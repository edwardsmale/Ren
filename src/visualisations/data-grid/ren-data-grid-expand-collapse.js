/**
 * Module that provides functions for managing the expand/collapse state of groups in the data grid.
 */
Ren.DataGrid_ExpandCollapse = (() => {

    const isGroupExpanded = (tabularData, expandedGroups, grouping, group) => {

        if (!expandedGroups) return true;
        if (!grouping) return false;
        if (grouping.isOutermostGrouping) return true;

        const groupKey = concatGroupByColumnValues(tabularData, grouping, group);

        return expandedGroups.has(groupKey);
    };

    const expandGroup = (tabularData, expandedGroups, grouping, group) => {

        if (!grouping || grouping.preventExpansion) return;
        const groupKey = concatGroupByColumnValues(tabularData, grouping, group);

        expandedGroups.add(groupKey);
    };

    const collapseGroup = (tabularData, expandedGroups, grouping, group) => {

        if (!grouping) return;
        const groupKey = concatGroupByColumnValues(tabularData, grouping, group);

        expandedGroups.delete(groupKey);
    };

    /**
     * Concatenates the values of the group by columns for the specified group into a single string
     * with "¬" as the separator.
     */
    const concatGroupByColumnValues = (tabularData, grouping, group) => {

        if (!grouping || !grouping.groupByColumnIndexes) return "";
        const { groupByColumnIndexes } = grouping;
        const { groupByColumnValues } = group;

        const decompress = tabularData.CompressionDictionary.decompressValue;

        let result = "";

        for (let i = 0, len = groupByColumnIndexes.length; i < len; i++) {

            if (i > 0) result += "¬";
            result += groupByColumnIndexes[i] + ":" + decompress(groupByColumnValues[i], groupByColumnIndexes[i]);
        }

        return result;
    };

    return {
        isGroupExpanded,
        expandGroup,
        collapseGroup
    };
})();
