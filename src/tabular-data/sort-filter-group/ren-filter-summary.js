/**
 * Describes filters, as Ren.DateValueChart_DataPointGrid gathers them, in words: one entry per
 * column or hierarchy filtered, such as "Category: Paper; Gel Pens".  A hierarchy's filter
 * names the shallowest nodes it states, each by its own name without those above it, so a whole
 * branch reads as its own name.
 *
 * An entry is headed as the filter module setting it heads its item, where one is given, and
 * otherwise by its column's heading.
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

    const createPart = (text, isValue) => ({ text, isValue });

    const joinParts = (parts) => parts.map(part => part.text).join("");

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

    const describeColumnFilter = (getHeading, column, columnFilter, maxValues) => {

        const labels = [];

        columnFilter.valueMap.forEach((value) => labels.push(getValueLabel(value)));

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

            entries.push(parts);
        });

        return entries;
    };

    /**
     * Gets the headings the filter modules filtering any of the settings groups give their items,
     * keyed by column.  The first module to give a column one wins.
     */
    const getFilterModuleHeadings = (settingsGroups) => {

        const headings = {};
        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < visualisations.length; index++) {

            const visualisation = visualisations[index];

            if (visualisation.isDestroyed) continue;

            if (!settingsGroups.includes(visualisation.sourceDataGroupingSettingsGroup)) continue;

            const columnOverrides = visualisation.columnOverrides ?? {};
            const columns = Object.keys(columnOverrides);

            for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {

                const column = columns[columnIndex];
                const heading = columnOverrides[column]?.HeadingOverride;

                if (heading && headings[column] === undefined) headings[column] = heading;
            }
        }

        return headings;
    };

    // Gets each entry as its parts.
    const getEntryParts = (filters, tabularData, maxValues, headings) => {

        const entries = [];

        if (!filters || !tabularData) return entries;

        const getHeading = (column) => headings?.[column] || getColumnHeading(tabularData, column);

        filters.columnFilters?.forEach((columnFilter, column) =>
            entries.push(describeColumnFilter(getHeading, column, columnFilter, maxValues)));

        const comparePredicates = [];
        const predicates = filters.predicates ?? [];

        for (let index = 0; index < predicates.length; index++) {

            const predicate = predicates[index];

            switch (predicate?.type) {

                case "includeCombinations":
                case "excludeCombinations": {

                    const entry = describeCombinations(getHeading, predicate, maxValues);

                    if (entry) entries.push(entry);
                    break;
                }

                case "compare":
                    comparePredicates.push(predicate);
                    break;

                case "function":
                    entries.push([createPart("Custom filter", false)]);
                    break;

                case "includeRowIndexes":
                    entries.push([createPart("Chosen rows", false)]);
                    break;
            }
        }

        return entries.concat(describeComparePredicates(getHeading, comparePredicates));
    };

    /**
     * Gets the filters' entries, each naming at most maxValues values where it is given.  Headings
     * holds the headings to give columns in place of their own, keyed by column.
     */
    const getEntries = (filters, tabularData, maxValues, headings) =>
        getEntryParts(filters, tabularData, maxValues, headings).map(joinParts);

    /**
     * Gets the filters in words as parts, { text, isValue }, which flag the values named so that
     * they can be shown apart from the words around them.  Empty where nothing is filtered.
     */
    const getParts = (filters, tabularData, maxValues, headings) => {

        const entries = getEntryParts(filters, tabularData, maxValues, headings);
        const parts = [];

        for (let index = 0; index < entries.length; index++) {

            if (index) parts.push(createPart(ENTRY_SEPARATOR, false));

            const entryParts = entries[index];

            for (let partIndex = 0; partIndex < entryParts.length; partIndex++) {
                parts.push(entryParts[partIndex]);
            }
        }

        return parts;
    };

    /**
     * Gets the filters in words, or "" where nothing is filtered.
     */
    const getText = (filters, tabularData, maxValues, headings) =>
        joinParts(getParts(filters, tabularData, maxValues, headings));

    return {
        getEntries,
        getFilterModuleHeadings,
        getParts,
        getText
    };
})();
