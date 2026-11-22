/**
 * State helper functions for grouping context menus.
 */
Ren.GroupingMenuState = (tabularData, dataGroupingSettings, columnIndex, group) => {

    const columnIdOrHeading = tabularData.ColumnModels[columnIndex]?.ColumnIdOrHeading;
    const columnType = tabularData.ColumnModels[columnIndex]?.ColumnType;
    const isDateColumn = columnType === "Date" || columnType === "Date/Time";
    const isDateTimeColumn = columnType === "Date/Time";
    const isNumberColumn = columnType === "Number" || columnType === "Currency" || columnType === "Percentage";
    const isTextColumn = columnType === "Text" || columnType === "String";

    const groupingAlreadyExistsForColumn = () => dataGroupingSettings.groupings.groupingAlreadyExists(columnIndex);
    const anyGroupingsExist = () => dataGroupingSettings.groupings.numGroupings() > 0;
    const multipleGroupingsExist = () => dataGroupingSettings.groupings.numGroupings() > 1;
    const grouping = dataGroupingSettings.groupings.getGroupingForGroup(group);

    /**
     * Gets a value indicating whether the column can be grouped by: a column the menu was opened
     * on, which is not grouped by already.
     */
    const canGroupByColumn = () => columnIndex !== null && !groupingAlreadyExistsForColumn();

    /**
     * Gets the index of the grouping in the groupings.entries array.
     * Returns -1 if the grouping is not found or if group is not provided.
     */
    const getGroupingIndex = () => {

        if (!grouping) return -1;

        const entries = dataGroupingSettings.groupings.entries;

        for (let i = 0; i < entries.length; i++) {

            if (entries[i] === grouping) {
                return i;
            }
        }

        return -1;
    };

    /**
     * Gets comma-separated column names for the grouping.
     */
    const getGroupingColumnNames = () => {

        if (!grouping || !grouping.groupByColumnIndexes) return "";

        const columnNames = grouping.groupByColumnIndexes.map(index => {

            const columnModel = tabularData.ColumnModels[index];
            return columnModel ? columnModel.ColumnIdOrHeading : "";
        }).filter(name => name);

        return columnNames.join(", ");
    };

    /**
     * Returns the name of the calculation function (if any) applied to the specified column in the
     * innermost grouping.  Returns null if no calculation function is applied.
     */
    const getAppliedCalcFunctionName = () => {

        const innermostGrouping = dataGroupingSettings.groupings.innermostGrouping();
        if (!innermostGrouping || !innermostGrouping.groupByCalcFunctions) return null;

        const groupByColumnIndexes = innermostGrouping.groupByColumnIndexes;
        const columnIndexInGrouping = groupByColumnIndexes.indexOf(columnIndex);

        if (columnIndexInGrouping === -1) return null;

        const calcFunction = innermostGrouping.groupByCalcFunctions[columnIndexInGrouping];
        return calcFunction?.name || null;
    };

    /**
     * Returns the calculation function (if any) defined on the column itself.  Returns null if no
     * calculation function is defined.
     */
    const getColumnCalcFunction = () => {

        if (!columnIdOrHeading) return null;

        const columnCalcFunc = dataGroupingSettings.dataRows.columns[columnIdOrHeading]?.calcFunction;
        return columnCalcFunc || null;
    };

    /**
     * Gets a value indicating whether a calculation function is applied to the specified column in
     * the innermost grouping.
     */
    const hasCalcFunctionApplied = () => getAppliedCalcFunctionName() !== null;

    /**
     * Gets a value indicating whether the specified calculation function name is applied to the
     * column in the innermost grouping.
     */
    const isCalcFunctionApplied = (functionName) => getAppliedCalcFunctionName() === functionName;

    return {
        isDateColumn,
        isDateTimeColumn,
        isNumberColumn,
        isTextColumn,
        columnIdOrHeading,
        columnType,
        grouping,
        groupingAlreadyExistsForColumn,
        anyGroupingsExist,
        canGroupByColumn,
        multipleGroupingsExist,
        getGroupingIndex,
        getGroupingColumnNames,
        getAppliedCalcFunctionName,
        getColumnCalcFunction,
        hasCalcFunctionApplied,
        isCalcFunctionApplied
    };
};
