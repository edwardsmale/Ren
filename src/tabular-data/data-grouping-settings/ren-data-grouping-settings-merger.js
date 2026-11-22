Ren.DataGroupingSettingsMerger = (tabularData, dataGroupingSettings) => {

/**
 * Determines if a calc function returns numeric values.
 */
const isNumericCalcFunction = (calcFunctionName) => {

    return calcFunctionName === "string-length";
};

const EXPAND_ICON_FORMAT_FUNCTION_NAME = "expand-icon";

/**
 * Gets the format function specs to compile for a column, leaving out the expand icon where the
 * columns are the totals row's, since the totals row can never be collapsed.  A format set on a
 * whole column is set on every grouping, the totals row's included.
 */
const getValueFormatFunctionSpecs = (valueFormatFunction, isTotalsRow) => {

    if (!isTotalsRow) return valueFormatFunction;

    const specs = valueFormatFunction.filter(f => f?.name !== EXPAND_ICON_FORMAT_FUNCTION_NAME);

    return specs.length > 0 ? specs : null;
};

/**
 * Merges the value formats, format functions, and calc functions in the report settings with
 * those specified in the column models, and compiles the report settings' style functions.
 */
const getColumnValueFormats = (tabularData, columns) => {

    const paras = Ren.ReportInputParameters.getInputParametersForGuid(
        dataGroupingSettings.containingReportGuid
    );

    const columnValueFormats = tabularData.ColumnModelFormats.slice(0);
    const columnFormatFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnCalcFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnCellStyleFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnRowStyleFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnCellTooltipFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnCellTooltips = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnHeadingTooltipFunctions = Array(tabularData.ColumnModelFormats.length).fill(null);
    const columnHeadingTooltips = Array(tabularData.ColumnModelFormats.length).fill(null);
    let hasRowStyleFunctions = false;
    let columnMergesDataRowBackgrounds = null;

    const isTotalsRow = !!columns &&
        columns === dataGroupingSettings.groupings?.totalsRowGrouping()?.columns;

    for (const key in columns) {

        const state = columns[key];
        const columnIndex = tabularData.columnResolver.getColumnIndex(key);

        if (state.valueFormat !== undefined) {

            columnValueFormats[columnIndex] = state.valueFormat;
        }
        else if (state.calcFunction) {

            const calcFunctionSpec = Ren.ArrayUtils.ensureArray(state.calcFunction)[0];
            const calcFunctionName = calcFunctionSpec?.name;

            if (isNumericCalcFunction(calcFunctionName)) {

                columnValueFormats[columnIndex] = Ren.SpreadsheetColumnFormatEnum.Integer;
            }
        }

        const valueFormatFunctionSpecs = state.valueFormatFunction
            ? getValueFormatFunctionSpecs(state.valueFormatFunction, isTotalsRow)
            : null;

        if (valueFormatFunctionSpecs) {

            columnFormatFunctions[columnIndex] = valueFormatFunctionSpecs
                .map(f => Ren.FormatFunctions.createFunction(f, paras));
        }

        if (state.calcFunction) {

            columnCalcFunctions[columnIndex] = state.calcFunction
                .map(f => Ren.FormatFunctions.createFunction(f, paras));
        }

        if (state.cellStyleFunction) {

            columnCellStyleFunctions[columnIndex] = Ren.ArrayUtils
                .ensureArray(state.cellStyleFunction)
                .map(f => Ren.FormatFunctions.createFunction(f, paras));
        }

        if (state.rowStyleFunction) {

            columnRowStyleFunctions[columnIndex] = Ren.ArrayUtils
                .ensureArray(state.rowStyleFunction)
                .map(f => Ren.FormatFunctions.createFunction(f, paras));

            hasRowStyleFunctions = true;
        }

        if (state.cellTooltipFunction) {

            columnCellTooltipFunctions[columnIndex] = Ren.ArrayUtils
                .ensureArray(state.cellTooltipFunction)
                .map(f => Ren.FormatFunctions.createFunction(f, paras));
        }

        if (state.headingTooltipFunction) {

            columnHeadingTooltipFunctions[columnIndex] = Ren.ArrayUtils
                .ensureArray(state.headingTooltipFunction)
                .map(f => Ren.FormatFunctions.createFunction(f, paras));
        }

        columnCellTooltips[columnIndex] = state.cellTooltip || null;
        columnHeadingTooltips[columnIndex] = state.headingTooltip || null;

        if (state.mergeDataRowBackgrounds) {

            columnMergesDataRowBackgrounds ??=
                Array(tabularData.ColumnModelFormats.length).fill(false);

            columnMergesDataRowBackgrounds[columnIndex] = true;
        }
    }

    return {
        columnValueFormats,
        columnFormatFunctions,
        columnCalcFunctions,
        columnCellStyleFunctions,
        columnRowStyleFunctions: hasRowStyleFunctions ? columnRowStyleFunctions : null,
        columnCellTooltipFunctions,
        columnCellTooltips,
        columnHeadingTooltipFunctions,
        columnHeadingTooltips,

        // For a grouping's columns, whether each gives its group rows the mixed backgrounds of
        // their data rows (see Ren.DataGridMergedBackgrounds).  Null where none does.
        columnMergesDataRowBackgrounds
    };
};

    /**
     * Merges the aggregation types in the report settings with the aggregation types specified in
     * the column models.
     */
    const mergeColumnAggTypes = (
        tabularData,
        columnModelAggTypes,
        columnModelAggregateWithRespectTos,
        columns
    ) => {

        const columnAggTypes = columnModelAggTypes.slice(0);
        const columnAggregateWithRespectTos = columnModelAggregateWithRespectTos.slice(0);

        const columnIndexCache = {};
        const respectToIndexCache = {};

        for (const key in columns) {

            const state = columns[key];

            let columnIndex = columnIndexCache[key];

            if (columnIndex === undefined) {

                columnIndex = tabularData.columnResolver.getColumnIndex(key);
                columnIndexCache[key] = columnIndex;
            }

            if (state.aggregationType !== undefined) {

                columnAggTypes[columnIndex] = state.aggregationType;
            }

            if (state.aggregateWithRespectToColumn !== undefined) {

                // Resolve the column name/id to an index so the aggregation engine can use it
                // directly.  See getCompressedValuesToAggregate_wrt in ren-aggregation.js for how
                // this index drives row deduplication at aggregation time - and, under the First
                // and Last aggregations, getCompressedValuesToAggregate_ordered, which reads it as
                // the order the rows are picked from instead.
                const respectToKey = state.aggregateWithRespectToColumn;

                let respectToIndex = respectToIndexCache[respectToKey];

                if (respectToIndex === undefined) {

                    respectToIndex = tabularData.columnResolver.getColumnIndex(respectToKey);
                    respectToIndexCache[respectToKey] = respectToIndex;
                }

                columnAggregateWithRespectTos[columnIndex] = respectToIndex;
            }
        }

        return {
            columnAggTypes,
            columnAggregateWithRespectTos
        };
    };

    return {
        getColumnValueFormats,
        mergeColumnAggTypes
    };
};
