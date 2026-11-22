/**
 * Module for calculating indentation related to groupings in a tabular data report.
 */
Ren.GroupingIndentation = () => {

    const GroupCtrlsCountModeEnum = Ren.GroupCtrlsCountModeEnum;

    /**
     * Gets the width of the pseudo-column that contains the group expand/collapse buttons and
     * counts.
     */
    const groupCtrlsWidth = (groupings, groupCtrlsCountMode) => {

        if (groupCtrlsCountMode === GroupCtrlsCountModeEnum.Collapsed) return 0;

        const numGroupings = groupings.numGroupings();
        if (numGroupings === 0) return 0;

        const groupCountsIndentation = groupCtrlsCountMode === GroupCtrlsCountModeEnum.NoCounts ? 16 : 38;
        return numGroupings * 8 + groupCountsIndentation;
    };

    /**
     * Gets the left padding for the group expand/collapse buttons, which are indented based on the
     * group level.
     */
    const groupCtrlsPadding = groupLevel => (groupLevel - 1) * 8 + 4;

    /**
     * Gets the left padding for the cells of group rows, which are indented based on the group
     * level.
     */
    const groupCellPadding = groupLevel => (groupLevel - 1) * 3 + 4;

    return {
        groupCtrlsWidth,
        groupCtrlsPadding,
        groupCellPadding
    };
};
