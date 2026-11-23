/**
 * Functions for generating Excel files in the browser, for the 'Export Data' links.
 */
Ren.Excel = (() => {

    /**
     * Gets a link as an Excel formula, with the quotes in its parts doubled as Excel needs, and
     * its text to show until Excel works the formula out.
     */
    const getHyperlinkFormula = (href, text) => {

        const quote = part => "\"" + String(part ?? "").replace(/"/g, "\"\"") + "\"";

        return { formula: `HYPERLINK(${quote(href)}, ${quote(text)})`, value: text };
    };

    /**
     * Gets the sheets (see Ren.XlsxWriter) for the given data grids, one each.
     */
    const buildSheets = (dataGrids) => {

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

        return dataGrids.map((dataGrid) => {

            const tabularData = dataGrid.tabularData;
            const columnTypesAndFormats = tabularData.ColumnModels.map(getColumnTypeAndFormat);

            const columnCalcFunctions =
                dataGrid.dataGroupingSettings.getDataRowsColumnFormats().columnCalcFunctions;

            // Cache visible column indices to avoid repeated function calls
            const visibleColumnIndices = dataGrid.gridState.getVisibleColumnIndices ?
                dataGrid.gridState.getVisibleColumnIndices() :
                Array.from({
                    length: tabularData.ColumnCount
                }, (_, i) => i).filter(i => dataGrid.gridState.isColumnVisible(i));

            const columns = visibleColumnIndices.map(columnIndex => ({
                heading: tabularData.ColumnModels[columnIndex].Heading,
                format: columnTypesAndFormats[columnIndex].format
            }));

            const rows = [];

            const compiledFilter = dataGrid.dataGroupingSettings.hasFilter() ?
                Ren.Filter.createCompiledFilter(tabularData, dataGrid.dataGroupingSettings) :
                null;

            // For now, just output all the rows in their original order.
            for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {

                if (compiledFilter && compiledFilter.isExcluded(rowIndex)) continue;

                const rowModel = tabularData.RowModels[rowIndex];

                const row = [];

                // Built lazily: only allocated for rows where at least one visible column has
                // a calc function that needs to reference other column values via rowVals.
                let rowVals = null;

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

                            outputValue = getHyperlinkFormula(
                                elems[0].getAttribute("href"),
                                elems[0].textContent
                            );
                        }
                        else {

                            outputValue = Array.from(elems).map(elem => elem.textContent).join("");
                        }
                    }

                    // The dates are parsed as UTC, as Ren.XlsxWriter reads them.
                    if (columnTypeAndFormat.type === Date && !(outputValue instanceof Date)) {

                        outputValue = null;
                    }

                    row.push(outputValue);
                }

                rows.push(row);
            }

            return {
                name: tabularData.Title.replace(/&/g, "+"),
                columns,
                rows
            };
        });
    };

    /**
     * Saves the given data grids as an Excel file, a sheet each.
     * @returns {Promise<void>}
     */
    const exportToExcel = (dataGrids, downloadDataFilename) => {

        return Ren.XlsxWriter.download(buildSheets(dataGrids), downloadDataFilename).catch((e) => {

            Ren.GlobalErrorHandler.logError("[Excel] Error writing the Excel file:", e);
        });
    };

    return {
        buildSheets,
        exportToExcel
    };
})();
