/**
 * Negative column value filters: columns listed in their filter set's negatedColumns, whose filter
 * names the values to leave out rather than the only values to keep.  Unlike a positive filter, it
 * survives its data source growing, as a value added afterwards is shown rather than silently
 * filtered away.  An empty negative list is no filter at all.
 * A filter is only ever resolved to the positive list it currently amounts to for reading; storing
 * that would freeze it again.
 */
Ren.FilterNegation = (() => {

    const EMPTY_SET = new Set();

    /**
     * Gets the negated columns held by a tab's filter entry, as a Set.
     */
    const getNegatedColumnSetFromTabFilters = (tabFilters) => {

        const negatedColumns = tabFilters?.negatedColumns;

        if (!Array.isArray(negatedColumns) || negatedColumns.length === 0) return EMPTY_SET;

        return new Set(negatedColumns);
    };

    /**
     * Gets the negated columns of a filter set parent, as a Set.  Read straight off the filter set,
     * as the accessors' getters would leave an empty filter set behind on every grouping rendered.
     */
    const getNegatedColumnSet = (filterSetParent, tabularData) =>
        getNegatedColumnSetFromTabFilters(filterSetParent?.filterSet?.[tabularData.Title]);

    const isNegatedColumn = (filterSetParent, tabularData, columnIdOrHeading) =>
        getNegatedColumnSet(filterSetParent, tabularData).has(columnIdOrHeading);

    /**
     * Gets the values a negative filter currently allows: every value the column holds in the data,
     * less the excluded ones.  A snapshot, so used to read a filter and never to store one.
     */
    const toInclusionValues = (tabularData, columnIdOrHeading, excludedValues) => {

        const columnIndex = tabularData?.columnResolver?.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null || columnIndex === undefined) return null;

        const distinctValues = Ren.DataGroupingSettings_Services_HasFilter
            .getDistinctFilterValueSet(tabularData, columnIndex);

        const excludedSet = new Set();

        for (let i = 0; i < (excludedValues?.length ?? 0); i++) {

            const excludedValue = excludedValues[i];

            excludedSet.add(excludedValue == null ? Ren.NullSentinel : String(excludedValue));
        }

        const includedValues = [];

        distinctValues.forEach((value) => {

            if (!excludedSet.has(value)) includedValues.push(value);
        });

        return includedValues;
    };

    /**
     * Gets the exclusion list that leaves exactly the given values showing, for storing a selection
     * made in inclusion terms (a filter module's ticks) against a negated column.
     */
    const toExclusionValues = (tabularData, columnIdOrHeading, includedValues) => {

        const columnIndex = tabularData?.columnResolver?.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null || columnIndex === undefined) return null;

        const distinctValues = Ren.DataGroupingSettings_Services_HasFilter
            .getDistinctFilterValueSet(tabularData, columnIndex);

        const includedSet = new Set();

        for (let i = 0; i < (includedValues?.length ?? 0); i++) {

            const includedValue = includedValues[i];

            includedSet.add(includedValue == null ? Ren.NullSentinel : String(includedValue));
        }

        const excludedValues = [];

        distinctValues.forEach((value) => {

            if (!includedSet.has(value)) excludedValues.push(value);
        });

        return excludedValues;
    };

    /**
     * Gets a tab's column value filters as a positive map, with every negated column's list
     * replaced by the values it currently allows.  Returns the object given where no column is
     * negated.
     */
    const toInclusionColumnValueFilters = (tabularData, columnValueFilters, negatedColumnSet) => {

        if (!columnValueFilters || !negatedColumnSet || negatedColumnSet.size === 0) {
            return columnValueFilters;
        }

        const normalised = {};

        for (const columnIdOrHeading in columnValueFilters) {

            const filterValues = columnValueFilters[columnIdOrHeading];

            if (!negatedColumnSet.has(columnIdOrHeading)) {

                normalised[columnIdOrHeading] = filterValues;
                continue;
            }

            // An empty exclusion list is no filter, so the column is left out rather than listing
            // every value.
            if (!Array.isArray(filterValues) || filterValues.length === 0) continue;

            const includedValues = toInclusionValues(tabularData, columnIdOrHeading, filterValues);

            if (includedValues) normalised[columnIdOrHeading] = includedValues;
        }

        return normalised;
    };

    /**
     * Gets a filter set parent's column value filters as a positive map.
     */
    const toInclusionColumnValueFiltersOf = (tabularData, filterSetParent) => {

        const tabFilters = filterSetParent?.filterSet?.[tabularData.Title];

        return toInclusionColumnValueFilters(
            tabularData,
            tabFilters?.columnValueFilters ?? null,
            getNegatedColumnSetFromTabFilters(tabFilters)
        );
    };

    /**
     * Gets a (value) => passes check for one column's filter, honouring its negation.  The value
     * tested is already normalised to a string ("" for blank).  Built once and reused across a
     * level's groups, as a binned grouping filter lists every raw value its bins cover, and
     * scanning that list once per group froze the page.
     */
    const createValueMatcher = (filterValues, isNegated) => {

        const listedValues = new Set();

        for (let i = 0; i < filterValues.length; i++) {

            const filterValue = filterValues[i];

            listedValues.add((filterValue == null || filterValue === "") ? "" : String(filterValue));
        }

        return (value) => listedValues.has(value) !== isNegated;
    };

    return {
        getNegatedColumnSet,
        getNegatedColumnSetFromTabFilters,
        isNegatedColumn,
        toInclusionValues,
        toExclusionValues,
        toInclusionColumnValueFilters,
        toInclusionColumnValueFiltersOf,
        createValueMatcher
    };
})();
