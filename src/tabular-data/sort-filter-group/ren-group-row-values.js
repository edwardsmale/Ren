/**
 * One grouping's group-row values, held as an array per column rather than per group, as most
 * columns of a group row are never aggregated and so need never be allocated.  A compressed column
 * is held in a dense Int32Array until it is written a value one cannot hold exactly (a null, or an
 * uninterned literal).  A group reads a value as:
 *
 *   group.groupValues.get(group.position, columnIndex)
 *
 * @param {Array} isColumnCompressed - tabularData.IsColumnCompressed.
 */
Ren.GroupRowValues = (columnCount, groupCount, isColumnCompressed) => {

    // One entry per column, left empty until a value is written to that column.
    const columns = new Array(columnCount);

    // Callers ask for the same group's row several times over, and some cache against its
    // identity, so the last row built is kept.
    let lastRowPosition = -1;
    let lastRow = null;

    /**
     * Copies a dense Int32Array column into a plain array.  Unwritten positions carry over as zero,
     * which is safe as each is written before anything reads it.
     */
    const promoteColumn = (columnIndex, column) => {

        const promoted = new Array(groupCount);

        for (let position = 0; position < groupCount; position++) {
            promoted[position] = column[position];
        }

        columns[columnIndex] = promoted;

        return promoted;
    };

    /**
     * Gets the value one group holds in one column, or "" where no group holds a value in it.
     */
    const get = (position, columnIndex) => {

        const column = columns[columnIndex];

        return column === undefined ? "" : column[position];
    };

    const set = (position, columnIndex, value) => {

        let column = columns[columnIndex];

        if (column === undefined) {

            column = isColumnCompressed?.[columnIndex]
                ? new Int32Array(groupCount)
                : new Array(groupCount);

            columns[columnIndex] = column;
        }

        if (column instanceof Int32Array) {

            // (value | 0) === value is true only for integers within the Int32 range, which every
            // dictionary index is.
            if (typeof value !== "number" || (value | 0) !== value) {
                column = promoteColumn(columnIndex, column);
            }
        }

        column[position] = value;

        if (position === lastRowPosition) {

            lastRowPosition = -1;
            lastRow = null;
        }
    };

    /**
     * Sets every group's value in one column, choosing the dense or plain form once for the column.
     *
     * @param {Array} values - One value per group.  Not copied where it becomes the column, so the
     *   caller must not write to it after.
     */
    const setColumn = (columnIndex, values) => {

        let column = values;

        if (isColumnCompressed?.[columnIndex]) {

            // One value the dense form cannot hold exactly keeps the whole column plain.
            let isDense = true;

            for (let position = 0; position < groupCount; position++) {

                const value = values[position];

                if (typeof value !== "number" || (value | 0) !== value) {

                    isDense = false;
                    break;
                }
            }

            if (isDense) {

                column = new Int32Array(groupCount);

                for (let position = 0; position < groupCount; position++) {
                    column[position] = values[position];
                }
            }
        }

        columns[columnIndex] = column;

        lastRowPosition = -1;
        lastRow = null;
    };

    /**
     * Gets one group's values as a row array.  Repeated calls for the same group return the same
     * array, so caches keyed on it still hit.  It is a copy, so writing to it changes nothing.
     */
    const getRow = (position) => {

        if (position === lastRowPosition) return lastRow;

        const row = new Array(columnCount);

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

            const column = columns[columnIndex];

            row[columnIndex] = column === undefined ? "" : column[position];
        }

        lastRowPosition = position;
        lastRow = row;

        return row;
    };

    return {
        columnCount,
        get,
        getRow,
        groupCount,
        set,
        setColumn
    };
};
