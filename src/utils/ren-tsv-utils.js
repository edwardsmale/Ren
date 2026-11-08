Ren.TsvUtils = (() => {

    /**
     * Splits a TSV string into a 2-D array of cells (rows × columns).
     */
    const parseTsv = (tsv) => tsv.split("\n").map(row => row.split("\t"));

    const getEmptyColumnIndexesFromRows = (rows) => {

        const emptyColumnIndexes = [];

        for (let colIndex = 0; colIndex < rows[0].length; colIndex++) {

            let isEmpty = true;

            for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {

                if (rows[rowIndex][colIndex].trim() !== "") {

                    isEmpty = false;
                    break;
                }
            }

            if (isEmpty) emptyColumnIndexes.push(colIndex);
        }

        return emptyColumnIndexes;
    };

    const getEmptyColumnIndexes = (tsv) => getEmptyColumnIndexesFromRows(parseTsv(tsv));

    const removeEmptyColumns = (tsv) => {

        const rows = parseTsv(tsv);
        const emptyColumnIndexes = new Set(getEmptyColumnIndexesFromRows(rows));

        return rows.map(cols => cols.filter((_, index) => !emptyColumnIndexes.has(index)).join("\t")).join("\n");
    };

    return {
        getEmptyColumnIndexes,
        removeEmptyColumns
    };
})();
