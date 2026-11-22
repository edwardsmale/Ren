/**
 * Filter Module: the options and totals row of an item filtering a grouping level, built from
 * that level's group rows.
 */
Ren.FilterModule_Counts_GroupOptions = (s, counts) => {

    const { tabularData, countColumnIndex, paras } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { binning, columnInfo, filterTarget, filtering, itemSettings } = s;

    const { sortOptionsAndFlagToggleEffect } = counts;

    // ===== Options taken from the group rows =====
    //
    // A grouping-level filter is matched against group rows, so the options are the values they
    // hold: a binned value, or an aggregated figure.  The page's data-row filters prune them, as do
    // the item's compare filters, but not its ticks, which only hide groups.

    const decompressGroupValue = (group, columnIndex) =>
        tabularData.CompressionDictionary.decompressValue(
            group.groupValues.get(group.position, columnIndex),
            columnIndex
        );

    // Gets a value indicating whether a group still has rows, tested as the grid tests it.
    const groupHasRows = (group) =>
        countColumnIndex < 0 || decompressGroupValue(group, countColumnIndex) !== "0";

    // Gets a group's filter value, with "" for null, as groupMatchesGroupingFilter reads it.
    const getGroupFilterValue = (group, columnIndex) => {

        const value = decompressGroupValue(group, columnIndex);

        return value === null || value === undefined ? "" : String(value);
    };

    // Gets a group's option value, binned first so the figures, compare filters and ticks all read
    // the bin.
    const getGroupOptionValue = (group, column) =>
        String(binning.binValue(
            column.columnIdOrHeading,
            getGroupFilterValue(group, column.columnIndex)
        ));

    // Gets a binned option's sort key, as its bin is a caption, or null.
    const getGroupOptionSortKey = (group, column) =>
        binning.hasBinning(column.columnIdOrHeading)
            ? String(binning.binSortKey(
                column.columnIdOrHeading,
                getGroupFilterValue(group, column.columnIndex)
            ))
            : null;

    // Gets the unbinned values of every group with rows, not just those shown, so a binned tick
    // names every value its bin covers.
    const getDistinctGroupValuesForColumnIndex = (columnIndex) => {

        const groups = getTargetGroups();
        const values = new Set();

        for (let i = 0; i < groups.length; i++) {
            values.add(getGroupFilterValue(groups[i], columnIndex));
        }

        return Array.from(values);
    };

    // Returns 0 when there is none, as the other aggregations do for an empty set.
    const firstOrLastGroupValue = (values, takeLast) => {

        for (let i = 0; i < values.length; i++) {

            const value = values[takeLast ? values.length - 1 - i : i];

            if (Ren.IsNullOrEmpty(value)) continue;

            return value;
        }

        return 0;
    };

    // Of the numeric values, averaging the middle two of an even count.  Returns 0 when there are
    // none, as the other aggregations do for an empty set.
    const medianGroupValue = (values) => {

        const numbers = [];

        for (let i = 0; i < values.length; i++) {

            if (Ren.IsNullOrEmpty(values[i])) continue;

            const number = Number(values[i]);
            if (!isNaN(number)) numbers.push(number);
        }

        if (numbers.length === 0) return 0;

        numbers.sort((a, b) => a - b);

        const middle = numbers.length >> 1;

        if (numbers.length % 2 === 1) return numbers[middle];

        return (numbers[middle - 1] + numbers[middle]) / 2;
    };

    // The values are already aggregated, so an average is of the groups, as a grid's totals row
    // reads.  "With respect to" is ignored, as it deduplicates data rows before aggregation.
    const aggregateGroupValues = (values, aggregationType) => {

        if (values.length === 0) return 0;

        if (aggregationType === "Count") return values.length;
        if (aggregationType === "CountDistinct") return new Set(values).size;

        // In the order the groups arrive, as there is no "with respect to" to order them by.
        if (aggregationType === "First") return firstOrLastGroupValue(values, false);
        if (aggregationType === "Last") return firstOrLastGroupValue(values, true);

        // Of the values themselves, as there is no "with respect to" to order them by.
        if (aggregationType === "Median") return medianGroupValue(values);

        let total = 0;
        let minimum = null;
        let maximum = null;

        for (let i = 0; i < values.length; i++) {

            const number = Number(values[i]);
            if (isNaN(number)) continue;

            total += number;

            if (minimum === null || number < minimum) minimum = number;
            if (maximum === null || number > maximum) maximum = number;
        }

        if (aggregationType === "Min") return minimum ?? 0;
        if (aggregationType === "Max") return maximum ?? 0;
        if (aggregationType === "Average") return total / values.length;

        return total;
    };

    // Gets every group of the target level, hidden or not.
    const getAllTargetGroups = () => {

        const grouping = filterTarget.getTargetGrouping();
        const groups = [];

        if (!grouping) return groups;

        grouping.groups().forEach((group) => groups.push(group));

        return groups;
    };

    // Gets the target level's groups that still have rows.
    const getTargetGroups = () => {

        const allGroups = getAllTargetGroups();
        const groups = [];

        for (let i = 0; i < allGroups.length; i++) {

            if (groupHasRows(allGroups[i])) groups.push(allGroups[i]);
        }

        return groups;
    };

    // Gets the groups with rows that the level's compare filters leave showing, as a value whose
    // groups are all hidden mustn't be offered.  The ticks aren't applied, or hidden values could
    // never be ticked back.
    const getShownTargetGroups = () => {

        const allGroups = getAllTargetGroups();
        const predicates = filterTarget.getPredicates();

        // Compiled against every group, as a top or bottom N ranks the groups it is given.
        const check = predicates.length
            ? Ren.FilterPredicates.compileGroupPredicates(
                predicates,
                tabularData,
                allGroups,
                paras
            )
            : null;

        const groups = [];

        for (let i = 0; i < allGroups.length; i++) {

            const group = allGroups[i];

            if (!groupHasRows(group)) continue;
            if (check && check(group)) continue;

            groups.push(group);
        }

        return groups;
    };

    // Gets a value indicating whether an item shows a count of groups per value, as a group-level
    // item with no "Value column" does.
    const countsGroupsForColumn = (columnIdOrHeading) =>
        filterTarget.isGroupingTarget && !itemSettings.getValueConfig(columnIdOrHeading).column;

    // One option per distinct group value, with its figure and any "Sort by" figure.
    const buildGroupOptions = (column) => {

        const groups = getShownTargetGroups();

        const countsGroups = countsGroupsForColumn(column.columnIdOrHeading);

        const valueColumnIndex = countsGroups
            ? -1
            : columnInfo.getValueColumnIndex(column.columnIdOrHeading);

        const valueConfig = itemSettings.getValueConfig(column.columnIdOrHeading);
        const sortConfig = itemSettings.getSortConfig(column.columnIdOrHeading);

        const sortColumnIndex = sortConfig.column
            ? tabularData.columnResolver.getColumnIndex(sortConfig.column)
            : -1;

        const optionsByValue = new Map();
        const options = [];

        for (let i = 0; i < groups.length; i++) {

            const group = groups[i];
            const value = getGroupOptionValue(group, column);

            let option = optionsByValue.get(value);

            if (!option) {

                option = {
                    value,
                    // A group with no value is captioned "(blank)".
                    baseText: columnInfo.resolveBaseText(column.columnIdOrHeading, value),
                    // A binned option orders by its bin's sort key, not its caption.
                    valueSortKey: getGroupOptionSortKey(group, column),
                    groupCount: 0,
                    valueFigures: [],
                    sortFigures: []
                };

                optionsByValue.set(value, option);
                options.push(option);
            }

            option.groupCount++;

            if (valueColumnIndex >= 0) {
                option.valueFigures.push(decompressGroupValue(group, valueColumnIndex));
            }

            if (sortColumnIndex >= 0) {
                option.sortFigures.push(decompressGroupValue(group, sortColumnIndex));
            }
        }

        for (let i = 0; i < options.length; i++) {

            const option = options[i];

            option.aggregatedValue = countsGroups
                ? option.groupCount
                : aggregateGroupValues(option.valueFigures, valueConfig.aggregationType);

            if (sortColumnIndex >= 0) {

                option.sortValue = sortColumnIndex === valueColumnIndex
                    ? option.aggregatedValue
                    : aggregateGroupValues(option.sortFigures, sortConfig.aggregationType);
            }
        }

        sortOptionsAndFlagToggleEffect(column, options, sortConfig, sortColumnIndex >= 0);

        return options;
    };

    // Gets the totals-row figure, aggregated across the selected groups only, so the row totals
    // what is ticked.  Counting groups, the totals-row aggregation only decides whether it shows.
    const getGroupTotalDisplayValue = (column) => {

        const totalAggregationType = itemSettings.getTotalAggregationType(column.columnIdOrHeading);

        if (totalAggregationType === "None") return null;

        const countsGroups = countsGroupsForColumn(column.columnIdOrHeading);

        const valueColumnIndex = countsGroups
            ? -1
            : columnInfo.getValueColumnIndex(column.columnIdOrHeading);

        if (!countsGroups && (valueColumnIndex == null || valueColumnIndex < 0)) return null;

        const currentFilter = filtering.getColumnFilter(column.columnIdOrHeading);
        const selectedValues = currentFilter == null ? null : new Set();

        if (currentFilter != null) {

            for (let i = 0; i < currentFilter.length; i++) {
                selectedValues.add(String(currentFilter[i]));
            }
        }

        const groups = getShownTargetGroups();
        const figures = [];

        let selectedGroupCount = 0;

        for (let i = 0; i < groups.length; i++) {

            const group = groups[i];

            if (selectedValues != null && !selectedValues.has(getGroupOptionValue(group, column))) {
                continue;
            }

            selectedGroupCount++;

            if (!countsGroups) figures.push(decompressGroupValue(group, valueColumnIndex));
        }

        if (countsGroups) return selectedGroupCount;

        return aggregateGroupValues(figures, totalAggregationType);
    };

    return {
        countsGroupsForColumn,
        buildGroupOptions,
        getDistinctGroupValuesForColumnIndex,
        getGroupTotalDisplayValue
    };
};
