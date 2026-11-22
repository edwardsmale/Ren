Ren.WordCloud_ColumnDetector = (() => {

    const isNumericValue = (value) =>
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "" && !isNaN(value));

    /**
     * Detects the word and count columns: the first non-numeric column and the first numeric one.
     * Without a numeric column the auto row count is the counts, so a column of words is sized by
     * how often each repeats.
     */
    const detectColumns = (inputData, visualisation, tabularData, columnResolver) => {

        if (!inputData || inputData.length === 0) return "No data available to detect columns";

        const { columns, countColumn } = Ren.VisualisationDetectionColumns.getDetectionColumns(
            inputData,
            visualisation.selectedColumns,
            tabularData,
            columnResolver
        );

        const firstRow = inputData[0];
        let wordHeading = null;
        let countHeading = null;

        for (let i = 0; i < columns.length; i++) {

            const column = columns[i];

            if (isNumericValue(firstRow[column])) {

                if (!countHeading) countHeading = column;
            }
            else if (!wordHeading) {

                wordHeading = column;
            }
        }

        // Numbers alone: the first column is taken as the words.
        if (!wordHeading && columns.length > 0) {

            wordHeading = columns[0];
            countHeading = columns.length > 1 ? columns[1] : null;
        }

        countHeading = countHeading || countColumn;

        if (!wordHeading) return "Could not find a column for words";
        if (!countHeading) return "Could not find a numeric column for counts";

        return {
            wordHeading,
            countHeading
        };
    };

    return {
        detectColumns
    };
})();
