/**
 * Derived data grouping settings: a private settings object a visualisation builds over its
 * source's data to work something out for itself — an option's row count, an item's total, a
 * chart's points per month — rather than to show the data as it stands.
 *
 * They are never added to the shared collection, so nothing else can find them, no event announces
 * them, and grouping or filtering one leaves every other visualisation untouched.
 *
 *     const settings = Ren.DerivedDataGroupingSettings.create({
 *         tabularData,
 *         visualisation,
 *         sourceSettings: getSourceDataGroupingSettings(),
 *         namePrefix: "filter-module-counts",
 *         prepare: (settings) => applyCrossFilter(settings),   // before the groupings are applied
 *         entries: [{ groupByColumns: ["Region"], columns }],
 *         totalColumns                                         // the outermost totals grouping
 *     });
 *
 * The totals grouping is declared explicitly so that it carries an aggregation and its single group
 * can be read back as the grand total.  Pass totalColumns as an empty object for a totals grouping
 * that aggregates nothing, or leave it out for no totals grouping at all.
 *
 * The readers below take either a settings object built here or a plain { groupings: { entries } }
 * literal; only the readers that walk the built groups need real settings.
 */
Ren.DerivedDataGroupingSettings = (() => {

    /**
     * The indexes of the columns the entries declare an aggregation for.  Every other column is
     * left unaggregated, which on a wide data source is most of the cost, so a column a calc
     * function reads has to be declared alongside the column it computes.
     */
    const resolveAggregatedColumnIndexes = (tabularData, entries) => {

        const columnIndexes = new Set();

        for (let i = 0; i < entries.length; i++) {

            const columns = entries[i].columns;

            for (const key in columns) {

                const columnIndex = tabularData.columnResolver.getColumnIndex(key);

                if (columnIndex >= 0) columnIndexes.add(columnIndex);
            }
        }

        return columnIndexes;
    };

    /**
     * Builds a private data grouping settings over the same data as the source, optionally prepared
     * (filters applied directly on its data rows) and grouped.
     */
    const create = (config) => {

        const sourceSettings = config.sourceSettings;

        const settings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
            config.tabularData,
            {
                dataGroupingSettingsGroup: Ren.RandomUtils.generateRandomClassName(config.namePrefix),
                dataSourceUri: sourceSettings?.dataSourceUri,
                sqlFilename: sourceSettings?.sqlFilename,
                visualisationGuid: config.visualisation?.visualisationGuid
            },
            new Set(),
            false // Do not add to the shared collection; this is a private, derived computation.
        );

        // Any filtering is applied before the groupings, and directly on the data rows rather than
        // through sortFilterGroup, so no filter-changed event fires for a private computation.
        if (config.prepare) config.prepare(settings);

        if (!config.entries) return settings;

        const entries = config.entries.slice();

        if (config.totalColumns) entries.push({ groupByColumns: [], columns: config.totalColumns });

        settings.aggregatedColumnIndexes = resolveAggregatedColumnIndexes(config.tabularData, entries);

        settings.sortFilterGroup.applyGroupings({ entries });

        return settings;
    };

    /**
     * Releases settings that are no longer used.  Their summary stats' change listener would
     * otherwise hold them, and the whole-dataset groupings within them, for the life of the page.
     */
    const release = (settings) => settings?.summaryStats?.dispose?.();

    /**
     * A build-once cache of derived settings, keyed by whatever they were derived for: build on
     * first ask, drop (and release) one key or all of them.
     *
     * getKey turns the argument into its cache key; omit it where the argument is the key itself.
     */
    const createCache = (build, getKey) => {

        const settingsByKey = new Map();

        const keyOf = (argument) => getKey ? getKey(argument) : argument;

        const get = (argument) => {

            const key = keyOf(argument);

            let settings = settingsByKey.get(key);

            if (!settings) {

                settings = build(argument);
                settingsByKey.set(key, settings);
            }

            return settings;
        };

        const invalidate = (argument) => {

            const key = keyOf(argument);

            release(settingsByKey.get(key));
            settingsByKey.delete(key);
        };

        const invalidateAll = () => {

            settingsByKey.forEach(release);
            settingsByKey.clear();
        };

        return {
            get,
            invalidate,
            invalidateAll
        };
    };

    const getEntries = (settings) => settings?.groupings?.entries ?? null;

    /**
     * Gets the innermost entry that actually groups by something: the first with group-by columns.
     * The entries that follow it are its parent levels, ending in the outermost totals grouping.
     */
    const getInnermostGroupByEntry = (settings) => {

        const entries = getEntries(settings);

        if (!entries) return null;

        for (let i = 0; i < entries.length; i++) {

            const entry = entries[i];

            if (entry.groupByColumnIndexes && entry.groupByColumnIndexes.length > 0) return entry;
        }

        return null;
    };

    /**
     * Gets the name of the calc function an entry bins its group-by value with (e.g.
     * date-month-start), or null where it groups by the raw value.
     */
    const getGroupByCalcFunctionName = (entry) => {

        const specification = entry?.groupByCalcFunctions?.[0];

        if (!specification) return null;

        return typeof specification === "string" ? specification : specification.name ?? null;
    };

    // Gets the grand-total grouping declared by create, and its single group, which holds every
    // (surviving) row.
    const getTotalsGrouping = (settings) => settings?.groupings?.lastGrouping() ?? null;

    const getTotalsGroup = (settings) => getTotalsGrouping(settings)?.firstGroup() ?? null;

    // Gets the grouping whose groups are the values that were grouped by: the outermost level below
    // the totals grouping.
    const getValuesGrouping = (settings) => settings?.groupings?.secondToLastGrouping() ?? null;

    /**
     * Reads a column's aggregated value from the grand-total group: the value derived across every
     * row the settings still hold.  Null when there is no totals group to read.
     */
    const readTotalValue = (settings, tabularData, valueColumnIndex) => {

        const totalsGroup = getTotalsGroup(settings);

        if (!totalsGroup) return null;

        return tabularData.CompressionDictionary.decompressValue(
            totalsGroup.groupValues.get(totalsGroup.position, valueColumnIndex),
            valueColumnIndex
        );
    };

    /**
     * A group's value in the column it was grouped by.  groupByColumnValues holds a raw value from
     * the data, which where the entry bins its group-by column is one of the values in the bin
     * rather than the bin itself.
     *
     * deriveValue is the function the entry bins that column with; omit it to read the raw value.
     * The bin is derived from the raw value rather than read from the group's row values, because a
     * bin that is not a string is stored there uncompressed and would be misread through the
     * compression dictionary.
     */
    const readGroupByValue = (group, tabularData, groupByColumnIndex, deriveValue) => {

        const value = tabularData.CompressionDictionary.decompressValue(
            group.groupByColumnValues[0],
            groupByColumnIndex
        );

        return deriveValue ? deriveValue(value) : value;
    };

    /**
     * The distinct values a settings' values grouping grouped by, in group order.  Read from the
     * groups themselves, so a binned grouping (deriveValue) yields its bins rather than the raw
     * values beneath them.
     */
    const readGroupByValues = (settings, tabularData, groupByColumnIndex, deriveValue) => {

        const values = [];
        const grouping = getValuesGrouping(settings);

        if (!grouping) return values;

        grouping.groups().forEach((group) => {

            values.push(readGroupByValue(group, tabularData, groupByColumnIndex, deriveValue));
        });

        return values;
    };

    /**
     * Reads a map from each distinct grouped-by value (as a string) to the aggregated value of the
     * given column, over the values grouping.  Empty when the settings have no groups or the
     * aggregated column does not exist. deriveValue reads a binned grouping's own (binned) values -
     * see readGroupByValue.
     */
    const readAggregatedValuesByGroupValue = (
        settings, tabularData, groupByColumnIndex, aggregatedColumnIndex, deriveValue
    ) => {

        const values = new Map();

        if (aggregatedColumnIndex == null || aggregatedColumnIndex < 0) return values;

        const grouping = getValuesGrouping(settings);

        if (!grouping) return values;

        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        grouping.groups().forEach((group) => {

            const value = readGroupByValue(group, tabularData, groupByColumnIndex, deriveValue);

            // Kept as the raw decompressed value (not coerced to a number) so non-numeric
            // aggregations such as SingleValue survive; sortAuto orders numbers and text alike.
            const aggregated = decompressValue(
                group.groupValues.get(group.position, aggregatedColumnIndex),
                aggregatedColumnIndex
            );

            // A group of NULL rows is keyed by the sentinel rather than by "null", the value NULLs
            // are filtered on (see ren-filter.js), whether or not the column is compressed.
            values.set(value == null ? Ren.NullSentinel : String(value), aggregated);
        });

        return values;
    };

    return {
        create,
        createCache,
        release,
        getEntries,
        getInnermostGroupByEntry,
        getGroupByCalcFunctionName,
        getTotalsGrouping,
        getTotalsGroup,
        getValuesGrouping,
        readTotalValue,
        readGroupByValues,
        readAggregatedValuesByGroupValue
    };
})();
