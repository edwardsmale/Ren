/**
 * Describes filters, as Ren.DateValueChart_DataPointGrid gathers them, in words: one entry per
 * column or hierarchy filtered, such as "Category: Paper; Gel Pens".  A hierarchy's filter
 * names the shallowest nodes it states, each by its own name without those above it, so a whole
 * branch reads as its own name.
 *
 * An entry is headed as the filter module setting it heads its item, where one is given, and
 * otherwise by its column's heading.  A Boolean column's values read as Yes and No, and where its
 * item is shown as a "Yes or both" checkbox, ticked, the entry is the heading alone.
 */
Ren.FilterSummary = (() => {

    const VALUE_SEPARATOR = "; ";
    const ENTRY_SEPARATOR = "  |  ";

    const getColumnHeading = (tabularData, column) => {

        const columnIndex = tabularData.columnResolver?.getColumnIndex(column);

        if (columnIndex == null) return String(column);

        return tabularData.columnResolver.getColumnHeading(columnIndex) ?? String(column);
    };

    const getValueLabel = (value) => String(Ren.ValueDisplayLabel(value ?? Ren.NullSentinel));

    const isYesValue = (value) => {

        const text = String(value).toLowerCase();

        return text === "1" || text === "true";
    };

    const isNoValue = (value) => {

        const text = String(value).toLowerCase();

        return text === "0" || text === "false";
    };

    const getBooleanValueLabel = (value) => {

        if (isYesValue(value)) return "Yes";

        if (isNoValue(value)) return "No";

        return getValueLabel(value);
    };

    const isBooleanColumn = (tabularData, column) => {

        const columnIndex = tabularData.columnResolver?.getColumnIndex(column);

        if (columnIndex == null) return false;

        return tabularData.ColumnModels?.[columnIndex]?.ColumnFormat
            === Ren.SpreadsheetColumnFormatEnum.Boolean;
    };

    // Gets a value indicating whether a Boolean column's filter lets its "Yes" rows alone through,
    // which is what ticks a filter module's checkbox for it.
    const isYesOnlyFilter = (columnFilter) => {

        const values = Array.from(columnFilter.valueMap.values());

        if (!values.length) return false;

        return columnFilter.isNegated ? values.every(isNoValue) : values.every(isYesValue);
    };

    const createPart = (text, isValue) => ({ text, isValue });

    const joinParts = (parts) => parts.map(part => part.text).join("");

    // An entry, with the column it names where it names a column's values.
    const createEntry = (parts, column = null) => ({ parts, column });

    // Names the values, counting those past maxValues rather than naming them.
    const describeValues = (heading, labels, isNegated, maxValues) => {

        const parts = [createPart(`${heading}: ${isNegated ? "not " : ""}`, false)];

        if (!labels.length) {

            parts.push(createPart("none", false));
            return parts;
        }

        const shownCount = maxValues && labels.length > maxValues ? maxValues : labels.length;

        for (let index = 0; index < shownCount; index++) {

            if (index) parts.push(createPart(VALUE_SEPARATOR, false));

            parts.push(createPart(labels[index], true));
        }

        if (shownCount < labels.length) {
            parts.push(createPart(` and ${labels.length - shownCount} more`, false));
        }

        return parts;
    };

    const describeColumnFilter = (
        getHeading, getShowAsCheckbox, tabularData, column, columnFilter, maxValues) => {

        const isBoolean = isBooleanColumn(tabularData, column);

        if (isBoolean && getShowAsCheckbox(column) === "YesOrBoth" && isYesOnlyFilter(columnFilter)) {
            return [createPart(getHeading(column), false)];
        }

        const labels = [];
        const getLabel = isBoolean ? getBooleanValueLabel : getValueLabel;

        columnFilter.valueMap.forEach((value) => labels.push(getLabel(value)));

        return describeValues(getHeading(column), labels, columnFilter.isNegated, maxValues);
    };

    // A hierarchy is headed by its top level, as a filter module heads its item.
    const describeCombinations = (getHeading, predicate, maxValues) => {

        const columns = predicate.columns ?? [];
        const tuples = predicate.tuples ?? [];

        if (!columns.length) return null;

        const labels = tuples.map(tuple => getValueLabel(tuple[tuple.length - 1]));

        return describeValues(
            getHeading(columns[0]),
            labels,
            predicate.type === "excludeCombinations",
            maxValues
        );
    };

    const getOrGroupKey = (predicate) =>
        predicate.column + "|" + Ren.FilterCompareOperators.orGroupLeadOf(predicate);

    // Compare filters on a column joined by OR read as one entry.
    const describeComparePredicates = (getHeading, predicates) => {

        const groups = new Map();

        for (let index = 0; index < predicates.length; index++) {

            const predicate = predicates[index];
            const text = Ren.FilterCompareOperators.summarise(predicate);

            if (!text) continue;

            const key = getOrGroupKey(predicate);

            if (!groups.has(key)) groups.set(key, { column: predicate.column, texts: [] });

            groups.get(key).texts.push(text);
        }

        const entries = [];

        groups.forEach((group) => {

            const parts = [createPart(getHeading(group.column) + " ", false)];

            for (let index = 0; index < group.texts.length; index++) {

                if (index) parts.push(createPart(" or ", false));

                parts.push(createPart(group.texts[index], true));
            }

            entries.push(createEntry(parts));
        });

        return entries;
    };

    /**
     * Gets the settings the filter modules filtering any of the settings groups give their items
     * that bear on the summary, as { heading, showAsCheckbox }, keyed by column.  The first module
     * to give a column each setting wins.
     */
    const getFilterModuleItemSettings = (settingsGroups) => {

        const itemSettings = {};
        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < visualisations.length; index++) {

            const visualisation = visualisations[index];

            if (visualisation.isDestroyed) continue;

            if (!settingsGroups.includes(visualisation.sourceDataGroupingSettingsGroup)) continue;

            const columnOverrides = visualisation.columnOverrides ?? {};
            const columns = Object.keys(columnOverrides);

            for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {

                const column = columns[columnIndex];
                const override = columnOverrides[column];
                const settings = itemSettings[column] ?? (itemSettings[column] = {});

                if (override?.HeadingOverride && settings.heading === undefined) {
                    settings.heading = override.HeadingOverride;
                }

                if (override?.showAsCheckbox && settings.showAsCheckbox === undefined) {
                    settings.showAsCheckbox = override.showAsCheckbox;
                }
            }
        }

        return itemSettings;
    };

    // Gets each entry, as { parts, column }.
    const getEntryParts = (filters, tabularData, maxValues, itemSettings) => {

        const entries = [];

        if (!filters || !tabularData) return entries;

        const getHeading = (column) =>
            itemSettings?.[column]?.heading || getColumnHeading(tabularData, column);

        const getShowAsCheckbox = (column) => itemSettings?.[column]?.showAsCheckbox ?? "Off";

        filters.columnFilters?.forEach((columnFilter, column) => entries.push(createEntry(
            describeColumnFilter(
                getHeading,
                getShowAsCheckbox,
                tabularData,
                column,
                columnFilter,
                maxValues
            ),
            column
        )));

        const comparePredicates = [];
        const predicates = filters.predicates ?? [];

        for (let index = 0; index < predicates.length; index++) {

            const predicate = predicates[index];

            switch (predicate?.type) {

                case "includeCombinations":
                case "excludeCombinations": {

                    const entry = describeCombinations(getHeading, predicate, maxValues);

                    if (entry) entries.push(createEntry(entry));
                    break;
                }

                case "compare":
                    comparePredicates.push(predicate);
                    break;

                case "function":
                    entries.push(createEntry([createPart("Custom filter", false)]));
                    break;

                case "includeRowIndexes":
                    entries.push(createEntry([createPart("Chosen rows", false)]));
                    break;
            }
        }

        return entries.concat(describeComparePredicates(getHeading, comparePredicates));
    };

    /**
     * Gets the filters' entries, each naming at most maxValues values where it is given.  Item
     * settings holds, keyed by column, the filter module settings of getFilterModuleItemSettings:
     * the heading to give a column in place of its own, and how it is shown as a checkbox.
     */
    const getEntries = (filters, tabularData, maxValues, itemSettings) =>
        getEntryParts(filters, tabularData, maxValues, itemSettings)
            .map(entry => joinParts(entry.parts));

    /**
     * Gets the filters in words as parts, { text, isValue }, which flag the values named so that
     * they can be shown apart from the words around them.  Empty where nothing is filtered.
     *
     * The entries of the columns in leadingColumns, a set, where it is given, come first, and each
     * of their parts carries its column as column, so that they can be shown apart from the rest.
     */
    const getParts = (filters, tabularData, maxValues, itemSettings, leadingColumns) => {

        const entries = getEntryParts(filters, tabularData, maxValues, itemSettings);
        const isLeading = (entry) => entry.column != null && !!leadingColumns?.has(entry.column);
        const ordered = entries.filter(isLeading).concat(entries.filter(entry => !isLeading(entry)));
        const parts = [];

        for (let index = 0; index < ordered.length; index++) {

            if (index) parts.push(createPart(ENTRY_SEPARATOR, false));

            const entry = ordered[index];
            const entryParts = entry.parts;

            for (let partIndex = 0; partIndex < entryParts.length; partIndex++) {

                parts.push(isLeading(entry)
                    ? Object.assign({}, entryParts[partIndex], { column: entry.column })
                    : entryParts[partIndex]);
            }
        }

        return parts;
    };

    /**
     * Gets the filters in words, or "" where nothing is filtered.
     */
    const getText = (filters, tabularData, maxValues, itemSettings) =>
        joinParts(getParts(filters, tabularData, maxValues, itemSettings));

    return {
        getEntries,
        getFilterModuleItemSettings,
        getParts,
        getText
    };
})();
