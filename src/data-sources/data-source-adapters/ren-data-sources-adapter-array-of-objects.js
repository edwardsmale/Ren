/**
 * Converts an array of objects, one per row, into a Ren tabular data set collection.  The columns'
 * types are inferred from their values, unless the array comes with hints that say otherwise:
 *
 *   { "columns": [{ "name": "Price", "format": "currency" }], "rows": [{ "Price": 1.5 }, ...] }
 *
 * where a column with no hint needn't be listed.  See Ren.DataSourceColumnHints.
 */
Ren.DataSourcesAdapter_ArrayOfObjects = (() => {

    /**
     * Gets a value indicating whether a parsed response is an array of objects, on its own or with
     * column hints.
     */
    const isArrayOfObjects = (parsedJson) => {

        if (Array.isArray(parsedJson)) return true;

        if (!parsedJson || !Array.isArray(parsedJson.columns) || !Array.isArray(parsedJson.rows)) {
            return false;
        }

        const firstRow = parsedJson.rows[0];

        return !!firstRow && typeof firstRow === "object" && !Array.isArray(firstRow);
    };

    /**
     * Converts a parsed response that isArrayOfObjects into a Ren tabular data set collection.
     */
    const adaptResponse = (parsedJson, dataSourceUri, tabularDataTitle) => {

        if (Array.isArray(parsedJson)) {
            return adaptArrayOfObjects(parsedJson, dataSourceUri, tabularDataTitle);
        }

        const columns = Ren.DataSourceColumnHints.read(parsedJson.columns);

        return adaptArrayOfObjects(
            parsedJson.rows,
            dataSourceUri,
            tabularDataTitle,
            columns.hints
        );
    };

    /**
     * Converts an array of objects to a Ren tabular data set collection.  The column hints, by
     * column name, are optional.
     */
    const adaptArrayOfObjects = (arrayOfObjects, dataSourceUri, tabularDataTitle, columnHints) => {

        if (!Array.isArray(arrayOfObjects)) return null;
        if (arrayOfObjects.length === 0) return null;

        validateArrayOfObjects(arrayOfObjects);

        const columnHeadings = Object.keys(arrayOfObjects[0]);

        if (columnHints) validateColumnHints(columnHints, columnHeadings);

        columnHeadings.unshift("__Count"); // Add a count column.

        const columnModels = [];

        const uniqueCompressibleValues = new Set();

        const isColumnCompressed = [];
        const isDateColumnIndex = [];
        const isDateTimeColumnIndex = [];
        const isHintedColumnIndex = [];

        for (let i = 0; i < columnHeadings.length; i++) {

            const columnHeading = columnHeadings[i];

            const columnModel = {
                Heading: columnHeading,
                ColumnId: columnHeading,
                ColumnIdOrHeading: columnHeading,
                Visible: true,
                AggregationType: Ren.AggregationTypeEnum.NoTotal
            };

            const hint = i > 0 && columnHints ? columnHints[columnHeading] : undefined;

            if (hint && hint.heading) columnModel.Heading = hint.heading;

            if (i === 0) {

                // Add the automatic count column.
                columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Number;
                columnModel.AggregationType = Ren.AggregationTypeEnum.Sum;
                columnModel.ColumnType = "Number";
                columnModel.Heading = "Count";
                columnModel.Visible = false;
            }
            else if (hint && hint.columnType) {

                columnModel.ColumnType = hint.columnType;
                columnModel.ColumnFormat = hint.columnFormat;
                isHintedColumnIndex[i] = true;

                if (hint.columnType !== "Number") isColumnCompressed[i] = true;
                if (hint.columnType === "Date") isDateColumnIndex[i] = true;
                if (hint.columnType === "Date/Time") isDateTimeColumnIndex[i] = true;
            }
            else {

                let nonEmptyValues = arrayOfObjects
                    .map(row => row[columnHeading])
                    .filter(value => value !== null && value !== "");

                if (!nonEmptyValues.length) {

                    columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Number;
                    columnModel.ColumnType = "Number";
                }
                else {

                    if (Ren.ArrayUtils.isArrayOfNumericStrings(nonEmptyValues)) {

                        nonEmptyValues = nonEmptyValues.map(value => parseFloat(value));
                    }

                    const isNumberColumn = Ren.ArrayUtils.isArrayOfNumbers(nonEmptyValues);

                    if (isNumberColumn) {

                        const isIntColumn = nonEmptyValues.every(value => Number.isInteger(value));

                        const isIdColumn =
                            isIntColumn &&
                            columnHeading.endsWith("Id") &&
                            nonEmptyValues.every(value => value > 0);

                        columnModel.ColumnType = "Number";

                        if (isIdColumn) {
                            columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Id;
                        }
                        else if (isIntColumn) {

                            columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Integer;
                        }
                        else {

                            columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Number;
                        }
                    }
                    else {

                        const dateValues = nonEmptyValues
                            .map(value => Ren.DateUtils.parseDateTimeUniversal(value, true))
                            .filter(date => date !== null);

                        if (dateValues.length === nonEmptyValues.length) {

                            // All values are dates or date/times.

                            if (dateValues.every(value => Ren.DateUtils.isDateOnly(value))) {

                                columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.Date;
                                columnModel.ColumnType = "Date";
                                isDateColumnIndex[i] = true;
                            }
                            else {

                                columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.DateTime;
                                columnModel.ColumnType = "Date/Time";
                                isDateTimeColumnIndex[i] = true;
                            }
                        }
                        else {

                            columnModel.ColumnFormat = Ren.SpreadsheetColumnFormatEnum.General;
                            columnModel.ColumnType = "String";
                        }

                        isColumnCompressed[i] = true;
                    }
                }
            }

            columnModels.push(columnModel);
        }

        const rowModels = arrayOfObjects.map(row => {

            const cv = [];

            for (let i = 0; i < columnHeadings.length; i++) {

                const columnHeading = columnHeadings[i];

                if (i === 0) {

                    cv.push(1); // Count column, which is always 1.
                }
                else {

                    let value = row[columnHeading];

                    if (isHintedColumnIndex[i]) {

                        value = Ren.DataSourceColumnHints.convertValue(
                            value,
                            columnModels[i].ColumnType,
                            columnHeading
                        );

                        // An empty value in a hinted date column stays empty.
                        if (value === null || value === "") {

                            cv.push(value);
                            continue;
                        }
                    }

                    if (isDateTimeColumnIndex[i]) {

                        const dateTime = Ren.DateUtils.parseDateTimeUniversal(value);

                        value = Ren.DateUtils.formatAsSortableUtcDateTime(dateTime);
                    }
                    else if (isDateColumnIndex[i]) {

                        const date = Ren.DateUtils.parseDateTimeUniversal(value);

                        value = Ren.DateUtils.formatAsSortableDate(date);
                    }

                    cv.push(value);

                    if (isColumnCompressed[i]) {

                        uniqueCompressibleValues.add(value);
                    }
                }
            }

            return { CV: cv };
        });

        const dictionary = Ren.DataSourcesCompressAdapter.compress(
            rowModels,
            isColumnCompressed,
            uniqueCompressibleValues
        );

        const tabularData = {
            IsColumnCompressed: isColumnCompressed,
            ColumnModels: columnModels,
            RowModels: rowModels,
            Title: tabularDataTitle
        };

        // Currently, only one tabular data instance is supported by the adapter.
        const tabularDataSets = [{
            TabularDatas: [tabularData],
            Title: tabularDataTitle
        }];

        const tabularDataSetCollection = {
            IsVirtualDataSource: true,
            DataSourceUri: dataSourceUri,
            TabularDataSets: tabularDataSets,
            CompressionDictionary: dictionary
        };

        return tabularDataSetCollection;
    };

    /**
     * Checks that every column hinted at is one of the objects' keys; throws an error if not.
     */
    const validateColumnHints = (columnHints, columnHeadings) => {

        const hintedNames = Object.keys(columnHints);

        for (let index = 0; index < hintedNames.length; index++) {

            if (columnHeadings.indexOf(hintedNames[index]) === -1) {
                throw new Error(`The column "${hintedNames[index]}" isn't in the rows.`);
            }
        }
    };

    /**
     * Checks that the objects in the array all have the same keys; throws an error if they do not.
     */
    const validateArrayOfObjects = (arrayOfObjects) => {

        const columnHeadings = Object.keys(arrayOfObjects[0]);

        columnHeadings.sort();

        const columnHeadingsConcatenated = columnHeadings.join("|");

        for (let i = 1; i < arrayOfObjects.length; i++) {

            const headings = Object.keys(arrayOfObjects[i]);

            headings.sort();

            const headingsConcatenated = headings.join("|");

            if (headingsConcatenated !== columnHeadingsConcatenated) {

                throw new Error("The objects in the array do not have the same keys.");
            }
        }
    };

    return {
        adaptArrayOfObjects,
        adaptResponse,
        isArrayOfObjects
    };
})();
