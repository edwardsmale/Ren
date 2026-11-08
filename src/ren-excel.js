/**
 * Functions for generating Excel files in the browser, for the 'Export Data' links.
 */
Ren.Excel = (() => {

    const exportToExcel = (dataGrids, downloadDataFilename) => {

        const excelFormats = Ren.ValueFormatter.getExcelFormats();

        /**
         * Returns the data type and format of the given column model.  Must match
         * Ren.SpreadsheetColumnFormatEnum.
         */
        const getColumnTypeAndFormat = (columnModel) => {

            switch (columnModel.ColumnFormat) {

                case Ren.SpreadsheetColumnFormatEnum.General: return { type: String, format: null, getValue: v => v?.toString() };
                case Ren.SpreadsheetColumnFormatEnum.Number: return { type: Number, format: null, getValue: v => parseFloat(v) };
                case Ren.SpreadsheetColumnFormatEnum.Integer: return { type: Number, format: "0", getValue: v => parseFloat(v) };
                case Ren.SpreadsheetColumnFormatEnum.Currency: return { type: Number, format: excelFormats.currency, getValue: v => parseFloat(v) };
                case Ren.SpreadsheetColumnFormatEnum.Percentage: return { type: Number, format: "0.00%", getValue: v => parseFloat(v) };
                case Ren.SpreadsheetColumnFormatEnum.Date: return { type: Date, format: excelFormats.date, getValue: v => Ren.DateUtils.parseYYYYMMDD(v) };
                case Ren.SpreadsheetColumnFormatEnum.DateTime: return { type: Date, format: excelFormats.dateTime, getValue: v => Ren.DateUtils.parseYYYYMMDD_HHmmss(v) };
                case Ren.SpreadsheetColumnFormatEnum.IndexedString: return { type: String, format: null, getValue: v => Ren.IndexedStringUtils.getText(v?.toString()) };
                default: return { type: String, format: null, getValue: v => v?.toString() };
            }
        };

        const sheets = [];
        const allSchemas = [];
        const allObjects = [];

        dataGrids.forEach((dataGrid) => {

            const tabularData = dataGrid.tabularData;
            const columnTypesAndFormats = tabularData.ColumnModels.map(getColumnTypeAndFormat);

            const columnCalcFunctions =
                dataGrid.dataGroupingSettings.getDataRowsColumnFormats().columnCalcFunctions;

            const schema = [];

            // Cache visible column indices to avoid repeated function calls
            const visibleColumnIndices = dataGrid.gridState.getVisibleColumnIndices ?
                dataGrid.gridState.getVisibleColumnIndices() :
                Array.from({
                    length: tabularData.ColumnCount
                }, (_, i) => i).filter(i => dataGrid.gridState.isColumnVisible(i));

            // Build schema for visible columns
            visibleColumnIndices.forEach((columnIndex) => {

                const columnModel = tabularData.ColumnModels[columnIndex];
                const columnTypeAndFormat = columnTypesAndFormats[columnIndex];

                const schemaColumn = {
                    column: columnModel.Heading,
                    type: columnTypeAndFormat.type
                };

                if (columnTypeAndFormat.format) {
                    schemaColumn.format = columnTypeAndFormat.format;
                }

                schemaColumn.value = c => c[columnModel.Heading];
                schemaColumn.width = dataGrid.gridState.getColumnWidth(columnIndex) / 5;

                schema.push(schemaColumn);
            });

            const objects = [];

            const compiledFilter = dataGrid.dataGroupingSettings.hasFilter() ?
                Ren.Filter.createCompiledFilter(tabularData, dataGrid.dataGroupingSettings) :
                null;

            // For now, just output all the rows in their original order.
            for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {

                if (compiledFilter && compiledFilter.isExcluded(rowIndex)) continue;

                const rowModel = tabularData.RowModels[rowIndex];

                const row = {};

                // Built lazily: only allocated for rows where at least one visible column has
                // a calc function that needs to reference other column values via rowVals.
                let rowVals = null;

                let columnIndex = 0;

                // Iterate only through visible columns using the cached indices.
                for (let visibleIndex = 0; visibleIndex < visibleColumnIndices.length; visibleIndex++) {

                    const x = visibleColumnIndices[visibleIndex];

                    let rv = dataGrid.getRowValue(rowModel, x);

                    if (columnCalcFunctions?.[x]?.length) {

                        if (!rowVals) {

                            rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                                tabularData,
                                rowModel.CV,
                                true
                            );
                        }

                        const fns = columnCalcFunctions[x];

                        for (let k = 0; k < fns.length; k++) {

                            try {

                                rv = fns[k](rv, rowVals, null, null, rowModel.CV);
                            }
                            catch (e) {

                                Ren.GlobalErrorHandler.logError(
                                    "[Excel] Error applying calc function during export:",
                                    e
                                );
                            }
                        }
                    }

                    const rowValue = (rv === null || rv === Ren.NullSentinel) ? "" : rv.toString();

                    const columnTypeAndFormat = columnTypesAndFormats[x];

                    let outputValue = rowValue ? columnTypeAndFormat.getValue(rowValue) : "";

                    if (typeof outputValue === "string" && outputValue.indexOf("<") === 0) {

                        const elems = Ren.HtmlUtils.parseHTML(outputValue).body.children;

                        if (elems.length === 1 && elems[0].tagName === "A") {

                            const href = elems[0].getAttribute("href");
                            const text = elems[0].textContent;

                            outputValue = `=HYPERLINK("${href}", "${text}")`;
                            schema[columnIndex].type = "Formula";
                        }
                        else {

                            outputValue = Array.from(elems).map(elem => elem.textContent).join("");
                        }
                    }

                    if (columnTypeAndFormat.type === Date && !outputValue.toLocaleDateString) {

                        outputValue = null;
                    }

                    row[tabularData.ColumnModels[x].Heading] = outputValue;

                    columnIndex++;
                }

                objects.push(row);
            }

            let title = tabularData.Title;

            title = title.replace(/&/g, "+");
            title = title.replace(/[\\/*?:[\]]/g, " ");
            title = title.substring(0, 31);

            sheets.push(title);
            allSchemas.push(schema);
            allObjects.push(objects);
        });

        // See https://www.npmjs.com/package/write-excel-file

        writeXlsxFile(allObjects, {
            sheets,
            schema: allSchemas,
            fileName: downloadDataFilename,
            fontFamily: "Calibri",
            fontSize: 11,
            stickyRowsCount: 1
        });
    };

    return {
        exportToExcel
    };
})();
