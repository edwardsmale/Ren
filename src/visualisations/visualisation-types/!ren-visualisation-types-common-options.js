/**
 * The options common to all visualisation types, with their types, and their default values.
 */
Ren.VisualisationTypes_CommonOptions = [{

    /**
     * The visualisationId of the container the visualisation is a child of.  It is put in the
     * container, among its other children by containerOrder, rather than at targetSelector.
     */
    containerVisualisationId: "String",

    /**
     * The visualisation's place among its container's children, lowest first.
     */
    containerOrder: "Number",

    /**
     * Which of its container's children elements the visualisation goes in, for a container that
     * has more than one (such as a task lane, with a cell per column).  The first by default.
     */
    containerSlot: "String",

    /**
     * The name of the Ren.DataSourceFormats format the data source response is read as, for a
     * response that cannot say what it is.  Optional.
     */
    dataFormat: "String",

    dataGroupingSettingsGroup: "String",

    doNotSerializeIfPopup: "Boolean",

    // CSS filter effects (see Ren.VisualisationEffects), applied to the visualisation's elements
    // with the visualisation-effects-apply class.
    effectBrightness: "Number",
    effectContrast: "Number",
    effectGreyscale: "Number",
    effectHue: "Number",
    effectInvert: "Number",
    effectSaturation: "Number",
    effectSepia: "Number",

    // For visualisations that only make sense in live reports.  Their data sources are dropped too.
    excludeFromDownloadedReports: "Boolean",

    excludeFromSerialization: "Boolean",

    /**
     * The URI to fetch data from that does not come from a report's SQL; the general form of
     * sqlFilename.  Unlike dataSourceUri, it takes the containing report's dates, parameters and
     * uploaded files.
     */
    fetchUri: "String",

    fillAvailableSpace: "Boolean",

    /**
     * When true and the popup is tab-relative, the popup is resized with its tabbed module tab
     * content element.  Combine with fillAvailableSpace so the visualisation scales too.
     */
    fillTabbedModuleContentTab: "Boolean",

    /**
     * When true, an auto-sizing popup fits its content exactly, rather than leaving the margin a
     * data grid needs for its scroll bars and stat bar.
     */
    fitPopupToContentExactly: "Boolean",

    gridStateGroup: "String",

    horizontalScrollbar: "Boolean",

    /**
     * A runtime flag set by VisualisationCreator on a child visualisation (one with
     * isChildVisualisation), so that the actuizer leaves creating it to its parent.
     */
    isAlreadyCreated: "Boolean",

    // Filtered out during serialization, as the parent EmbeddedReport recreates it.
    isInsideEmbeddedReport: "Boolean",

    /**
     * When true, the visualisation belongs to no report context, so it is not destroyed when the
     * report it was opened from reloads (a calendar picking that report's dates, say).
     */
    isIndependentOfReportContext: "Boolean",

    isInsidePopup: "Boolean",

    isPopup: "Boolean",

    /**
     * When true, a popup linked to a tabbed module tab is moved inside that tab's content element,
     * so its position is relative to it and it is clipped to its bounds.
     */
    isTabRelative: "Boolean",

    // When true, the visualisation is not destroyed when different report settings are loaded.
    isTransitive: "Boolean",

    // When true, the visualisation has no visual output and only adds parameters to the report
    // context (e.g. ren-default-dates).
    isVirtual: "Boolean",

    /**
     * When true, a popup fitted to its content exactly that opens too near the bottom of the
     * viewport to show all of it is moved up, rather than shortened.
     */
    raisePopupToFitContent: "Boolean",

    // When true, the visualisation is rendered before waiting for all data sources to be ready.
    renderImmediately: "Boolean",

    resizeToFitContentOnLoad: "Boolean",

    /**
     * When true, resizing the popup scales its content to fit the popup's width rather than laying
     * it out afresh.  The content keeps the layout width it had when the popup was first resized.
     */
    scalePopupContentToFit: "Boolean",

    /**
     * The ID attribute of the visualisation's <ren-*> element, which the settings saved for it are
     * keyed by, so they survive the report changing around it.  Optional.
     */
    settingsId: "String",

    // Sets dataGroupingSettingsGroup, gridStateGroup and visualisationSettingsGroup to one value.
    settingsGroup: "String",

    style: "String",

    suppressLoadingAnimation: "Boolean",

    tabbedModuleTabId: "String",

    /**
     * When set, the visualisation's own uploaded-files-* attributes are ignored and its uploaded
     * files are supplied by the group's uploaded files module.
     */
    uploadedFilesGroup: "String",

    verticalScrollbar: "Boolean",

    visualisationGuid: "String",

    /**
     * The ID a container is named by in its children's containerVisualisationId, which stays the
     * same between loads, unlike visualisationGuid.  A container is given one if it has none.
     */
    visualisationId: "String",

    visualisationSettingsGroup: "String"
}];

Ren.VisualisationTypes_CommonDefaultOptions = [{
    doNotSerializeIfPopup: false,
    effectBrightness: 100,
    effectContrast: 100,
    effectGreyscale: 0,
    effectHue: 0,
    effectInvert: 0,
    effectSaturation: 100,
    effectSepia: 0,
    excludeFromDownloadedReports: false,
    excludeFromSerialization: false,
    fillAvailableSpace: false,
    fillTabbedModuleContentTab: false,
    fitPopupToContentExactly: false,
    horizontalScrollbar: false,
    isAlreadyCreated: false,
    isChildVisualisation: false,
    isIndependentOfReportContext: false,
    isInsideEmbeddedReport: false,
    isInsidePopup: false,
    isPopup: false,
    isTabRelative: false,
    isTransitive: false,
    isVirtual: false,
    raisePopupToFitContent: false,
    renderImmediately: false,
    resizeToFitContentOnLoad: true,
    scalePopupContentToFit: false,
    suppressLoadingAnimation: false,
    verticalScrollbar: false
}];

/**
 * The properties every visualisation type saves to "visualisationProperties" as well as its own
 * persistedProperties, left out while they hold their default.
 */
Ren.VisualisationTypes_CommonPersistedProperties = [
    "effectBrightness",
    "effectContrast",
    "effectGreyscale",
    "effectHue",
    "effectInvert",
    "effectSaturation",
    "effectSepia"
].map(name => ({
    name,
    transform: value =>
        value === Ren.VisualisationTypes_CommonDefaultOptions[0][name] ? undefined : value
}));
