/**
 * Converts the columns-and-rows shape, { columns: ["A", "B"], rows: [[1, "x"], [2, "y"]] }, into a
 * Ren tabular data set collection.  The column types are inferred as for an array of objects,
 * except where a column is given as a hint rather than a name - see Ren.DataSourceColumnHints.
 */
Ren.DataSourcesAdapter_ColumnsAndRows = (() => {

    /**
     * Gets a value indicating whether a parsed response is in the columns-and-rows shape.  Rows
     * that are objects make it an array of objects with column hints instead.
     */
    const isColumnsAndRows = (parsedJson) =>
        !!parsedJson && !Array.isArray(parsedJson) &&
        Array.isArray(parsedJson.columns) && Array.isArray(parsedJson.rows) &&
        (parsedJson.rows.length === 0 || Array.isArray(parsedJson.rows[0]));

    const adaptColumnsAndRows = (columnsAndRows, dataSourceUri, tabularDataTitle) => {

        const columns = Ren.DataSourceColumnHints.read(columnsAndRows.columns);
        const names = columns.names;
        const rows = columnsAndRows.rows;

        for (let index = 0; index < names.length; index++) {

            if (names.indexOf(names[index]) !== index) {
                throw new Error(`The column "${names[index]}" is named more than once.`);
            }
        }

        const arrayOfObjects = [];

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {

            const row = rows[rowIndex];

            if (!Array.isArray(row) || row.length !== names.length) {
                throw new Error(`Row ${rowIndex} does not have one value for each column.`);
            }

            const rowObject = {};

            for (let index = 0; index < names.length; index++) {
                rowObject[names[index]] = row[index] === undefined ? null : row[index];
            }

            arrayOfObjects.push(rowObject);
        }

        return Ren.DataSourcesAdapter_ArrayOfObjects.adaptArrayOfObjects(
            arrayOfObjects,
            dataSourceUri,
            tabularDataTitle,
            columns.hints,
            names
        );
    };

    return {
        adaptColumnsAndRows,
        isColumnsAndRows
    };
})();
