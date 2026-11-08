/**
 * Applies a tab's filters to plain row objects keyed by heading: the row-object counterpart of the
 * grid's index-based compiled filter (see Ren.Filter), which must reach the same answer.  An empty
 * exclusion list is no filter at all, while an empty inclusion list keeps no row.
 */
Ren.RowObjectFilter = (() => {

    /**
     * Gets a value in the form the filters compare values in: its string, and "" for a blank.
     */
    const toValueString = (value) => (value == null || value === "") ? "" : String(value);

    /**
     * Compiles the columns a tab's column value filters constrain, each to a Set of allowed values
     * plus a coversEmpty flag, lifting the allowed-value scan out of the per-row loop.  Returns
     * null where a column's inclusion list is empty, which keeps no row.
     */
    const compileColumnValueFilters = (columnValueFilters, negatedColumns) => {

        const compiled = [];

        for (const columnIdOrHeading in columnValueFilters) {

            const filterValues = columnValueFilters[columnIdOrHeading];
            const isNegated = !!negatedColumns?.has(columnIdOrHeading);

            if (!Array.isArray(filterValues) || filterValues.length === 0) {

                // An exclusion of nothing is no filter; an inclusion of nothing keeps no row.
                if (isNegated) continue;

                return null;
            }

            const valueSet = new Set();
            let coversEmpty = false;

            for (let i = 0; i < filterValues.length; i++) {

                const filterValue = filterValues[i];

                if (filterValue == null || filterValue === "") {
                    coversEmpty = true;
                }
                else {

                    valueSet.add(String(filterValue));
                }
            }

            compiled.push({ key: columnIdOrHeading, valueSet, coversEmpty, isNegated });
        }

        return compiled;
    };

    /**
     * Gets a value indicating whether a row satisfies every one of the compiled column value
     * filters.
     */
    const rowMatchesColumnValueFilters = (row, compiled) => {

        for (let i = 0; i < compiled.length; i++) {

            const filter = compiled[i];
            const valueString = toValueString(row[filter.key]);

            const isListed = valueString === ""
                ? filter.coversEmpty
                : filter.valueSet.has(valueString);

            // A negated column lists the values to leave out.
            if (isListed === filter.isNegated) return false;
        }

        return true;
    };

    /**
     * Gets the rows that satisfy every column value filter, or the input array itself where no
     * column constrains anything.
     */
    const filterRowsByColumnValueFilters = (rows, columnValueFilters, negatedColumns) => {

        const compiled = compileColumnValueFilters(columnValueFilters, negatedColumns);

        if (compiled === null) return [];

        if (compiled.length === 0) return rows;

        const filteredRows = [];

        for (let i = 0; i < rows.length; i++) {

            if (rowMatchesColumnValueFilters(rows[i], compiled)) filteredRows.push(rows[i]);
        }

        return filteredRows;
    };

    /**
     * Gets the rows that survive a tab's row-filter predicates.  The whole set is passed to the
     * compiler so a top/bottom N compare operator has the column to rank within.
     */
    const filterRowsByRowFilterPredicates = (rows, predicates, paras) => {

        if (!Array.isArray(predicates) || predicates.length === 0) return rows;

        const isExcluded =
            Ren.FilterPredicates.compileRowObjectPredicates(predicates, rows, paras);

        if (!isExcluded) return rows;

        const filteredRows = [];

        for (let i = 0; i < rows.length; i++) {

            if (!isExcluded(rows[i])) filteredRows.push(rows[i]);
        }

        return filteredRows;
    };

    /**
     * Gets the rows one tab's filter entry keeps: its column value filters and row-filter
     * predicates, ANDed.
     */
    const filterRowsByTabFilters = (rows, tabFilters, paras) => {

        if (!tabFilters) return rows;

        const filteredRows = filterRowsByColumnValueFilters(
            rows,
            tabFilters.columnValueFilters,
            Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters)
        );

        return filterRowsByRowFilterPredicates(
            filteredRows,
            tabFilters.rowFilter?.predicates,
            paras
        );
    };

    /**
     * Gets the distinct values a column holds across a set of rows, in the form the filters compare
     * them in, and in row order.
     */
    const getDistinctValues = (rows, columnIdOrHeading) => {

        const values = new Set();

        for (let i = 0; i < rows.length; i++) {

            values.add(toValueString(rows[i][columnIdOrHeading]));
        }

        return Array.from(values);
    };

    return {
        toValueString,
        compileColumnValueFilters,
        rowMatchesColumnValueFilters,
        filterRowsByColumnValueFilters,
        filterRowsByRowFilterPredicates,
        filterRowsByTabFilters,
        getDistinctValues
    };
})();
