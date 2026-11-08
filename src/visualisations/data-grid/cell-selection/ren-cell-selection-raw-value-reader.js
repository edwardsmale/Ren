/**
 * Reads the raw values, before the grid's formatting, of the grid's data rows and group rows.
 */
Ren.DataGridCellSelection_RawValueReader = (tabularData, dataGroupingSettings) => {

    /**
     * Gets the grouping, the given one or one it sits inside, that groups by the given column, so
     * that each of its group rows holds one of the column's values or the bin they were put in.
     * Elsewhere a group row holds an aggregate, and null is returned.
     */
    const getGroupingByColumn = (grouping, columnIndex) => {

        const entries = dataGroupingSettings.groupings.entries;

        while (grouping) {

            if (grouping.groupByColumnIndexes.indexOf(columnIndex) !== -1) return grouping;

            const parentGroupingIndex = grouping.parentGroupingIndex;

            grouping = parentGroupingIndex || parentGroupingIndex === 0
                ? entries[parentGroupingIndex]
                : null;
        }

        return null;
    };

    // The aggregation types that make one value of a group's data rows, such as their sum.
    const SINGLE_RESULT_AGGREGATION_TYPES = new Set([
        Ren.AggregationTypeEnum.Sum,
        Ren.AggregationTypeEnum.Average,
        Ren.AggregationTypeEnum.Count,
        Ren.AggregationTypeEnum.CountDistinct,
        Ren.AggregationTypeEnum.Min,
        Ren.AggregationTypeEnum.Max,
        Ren.AggregationTypeEnum.MostCommon,
        Ren.AggregationTypeEnum.First,
        Ren.AggregationTypeEnum.Last,
        Ren.AggregationTypeEnum.Median
    ]);

    // The aggregation types that give the value a group's data rows share, and a blank or a
    // placeholder, such as the expand button, where they do not share one.
    const SHARED_VALUE_AGGREGATION_TYPES = new Set([
        Ren.AggregationTypeEnum.SingleValuesOnly,
        Ren.AggregationTypeEnum.SingleValueOrPlaceholder,
        Ren.AggregationTypeEnum.ExpandIcon
    ]);

    /**
     * Gets the value a group row's aggregate holds where its aggregation type guarantees that to
     * be one of the column's values, or null where it may be a total, a list, or the blank or
     * placeholder shown where the group's data rows differ.
     */
    const getSharedAggregateValue = (grouping, columnIndex, value) => {

        const aggregationType = grouping.getColumnAggregationType(columnIndex);

        if (!SHARED_VALUE_AGGREGATION_TYPES.has(aggregationType)) return null;

        if (value === "") return null;

        // The placeholders are markup, which is what tells them from a value.
        if (typeof value === "string" && value.startsWith("<")) return null;

        return value;
    };

    /**
     * Gets the value a group row's aggregate stands for, or null where it stands for no one value:
     * a list of the group's values, or the blank or placeholder shown where they differ.
     */
    const getAggregateValue = (grouping, columnIndex, value) => {

        const aggregationType = grouping.getColumnAggregationType(columnIndex);

        if (SINGLE_RESULT_AGGREGATION_TYPES.has(aggregationType)) return value;

        return getSharedAggregateValue(grouping, columnIndex, value);
    };

    /**
     * Gets the raw value of the given column in the row with the given index (excluding headings),
     * or undefined where the row holds no one value for it.
     *
     * A group row gives the value it shows: where its grouping groups by the column, the one its
     * data rows share or, for a binned column, their bin as it reads; elsewhere, its aggregate,
     * where that is one value, such as a sum or the value its data rows all share.  The totals
     * row's aggregates are left out.
     */
    const getRawValue = (rowIndex, columnIndex) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        if (tabularData.isDataRow(rowIndex)) {

            return decompressValue(tabularData.RowModels[rowIndex].CV[columnIndex], columnIndex);
        }

        if (!tabularData.isGroupRow(rowIndex)) return undefined;

        const groupings = dataGroupingSettings.groupings;
        const rowGrouping = groupings.getGroupingWithRowIndex(rowIndex);
        const grouping = getGroupingByColumn(rowGrouping, columnIndex);

        const group = groupings.getGroupWithRowIndex(rowIndex);
        const value = decompressValue(
            group.groupValues.get(group.position, columnIndex),
            columnIndex
        );

        if (!grouping) {

            // The totals row sums up every row in the grid rather than being one of them.
            if (rowGrouping.isOutermostGrouping) return undefined;

            return getAggregateValue(rowGrouping, columnIndex, value) ?? undefined;
        }

        const positionInGroupBy = grouping.groupByColumnIndexes.indexOf(columnIndex);

        // A bin that has to order a certain way carries a sort key ahead of what it reads as.
        return grouping.groupByCalcFunctions?.[positionInGroupBy]
            ? Ren.TextUtils.stripSortPrefix(value)
            : value;
    };

    return {
        getRawValue,
        getSharedAggregateValue
    };
};
