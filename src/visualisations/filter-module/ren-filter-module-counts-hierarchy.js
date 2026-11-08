/**
 * Filter Module: the grouping hierarchy an item's values nest within, the derived settings that
 * group by it, and the tree of value nodes built from them.
 */
Ren.FilterModule_Counts_Hierarchy = (s, counts) => {

    const { tabularData, columnOverrides, countColumnIndex, NODE_KEY_SEPARATOR } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { columnInfo, filterTarget, filtering, itemSettings } = s;

    const FilterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;
    const DerivedSettings = Ren.DerivedDataGroupingSettings;

    const {
        createDerivedSettings,
        buildAggregatedColumns,
        buildHierarchyTotalColumns,
        readTotalDisplayValue,
        readValueSummaryStats,
        getCachedItemResult,
        canAddUpTotalFromFigures,
        sortToggleReorders
    } = counts;

    // Gets the columns a hierarchy's own filter covers, left out of its cross-filter, and their
    // chain's key.
    const ownColumnIdsOf = (hierarchyColumns) =>
        hierarchyColumns.map((column) => columnInfo.getDataColumnId(column));

    const ownCombinationKeyOf = (hierarchyColumns) =>
        filtering.columnsKeyOf(columnInfo.chainOf(hierarchyColumns));

    // Gets a hierarchy's extra cache key: its chain, as regrouping the source grid changes its
    // values, and each level's settings, as a derived level's are held under its level key.
    const hierarchyConfigKey = (hierarchyColumns) => {

        const parts = [JSON.stringify(columnInfo.chainOf(hierarchyColumns))];

        for (let i = 0; i < hierarchyColumns.length; i++) {

            const columnIdOrHeading = hierarchyColumns[i].columnIdOrHeading;

            parts.push(columnIdOrHeading);
            parts.push(JSON.stringify(columnOverrides[columnIdOrHeading] ?? null));
        }

        return parts.join(NODE_KEY_SEPARATOR);
    };

    // Gets the key a hierarchy's caches are held under.
    const hierarchyKeyOf = (hierarchyColumns) =>
        hierarchyColumns.map((column) => column.columnIdOrHeading).join("|");

    // Each level folds in its "Value column" and "Sort by" choices, so changing one drops this.
    const hierarchicalCountsSettings = DerivedSettings.createCache(
        (hierarchyColumns) => createHierarchicalCountsDataGroupingSettings(hierarchyColumns),
        hierarchyKeyOf
    );

    // Carries the hierarchy's live selection as a filter, so is dropped with the counts settings.
    const selectedHierarchyTotalSettings = DerivedSettings.createCache(
        (hierarchyColumns) => createSelectedHierarchyTotalSettings(hierarchyColumns),
        hierarchyKeyOf
    );

    // Dropped whole, as a column may sit at any level of a hierarchy that now needs regrouping.
    const invalidateCaches = () => {

        hierarchicalCountsSettings.invalidateAll();
        selectedHierarchyTotalSettings.invalidateAll();
    };

    // Gets the source grid's grouping columns, top first.  Group-by columns are cumulative, so a
    // level's own column is what it adds over its parent, the next entry.
    const getSourceGroupingChainColumnIndexes = () => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return [];

        // A hierarchy filters on value combinations, which a grouping level doesn't honour.
        if (filterTarget.isGroupingTarget) return [];

        const entries = settings.groupings?.entries;
        if (!entries || entries.length < 2) return [];

        const chain = [];

        for (let i = 0; i < entries.length - 1; i++) {

            const current = entries[i].groupByColumnIndexes ?? [];
            const parent = entries[i + 1].groupByColumnIndexes ?? [];
            const parentSet = new Set(parent);

            for (let j = 0; j < current.length; j++) {
                if (!parentSet.has(current[j])) chain.push(current[j]);
            }
        }

        return chain;
    };

    // Gets the included columns forming the grid's hierarchy, top first, or none when under two.
    const getHierarchyColumns = () => {

        const chain = getSourceGroupingChainColumnIndexes();
        if (chain.length < 2) return [];

        const eligibleColumns = s.eligibleColumns;
        const eligibleByIndex = new Map();

        for (let i = 0; i < eligibleColumns.length; i++) {
            eligibleByIndex.set(eligibleColumns[i].columnIndex, eligibleColumns[i]);
        }

        const columns = [];

        for (let i = 0; i < chain.length; i++) {

            const column = eligibleByIndex.get(chain[i]);
            if (column && itemSettings.isColumnIncluded(column)) columns.push(column);
        }

        return columns.length >= 2 ? columns : [];
    };

    // Gets the ancestor columns a leaf's values nest within, top first.  "Group by" parents take
    // precedence over the source grid's grouping chain.
    const getAncestorColumnsForLeaf = (leafColumn, gridChain) => {

        // As above: a grouping level has no hierarchical items.
        if (filterTarget.isGroupingTarget) return [];

        const manual = columnOverrides[leafColumn.columnIdOrHeading]?.parentGroupings;

        if (manual && manual.length) {

            const columns = [];

            for (let i = 0; i < manual.length; i++) {

                const column = columnInfo.findEligibleColumn(columnInfo.getEntryColumnIdOrHeading(manual[i]));
                if (!column) continue;

                // A derived level names the column its values are computed from.
                const calcFunction = columnInfo.getEntryCalcFunction(manual[i]);

                columns.push(calcFunction ? columnInfo.createDerivedLevel(column, calcFunction) : column);
            }

            return columns;
        }

        if (gridChain.length >= 2
            && gridChain[gridChain.length - 1].columnIdOrHeading === leafColumn.columnIdOrHeading) {

            return gridChain.slice(0, gridChain.length - 1);
        }

        return [];
    };

    // Groups by the whole hierarchy at once, so each group's containedGroups hold its children.
    const createHierarchicalCountsDataGroupingSettings = (hierarchyColumns) => {

        // Innermost first, so once the totals grouping is appended each group's containedGroups
        // descend one level at a time.
        const entries = [];

        for (let d = hierarchyColumns.length - 1; d >= 0; d--) {

            // Settings are held under the level key, but the data is grouped by the real column.
            const level = hierarchyColumns[d];

            const entry = {
                groupByColumns: [columnInfo.getDataColumnId(level)],
                columns: buildAggregatedColumns(level.columnIdOrHeading)
            };

            if (level.calcFunction) entry.groupByCalcFunctions = [{ name: level.calcFunction }];

            entries.push(entry);
        }

        // Cross-filtered by the page's filters other than this hierarchy's own selection, so only
        // combinations with rows show.  A compare filter on its columns is kept.
        const ownColumnIds = hierarchyColumns.map((column) => columnInfo.getDataColumnId(column));

        const prepare = (settings) => {

            settings._filterModuleCrossFiltered = filtering.applyCrossFilterToScratchSettings(
                settings,
                ownColumnIds,
                filtering.columnsKeyOf(columnInfo.chainOf(hierarchyColumns))
            );
        };

        // The totals grouping is declared explicitly, so it aggregates the hierarchy's grand total.
        return createDerivedSettings(
            "filter-module-hierarchy-counts",
            prepare,
            entries,
            buildHierarchyTotalColumns(hierarchyColumns)
        );
    };

    const getHierarchicalCountsDataGroupingSettings = (hierarchyColumns) =>
        hierarchicalCountsSettings.get(hierarchyColumns);

    // Like the counts settings' total, but also excluding the deselected combinations.
    const createSelectedHierarchyTotalSettings = (hierarchyColumns) => {

        const ownColumnIds = hierarchyColumns.map((column) => columnInfo.getDataColumnId(column));
        const chain = columnInfo.chainOf(hierarchyColumns);

        const prepare = (settings) => {

            // The same cross-filter as the hierarchy's counts.
            filtering.applyCrossFilterToScratchSettings(
                settings,
                ownColumnIds,
                filtering.columnsKeyOf(chain)
            );

            const selection = filtering.getHierarchySelection(chain);

            if (!isHierarchyFiltered(selection)) return;

            const predicates = FilterAccessors.getRowFilterPredicates(settings.dataRows, tabularData);

            predicates.push(filtering.buildCombinationsPredicate(chain, selection));

            FilterAccessors.setRowFilterPredicates(settings.dataRows, tabularData, predicates);
        };

        return createDerivedSettings(
            "filter-module-selected-hierarchy-total",
            prepare,
            [],
            buildHierarchyTotalColumns(hierarchyColumns)
        );
    };

    const getSelectedHierarchyTotalSettings = (hierarchyColumns) =>
        selectedHierarchyTotalSettings.get(hierarchyColumns);

    // Gets a value indicating whether a hierarchy's selection leaves anything out.  A positive
    // one always does, as it names what is kept rather than what is not.
    const isHierarchyFiltered = (selection) => selection.isPositive || selection.keys.size > 0;

    /**
     * Adds up the selected leaves' figures, as every row sits under exactly one leaf, or returns
     * null where the levels don't aggregate the same column the same way.
     */
    const addUpSelectedTotalFromLeafNodes = (hierarchyColumns, selection) => {

        const topColumn = hierarchyColumns[0];
        const leafColumn = hierarchyColumns[hierarchyColumns.length - 1];

        const canAddUp = canAddUpTotalFromFigures(
            topColumn.columnIdOrHeading,
            leafColumn.columnIdOrHeading
        );

        if (!canAddUp) return null;

        let total = 0;
        let addsUp = true;

        const TupleKeys = Ren.FilterModule_TupleKeys;
        const reader = TupleKeys.createReader(selection.keys, selection.isPositive);

        const addNodes = (nodes) => {

            for (let i = 0; i < nodes.length && addsUp; i++) {

                const node = nodes[i];
                const state = reader.getNodeState(node);

                if (state === TupleKeys.EXCLUDED) continue;

                // A whole branch off is one key, so the walk down stops at it.
                if (!node.isLeaf) {

                    addNodes(node.children);
                    continue;
                }

                const value = Number(node.aggregatedValue);

                // Concatenate and DistinctValues read back as text, which can't be added up.
                if (!Number.isFinite(value)) {
                    addsUp = false;
                }
                else {

                    total += value;
                }
            }
        };

        addNodes(buildHierarchyTree(hierarchyColumns));

        return addsUp ? total : null;
    };

    // Gets a hierarchy's totals-row figure.  With some combinations deselected, the selected
    // leaves' figures are added up where possible, and otherwise recomputed over their rows.
    const getHierarchyTotalDisplayValue = (hierarchyColumns) => {

        const chain = columnInfo.chainOf(hierarchyColumns);
        const selection = filtering.getHierarchySelection(chain);
        const isFiltered = isHierarchyFiltered(selection);
        const statedKeysInOrder = Array.from(selection.keys);

        // Sorted, so the same selection reads the same figure whatever order it was gathered in.
        Ren.ArrayUtils.sortAlpha(statedKeysInOrder);

        // The stated combinations join the key, so the figure covers the selected ones alone.
        return getCachedItemResult(
            "hierarchy-total",
            ownColumnIdsOf(hierarchyColumns),
            ownCombinationKeyOf(hierarchyColumns),
            hierarchyConfigKey(hierarchyColumns)
                + (selection.isPositive ? "+" : "-")
                + JSON.stringify(statedKeysInOrder),
            () => {

                const addedUp = isFiltered
                    ? addUpSelectedTotalFromLeafNodes(hierarchyColumns, selection)
                    : null;

                if (addedUp !== null) return addedUp;

                return readTotalDisplayValue(
                    hierarchyColumns[0].columnIdOrHeading,
                    hierarchyColumns[hierarchyColumns.length - 1].columnIdOrHeading,
                    () => isFiltered
                        ? getSelectedHierarchyTotalSettings(hierarchyColumns)
                        : getHierarchicalCountsDataGroupingSettings(hierarchyColumns)
                );
            }
        );
    };

    // Gets the grand-total group's stats, as the totals row shows the top column's value.
    const getHierarchyValueSummaryStats = (hierarchyColumns) =>
        getCachedItemResult(
            "hierarchy-value-summary-stats",
            ownColumnIdsOf(hierarchyColumns),
            ownCombinationKeyOf(hierarchyColumns),
            hierarchyConfigKey(hierarchyColumns),
            () => readValueSummaryStats(
                hierarchyColumns[0].columnIdOrHeading,
                () => getHierarchicalCountsDataGroupingSettings(hierarchyColumns)
            )
        );

    // Gets a node's compressed value, or null.  A derived level's group-by value is a date within
    // the period, so its derived value is read from the group's values instead.
    const readGroupValue = (group, column, positionInGroupBy) => {

        if (column.calcFunction) return group.groupValues.get(group.position, column.columnIndex);

        return positionInGroupBy >= 0 ? group.groupByColumnValues[positionInGroupBy] : null;
    };

    // Gets a value indicating whether a node's value string ends its branch when it is the only
    // child.
    const isBranchEndValue = (valueString) =>
        valueString === ""
        || valueString === Ren.NullSentinel
        || valueString === Ren.NullSentinelDisplayLabel;

    // Level 0 is the topmost grouping.  Each node carries its descendant leaves' tuple keys, which
    // drive the leaf column's filter.  buildHierarchyTree reads an unchanged tree back instead.
    const buildTree = (hierarchyColumns) => {

        const settings = getHierarchicalCountsDataGroupingSettings(hierarchyColumns);
        const groupingEntries = DerivedSettings.getEntries(settings);
        const levelCount = hierarchyColumns.length;
        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        // Under cross-filtering, a node with no rows left is pruned with its subtree.  Presence
        // needs the row-count column; without one, every node is kept.
        const pruneToPresentNodes = settings._filterModuleCrossFiltered && countColumnIndex >= 0;

        // Prefixed by the hierarchy's columns, so expanded node keys never collide.
        const hierarchyKey = hierarchyKeyOf(hierarchyColumns);

        // Populated once per level, as one pass covers every group of the parents' grouping.
        const levelsWithPopulatedStats = new Set();

        // The "Sort" toggle is keyed on the leaf and switches only its level's sort.
        let sortToggleChangesOrder = false;

        const buildNodes = (groupsMap, depth, parentKey, ancestorValues, parentGroup) => {

            if (!groupsMap) return [];

            const column = hierarchyColumns[depth];
            const grouping = groupingEntries[levelCount - 1 - depth];
            const positionInGroupBy = grouping.groupByColumnIndexes.indexOf(column.columnIndex);
            const isLeaf = depth === levelCount - 1;

            // Kept raw, so non-numeric aggregations survive and the value format applies at render.
            const valueColumnIndex = columnInfo.getValueColumnIndex(column.columnIdOrHeading);
            const sortConfig = itemSettings.getSortConfig(column.columnIdOrHeading);
            const sortColumnIndex = sortConfig.column
                ? tabularData.columnResolver.getColumnIndex(sortConfig.column)
                : -1;

            // "Show as" formats read the parent node's group stats, so "% of group total" is a
            // node's share of its parent.
            const formatFunctions = columnInfo.getValueFormatFunctions(column.columnIdOrHeading);
            let summaryStats = null;

            if (formatFunctions && valueColumnIndex >= 0) {

                const parentGrouping = groupingEntries[levelCount - depth];

                if (parentGrouping && !levelsWithPopulatedStats.has(depth)) {

                    settings.summaryStats.populateStatsUsedByFunctions(
                        formatFunctions,
                        valueColumnIndex,
                        parentGrouping
                    );

                    levelsWithPopulatedStats.add(depth);
                }

                summaryStats = {
                    group: parentGroup?.summaryStats ?? null,
                    overall: DerivedSettings.getTotalsGroup(settings)?.summaryStats ?? null
                };
            }

            const nodes = [];

            groupsMap.forEach((group) => {

                // Skip nodes the cross-filters leave with no rows, along with their subtree.
                if (pruneToPresentNodes) {

                    const nodeCount = decompressValue(
                        group.groupValues.get(group.position, countColumnIndex),
                        countColumnIndex
                    );

                    if (nodeCount == null || !(Number(nodeCount) > 0)) return;
                }

                const groupValue = readGroupValue(group, column, positionInGroupBy);

                const rawValue = groupValue === null
                    ? "" : decompressValue(groupValue, column.columnIndex);

                const value = rawValue === null || rawValue === undefined ? "" : rawValue;

                const valueString = String(value);

                // Joined, the value path is the combination filter's tuple key.
                const nodeValues = ancestorValues.concat([valueString]);
                const nodeTupleKey = nodeValues.join(NODE_KEY_SEPARATOR);

                const aggregatedValue = valueColumnIndex >= 0
                    ? decompressValue(
                        group.groupValues.get(group.position, valueColumnIndex),
                        valueColumnIndex
                    )
                    : 0;

                const node = {
                    value,
                    valueString,
                    key: parentKey + NODE_KEY_SEPARATOR + valueString,
                    tupleKey: nodeTupleKey,
                    columnIdOrHeading: column.columnIdOrHeading,
                    columnIndex: column.columnIndex,
                    fallbackHeading: column.fallbackHeading,
                    aggregatedValue,
                    summaryStats,
                    depth,
                    isLeaf,
                    children: [],
                    leafTupleKeys: []
                };

                if (sortColumnIndex >= 0) {

                    node.sortValue = sortColumnIndex === valueColumnIndex
                        ? aggregatedValue
                        : decompressValue(
                            group.groupValues.get(group.position, sortColumnIndex),
                            sortColumnIndex
                        );
                }

                if (isLeaf) {

                    node.leafTupleKeys.push(nodeTupleKey);
                }
                else {

                    node.children =
                        buildNodes(group.containedGroups, depth + 1, node.key, nodeValues, group);

                    for (let i = 0; i < node.children.length; i++) {

                        const childLeafTupleKeys = node.children[i].leafTupleKeys;

                        for (let j = 0; j < childLeafTupleKeys.length; j++) {
                            node.leafTupleKeys.push(childLeafTupleKeys[j]);
                        }
                    }

                    // A branch holding only a blank or NULL (the sentinel, or the text "NULL") ends
                    // here, so levels can be of uneven depth.  The node's tuple key covers the
                    // combinations beneath it.
                    if (node.children.length === 1
                        && isBranchEndValue(node.children[0].valueString)) {

                        node.aggregatedValue = node.children[0].aggregatedValue;
                        node.children = [];
                        node.isLeaf = true;
                    }
                }

                nodes.push(node);
            });

            const unsortedNodes = isLeaf && !sortToggleChangesOrder
                ? nodes.slice()
                : null;

            // Mirrors buildOptions.
            if (sortConfig.byValue) {

                const valueSortKey = columnInfo.createValueSortKeyResolver(column);

                Ren.ArrayUtils.sortAuto(
                    nodes,
                    (node) => valueSortKey(node.value),
                    sortConfig.descending
                );

                columnInfo.moveNullEntriesFirst(nodes, (node) => node.value);
            }
            else if (sortConfig.column) {

                Ren.ArrayUtils.sortAuto(nodes, (node) => node.sortValue, sortConfig.descending);
            }
            else {

                Ren.ArrayUtils.sortAuto(
                    nodes,
                    (node) => node.aggregatedValue,
                    sortConfig.descending
                );
            }

            if (unsortedNodes !== null) {

                sortToggleChangesOrder =
                    sortToggleReorders(column, unsortedNodes, nodes, !!sortConfig.column);
            }

            return nodes;
        };

        const topGrouping = DerivedSettings.getValuesGrouping(settings);

        // The grand-total group is the top level's parent, for its group stats.
        const totalsGroup = DerivedSettings.getTotalsGroup(settings);

        const tree = buildNodes(
            topGrouping ? topGrouping.groups() : null,
            0,
            hierarchyKey,
            [],
            totalsGroup
        );

        tree.sortToggleChangesOrder = sortToggleChangesOrder;

        return tree;
    };

    // The cached nodes are shared, so the view must not write to them.
    const buildHierarchyTree = (hierarchyColumns) =>
        getCachedItemResult(
            "hierarchy-tree",
            ownColumnIdsOf(hierarchyColumns),
            ownCombinationKeyOf(hierarchyColumns),
            hierarchyConfigKey(hierarchyColumns),
            () => buildTree(hierarchyColumns)
        );

    return {
        invalidateCaches,
        getHierarchyColumns,
        getAncestorColumnsForLeaf,
        getHierarchyTotalDisplayValue,
        getHierarchyValueSummaryStats,
        buildHierarchyTree
    };
};
