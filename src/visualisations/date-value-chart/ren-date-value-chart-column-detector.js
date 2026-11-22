Ren.DateValueChart_ColumnDetector = (() => {

    /**
     * Works out the date and value columns from the input data.
     * Supports both single-column (backward compatible) and multi-column modes.
     * When 2+ numeric columns are available, returns them for side-by-side rendering.
     * When only 1 numeric column is available, returns traditional single-series mode.
     */
    const detectColumnsAndDatePeriod = (inputData, visualisation) => {

        const selectedColumns = visualisation.selectedColumns;

        const { dateHeading, valueHeadings, error } =
            Ren.AdHocDataSource_ColumnDetector.detectColumns(inputData, selectedColumns);

        if (error) return error;

        if (valueHeadings.length >= 2) {

            return {
                dateHeading: dateHeading,
                valueHeadings: valueHeadings
            };
        }
        else {

            return {
                dateHeading: dateHeading,
                valueHeading: valueHeadings[0]
            };
        }
    };

    return {
        detectColumnsAndDatePeriod
    };
})();
