/**
 * Finds a date/value chart's grouping entries by what they hold rather than where they sit.
 *
 * A chart's own dataGroupingSettings may group by a date column (an entry with a date calc
 * function), split the data by another column (an entry without one), both or neither, before
 * the empty outermost entry.  A chart without a date column is drawn as an all-time chart.
 *
 * The aggregation settings of the value columns (the entry's columns) live on the innermost
 * entry, whichever that is, so they move as entries are added and removed in front of them.
 */
Ren.DateValueChart_GroupingEntries = (() => {

    // What the rows of a chart without a date column are grouped under in place of a date: one
    // date, so every row falls in one all-time bin.  No column holds the control character, so it
    // never meets a column of the data.
    const NO_DATE_HEADING = "\u0001date";
    const NO_DATE_VALUE = "2000-01-01";

    const getEntries = (settings) => settings?.groupings?.entries ?? null;

    /**
     * Gets a value indicating whether an entry groups by a date: whether it bins by a date period
     * or puts every date in one group.
     */
    const isDateEntry = (entry) => {

        const calcFunctionName = Ren.DerivedDataGroupingSettings.getGroupByCalcFunctionName(entry);

        if (!calcFunctionName) return false;

        return Ren.DatePeriodDetector.getPeriodForCalcFunction(calcFunctionName) !== undefined
            || Ren.DateValueChart_GroupingApplyer.isAllTimeCalcFunction(calcFunctionName);
    };

    /**
     * Gets the entry that groups by the chart's date column, or null where it has none.
     */
    const getDateEntry = (settings) => {

        const entries = getEntries(settings);

        if (!entries) return null;

        for (let i = 0; i < entries.length; i++) {

            if (isDateEntry(entries[i])) return entries[i];
        }

        return null;
    };

    /**
     * Gets the entry the value columns' aggregation settings live on: the innermost one.
     */
    const getAggregationEntry = (settings) => getEntries(settings)?.[0] ?? null;

    /**
     * Inserts an entry, carrying the aggregation settings over to it where it becomes the
     * innermost entry.
     */
    const insertEntry = (settings, index, entry) => {

        const entries = getEntries(settings);

        if (index === 0 && entries.length > 0 && entries[0].columns) {

            entry.columns = entries[0].columns;
            delete entries[0].columns;
        }

        entries.splice(index, 0, entry);
    };

    /**
     * Removes an entry, handing its aggregation settings on to the entry that becomes the
     * innermost one where it was the innermost.
     */
    const removeEntry = (settings, entry) => {

        const entries = getEntries(settings);
        const index = entries.indexOf(entry);

        if (index === -1) return;

        entries.splice(index, 1);

        if (index === 0 && entry.columns && entries.length > 0) {

            entries[0].columns = entry.columns;
        }
    };

    /**
     * Gets the chart's date column, named as the rows are keyed - by column ID or heading - or
     * null where it has none or the column it names is no longer in the data.
     *
     * Settings written before the column was named hold an index alone, which is not to be relied
     * on, so where there is no name it is left to the caller to find the column.
     */
    const getDateColumnKey = (settings, columnResolver) => {

        const entry = getDateEntry(settings);
        const namedColumn = entry?.groupByColumns?.[0];

        if (!namedColumn) return null;

        if (!columnResolver) return namedColumn;

        const columnIndex = columnResolver.getColumnIndex(namedColumn);

        if (columnIndex == null) return null;

        // Keep the index the name resolves to, as the split entry does.
        entry.groupByColumnIndexes = [columnIndex];

        return columnResolver.getColumnIdOrHeading(columnIndex) ?? namedColumn;
    };

    /**
     * Groups the chart by the given column's dates, or by none when passed null, so that it is
     * drawn as an all-time chart.
     *
     * A chart that already has a date column keeps its period and any relative date range; an
     * absolute range named dates of the old column, so is dropped.  A chart gaining a date column
     * bins it by the calc function given.
     */
    const setDateColumn = (settings, columnIndex, columnResolver, calcFunctionName) => {

        const entries = getEntries(settings);

        if (!entries) return;

        const dateEntry = getDateEntry(settings);

        if (columnIndex == null) {

            if (dateEntry) removeEntry(settings, dateEntry);

            return;
        }

        const columnKey = columnResolver?.getColumnIdOrHeading(columnIndex);

        if (dateEntry) {

            dateEntry.groupByColumnIndexes = [columnIndex];

            if (columnKey) dateEntry.groupByColumns = [columnKey];

            const range = dateEntry.dateRange;

            if (range && !(range.lastPeriodCount > 0) && !range.preset) delete dateEntry.dateRange;

            return;
        }

        const entry = {
            groupByColumnIndexes: [columnIndex],
            groupByCalcFunctions: [{ name: calcFunctionName }]
        };

        if (columnKey) entry.groupByColumns = [columnKey];

        insertEntry(settings, 0, entry);
    };

    /**
     * Gets a value indicating whether an entry's column indexes can be rebuilt from its column
     * names: whether it names every column it indexes.
     */
    const canRebuildColumnIndexes = (entry) => {

        const indexes = entry.groupByColumnIndexes;
        const names = entry.groupByColumns;

        if (!Array.isArray(indexes) || !Array.isArray(names)) return false;
        if (indexes.length !== names.length) return false;

        for (let i = 0; i < names.length; i++) {

            if (typeof names[i] !== "string" || names[i] === "") return false;
        }

        return true;
    };

    /**
     * Gets a copy of the settings as they are saved: without the column indexes of the entries
     * that name their columns, as a column added to the query shifts every index after it.  An
     * entry grouping by nothing is saved as naming no columns.  Settings written before the
     * columns were named keep their indexes, which are all they have.  The indexes are rebuilt from
     * the names as the chart is drawn (see resolveColumnIndexes).
     */
    const getSettingsToSave = (settings) => {

        const settingsToSave = Ren.ObjectUtils.clone(settings);
        const entries = getEntries(settingsToSave);

        if (!entries) return settingsToSave;

        for (let i = 0; i < entries.length; i++) {

            const entry = entries[i];

            if (Array.isArray(entry.groupByColumnIndexes) &&
                entry.groupByColumnIndexes.length === 0 &&
                entry.groupByColumns === undefined) {

                entry.groupByColumns = [];
            }

            if (canRebuildColumnIndexes(entry)) delete entry.groupByColumnIndexes;
        }

        return settingsToSave;
    };

    /**
     * Sets the column indexes of each entry that names its columns to where those columns now
     * are, as the saved settings hold the names alone (see getSettingsToSave).  An entry naming a
     * column no longer in the data is left as it is, for its reader to drop.
     */
    const resolveColumnIndexes = (settings, columnResolver) => {

        const entries = getEntries(settings);

        if (!entries || !columnResolver) return;

        for (let i = 0; i < entries.length; i++) {

            const names = entries[i].groupByColumns;

            if (!Array.isArray(names)) continue;

            const indexes = new Array(names.length);
            let isResolved = true;

            for (let j = 0; j < names.length; j++) {

                indexes[j] = columnResolver.getColumnIndex(names[j]);

                if (indexes[j] == null) { isResolved = false; break; }
            }

            if (isResolved) entries[i].groupByColumnIndexes = indexes;
        }
    };

    return {
        NO_DATE_HEADING,
        NO_DATE_VALUE,
        isDateEntry,
        getDateEntry,
        getAggregationEntry,
        insertEntry,
        removeEntry,
        getDateColumnKey,
        setDateColumn,
        getSettingsToSave,
        resolveColumnIndexes
    };
})();
