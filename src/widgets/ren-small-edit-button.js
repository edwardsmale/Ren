/**
 * Creates a small edit button.
 */
Ren.SmallEditButton = (() => {

    const create = (title, text) => {

        return Ren.HtmlUtils.create("button")
            ._addClass(
                "ren-web-report-small-button",
                "js-ren-context-menu-button"
            )
            ._attr("title", title)
            ._text(text || "✎");
    };

    return {
        create
    };
})();
