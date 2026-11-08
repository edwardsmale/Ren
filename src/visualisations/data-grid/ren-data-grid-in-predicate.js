/**
 * Writes a SQL Server IN predicate for the cells selected in one column of a data grid, ready to
 * be pasted into a WHERE clause, and shows it in a popup with a button that copies it to the
 * clipboard.
 *
 * The identifiers and the values are written by Ren.DataGridSqlPopup, so a currency column
 * contributes bare numbers rather than "£101.99" and an enum column the integers behind its
 * labels.
 */
Ren.DataGridInPredicate = (() => {

    // The width the value list is wrapped at, past which it is written over several lines rather
    // than one that runs off to the right.
    const MAX_SINGLE_LINE_LENGTH = 100;

    /**
     * The literals to list, one for each distinct value among the selected cells, in the order the
     * grid shows them.
     *
     * A value the grid shows more than once is listed once, since a second copy of it would say
     * nothing the first did not.  NULLs are left out altogether: SQL Server compares them to
     * nothing, so a NULL in the list would only mislead whoever reads the predicate.
     */
    const getValueLiterals = (tabularData, columnIndex, values) => {

        const sqlPopup = Ren.DataGridSqlPopup;
        const columnModel = tabularData.ColumnModels[columnIndex];

        const literals = new Set();

        for (let index = 0; index < values.length; index++) {

            const value = values[index];

            if (Ren.IsNull(value)) continue;

            literals.add(sqlPopup.getValueLiteral(value, columnModel));
        }

        return Array.from(literals);
    };

    /**
     * Writes the predicate: the column's name, IN, and the selected values in brackets.
     *
     * @param {object} tabularData - The grid's data.
     * @param {number} columnIndex - The SQL index of the column the selected cells stand in.
     * @param {Array} values - The raw values of the selected cells, in the order the grid shows
     * them.
     */
    const buildSql = (tabularData, columnIndex, values) => {

        const sqlPopup = Ren.DataGridSqlPopup;

        const columnName = sqlPopup.escapeIdentifier(tabularData.ColumnModels[columnIndex].Heading);

        const literals = getValueLiterals(tabularData, columnIndex, values);

        if (!literals.length) {

            return "-- None of the selected cells holds a value.";
        }

        const singleLine = columnName + " IN (" + literals.join(", ") + ")";

        if (singleLine.length <= MAX_SINGLE_LINE_LENGTH) return singleLine;

        return [
            columnName + " IN (",
            sqlPopup.joinWrapped(literals, "    "),
            ")"
        ].join("\n");
    };

    /**
     * Shows the IN predicate for the selected cells of the given column.
     *
     * @param {object} tabularData - The grid's data.
     * @param {number} columnIndex - The SQL index of the column the selected cells stand in.
     * @param {Array} values - The raw values of the selected cells, in the order the grid shows
     * them.
     */
    const show = (tabularData, columnIndex, values) => {

        return Ren.DataGridSqlPopup.show({
            id: "data-grid-in-predicate-popup",
            title: "IN predicate",
            // Wide enough for the width the value list is wrapped at, so that a line of it is never
            // long enough to have to be scrolled to.
            width: 760,
            height: 360,
            getSql: () => buildSql(tabularData, columnIndex, values)
        });
    };

    return {
        buildSql,
        show
    };
})();
