/**
 * Creates a Filter Module visualisation: a wrapping panel of checkbox items, one per included
 * column of the source grid, whose selections drive that grid's filter.  Boolean columns show
 * "Yes"/"No" for their "1"/"0" values; enum columns filter on their labels.
 *
 * This file is the orchestrator.  Each Ren.FilterModule_XXX sub-module receives the shared context
 * `s` and its public functions are published under a facet of their own on it.
 */
Ren.CreateFilterModule = (tabularData, visualisation) => {

    const s = {};

    s.tabularData = tabularData;
    s.visualisation = visualisation;
    s.paras = Ren.ReportInputParameters.getInputParameters(visualisation.containingReport);
    s.sourceGroup = visualisation.sourceDataGroupingSettingsGroup;

    s.columnOverrides = visualisation.columnOverrides ?? (visualisation.columnOverrides = {});
    s.columnModels = tabularData.ColumnModels;

    Object.assign(s, Ren.FilterModule_Constants);

    // The dates the source group's date/value charts were last drawn over, which the module's
    // figures and options are narrowed to where it follows them (see
    // Ren.FilterModule_Filtering's getShownDatesPredicate), or null for every date.
    s.shownRange = visualisation.followChartDates
        ? Ren.DateValueChart_DateRange.getShownRange(
            s.sourceGroup,
            visualisation.containingReportGuid
        )
        : null;

    // -1 when the source grid's data has no count column.
    s.countColumnIndex = tabularData.findColumnIndex(s.COUNT_COLUMN_HEADING);

    // Keyed by facet, so no module can overwrite another's function.
    const SUB_MODULES = {
        columnInfo: Ren.FilterModule_Columns,
        filterTarget: Ren.FilterModule_FilterTarget,
        itemSettings: Ren.FilterModule_Settings,
        binning: Ren.FilterModule_Binning,
        counts: Ren.FilterModule_Counts,
        filtering: Ren.FilterModule_Filtering,
        grouping: Ren.FilterModule_Grouping,
        menu: Ren.FilterModule_Menu,
        showRows: Ren.FilterModule_ShowRows,
        includeWhenSaving: Ren.FilterModule_IncludeWhenSaving,
        totalRowView: Ren.FilterModule_TotalRow,
        reorder: Ren.FilterModule_Reorder,
        busyIndicator: Ren.FilterModule_BusyIndicator,
        hierarchyView: Ren.FilterModule_HierarchyView,
        virtualOptions: Ren.FilterModule_VirtualOptions,
        view: Ren.FilterModule_View,
        fixedDimensions: Ren.FilterModule_FixedDimensions
    };

    // Every facet exists, empty, up front, so modules which call each other both ways can be wired
    // in whatever order their construction needs.
    const facetNames = Object.keys(SUB_MODULES);

    for (let index = 0; index < facetNames.length; index++) s[facetNames[index]] = {};

    const wire = (facetName) => {

        Object.assign(s[facetName], SUB_MODULES[facetName](s));
        Object.freeze(s[facetName]);
    };

    wire("columnInfo");

    // The source grid may not have registered its settings yet; retry on the next iteration.
    if (!s.columnInfo.getSourceDataGroupingSettings()) return Ren.NotReady;

    wire("filterTarget");

    s.columnInfo.initColumnMetadata();
    s.columnInfo.initialiseNewItemSettingsForIncludedColumns();

    wire("itemSettings");
    wire("binning");

    wire("counts");
    wire("filtering");
    wire("grouping");
    wire("menu");
    wire("showRows");
    wire("totalRowView");

    const sourceGroup = s.sourceGroup;

    // A class of its own scopes the dynamic stylesheets, as two modules can share a visualisation.
    const panelGuid = Ren.RandomUtils.generateRandomClassName("ren-filter-module");

    const element = s.element = Ren.HtmlUtils.create("div")
        ._addClass("ren-filter-module", panelGuid, Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME);

    // Tagged with the visualisation's guid so that the sheets go when the visualisation does.
    s.stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(panelGuid, "item-dimensions");

    s.markStylesheet =
        Ren.DynamicStylesheets.setupDynamicStylesheet(panelGuid, "include-when-saving");

    if (visualisation.visualisationGuid) {

        s.stylesheet.getStylesheet().dataset.guid = visualisation.visualisationGuid;
        s.markStylesheet.getStylesheet().dataset.guid = visualisation.visualisationGuid;
    }

    s.compareControlRefs = []; // Ren.CompareFilterControl instances.

    // Held here, as the controls are rebuilt on every render and would lose half-typed input.
    const comparePendingInputsByColumnAndSlot = new Map();

    // Gets the pending-input store for one of a column's compare controls, created on first use.
    s.getComparePendingInputs = (columnIdOrHeading, slot) => {

        const key = columnIdOrHeading + s.NODE_KEY_SEPARATOR + (slot ?? 0);

        let pendingInputs = comparePendingInputsByColumnAndSlot.get(key);

        if (!pendingInputs) {

            pendingInputs = { operator: "", value: "", value2: "" };
            comparePendingInputsByColumnAndSlot.set(key, pendingInputs);
        }

        return pendingInputs;
    };

    // A node's tuple key is its value path from the root, joined by NODE_KEY_SEPARATOR.
    s.hierCheckboxRefs = []; // { input, chain, node }

    s.hierAllCheckboxRefs = []; // { input, chain, rootNodes }

    // Not cleared by render(), so redrawing preserves which branches were open.
    s.expandedNodeKeys = new Set();

    // The leaf columns of the hierarchies whose initial expansion has been applied, so a redraw
    // leaves the user's own expanding and collapsing alone.
    s.initialExpansionAppliedLeaves = new Set();

    // Wired in once the panel element and mark stylesheet exist.
    wire("includeWhenSaving");
    wire("reorder");

    wire("busyIndicator");
    wire("virtualOptions");
    wire("hierarchyView");
    wire("view");
    wire("fixedDimensions");

    Ren.AddContextMenuItems(
        element,
        () => [
            s.menu.getPanelViewMenuItem(),
            s.menu.getAddColumnMenuItem(),
            s.menu.getStackInColumnsMenuItem()
        ]
    );

    s.view.render();

    // Gets a signature of the source grid's filter, telling a filter change from a grouping or sort
    // change.
    const getSourceFilterSignature = () => s.filterTarget.getFilterSignature();

    let lastSourceFilterSignature = getSourceFilterSignature();

    // Counts are only invalidated when the source filter actually changed.
    const refreshForSourceChange = () => {

        const signature = getSourceFilterSignature();

        if (signature !== lastSourceFilterSignature) {

            lastSourceFilterSignature = signature;
            s.counts.invalidateAllCounts();
        }

        s.reuseDimensionsOnNextRender = true;
        s.view.render();
    };

    // The source grid's data source can be replaced under the module (the Variations window
    // replaces its own whenever a variation is added), so the module is rebuilt over the new data
    // rather than reading the old.
    let isRecreated = false;

    const recreateIfDataReplaced = () => {

        if (!tabularData.isDestroyed) return false;

        isRecreated = true;
        visualisation.recreate();

        return true;
    };

    // A data source can also be replaced without the source grid's filter or settings changing
    // (the load/save settings window rebuilds its own when a settings file is saved or deleted).
    Ren.Messages.Events.dataSourcesChanged.handle(() => {

        if (visualisation.isDestroyed || isRecreated) return false;

        if (Ren.DataSources.isDataSourceLoaded(visualisation.dataSourceUri)) {

            recreateIfDataReplaced();
        }
    });

    // A filter toggle fires both events; the refresh is ranked above the sync so only it runs, as
    // it syncs the checkboxes anyway.
    Ren.DataGroupingSettingsBinding({
        visualisation,
        group: sourceGroup,
        onSettingsChanged: {
            action: "refresh",
            rank: 1,
            handler: () => {

                if (recreateIfDataReplaced()) return;

                refreshForSourceChange();
            }
        },
        onFilterChanged: {
            action: "sync",
            handler: () => {

                if (recreateIfDataReplaced()) return;

                s.view.syncCheckboxes();
            }
        },
        dateRangeGroup: sourceGroup,
        onShownRangeChanged: visualisation.followChartDates
            ? {
                action: "shownRange",
                rank: 1,
                handler: (shownRange) => {

                    if (recreateIfDataReplaced()) return;

                    s.shownRange = shownRange;
                    s.counts.invalidateAllCounts();
                    s.reuseDimensionsOnNextRender = true;
                    s.view.render();
                }
            }
            : null
    });

    return {
        element
    };
};
