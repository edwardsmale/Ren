Ren.VisualisationTypes_GridSet = {
    visualisationTypeName: "GridSet",
    tagName: "ren-grid",
    availableOptions: {
        dataSourceUri: "String",
        settingsGroup: "String",
        dataTabIndex: "Number",
        dataTabIndexes: "Number[]",
        dataTabGroup: "String",
        includeAllTabs: "Boolean",

        // Gives the set's tabs with the same columns one set of data grouping settings, so that a
        // grouping, sort or format set on one tab is set on them all.  Each tab keeps its own
        // filters.  Without it, each tab has settings of its own.
        syncTabSettings: "Boolean",
        maxWidth: "String",
        maxHeight: "String",
        settingsNonSerializable: "Boolean",
        isAlreadyCreated: "Boolean",
        showRowAndColumnHeadings: "Boolean",
        showTabTitles: "Boolean",
        columnDefaults: "Object",
        statBar: "Boolean",
        totalsRow: "string",
        quickLinks: "Boolean",
        undoLinks: "Boolean",
        variations: "Boolean",
        showColumnHeaderDownArrows: "Boolean",
        highlightHoveredRow: "Boolean",

        // Previews function editor code for the row of the cell the editor was opened from (see
        // Ren.FunctionEditorAutoPreview).  Undefined, the default, is on until a preview is slow.
        autoPreviewEnabled: "Boolean",

        // The number of the second-to-last grouping's groups (or data rows, without groupings)
        // shown per page, paged client-side.
        pageSize: "Number",

        // Lists every row the data holds, whatever the filters on the grid's settings group say.
        // The filters go on being kept and edited as they are on any other grid - its column
        // heading popups and the filter modules opened from them still write them, and whatever
        // else follows the group still filters by them - but the grid itself stops hiding rows for
        // them, so a grid whose rows are the list a reader is choosing from stays the whole list.
        // Only worth setting on a grid that says which rows the filters keep in some other way of
        // its own: the date/value chart's dates grid, whose tick column does (see
        // Ren.DateValueChart_DateMarkersGrid).
        ignoreRowFilters: "Boolean"
    },
    defaultOptions: {
        dataTabIndexes: [1],
        dataTabGroup: null,
        includeAllTabs: false,
        syncTabSettings: false,
        showRowAndColumnHeadings: false,
        showTabTitles: false,
        maxHeight: "37rem",
        statBar: true,
        totalsRow: "Bottom",
        quickLinks: true,
        undoLinks: true,
        variations: true,
        showColumnHeaderDownArrows: true,
        highlightHoveredRow: true,
        horizontalScrollbar: true,
        verticalScrollbar: true,
        settingsNonSerializable: false,
        fillAvailableSpace: true,
        ignoreRowFilters: false,
        pageSize: null
    },
    synchronisedOptions: {
        statBar: "Boolean",
        totalsRow: "string",
        quickLinks: "Boolean",
        undoLinks: "Boolean",
        variations: "Boolean",
        showColumnHeaderDownArrows: "Boolean",
        highlightHoveredRow: "Boolean",
        autoPreviewEnabled: "Boolean",
        pageSize: "Number"
    },

    // The properties saved with the report settings (see Ren.VisualisationPropertiesTransformer).
    // A grid declared as <ren-grid> markup is rebuilt from that markup on every load rather than
    // written to the settings file's visualisations list, so the parts of it the reader turns on
    // and off through its context menu are only remembered by being listed here.  The values are
    // saved as they stand rather than only when they differ from the markup, which is not
    // recorded: a grid whose markup hides its variations and whose reader has shown them has to
    // save the shown state to keep it.
    persistedProperties: [
        "statBar",
        "variations",
        "quickLinks",
        "showColumnHeaderDownArrows",
        {

            // Highlighting is the default, so only turning it off is worth saving.
            name: "highlightHoveredRow",
            transform: (highlightHoveredRow) => highlightHoveredRow === false ? false : undefined
        },

        // Saved once set, as undefined is not the same as true: only undefined turns itself off.
        "autoPreviewEnabled",
        {

            // Null is the unpaged default, so only a set page size is worth saving.
            name: "pageSize",
            transform: (pageSize) => pageSize === null ? undefined : pageSize
        },

        // Left out of the settings unless the grid set's bottom edge has been dragged.
        "resizedMaxHeight"
    ],

    applyDefaultLogic: (_visualisation, parameters) => {

        if (parameters.dataTabGroup) {
            parameters.dataTabIndexes = null;
        }
        else if (parameters.includeAllTabs) {

            parameters.dataTabIndexes = "";
        }
        else if (parameters.dataTabIndex && !parameters.dataTabIndexes) {

            parameters.dataTabIndexes = [parameters.dataTabIndex];
        }

        if (parameters.includeAllTabs) parameters.showTabTitles = true;
        if (parameters.dataTabIndexes?.includes(",")) parameters.showTabTitles = true;
    },
    render: (visualisation, tabularDataSet) => {

        tabularDataSet = tabularDataSet ??
            Ren.DataSources.getTabularDataSet(visualisation.dataSourceUri);

        visualisation.instance = Ren.CreateGridSet(tabularDataSet, visualisation);

        if (!visualisation.instance) return;

        const report = Ren.HtmlUtils.create("report")
            ._append(visualisation.instance.element);

        if (visualisation.gridSetWidth) report._style("width", visualisation.gridSetWidth);

        // An empty <report-tabs> element stops the first row of data ending up hidden behind the
        // header row.
        report.prepend(Ren.HtmlUtils.create("report-tabs"));

        visualisation.instance.container = visualisation.element;

        // Not setHTML, which would run any script that a cell's data happens to contain.
        visualisation.instance.container.innerHTML = "";
        visualisation.instance.container.appendChild(report);

        //visualisation.settingsWindow = Ren.GridStateEditWindow(visualisation);

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    }
};
