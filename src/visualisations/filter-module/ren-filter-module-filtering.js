/**
 * Filter Module: the filtering behind the checkboxes - column value filters, and hierarchy,
 * compare and binned-column predicates - read and written through the filter target.  A grouping
 * level takes column value filters only.
 */
Ren.FilterModule_Filtering = (s) => {

    const { tabularData, columnModels, NODE_KEY_SEPARATOR } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { binning, columnInfo, filterTarget, itemSettings } = s;

    const FilterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;

    // Gets a column's filter, or null when every value is shown.  Read directly rather than
    // through the accessors, whose getters would leave an empty filter set behind to be saved.
    const getColumnFilter = (columnIdOrHeading) => {

        // A binned item's ticks are held as a predicate on the data rows.
        if (binning.filtersByPredicate(columnIdOrHeading)) {
            return getBinnedIncludedValues(columnIdOrHeading);
        }

        const filterSetParent = filterTarget.getFilterSetParent();
        if (!filterSetParent) return null;

        const columnValueFilters =
            filterSetParent.filterSet?.[tabularData.Title]?.columnValueFilters;

        const filterValues = columnValueFilters?.[columnIdOrHeading] ?? null;

        // A grouping level stores a binned item's bins expanded to the group values they cover.
        if (filterValues != null && binning.hasBinning(columnIdOrHeading)) {
            return binning.readBinnedValuesFromGroupValues(columnIdOrHeading, filterValues);
        }

        // A negated column stores the values it leaves out, but the module works in values shown.
        return Ren.ColumnValueSelection.toShownValues(
            tabularData,
            columnIdOrHeading,
            filterValues,
            filterTarget.isNegatedFilterColumn(columnIdOrHeading)
        );
    };

    // ===== Writing an item's ticks =====
    //
    // Every flat path writes through these, so a binned column's ticks land in the right place.

    const setFilterValues = (columnIdOrHeading, filterValues) => {

        if (binning.filtersByPredicate(columnIdOrHeading)) {

            setBinnedIncludedValues(columnIdOrHeading, filterValues);
            return;
        }

        if (binning.hasBinning(columnIdOrHeading)) {

            filterTarget.setColumnFilterValues(
                columnIdOrHeading,
                binning.expandBinnedValuesToGroupValues(columnIdOrHeading, filterValues)
            );

            return;
        }

        // A negated column stores everything it holds but the values selected.
        filterTarget.setColumnFilterValues(
            columnIdOrHeading,
            Ren.ColumnValueSelection.toStoredValues(
                tabularData,
                columnIdOrHeading,
                filterValues,
                filterTarget.isNegatedFilterColumn(columnIdOrHeading)
            )
        );
    };

    const removeFilter = (columnIdOrHeading) => {

        if (binning.filtersByPredicate(columnIdOrHeading)) {

            setBinnedIncludedValues(columnIdOrHeading, null);
            return;
        }

        filterTarget.removeColumnFilter(columnIdOrHeading);
    };

    // A binned or negated column's stored filter isn't its ticks, so it is rewritten whole from
    // the ticks already read, as reading a binned one re-bins every group.
    const toggleFilterValue = (columnIdOrHeading, filterValue, currentFilter) => {

        if (!binning.hasBinning(columnIdOrHeading)
            && !filterTarget.isNegatedFilterColumn(columnIdOrHeading)) {

            filterTarget.toggleColumnFilterValue(columnIdOrHeading, filterValue);
            return;
        }

        setFilterValues(
            columnIdOrHeading,
            Ren.ColumnValueSelection.toggleValue(currentFilter ?? [], filterValue)
        );
    };

    // ===== Negative filters =====
    //
    // Flipping the form reads the selection before the mark changes and writes it back after, so
    // the same values stay ticked.  Not offered on binned items or grouping levels, which have no
    // set of the column's own values to complement.

    const isFilterNegated = (columnIdOrHeading) =>
        filterTarget.isNegatedFilterColumn(columnIdOrHeading);

    const canNegateFilter = (columnIdOrHeading) =>
        !filterTarget.isGroupingTarget && !binning.hasBinning(columnIdOrHeading);

    const setFilterNegated = (columnIdOrHeading, isNegated) => {

        if (!canNegateFilter(columnIdOrHeading)) return;

        // A hierarchy's ticks are a predicate rather than a list of the column's own values.
        const hierarchy = hierarchiesByLeafColumn.get(columnIdOrHeading);

        if (hierarchy) {

            setHierarchyFilterNegated(hierarchy, isNegated);
            return;
        }

        // Read while the mark still says how the stored list should be read.
        const selectedValues = getColumnFilter(columnIdOrHeading);

        filterTarget.setNegatedFilterColumn(columnIdOrHeading, isNegated);

        // No filter reads the same in both forms.
        if (selectedValues == null) return;

        setFilterValues(columnIdOrHeading, selectedValues);
    };

    const toggleFilterNegated = (columnIdOrHeading) =>
        setFilterNegated(columnIdOrHeading, !isFilterNegated(columnIdOrHeading));

    // The single-select click rule, shared by the flat and hierarchy paths: Ctrl+click adds an
    // unselected target, clicking the sole selection selects everything, and any other click
    // narrows to the target.
    const applySingleSelectClick = (selection, target, addToSelection) => {

        if (addToSelection && !selection.isSelected(target)) {
            selection.add(target);
        }
        else if (selection.isSoleSelection(target)) {

            selection.selectAll();
        }
        else {

            selection.selectOnly(target);
        }
    };

    // The single-select adapter for a flat column.  A null filter means every value is selected.
    const buildFlatSingleSelection = (columnIdOrHeading, currentFilter) => {

        const isSelected = (value) => Ren.ColumnValueSelection.isValueShown(currentFilter, value);

        const isSoleSelection = (value) =>
            currentFilter != null && currentFilter.length === 1
                && String(currentFilter[0]) === String(value);

        const add = (value) =>
            setFilterValues(columnIdOrHeading, currentFilter.concat([value]));

        const selectOnly = (value) => setFilterValues(columnIdOrHeading, [value]);

        const selectAll = () => removeFilter(columnIdOrHeading);

        return { isSelected, isSoleSelection, add, selectOnly, selectAll };
    };

    // Ticks or unticks one value: a multi-select left-click, or a single-select right-click.
    const toggleOption = (item, value, currentFilter) => {

        if (currentFilter == null) {

            const newFilter = Ren.ColumnValueSelection.toggleValue(
                null,
                value,
                item.options.map(option => option.value)
            );

            if (newFilter !== null) setFilterValues(item.columnIdOrHeading, newFilter);
        }
        else {

            toggleFilterValue(item.columnIdOrHeading, value, currentFilter);
        }
    };

    const onCheckboxToggled = (item, value, addToSelection) => {

        const currentFilter = getColumnFilter(item.columnIdOrHeading);

        if (itemSettings.isSingleSelect(item.columnIdOrHeading)) {

            applySingleSelectClick(
                buildFlatSingleSelection(item.columnIdOrHeading, currentFilter),
                value,
                addToSelection
            );

            return;
        }

        toggleOption(item, value, currentFilter);
    };

    // A right-click does what a left-click does in the other mode: it narrows a multi-select
    // column to the value, and toggles the value on a single-select one.
    const onCheckboxRightClicked = (item, value) => {

        if (!itemSettings.isSingleSelect(item.columnIdOrHeading)) {

            setFilterValues(item.columnIdOrHeading, [value]);
            return;
        }

        toggleOption(item, value, getColumnFilter(item.columnIdOrHeading));
    };

    // Gets a value indicating whether every one of a column's options is selected.
    const areAllOptionsSelected = (item, currentFilter) => {

        if (currentFilter == null) return true;

        // A set, so a column with thousands of options doesn't scan the filter once per option.
        const selectedValues = new Set();

        for (let i = 0; i < currentFilter.length; i++) selectedValues.add(String(currentFilter[i]));

        for (let i = 0; i < item.options.length; i++) {

            if (!selectedValues.has(String(item.options[i].value))) return false;
        }

        return true;
    };

    // Clears a filter selecting every value as its column is taken off the module: it restricts
    // nothing but still counts as a filter, so Edit Groupings would bring the item back.
    // getOptions is only called where there is a filter to weigh.
    const clearColumnFilterIfNotRestricting = (columnIdOrHeading, getOptions) => {

        const currentFilter = getColumnFilter(columnIdOrHeading);

        if (currentFilter == null) return;

        const options = getOptions();

        // With no options, everything reads as selected whatever the filter holds.
        if (!options.length) return;

        if (areAllOptionsSelected({ options }, currentFilter)) {
            removeFilter(columnIdOrHeading);
        }
    };

    // With every value selected, clears them all (an empty filter shows nothing).
    const onAllToggled = (item) => {

        const currentFilter = getColumnFilter(item.columnIdOrHeading);

        if (areAllOptionsSelected(item, currentFilter)) {
            setFilterValues(item.columnIdOrHeading, []);
        }
        else {

            removeFilter(item.columnIdOrHeading);
        }
    };

    // Gets a value indicating whether a Boolean column's filter shows its "Yes" rows alone, which
    // is what ticks the item's single checkbox.
    const isYesOnlyFilter = (currentFilter) => {

        if (currentFilter == null) return false;

        let hasYes = false;

        for (let i = 0; i < currentFilter.length; i++) {

            const value = String(currentFilter[i]);

            if (value === "0") return false;

            if (value === "1") hasYes = true;
        }

        return hasYes;
    };

    // Ticking shows "Yes" alone.  Unticking shows "No" alone, or both where the item is set to
    // "Yes or both".
    const onBooleanCheckboxToggled = (item) => {

        const columnIdOrHeading = item.columnIdOrHeading;

        if (!isYesOnlyFilter(getColumnFilter(columnIdOrHeading))) {

            setFilterValues(columnIdOrHeading, ["1"]);
            return;
        }

        if (itemSettings.getShowAsCheckbox(columnIdOrHeading) === "YesOrNo") {
            setFilterValues(columnIdOrHeading, ["0"]);
        }
        else {

            removeFilter(columnIdOrHeading);
        }
    };

    // Only the column's own options are weighed, so values it no longer shows are dropped.
    const onInvertToggled = (item) => {

        const currentFilter = getColumnFilter(item.columnIdOrHeading);

        if (currentFilter == null) {

            setFilterValues(item.columnIdOrHeading, []);
            return;
        }

        // A set, so a column with thousands of options doesn't scan the filter once per option.
        const selectedValues = new Set();

        for (let i = 0; i < currentFilter.length; i++) selectedValues.add(String(currentFilter[i]));

        const inverted = [];

        for (let i = 0; i < item.options.length; i++) {

            const value = item.options[i].value;

            if (!selectedValues.has(String(value))) inverted.push(value);
        }

        setFilterValues(item.columnIdOrHeading, inverted);
    };

    // ===== Hierarchy combination filtering =====
    //
    // A hierarchical item filters on ancestor->leaf value combinations, stated as a combination
    // predicate: an includeCombinations one naming the combinations kept where the item's filter
    // is positive, and an excludeCombinations one naming those left out where it is negative.  A
    // tuple may stop short of the leaf, standing for every combination beneath it, which is how a
    // whole department is one tuple rather than one per product (see Ren.FilterModule_TupleKeys).
    // A derived level (a date period) states its calc function too, so the functions below take
    // the whole chain.

    const TupleKeys = Ren.FilterModule_TupleKeys;

    // Gets a key for a hierarchy's chain.  Plain columns give the key they always did, so
    // predicates saved before derived levels existed still match.
    const columnsKeyOf = (chain) => JSON.stringify(chain);

    // Gets the chain a stored combination predicate states.
    const chainOfPredicate = (predicate) => {

        const columns = predicate.columns ?? [];
        const calcFunctions = predicate.calcFunctions;

        if (!calcFunctions) return columns;

        return columns.map((column, index) => calcFunctions[index]
            ? { column, calcFunction: calcFunctions[index] }
            : column);
    };

    // Gets a chain's column identifiers, and its calc functions (null where it has none).
    const predicateColumnsOf = (chain) => chain.map((entry) => columnInfo.getEntryColumnIdOrHeading(entry));

    const predicateCalcFunctionsOf = (chain) => {

        let hasCalcFunction = false;

        const calcFunctions = chain.map((entry) => {

            const calcFunction = columnInfo.getEntryCalcFunction(entry);
            if (calcFunction) hasCalcFunction = true;

            return calcFunction;
        });

        return hasCalcFunction ? calcFunctions : null;
    };

    // Also built by the counts module for its selection-filtered total.
    const buildCombinationsPredicate = (chain, selection) => {

        const tuples = [];
        selection.keys.forEach((tupleKey) => tuples.push(tupleKey.split(NODE_KEY_SEPARATOR)));

        const predicate = {
            type: selection.isPositive ? "includeCombinations" : "excludeCombinations",
            columns: predicateColumnsOf(chain),
            tuples
        };

        const calcFunctions = predicateCalcFunctionsOf(chain);

        if (calcFunctions) predicate.calcFunctions = calcFunctions;

        return predicate;
    };

    // Gets the data rows' predicates, or an empty array where the module filters a grouping,
    // which takes none.  Compare filters go through the filter target instead.
    const getRowPredicates = () => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings || !filterTarget.supportsRowPredicates) return [];

        return getDataRowsPredicates(settings);
    };

    // Read whatever the module filters, as the cross-filter is about which rows still exist.
    const getDataRowsPredicates = (settings) =>
        Ren.DataGroupingSettings_Services_FilterAccessors.getRowFilterPredicates(
            settings.dataRows,
            tabularData
        );

    // A hierarchy always spans at least two columns, so the one-column includeCombinations
    // predicate a binned column holds its bins in is never taken for one.
    const isHierarchyPredicate = (predicate, chainKey) =>
        (predicate.type === "excludeCombinations" || predicate.type === "includeCombinations")
            && columnsKeyOf(chainOfPredicate(predicate)) === chainKey;

    /**
     * Gets a hierarchy's filter as the combinations it states and the sense it states them in: a
     * positive filter names what is kept and a negative one what is left out.  A hierarchy with no
     * filter reads as a negative one stating nothing, which leaves the whole tree ticked.
     */
    const getHierarchySelection = (chain) => {

        const chainKey = columnsKeyOf(chain);
        const predicates = getRowPredicates();

        for (let i = 0; i < predicates.length; i++) {

            const predicate = predicates[i];

            if (!isHierarchyPredicate(predicate, chainKey)) continue;

            const keys = new Set();
            const tuples = predicate.tuples ?? [];

            for (let j = 0; j < tuples.length; j++) {
                keys.add(tuples[j].join(NODE_KEY_SEPARATOR));
            }

            return { keys, isPositive: predicate.type === "includeCombinations" };
        }

        return { keys: new Set(), isPositive: false };
    };

    // A hierarchical item is marked on its leaf level, so that is where the sense its filter is
    // written in is read from too.  A derived level is not a column of the data, so the mark is
    // held against the level key the rest of the item's settings use rather than the chain's.
    const hierarchyLeafColumnsByChainKey = new Map();

    const hierarchyLeafColumnOf = (chain) =>
        hierarchyLeafColumnsByChainKey.get(columnsKeyOf(chain))
            ?? columnInfo.getEntryColumnIdOrHeading(chain[chain.length - 1]);

    const isHierarchyStatedPositively = (chain) =>
        !filterTarget.isNegatedFilterColumn(hierarchyLeafColumnOf(chain));

    /**
     * Reads a hierarchy's filter in the sense it is to be written back in: the one its mark asks
     * for, restated the other way round where the stored filter disagrees, and as shallowly as the
     * tree allows, so a settings file stating every leaf is written back short.
     */
    const getWorkingHierarchySelection = (chain, rootNodes) => {

        const stored = getHierarchySelection(chain);
        const isPositive = isHierarchyStatedPositively(chain);

        let keys = TupleKeys.canonicalise(stored.keys, rootNodes, stored.isPositive);

        if (stored.isPositive !== isPositive) keys = TupleKeys.invert(keys, rootNodes);

        return { keys, isPositive };
    };

    // Replaces only this hierarchy's predicate.  A selection leaving the whole tree ticked is no
    // filter at all, so it removes it rather than stating every combination there is.
    const setHierarchySelection = (chain, selection, rootNodes) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings || !filterTarget.supportsRowPredicates) return;

        const chainKey = columnsKeyOf(chain);

        const predicates = getRowPredicates().filter(
            (predicate) => !isHierarchyPredicate(predicate, chainKey)
        );

        const reader = TupleKeys.createReader(selection.keys, selection.isPositive);

        if (!reader.areAllNodesSelected(rootNodes)) {

            predicates.push(buildCombinationsPredicate(chain, selection));
        }

        settings.sortFilterGroup.setRowFilterPredicates(predicates);
    };

    // ===== A hierarchy's own positive and negative forms =====
    //
    // A hierarchical item registers itself as it is rendered, as flipping its filter between the
    // two restates the predicate it holds, and restating it needs the tree.

    const hierarchiesByLeafColumn = new Map();

    const registerHierarchy = (chain, leafColumnIdOrHeading, getRootNodes) => {

        hierarchyLeafColumnsByChainKey.set(columnsKeyOf(chain), leafColumnIdOrHeading);
        hierarchiesByLeafColumn.set(leafColumnIdOrHeading, { chain, getRootNodes });
    };

    const forgetHierarchies = () => {

        hierarchyLeafColumnsByChainKey.clear();
        hierarchiesByLeafColumn.clear();
    };

    // Restates the filter the way its new mark asks for, so the same combinations stay ticked.
    const setHierarchyFilterNegated = (hierarchy, isNegated) => {

        const rootNodes = hierarchy.getRootNodes();

        filterTarget.setNegatedFilterColumn(hierarchyLeafColumnOf(hierarchy.chain), isNegated);

        setHierarchySelection(
            hierarchy.chain,
            getWorkingHierarchySelection(hierarchy.chain, rootNodes),
            rootNodes
        );
    };

    // ===== A hierarchy's ticks =====
    //
    // Every operation goes through Ren.FilterModule_TupleKeys, which keeps the stated keys
    // canonical: a whole branch is one key rather than one per leaf beneath it.  So a node is
    // given its ancestors (root first), and a tree-wide one the tree's root nodes.
    //
    // Nothing filtered out at all is stated as an empty negative selection, which reads as no
    // filter whichever way round the item writes its own.

    const NOTHING_FILTERED_OUT = { keys: new Set(), isPositive: false };

    // Ticks or unticks a node and everything under it.
    const toggleHierarchyNode = (chain, rootNodes, node, ancestors) => {

        const selection = getWorkingHierarchySelection(chain, rootNodes);

        TupleKeys.toggleNode(selection.keys, node, ancestors, selection.isPositive);

        setHierarchySelection(chain, selection, rootNodes);
    };

    // The single-select adapter for a hierarchy node.  It acts on the node's own path, so a value
    // recurring under several parents keeps only the path clicked.
    const buildHierarchySingleSelection = (chain, rootNodes, selection) => {

        const isSelected = (target) =>
            TupleKeys.isNodeSelected(selection.keys, target.node, selection.isPositive);

        const isSoleSelection = (target) => TupleKeys.isSoleSelection(
            selection.keys,
            target.node,
            target.ancestors,
            rootNodes,
            selection.isPositive
        );

        const add = (target) => {

            TupleKeys.selectNode(
                selection.keys,
                target.node,
                target.ancestors,
                selection.isPositive
            );

            setHierarchySelection(chain, selection, rootNodes);
        };

        const selectOnly = (target) => setHierarchySelection(
            chain,
            {
                keys: TupleKeys.selectOnlyNode(
                    target.node,
                    target.ancestors,
                    rootNodes,
                    selection.isPositive
                ),
                isPositive: selection.isPositive
            },
            rootNodes
        );

        const selectAll = () => setHierarchySelection(chain, NOTHING_FILTERED_OUT, rootNodes);

        return { isSelected, isSoleSelection, add, selectOnly, selectAll };
    };

    // Single-select is tree-wide, so narrowing to a node deselects every other node in the tree.
    const toggleHierarchySingleSelect = (chain, rootNodes, clickedNode, ancestors, addToSelection) => {

        const selection = getWorkingHierarchySelection(chain, rootNodes);

        applySingleSelectClick(
            buildHierarchySingleSelection(chain, rootNodes, selection),
            { node: clickedNode, ancestors },
            addToSelection
        );
    };

    // A multi-select tree's right-click; a single-select tree's uses the plain toggles instead.
    const onHierarchyNodeRightClicked = (chain, rootNodes, clickedNode, ancestors) => {

        const selection = getWorkingHierarchySelection(chain, rootNodes);

        buildHierarchySingleSelection(chain, rootNodes, selection)
            .selectOnly({ node: clickedNode, ancestors });
    };

    // With everything ticked, unticks everything, as the flat "All" does.
    const onHierarchyAllToggled = (chain, rootNodes) => {

        const selection = getWorkingHierarchySelection(chain, rootNodes);
        const reader = TupleKeys.createReader(selection.keys, selection.isPositive);

        if (!reader.areAllNodesSelected(rootNodes)) {

            setHierarchySelection(chain, NOTHING_FILTERED_OUT, rootNodes);
            return;
        }

        setHierarchySelection(
            chain,
            {
                keys: TupleKeys.excludeAllNodes(rootNodes, selection.isPositive),
                isPositive: selection.isPositive
            },
            rootNodes
        );
    };

    const onHierarchyInvertToggled = (chain, rootNodes) => {

        const selection = getWorkingHierarchySelection(chain, rootNodes);

        setHierarchySelection(
            chain,
            {
                keys: TupleKeys.invert(selection.keys, rootNodes),
                isPositive: selection.isPositive
            },
            rootNodes
        );
    };

    // ===== A binned column's ticks =====
    //
    // Written as an includeCombinations predicate carrying the binning function, found by its
    // column alone so that changing the binning function rewrites it rather than adding another.

    const isBinnedIncludePredicate = (predicate, columnIdOrHeading) =>
        predicate.type === "includeCombinations"
            && Array.isArray(predicate.columns)
            && predicate.columns.length === 1
            && predicate.columns[0] === columnIdOrHeading;

    // Gets the bins a binned column includes, or null where it includes them all.
    const getBinnedIncludedValues = (columnIdOrHeading) => {

        const predicates = getRowPredicates();

        for (let i = 0; i < predicates.length; i++) {

            if (!isBinnedIncludePredicate(predicates[i], columnIdOrHeading)) continue;

            const tuples = predicates[i].tuples ?? [];
            const values = [];

            for (let j = 0; j < tuples.length; j++) values.push(tuples[j][0]);

            return values;
        }

        return null;
    };

    // Replaces only this column's predicate.  Null removes it; an empty list shows nothing.
    const setBinnedIncludedValues = (columnIdOrHeading, binnedValues) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings || !filterTarget.supportsRowPredicates) return;

        const predicates = getRowPredicates().filter(
            (predicate) => !isBinnedIncludePredicate(predicate, columnIdOrHeading)
        );

        if (binnedValues != null) {
            predicates.push(buildBinnedIncludePredicate(columnIdOrHeading, binnedValues));
        }

        settings.sortFilterGroup.setRowFilterPredicates(predicates);
    };

    // Also built by the counts module for its selection-filtered total.
    const buildBinnedIncludePredicate = (columnIdOrHeading, binnedValues) => {

        const tuples = [];

        for (let i = 0; i < binnedValues.length; i++) tuples.push([String(binnedValues[i])]);

        const chain = binning.getBinnedChain(columnIdOrHeading);

        const predicate = {
            type: "includeCombinations",
            columns: predicateColumnsOf(chain),
            tuples
        };

        const calcFunctions = predicateCalcFunctionsOf(chain);

        if (calcFunctions) predicate.calcFunctions = calcFunctions;

        return predicate;
    };

    // ===== Compare filter =====
    //
    // Offered whatever the module filters, so written through the filter target.  On a grouping
    // level they match its group rows, so "greater than 1000" states a group's total.

    const getComparePredicateList = () => filterTarget.getPredicates();

    // Gets the compare predicate a column carries in one of its slots, or null.
    const getComparePredicateForColumn = (columnIdOrHeading, slot) =>
        Ren.FilterCompareOperators.getComparePredicateForColumn(
            getComparePredicateList(),
            columnIdOrHeading,
            slot
        );

    // Gets the slots a column's compare predicates occupy, so a new one takes a free slot.
    const getUsedCompareSlotsForColumn = (columnIdOrHeading) =>
        Ren.FilterCompareOperators.getUsedSlotsForColumn(
            getComparePredicateList(),
            columnIdOrHeading
        );

    // Writes, or clears when null, one of a column's compare predicates, keeping every other.
    // A binned column's predicate carries its binning function.
    const applyComparePredicate = (columnIdOrHeading, slot, predicate) => {

        if (predicate) {

            const binningSpec = binning.getBinningSpec(columnIdOrHeading);

            if (binningSpec) predicate.calcFunction = binningSpec;
        }

        const next = Ren.FilterCompareOperators.replaceComparePredicateForColumn(
            getComparePredicateList(),
            columnIdOrHeading,
            predicate,
            slot
        );

        filterTarget.setPredicates(next);
    };

    // Renames an OR group whose first slot is being removed, so its filters stay ORed.  The new
    // first slot names the group, so carries no orGroup of its own.
    const renameCompareOrGroup = (columnIdOrHeading, slots) => {

        const lead = slots[0];
        const predicates = getComparePredicateList();
        const next = [];
        let isChanged = false;

        for (let i = 0; i < predicates.length; i++) {

            const predicate = predicates[i];
            const slot = Ren.FilterCompareOperators.slotOf(predicate);
            const isRenamed = predicate.type === "compare"
                && predicate.column === columnIdOrHeading
                && slots.indexOf(slot) !== -1;

            if (!isRenamed) {

                next.push(predicate);
                continue;
            }

            const renamed = Object.assign({}, predicate);

            if (slot === lead) {
                delete renamed.orGroup;
            }
            else {

                renamed.orGroup = lead;
            }

            next.push(renamed);
            isChanged = true;
        }

        if (isChanged) filterTarget.setPredicates(next);
    };

    // Used as compare strips are removed, since a filter left without a control is invisible.
    const clearComparePredicatesForColumn = (columnIdOrHeading) => {

        const existing = getComparePredicateList();

        const predicates = existing.filter(
            (predicate) => !(predicate.type === "compare" && predicate.column === columnIdOrHeading)
        );

        // Nothing to withdraw: writing anyway would re-apply the settings for no change.
        if (predicates.length === existing.length) return;

        filterTarget.setPredicates(predicates);
    };

    // Gets { isFiltering, clear } for everything an item filters by: its ticks, held however its
    // column holds them, and its compare filters.  The item's hierarchy is taken now, as the
    // render that follows removing the item forgets it.
    const createItemFilterClearer = (item) => {

        const leafColumnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);

        const hierarchy = filterTarget.supportsRowPredicates
            ? hierarchiesByLeafColumn.get(leafColumnIdOrHeading)
            : null;

        const isFiltering = () => {

            if (getUsedCompareSlotsForColumn(item.columnIdOrHeading).length > 0) return true;

            if (hierarchy) {

                const selection = getHierarchySelection(hierarchy.chain);
                return selection.isPositive || selection.keys.size > 0;
            }

            return getColumnFilter(leafColumnIdOrHeading) != null;
        };

        const clear = () => {

            if (hierarchy) {

                setHierarchySelection(
                    hierarchy.chain,
                    NOTHING_FILTERED_OUT,
                    hierarchy.getRootNodes()
                );
            }
            else if (getColumnFilter(leafColumnIdOrHeading) != null) {

                removeFilter(leafColumnIdOrHeading);
            }

            clearComparePredicatesForColumn(item.columnIdOrHeading);
        };

        return {
            isFiltering,
            clear
        };
    };

    // Gets a column's value kind ("text", "number" or "date"); Boolean and enum columns are text.
    const getColumnKindForColumnIndex = (columnIndex) => {

        const columnModel = columnModels[columnIndex];
        return columnModel
            ? Ren.FilterCompareOperators.columnKindForFormat(columnModel.ColumnFormat)
            : "text";
    };

    // ===== Cross-filtering an item's counts =====
    //
    // An item's counts are filtered by the page's other filters, minus its own selection, so it
    // never hides its own values in response to its own ticks.  A filter on the same column
    // elsewhere (the data rows, or another grouping level) is another item's and still applies.

    // A column filtered on several levels keeps only the values all of them allow.
    const mergeColumnValueFilters = (mergedFilters, columnValueFilters, excludedColumnIds) => {

        for (const columnIdOrHeading in columnValueFilters) {

            if (excludedColumnIds && excludedColumnIds.has(columnIdOrHeading)) continue;

            const filterValues = columnValueFilters[columnIdOrHeading];
            if (!filterValues) continue;

            const existingValues = mergedFilters[columnIdOrHeading];

            if (!existingValues) {

                mergedFilters[columnIdOrHeading] = filterValues.slice();
                continue;
            }

            const existingValueSet = new Set();

            for (let i = 0; i < existingValues.length; i++) {
                existingValueSet.add(String(existingValues[i]));
            }

            const intersection = [];

            for (let i = 0; i < filterValues.length; i++) {

                if (existingValueSet.has(String(filterValues[i]))) intersection.push(filterValues[i]);
            }

            mergedFilters[columnIdOrHeading] = intersection;
        }
    };

    // Gets the source's filters minus the item's own selection, or null when nothing is left to
    // filter by.  ownCombinationKey is the key of the item's own predicate chain, or null.
    const buildCrossFilterSetExcludingColumns = (ownColumnIds, ownCombinationKey) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return null;

        // A module pointed at a grouping drives no data-row filter, so leaves nothing out of it.
        const ownColumnIdSet = new Set(ownColumnIds);
        const ownDataRowsColumnIdSet = new Set(filterTarget.isGroupingTarget ? [] : ownColumnIds);
        const ownGrouping = filterTarget.isGroupingTarget ? filterTarget.getTargetGrouping() : null;

        // Read as inclusion lists, as a negated column's exclusions can't be intersected directly.
        const sourceColumnValueFilters =
            Ren.FilterNegation.toInclusionColumnValueFiltersOf(tabularData, settings.dataRows) ?? {};

        const columnValueFilters = {};

        mergeColumnValueFilters(
            columnValueFilters,
            sourceColumnValueFilters,
            ownDataRowsColumnIdSet
        );

        const groupingFilters =
            FilterAccessors.getRowFilterableGroupingColumnValueFilters(settings, tabularData);

        for (let i = 0; i < groupingFilters.length; i++) {

            mergeColumnValueFilters(
                columnValueFilters,
                Ren.FilterNegation.toInclusionColumnValueFilters(
                    tabularData,
                    groupingFilters[i].columnValueFilters,
                    groupingFilters[i].negatedColumns
                ),
                groupingFilters[i].grouping === ownGrouping ? ownColumnIdSet : null
            );
        }

        // The same levels' binned and compare filters, held as predicates.  A binned filter on the
        // item's own column is its own selection and is left out; a compare filter never is.
        const groupingPredicates = [];

        for (let i = 0; i < groupingFilters.length; i++) {

            const isOwnGrouping = groupingFilters[i].grouping === ownGrouping;
            const levelPredicates = groupingFilters[i].rowFilterPredicates ?? [];

            for (let j = 0; j < levelPredicates.length; j++) {

                const predicate = levelPredicates[j];
                const isOwnColumn = predicate.type !== "compare"
                    && ownColumnIdSet.has(predicate.columns[0]);

                if (isOwnGrouping && isOwnColumn) continue;

                groupingPredicates.push(predicate);
            }
        }

        // A combination predicate over exactly the item's own chain is its tick state.  A compare
        // filter never is, as it states which rows exist rather than what is ticked.
        const predicateTargetsOnlyOwnColumns = (predicate) => {

            if (predicate.type === "excludeCombinations" || predicate.type === "includeCombinations") {

                return ownCombinationKey != null
                    && columnsKeyOf(chainOfPredicate(predicate)) === ownCombinationKey;
            }

            return false;
        };

        const predicates = [];
        const sourcePredicates = getDataRowsPredicates(settings);

        for (let i = 0; i < sourcePredicates.length; i++) {

            if (predicateTargetsOnlyOwnColumns(sourcePredicates[i])) continue;
            predicates.push(Ren.ObjectUtils.cloneDeep(sourcePredicates[i]));
        }

        // Built here, so there is nothing to clone.
        for (let i = 0; i < groupingPredicates.length; i++) {
            predicates.push(groupingPredicates[i]);
        }

        const hasColumnValueFilters = Object.keys(columnValueFilters).length > 0;

        if (!hasColumnValueFilters && predicates.length === 0) return null;

        return { columnValueFilters, predicates };
    };

    // Writes the cross-filter onto scratch counts settings, returning whether any was applied.
    const applyCrossFilterToScratchSettings = (scratchSettings, ownColumnIds, ownCombinationKey) => {

        const crossFilter = buildCrossFilterSetExcludingColumns(ownColumnIds, ownCombinationKey);

        if (!crossFilter) return false;

        FilterAccessors.setColumnValueFilters(
            scratchSettings.dataRows,
            tabularData,
            crossFilter.columnValueFilters
        );

        if (crossFilter.predicates.length) {

            FilterAccessors.setRowFilterPredicates(
                scratchSettings.dataRows,
                tabularData,
                crossFilter.predicates
            );
        }

        return true;
    };

    return {
        getColumnFilter,
        isFilterNegated,
        canNegateFilter,
        setFilterNegated,
        toggleFilterNegated,
        onCheckboxToggled,
        onCheckboxRightClicked,
        areAllOptionsSelected,
        clearColumnFilterIfNotRestricting,
        onAllToggled,
        isYesOnlyFilter,
        onBooleanCheckboxToggled,
        onInvertToggled,
        onHierarchyInvertToggled,
        columnsKeyOf,
        buildCombinationsPredicate,
        getRowPredicates,
        getHierarchySelection,
        registerHierarchy,
        forgetHierarchies,
        toggleHierarchyNode,
        toggleHierarchySingleSelect,
        onHierarchyNodeRightClicked,
        onHierarchyAllToggled,
        getComparePredicateForColumn,
        getUsedCompareSlotsForColumn,
        applyComparePredicate,
        renameCompareOrGroup,
        clearComparePredicatesForColumn,
        createItemFilterClearer,
        getBinnedIncludedValues,
        buildBinnedIncludePredicate,
        getColumnKindForColumnIndex,
        buildCrossFilterSetExcludingColumns,
        applyCrossFilterToScratchSettings
    };
};
