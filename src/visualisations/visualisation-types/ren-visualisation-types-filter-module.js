Ren.VisualisationTypes_FilterModule = {
    visualisationTypeName: "FilterModule",
    tagName: "ren-filter-module",
    supportsEffects: true,
    availableOptions: {
        sourceDataGroupingSettingsGroup: "String",
        dataTabIndex: "Number",
        dataTabGroup: "String",

        // "Columns" stacks the items top to bottom, wrapping into further columns; otherwise they
        // are laid side by side, wrapping into further rows.
        itemFlow: "String",

        // Narrows the figures and options to the dates the date/value charts of the source group
        // are drawn over, such as the years a multi-chart's slider shows.
        followChartDates: "Boolean"
    },
    synchronisedOptions: {

    },

    // The properties saved with the report settings (see Ren.VisualisationPropertiesTransformer):
    // the per-column heading and value caption overrides, the user's drag-chosen item order, the
    // right-click hint's visibility, the item flow, and the filter the module drives where that
    // isn't the default (the data rows).  Each is omitted while empty or default so an untouched
    // module adds nothing to the saved settings.
    persistedProperties: [
        {

            // Which of the source grid's filters the checkboxes drive: { level: "dataRows" } (the
            // default) or { level: "grouping", groupByColumns: [...] } naming one grouping level by
            // the columns it groups by, an empty list being the outermost (totals row) grouping.
            // See ren-filter-module-filter-target.js.
            name: "filterTarget",
            transform: (filterTarget) =>
                filterTarget && filterTarget.level === "grouping" ? filterTarget : undefined
        },
        {
            name: "columnOverrides",
            transform: (columnOverrides) =>
                columnOverrides && Object.keys(columnOverrides).length > 0 ? columnOverrides : undefined
        },
        {

            // Whether the "Right-click to add filters" hint link is shown beneath the module's
            // items.  Shown unless explicitly turned off, so only the false is worth saving.
            name: "showRightClickHint",
            transform: (showRightClickHint) =>
                showRightClickHint === false ? false : undefined
        },
        {
            name: "followChartDates",
            transform: (followChartDates) => followChartDates === true ? true : undefined
        },
        {
            name: "itemFlow",
            transform: (itemFlow) => itemFlow === "Columns" ? itemFlow : undefined
        },
        {
            name: "columnOrder",
            transform: (columnOrder) =>
                Array.isArray(columnOrder) && columnOrder.length > 0 ? columnOrder : undefined
        }
    ],
    defaultOptions: {

        // The summary fills its popup and sizes the popup to its content (capped at 1000px wide by
        // the creator's initialMaxWidth).  The panel is only ever as big as its items, so the popup
        // is fitted to it exactly rather than being left a data grid's margin of empty space.
        fillAvailableSpace: true,
        resizeToFitContentOnLoad: true,
        fitPopupToContentExactly: true,
        verticalScrollbar: true
    },
    applyDefaultLogic: () => {

    },
    getCreateFunction: () => Ren.CreateFilterModule
};
