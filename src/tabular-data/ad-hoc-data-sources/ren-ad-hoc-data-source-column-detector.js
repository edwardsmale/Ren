Ren.AdHocDataSource_ColumnDetector = (() => {

    /**
     * Gets a value indicating whether a non-empty value counts towards a value column: a number,
     * or text reading as one once thousands separators are dropped, but never a date.
     */
    const isNumericValue = (val) => {

        const numericVal = typeof val === "number"
            ? val
            : Number(typeof val === "string" ? val.trim().replace(/,/g, "") : val);

        return !Ren.DateUtils.parseDateTimeUniversal(val) && !isNaN(numericVal);
    };

    const isDateColumn = (inputData, column) => {

        for (let ri = 0; ri < inputData.length; ri++) {

            const val = inputData[ri][column];

            if (!Ren.IsNullOrEmpty(val)) return !!Ren.DateUtils.parseDateTimeUniversal(val);
        }

        return false;
    };

    /**
     * Detects which are the value and date columns in the input data, which may be based on
     * arbitrarily-selected cells - in which case an ad hoc data source will be created - or
     * selected columns - in which case the visualisation will use the original data source.
     */
    const detectColumns = (inputData, selectedColumns) => {

        const columns = Ren.VisualisationDetectionColumns.getDetectionColumns(
            inputData,
            selectedColumns
        ).columns;

        const valueHeadings = [];

        for (let ci = 0; ci < columns.length; ci++) {

            const column = columns[ci];
            let hasValue = false;
            let allNumeric = true;

            for (let ri = 0; ri < inputData.length; ri++) {

                const val = inputData[ri][column];

                if (Ren.IsNullOrEmpty(val)) continue;

                if (!isNumericValue(val)) {

                    allNumeric = false;
                    break;
                }

                hasValue = true;
            }

            if (hasValue && allNumeric) {
                valueHeadings.push(column);
            }
        }

        const possibleDateColumns = columns.filter(column => !valueHeadings.includes(column));

        if (possibleDateColumns.length === 0) {

            return {
                error: "Could not detect date column."
            };
        }

        if (valueHeadings.length === 0) {

            return {
                error: "No data to show."
            };
        }

        // The first whose first value reads as a date, as a text column selected before the date
        // column is not one.
        const dateHeading = possibleDateColumns.find(column => isDateColumn(inputData, column))
            ?? possibleDateColumns[0];

        return {
            dateHeading,
            valueHeadings
        };
    };

    return {
        isNumericValue,
        detectColumns
    };
})();
