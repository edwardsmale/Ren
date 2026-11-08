/**
 * Converts column IDs and headings to column indexes, and vice versa.
 */
Ren.DataGridColumnResolver = (tabularData) => {

    const columnHeadings = [];
    const columnIds = [];
    const columnIdOrHeadings = [];
    const columnIdToIndex = {};
    const columnHeadingToIndex = {};

    // Build arrays and lookup maps.
    for (let i = 0; i < tabularData.ColumnModels.length; i++) {

        const model = tabularData.ColumnModels[i];
        const heading = model.Heading;
        const id = model.ColumnId;
        const idOrHeading = model.ColumnIdOrHeading;

        columnHeadings.push(heading);
        columnIds.push(id);
        columnIdOrHeadings.push(idOrHeading);

        if (id != null) columnIdToIndex[id] = i;
        if (heading != null) columnHeadingToIndex[heading] = i;
    }

    const getColumnIndex = (column) => {

        if (column == null) return null;
        if (typeof column === "number") return column;
        if (columnIdToIndex[column] !== undefined) return columnIdToIndex[column];
        if (columnHeadingToIndex[column] !== undefined) return columnHeadingToIndex[column];
        return null;
    };

    const getColumnIndexes = (columns) => {

        // Accepts Array or Set
        if (!Array.isArray(columns)) columns = Array.from(columns);
        return columns.map(getColumnIndex);
    };

    /**
     * Resolves a column identifier to a column index.  Accepts column index (number), column ID,
     * or column heading.  This is a convenience wrapper around getColumnIndex that handles the
     * common pattern of "if it's already a number, use it; otherwise resolve it".
     */
    const resolveColumn = (columnIdOrHeadingOrIndex) => {

        return typeof columnIdOrHeadingOrIndex === "number"
            ? columnIdOrHeadingOrIndex
            : getColumnIndex(columnIdOrHeadingOrIndex);
    };

    /**
     * Resolves an array of column identifiers to column indexes.
     */
    const resolveColumns = (columns) => {

        if (!Array.isArray(columns)) columns = Array.from(columns);
        return columns.map(resolveColumn);
    };

    const getFirstNotAutoAddedColumnIndex = () =>
        columnIdOrHeadings.findIndex(val => val && !val.includes("__"));

    const getColumnIdsOrHeadings = (columnIndexes) => {

        if (columnIndexes === undefined) {
            return columnIdOrHeadings.slice();
        }

        return columnIndexes.map(index => columnIdOrHeadings[index]);
    };

    const getColumnIdOrHeading = (columnIndex) => columnIdOrHeadings[columnIndex];
    const getColumnHeading = (columnIndex) => columnHeadings[columnIndex];

    return {
        getColumnIndex,
        getColumnIndexes,
        resolveColumn,
        resolveColumns,
        getFirstNotAutoAddedColumnIndex,
        getColumnIdOrHeading,
        getColumnIdsOrHeadings,
        getColumnHeading
    };
};
