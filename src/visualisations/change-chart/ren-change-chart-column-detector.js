Ren.ChangeChart_ColumnDetector = (() => {

    const isNumericValue = (value) =>
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "" && !isNaN(value));

    /**
     * Detects the label, before and after columns: the first shown text column, and the first two
     * shown number columns.
     */
    const detectColumns = (inputData, visualisation, tabularData, columnResolver) => {

        const { columns } = Ren.VisualisationDetectionColumns.getDetectionColumns(
            inputData,
            visualisation.selectedColumns,
            tabularData,
            columnResolver
        );

        const firstRow = inputData[0];
        let labelHeading = null;
        const valueHeadings = [];

        for (let index = 0; index < columns.length; index++) {

            const column = columns[index];

            if (isNumericValue(firstRow[column])) {
                valueHeadings.push(column);
            }
            else if (!labelHeading) {

                labelHeading = column;
            }
        }

        return {
            labelHeading,
            beforeHeading: valueHeadings[0] ?? null,
            afterHeading: valueHeadings[1] ?? null
        };
    };

    return {
        detectColumns
    };
})();
