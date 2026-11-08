/**
 * Creates a filters bar container that wraps nested HTML content.
 */
Ren.CreateFiltersBar = (_tabularData, visualisation) => {

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-filters-bar");

    if (visualisation.title) {
        element._attr("title", visualisation.title);
    }

    if (visualisation.style) {
        element._attr("style", visualisation.style);
    }

    Ren.HtmlUtils.setHTML(element, visualisation.contents ?? "");

    // Note: The reportAddedToDom.notify() will be called by the renderer after this element is
    // appended to the DOM, which will trigger scanify to process any nested ren-* elements.

    return {
        element
    };
};
