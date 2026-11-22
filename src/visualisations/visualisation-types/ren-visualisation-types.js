/**
 * Contains a list of objects detailing the various types of visualisation that can be created.
 */
Ren.VisualisationTypes = (() => {

    const selfClosingTagNames = [
        "ren-data-source",
        "ren-date-range-summary",
        "ren-date-selector",
        "ren-date-value-chart",
        "ren-default-dates",
        "ren-embedded-report",
        "ren-filter-module",
        "ren-format-function-content-module",
        "ren-grid",
        "ren-key-value-grid",
        "ren-paging-bar",
        "ren-parameter",
        "ren-parameter-option",
        "ren-parameters-module",
        "ren-stat-bar",
        "ren-uploaded-files-module",
        "ren-word-cloud"
    ];

    const nestedTagNames = {
        "ren-parameters-module": [
            "ren-parameter"
        ],
        "ren-parameter": [
            "ren-parameter-option"
        ]
    };

    // These ren-* elements contain HTML elements as a way of specifying input.
    const htmlContainingTagNames = [
        "ren-content-module",
        "ren-expandable-module",
        "ren-filters-bar",
        "ren-html-content",
        "ren-tabbed-module"
    ];

    /**
     * Specify the visualisation types and their properties.
     */
    const types = [
        Ren.VisualisationTypes_Calendar,
        Ren.VisualisationTypes_ContentModule,
        Ren.VisualisationTypes_DataGridVariationsWindow,
        Ren.VisualisationTypes_DataGroupingSettingsEditor,
        Ren.VisualisationTypes_DataSource,
        Ren.VisualisationTypes_DateRangeSummary,
        Ren.VisualisationTypes_DateSelector,
        Ren.VisualisationTypes_DateValueChart,
        Ren.VisualisationTypes_DefaultDates,
        Ren.VisualisationTypes_EmbeddedReport,
        Ren.VisualisationTypes_ExpandableModule,
        Ren.VisualisationTypes_FilterModule,
        Ren.VisualisationTypes_FiltersBar,
        Ren.VisualisationTypes_FindWindow,
        Ren.VisualisationTypes_FormatFunctionContentModule,
        Ren.VisualisationTypes_GridSet,
        Ren.VisualisationTypes_HtmlContent,
        Ren.VisualisationTypes_KeyValueGrid,
        Ren.VisualisationTypes_LinkTile,
        Ren.VisualisationTypes_PagingBar,
        Ren.VisualisationTypes_ParametersModule,
        Ren.VisualisationTypes_StatBar,
        Ren.VisualisationTypes_TaskBoard,
        Ren.VisualisationTypes_TaskLane,
        Ren.VisualisationTypes_TaskTile,
        Ren.VisualisationTypes_TileGroup,
        Ren.VisualisationTypes_UploadedFilesModule,
        Ren.VisualisationTypes_LoadSaveReportSettingsWindow,
        Ren.VisualisationTypes_JsonReportSettingsEditor,
        Ren.VisualisationTypes_Preview,
        Ren.VisualisationTypes_WordCloud,
        Ren.VisualisationTypes_ChangeChart,
        Ren.VisualisationTypes_TabbedModule
    ];

    const commonOptions = {};
    const commonDefaults = {};

    for (let i = 0; i < Ren.VisualisationTypes_CommonOptions.length; i++) {
        Object.assign(commonOptions, Ren.VisualisationTypes_CommonOptions[i]);
    }

    for (let i = 0; i < Ren.VisualisationTypes_CommonDefaultOptions.length; i++) {
        Object.assign(commonDefaults, Ren.VisualisationTypes_CommonDefaultOptions[i]);
    }

    const prepareType = (type) => {

        type.availableOptions = Object.assign({}, commonOptions, type.availableOptions);
        type.defaultOptions = Object.assign({}, commonDefaults, type.defaultOptions);
        type.synchronisedOptions = type.synchronisedOptions || {};

        // Gets a value indicating whether the type offers the "Effects..." menu item.  Effects are
        // only applied to elements with Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME, so a
        // type setting this must add that class to its elements.
        type.supportsEffects = type.supportsEffects === true;

        // Gets a value indicating whether the type offers focus mode (see
        // Ren.VisualisationFocusMode), shown by a button at the top-right of the visualisation.
        type.supportsFocusMode = type.supportsFocusMode === true;
    };

    types.forEach(prepareType);

    const getByTagName = (tagName) => types.find(type => type.tagName === tagName.toLowerCase());
    const getByTypeName = (typeName) => types.find(type => type.visualisationTypeName === typeName);

    // The host's own defaults for a type, by its visualisationTypeName, kept apart from the type
    // itself, which may be registered after them.
    const registeredDefaultsByTypeName = {};

    const getRegisteredDefaults = (typeName) => registeredDefaultsByTypeName[typeName] || {};

    Ren.Extensions.handle("visualisationDefaults", (registration) => {

        registeredDefaultsByTypeName[registration.typeName] = Object.assign(
            {},
            registeredDefaultsByTypeName[registration.typeName],
            registration.defaults
        );
    });

    const tagNames = Array.from(Object.values(types).map(type => type.tagName));

    // The page can be painted before the scanifier replaces its <ren-*> elements, so they're
    // hidden until then rather than flashing their unstyled headings and text.
    // In the head, since this runs before the body exists.
    const unscannedElementsStylesheet = document.createElement("style");

    const updateUnscannedElementsStylesheet = () => {

        unscannedElementsStylesheet.textContent = tagNames.join(",") + " { opacity: 0; }";
    };

    updateUnscannedElementsStylesheet();

    document.head.appendChild(unscannedElementsStylesheet);

    // The tag name lists are added to in place, since they're exported.
    Ren.Extensions.handle("visualisationType", (registration) => {

        const type = registration.type;
        const tagOptions = registration.tagOptions;

        prepareType(type);
        types.push(type);
        tagNames.push(type.tagName);

        if (tagOptions.selfClosing) selfClosingTagNames.push(type.tagName);

        if (tagOptions.htmlContaining) htmlContainingTagNames.push(type.tagName);

        if (tagOptions.nestedTagNames) nestedTagNames[type.tagName] = tagOptions.nestedTagNames;

        updateUnscannedElementsStylesheet();
    });

    return {
        getByTagName,
        getByTypeName,
        getRegisteredDefaults,
        tagNames,
        selfClosingTagNames,
        nestedTagNames,
        htmlContainingTagNames
    };
})();
