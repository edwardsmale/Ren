/**
 * Writes a SQL Server INSERT statement for the rows selected in a data grid, and shows it in a
 * popup with a button that copies the whole lot to the clipboard.
 */
Ren.DataGridInsertStatement = (() => {

    // SQL Server's table value constructor takes at most 1000 tuples, so a longer selection is
    // written as several INSERT statements rather than one that will not run.
    const MAX_ROWS_PER_STATEMENT = 1000;

    // Stands in for the table to insert into wherever the report's SQL doesn't say which table the
    // columns came from, or they came from more than one.
    const TABLE_NAME_PLACEHOLDER = "TableName";

    /**
     * Gets a value indicating whether a column is the table's identity, called exactly Id.  A named
     * key such as CustomerId is an ordinary value of the row.
     */
    const isIdColumn = (columnModel) => String(columnModel.Heading).trim().toLowerCase() === "id";

    const removeIdColumns = (tabularData, columnIndexes) => {

        const result = [];

        for (let index = 0; index < columnIndexes.length; index++) {

            if (isIdColumn(tabularData.ColumnModels[columnIndexes[index]])) continue;

            result.push(columnIndexes[index]);
        }

        return result;
    };

    const hasIdColumn = (tabularData, columnIndexes) =>
        removeIdColumns(tabularData, columnIndexes).length !== columnIndexes.length;

    /**
     * Gets the table the columns were selected from, or a placeholder where they don't agree or
     * none says.
     */
    const getTableName = (tabularData, columnIndexes) => {

        let tableName = null;

        for (let index = 0; index < columnIndexes.length; index++) {

            const sourceTableName = tabularData.ColumnModels[columnIndexes[index]].SourceTableName;

            if (!sourceTableName) continue;

            if (tableName === null) {

                tableName = sourceTableName;
            }
            else if (tableName !== sourceTableName) {

                return TABLE_NAME_PLACEHOLDER;
            }
        }

        return tableName === null
            ? TABLE_NAME_PLACEHOLDER
            : Ren.DataGridSqlPopup.escapeIdentifier(tableName);
    };

    const buildStatement = (tabularData, tableName, columnIndexes, rowIndexes) => {

        const sqlPopup = Ren.DataGridSqlPopup;

        const columnParts = new Array(columnIndexes.length);

        for (let index = 0; index < columnIndexes.length; index++) {

            columnParts[index] =
                sqlPopup.escapeIdentifier(tabularData.ColumnModels[columnIndexes[index]].Heading);
        }

        const lines = [
            "INSERT INTO " + tableName,
            "(",
            sqlPopup.joinWrapped(columnParts, "    "),
            ")",
            "VALUES"
        ];

        for (let rowNumber = 0; rowNumber < rowIndexes.length; rowNumber++) {

            const rowIndex = rowIndexes[rowNumber];
            const valueParts = new Array(columnIndexes.length);

            for (let index = 0; index < columnIndexes.length; index++) {

                const columnIndex = columnIndexes[index];

                valueParts[index] = sqlPopup.getValueLiteral(
                    sqlPopup.getCellValue(tabularData, rowIndex, columnIndex),
                    tabularData.ColumnModels[columnIndex]
                );
            }

            // Each row's values open on a line of their own, so that a row wide enough to wrap
            // still reads as one tuple.
            lines.push("    (");
            lines.push(sqlPopup.joinWrapped(valueParts, "        "));
            lines.push(rowNumber === rowIndexes.length - 1 ? "    );" : "    ),");
        }

        return lines.join("\n");
    };

    const buildSql = (tabularData, columnIndexes, rowIndexes) => {

        if (!columnIndexes.length || !rowIndexes.length) {

            return "-- There is nothing selected to insert.";
        }

        const tableName = getTableName(tabularData, columnIndexes);

        const statements = [];

        for (let start = 0; start < rowIndexes.length; start += MAX_ROWS_PER_STATEMENT) {

            statements.push(buildStatement(
                tabularData,
                tableName,
                columnIndexes,
                rowIndexes.slice(start, start + MAX_ROWS_PER_STATEMENT)
            ));
        }

        return statements.join("\n\n");
    };

    /**
     * Shows the INSERT statement for the given columns and data rows, each in display order.
     */
    const show = (tabularData, columnIndexes, rowIndexes) => {

        // Changes while the popup is open, as the Remove Id column button rewrites the statement.
        let insertedColumnIndexes = columnIndexes;

        return Ren.DataGridSqlPopup.show({
            id: "data-grid-insert-statement-popup",
            title: "INSERT statement",
            // Wide enough that no line of the wrapped statement has to be scrolled to.
            width: 760,
            height: 450,
            getSql: () => buildSql(tabularData, insertedColumnIndexes, rowIndexes),
            extraButton: {
                text: "Remove Id column",
                title: "Take the Id column out of the statement, so the database gives the new " +
                    "rows their own",
                isAvailable: () => hasIdColumn(tabularData, insertedColumnIndexes),
                click: () => {

                    insertedColumnIndexes = removeIdColumns(tabularData, insertedColumnIndexes);
                }
            }
        });
    };

    return {
        buildSql,
        show
    };
})();
