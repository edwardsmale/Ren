/**
 * A dependency-free visualisation that renders a static blob of HTML.  It has no data source, so it
 * renders immediately.  It is used to represent arbitrary markup (text, layout, etc.) captured from
 * a web report's view when it is converted to a settings-only report.
 */
Ren.VisualisationTypes_HtmlContent = {
    visualisationTypeName: "HtmlContent",
    tagName: "ren-html-content",
    renderImmediately: true,

    // Rendered as soon as the actuizer creates it, so that visualisations later in the report
    // settings can target the elements its markup holds (see Ren.VisualisationActuizer).
    renderOnCreation: true,
    availableOptions: {
        "moduleCssClass": "String"
    },
    synchronisedOptions: {},

    // The properties saved with the report settings (see Ren.VisualisationPropertiesTransformer):
    // the markup the user has edited via the module's "Edit content..." context menu item. A module
    // declared as markup is rebuilt from its <ren-html-content> element on every load, so without
    // this the edit would be undone by the element's nested HTML the next time the report ran.
    // Markup the user has not touched is left out, so an unedited module (whose markup the element
    // already carries, and which is often a good deal of HTML) adds nothing to the saved settings.
    persistedProperties: [
        {
            name: "contentHtml",
            transform: (contentHtml, visualisation) =>
                contentHtml === visualisation.declaredContentHtml ? undefined : contentHtml
        }
    ],
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyNestedHTML: (visualisation, _parameters, html) => {

        visualisation.contentHtml = html;

        // Kept so that persistedProperties above can tell markup the element declared from markup
        // the user has since edited.  Only a markup-declared module has it: one created from report
        // settings is saved in full anyway, so its edits need no comparison.
        visualisation.declaredContentHtml = html;
    },
    getCreateFunction: () => Ren.CreateHtmlContent
};
