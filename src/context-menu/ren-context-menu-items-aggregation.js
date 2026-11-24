/**
 * Functions to add aggregation menu items to the context menu.
 */
Ren.ContextMenuItems_Aggregation = (tabularData, dataGroupingSettings) => {

    const setAggregationType = dataGroupingSettings.setAggregationType;
    const setAggregateWithRespectToColumn = dataGroupingSettings.setAggregateWithRespectToColumn;
    const setAggregationIndicator = dataGroupingSettings.setAggregationIndicator;

    // Gets a value indicating whether a column holds values that cannot be summed or averaged.  A
    // compressed column stores strings or dates, so it never qualifies; an uncompressed one is
    // judged by its values.
    const columnHoldsStringValues = (columnIndex) => {

        if (tabularData.IsColumnCompressed?.[columnIndex]) return true;

        const distinctColumnCVs = tabularData.getDistinctColumnCV?.(columnIndex);

        if (!distinctColumnCVs) return false;

        for (let i = 0; i < distinctColumnCVs.length; i++) {

            const value = distinctColumnCVs[i];

            if (value === null || value === "" || value === Ren.NullSentinel) continue;

            if (typeof value === "string") return true;
        }

        return false;
    };

    // Gets the value format a calc function names for its results, or null where it names none.
    const getCalcValueFormat = (calcFunction, columnIndex) => calcFunction
        ? Ren.FunctionTags.getCalcFunctionsValueFormat(
            calcFunction,
            tabularData.ColumnModels[columnIndex].ColumnFormat
        )
        : null;

    /**
     * Gets a value indicating whether the values a column's aggregation in a grouping reads cannot
     * be summed or averaged.  A calc function giving numbers (the lengths of a column of strings,
     * say) that the grouping has, or where it has none, that the column is grouped by the results
     * of, is applied to
     * each value before a sum or average, so they can be (see Ren.Aggregation's
     * getPerValueCalcFunctions).  Otherwise they are the data rows' calc function's results where
     * it has one naming the kind it gives, and otherwise the column's own values.
     */
    const aggregatesNonArithmeticValues = (columnIndex, columnIdOrHeading, grouping) => {

        const isArithmetic = Ren.SpreadsheetColumnFormatEnum.IsArithmetic;

        const perValueCalcFunction = Ren.FunctionTags.getPerValueCalcFunction(
            dataGroupingSettings.groupings?.entries,
            grouping.columns,
            columnIndex,
            columnIdOrHeading
        );

        const perValueFormat = getCalcValueFormat(perValueCalcFunction, columnIndex);

        if (perValueFormat !== null && isArithmetic(perValueFormat)) return false;

        const dataRowsCalcValueFormat = getCalcValueFormat(
            dataGroupingSettings.dataRows?.columns?.[columnIdOrHeading]?.calcFunction,
            columnIndex
        );

        return dataRowsCalcValueFormat === null
            ? columnHoldsStringValues(columnIndex)
            : !isArithmetic(dataRowsCalcValueFormat);
    };

    // The column parameters let the multi-select wrapper pass this through like the column setters.
    const setAggregationIndicatorForAllColumns = (columnIndex, grouping, mode) => {

        if (mode === dataGroupingSettings.layout.aggregationIndicator) return;

        dataGroupingSettings.layout.aggregationIndicator = mode;

        dataGroupingSettings.fireChangedEvent(false);
        Ren.Messages.Events.columnsMoved.notify();
    };

    /**
     * Gets the submenu for choosing how a column's aggregation type is shown, ending with a
     * "Set default" submenu for the grid-wide choice that columns without their own setting follow.
     */
    const getIndicatorOptions = (columnIndex, rowIndex, grouping, columnIdOrHeading) => {

        const modes = Ren.AggregationIndicator.MODES;

        const getColumnMode = () => {

            const currentGrouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);
            return currentGrouping?.columns?.[columnIdOrHeading]?.aggregationIndicator;
        };

        const options = [
            {
                text: "Default",
                className: "qa-ren-aggregation-indicator-default",
                actionParameters: [columnIndex, grouping, undefined],
                action: setAggregationIndicator,
                ticked: () => !getColumnMode()
            }
        ];

        options.push(Ren.MENU_SEPARATOR);

        for (let i = 0; i < modes.length; i++) {

            const mode = modes[i];

            options.push({
                text: Ren.AggregationIndicator.getModeDisplayName(mode),
                className: "qa-ren-aggregation-indicator-" + Ren.TextUtils.convertToKebabCase(mode),
                actionParameters: [columnIndex, grouping, mode],
                action: setAggregationIndicator,
                ticked: () => getColumnMode() === mode
            });
        }

        const defaultOptions = [];

        for (let i = 0; i < modes.length; i++) {

            const mode = modes[i];

            defaultOptions.push({
                text: Ren.AggregationIndicator.getModeDisplayName(mode),
                className:
                    "qa-ren-aggregation-indicator-all-" + Ren.TextUtils.convertToKebabCase(mode),
                actionParameters: [columnIndex, grouping, mode],
                action: setAggregationIndicatorForAllColumns,
                ticked: () => (
                    dataGroupingSettings.layout.aggregationIndicator
                    ?? Ren.AggregationIndicator.DEFAULT_MODE
                ) === mode
            });
        }

        options.push(Ren.MENU_SEPARATOR);

        options.push({
            text: "Set default",
            id: "aggregation-indicator-set-default-menu",
            className: "qa-ren-aggregation-indicator-set-default",
            submenu: defaultOptions
        });

        return options;
    };

    const getMenuItems = (columnIndex, rowIndex, grouping) => {

        if (!grouping) return []; // Can't aggregate data rows.

        // Can't aggregate group-by columns.
        if (grouping.groupByColumnIndexes.includes(columnIndex)) return [];

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        const aggregationOptions = [];

        const aggregationTypes = Ren.AggregationTypeEnum;

        // Sum and Average only mean anything for numbers, so they are left out for a column of
        // strings (or of compressed values, which are strings or dates) that no calc function
        // turns into numbers.
        const hideNumericAggregations = aggregatesNonArithmeticValues(
            columnIndex,
            columnIdOrHeading,
            grouping
        );

        for (let i = 0; i < aggregationTypes.Values.length; i++) {

            const value = aggregationTypes.Values[i];
            const aggregationTypeAsString = aggregationTypes.Names[i];

            if (hideNumericAggregations &&
                (value === aggregationTypes.Sum || value === aggregationTypes.Average)) {

                continue;
            }

            const aggregationTypeKebabCase = Ren.TextUtils.convertToKebabCase(
                aggregationTypeAsString
            );

            const option = {
                text: aggregationTypeAsString,
                className: "qa-ren-aggregation-menu-item-" + aggregationTypeKebabCase,
                actionParameters: [columnIndex, grouping, value],
                action: setAggregationType,
                ticked: () => {

                    const currentGrouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(
                        rowIndex
                    );

                    return currentGrouping?.columns?.[columnIdOrHeading]?.aggregationType === value;
                }
            };

            aggregationOptions.push(option);
        }

        aggregationOptions.sort((a, b) => a.text.localeCompare(b.text));

        // Gets a value indicating whether the column's current aggregation is one of those that
        // interpret the "with respect to" column setting as an ordering, rather than as something
        // to deduplicate by.
        const usesWithRespectToAsOrdering = () => {

            const currentGrouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);
            const currentAggregationType =
                currentGrouping?.columns?.[columnIdOrHeading]?.aggregationType;

            return currentAggregationType === aggregationTypes.First
                || currentAggregationType === aggregationTypes.Last
                || currentAggregationType === aggregationTypes.Median;
        };

        // "With respect to" serves two purposes, according to the aggregation it accompanies.
        //
        // For every aggregation but First, Last and Median it selects which column is used for
        // deduplication before aggregating. Example: "Sum Days Active with respect to ID" sums each
        // ID's Days Active once, even when multiple product rows exist for that ID.
        //
        // For First, Last and Median it selects the column the rows are ordered by before the
        // first, last or middle row is chosen.
        const aggregateWithRespectToOptions = [
            {
                text: () => usesWithRespectToAsOrdering() ? "None (row order)" : "None",
                className: "qa-ren-aggregate-with-respect-to-none",
                actionParameters: [columnIndex, grouping, null],
                action: setAggregateWithRespectToColumn,
                ticked: () => {

                    const currentGrouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);
                    return !currentGrouping?.columns?.[columnIdOrHeading]?.aggregateWithRespectToColumn;
                }
            },
            Ren.MENU_SEPARATOR
        ];

        for (let i = 0; i < tabularData.ColumnModels.length; i++) {

            const column = tabularData.ColumnModels[i];

            if (column.Heading?.includes("__")) continue;

            const value = column.ColumnId || column.Heading;

            const option = {
                text: () => column.Heading,
                className: "qa-ren-aggregate-with-respect-to-" + Ren.TextUtils.convertToKebabCase(column.Heading || column.Subheading),
                actionParameters: [columnIndex, grouping, value],
                action: setAggregateWithRespectToColumn,
                ticked: () => {

                    const currentGrouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);
                    return currentGrouping?.columns?.[columnIdOrHeading]?.aggregateWithRespectToColumn === value;
                }
            };

            aggregateWithRespectToOptions.push(option);
        }

        const indicatorOptions = getIndicatorOptions(columnIndex, rowIndex, grouping, columnIdOrHeading);

        return [
            {
                section: "Aggregation",
                text: "Aggregation",
                id: "aggregation-parent-menu",
                className: "qa-ren-aggregation-menu-item",
                submenu: aggregationOptions
            },
            {
                section: "Aggregation",
                text: () => usesWithRespectToAsOrdering()
                    ? "with respect to (ordered by)"
                    : "with respect to",
                id: "aggregation-with-respect-to-parent-menu",
                submenu: aggregateWithRespectToOptions
            },
            {
                section: "Aggregation",
                text: "Show aggregation as",
                id: "aggregation-indicator-parent-menu",
                className: "qa-ren-aggregation-indicator-menu-item",
                submenu: indicatorOptions
            }
        ];
    };

    return {
        getMenuItems
    };
};
