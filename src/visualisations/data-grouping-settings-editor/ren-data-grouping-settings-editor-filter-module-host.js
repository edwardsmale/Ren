/**
 * Edit Groupings: one tile's filters, shown as a real Filter Module pointed at the tile's level by
 * its filter target.  It is built directly against a visualisation standing in front of the
 * editor's, so it shares the editor's lifetime and report context and nothing on it is saved.
 * A filter module shows no column until told to, so every column filtered at the level is
 * whitelisted into it before each render, with the per-column settings of the report's own filter
 * modules so that an item looks and behaves as its counterpart there does.
 */
Ren.DataGroupingSettingsEditorFilterModuleHost = (context) => {

    const { tabularData, tabTitle, visualisation, sourceVisualisation, filterTarget } = context;

    // Shown from the first render whether or not it is filtered at this level, as when the window
    // is opened from a cell to edit its level's filters.  Only included once, so that removing its
    // item keeps it removed.
    let initiallyIncludedColumnKey = context.initiallyIncludedColumnKey;

    // The host is kept across the editor's re-renders and simply re-parented into each newly built
    // tile, so the module inside it - and the value counts it has computed - outlive them.
    const element = Ren.HtmlUtils.create("div")._style("display", "contents");

    // Held here rather than on the visualisation so they survive the module being created again.
    const columnOverrides = {};

    let filterModule = null;
    let hasInitialisedColumnOverrides = false;

    // ===== Settings taken from the report's own filter modules =====
    //
    // An item built from nothing but a column name comes up flat and unformatted, which for a
    // hierarchical column means every leaf value at the top level.  So the report's own filter
    // modules over the same grid are found and their per-column settings - hierarchy, binning,
    // headings, value columns and formats - are taken as this module's, leaving only "included" to
    // be decided by what is actually filtered at this level.

    const getSourceDataGroupingSettings = (filterModuleVisualisation) =>
        Ren.DataGroupingSettingsSource.resolve(
            filterModuleVisualisation.sourceDataGroupingSettingsGroup,
            filterModuleVisualisation.sourceVisualisation,
            filterModuleVisualisation.sourceDataGroupingSettings,
            filterModuleVisualisation.dataTabIndex
        );

    // Matched on the settings they drive rather than the group name, which a module authored in a
    // report's JSON states before the report context has been prefixed onto it.
    const getSourceFilterModuleVisualisations = (sourceDataGroupingSettings) => {

        const candidates = Ren.VisualisationCollection.getVisualisations("FilterModule");
        const matches = [];

        for (let i = 0; i < candidates.length; i++) {

            const candidate = candidates[i];

            if (!candidate.columnOverrides) continue;

            if (candidate.sourceVisualisation === sourceVisualisation
                || (sourceDataGroupingSettings
                    && getSourceDataGroupingSettings(candidate) === sourceDataGroupingSettings)) {

                matches.push(candidate);
            }
        }

        return matches;
    };

    // Filled in setting by setting rather than copied over the entry, as an earlier render may have
    // put a column in already, and one level deep so that nothing here writes back into the module
    // the settings came from.
    const initialiseColumnOverride = (columnKey, sourceOverride, isHierarchyParent) => {

        const entry = columnOverrides[columnKey] ??= {};
        const settingNames = Object.keys(sourceOverride);

        for (let i = 0; i < settingNames.length; i++) {

            const settingName = settingNames[i];

            // Decided per level from the filters in effect there, not inherited.
            if (settingName === "included") continue;

            // A hierarchy parent's heading names the whole hierarchical item, not the column.
            if (isHierarchyParent && settingName === "HeadingOverride") continue;

            if (entry[settingName] === undefined) entry[settingName] = sourceOverride[settingName];
        }
    };

    // Gets the columns the source overrides name as a hierarchy's parent levels.
    const getHierarchyParentColumnKeys = (sourceOverrides) => {

        const parentColumnKeys = new Set();
        const columnKeys = Object.keys(sourceOverrides);

        for (let i = 0; i < columnKeys.length; i++) {

            const parentGroupings = sourceOverrides[columnKeys[i]]?.parentGroupings;

            if (!Array.isArray(parentGroupings)) continue;

            for (let j = 0; j < parentGroupings.length; j++) {

                const parentGrouping = parentGroupings[j];

                parentColumnKeys.add(
                    typeof parentGrouping === "string" ? parentGrouping : parentGrouping?.column
                );
            }
        }

        return parentColumnKeys;
    };

    const initialiseColumnOverrides = () => {

        if (hasInitialisedColumnOverrides) return;

        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceVisualisation);

        const filterModuleVisualisations =
            getSourceFilterModuleVisualisations(source.dataGroupingSettings);

        // Left uninitialised so that a module rendering later still gets the chance to supply them.
        if (!filterModuleVisualisations.length) return;

        for (let i = 0; i < filterModuleVisualisations.length; i++) {

            const sourceOverrides = filterModuleVisualisations[i].columnOverrides;
            const columnKeys = Object.keys(sourceOverrides);
            const parentColumnKeys = getHierarchyParentColumnKeys(sourceOverrides);

            for (let j = 0; j < columnKeys.length; j++) {

                initialiseColumnOverride(
                    columnKeys[j],
                    sourceOverrides[columnKeys[j]],
                    parentColumnKeys.has(columnKeys[j])
                );
            }
        }

        hasInitialisedColumnOverrides = true;
    };

    const getColumnValueFilters = (filterSetParent) =>
        filterSetParent?.filterSet?.[tabTitle]?.columnValueFilters ?? {};

    const getRowFilterPredicates = (filterSetParent) =>
        filterSetParent?.filterSet?.[tabTitle]?.rowFilter?.predicates ?? [];

    const SHOW_SETTING_NAMES = [
        "showSingleSelectToggle",
        "showSortToggle",
        "showOptionTotals",
        "showAllCheckbox",
        "showValueCheckboxes",
        "showBinningFunctionLink",
        "showTotal"
    ];

    // Held apart from the overrides so that a toggle the user turns off stays off across renders.
    const shownColumnKeys = new Set();

    // Every control is offered here, whatever the report's own module shows, as the window is for
    // working on the filters.
    const showAllControls = (columnKey) => {

        if (shownColumnKeys.has(columnKey)) return;

        shownColumnKeys.add(columnKey);

        const entry = columnOverrides[columnKey];

        for (let i = 0; i < SHOW_SETTING_NAMES.length; i++) entry[SHOW_SETTING_NAMES[i]] = true;

        if (!entry.compareFilterSlots) entry.showCompareFilter = true;
    };

    // A binned item's stored ticks are its bins, so the function they were binned with is put back
    // alongside them; without it the item would come up listing the column's raw values instead.
    const includeColumn = (columnKey, binningFunction) => {

        if (!columnKey) return;

        columnOverrides[columnKey] ??= {};
        columnOverrides[columnKey].included = true;

        showAllControls(columnKey);

        if (binningFunction) columnOverrides[columnKey].binningFunction ??= binningFunction;
    };

    // A filter held as a predicate has no column value filter to be found by, so the predicates are
    // walked too: a compare filter names its column, a binned item's ticks are a one-column
    // combination predicate, and a hierarchical item's span several, the last being the leaf the
    // item is built on.
    const includePredicateFilteredColumns = (filterSetParent) => {

        const predicates = getRowFilterPredicates(filterSetParent);

        for (let i = 0; i < predicates.length; i++) {

            const predicate = predicates[i];

            if (predicate.type === "compare") {

                includeColumn(predicate.column, predicate.calcFunction);
                continue;
            }

            const columns = predicate.columns;

            if (!Array.isArray(columns) || !columns.length) continue;

            const lastIndex = columns.length - 1;
            const leafColumnKey = columns[lastIndex];

            if (!leafColumnKey) continue;

            includeColumn(
                leafColumnKey,
                columns.length === 1 ? predicate.calcFunctions?.[0] : null
            );

            // Where the report states no hierarchy for the leaf, the predicate's own columns are
            // one: they are the levels its tuples name, outermost first.
            if (lastIndex > 0) {

                columnOverrides[leafColumnKey].parentGroupings ??= columns.slice(0, lastIndex);
            }
        }
    };

    const includeFilteredColumns = (filterSetParent) => {

        const columnKeys = Object.keys(getColumnValueFilters(filterSetParent));

        for (let i = 0; i < columnKeys.length; i++) includeColumn(columnKeys[i], null);

        includePredicateFilteredColumns(filterSetParent);
    };

    // Object.create leaves the editor's visualisation as the prototype, so isDestroyed and
    // containingReportGuid are read live from it rather than copied stale.
    const createFilterModule = () => {

        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceVisualisation);

        const filterModuleVisualisation = Object.create(visualisation);

        filterModuleVisualisation.sourceDataGroupingSettingsGroup = source.dataGroupingSettingsGroup;
        filterModuleVisualisation.sourceVisualisation = sourceVisualisation;
        filterModuleVisualisation.columnOverrides = columnOverrides;
        filterModuleVisualisation.filterTarget = filterTarget;

        // The window is for working on the filters, so the way to add one is always pointed out.
        filterModuleVisualisation.rightClickHintAlwaysShown = true;

        // An item added from the module's own menu shows its controls from the start too.
        filterModuleVisualisation.onColumnIncluded = showAllControls;

        // An item is listed because its column is filtered, so its cross clears the filter.
        filterModuleVisualisation.removingItemClearsFilter = true;

        const created = Ren.CreateFilterModule(tabularData, filterModuleVisualisation);

        // The source grid hasn't registered its settings yet; the next render tries again.
        return created === Ren.NotReady ? null : created;
    };

    // The module re-renders itself whenever the source settings change, so there is nothing to
    // redraw here.
    const render = (filterSetParent) => {

        initialiseColumnOverrides();
        includeFilteredColumns(filterSetParent);

        if (initiallyIncludedColumnKey) {

            includeColumn(initiallyIncludedColumnKey, null);
            initiallyIncludedColumnKey = null;
        }

        if (!filterModule) {

            filterModule = createFilterModule();

            if (filterModule) element._append(filterModule.element);
        }

        return element;
    };

    return {
        render
    };
};
