/**
 * Renders a tabbed module showing JSON data in different formats: pretty, indented, and raw.
 */
Ren.JsonDebugModule = () => {

    const contentElement = Ren.HtmlUtils.create("div")
        ._addClass("ren-tabbed-module-widget");

    const tabbedModuleWidget = Ren.TabbedModuleWidget();

    tabbedModuleWidget
        .addTab("Pretty")
        .addTab("Indented")
        .addTab("Raw")
        .render(contentElement);

    const update = (
        prettyJson,
        indentedJson,
        rawJson
    ) => {

        tabbedModuleWidget.setTabContent("Pretty",
            Ren.JsonHighlighter.highlightJson(
                Ren.JsonUtils.serializeForDebug(prettyJson, 2)
            ),
            "ren-json-pretty"
        );

        tabbedModuleWidget.setTabContent("Indented",
            Ren.TextUtils.htmlEncode(
                Ren.JsonUtils.serializeForDebug(indentedJson, 2)
            )
        );

        let rawContent = Ren.JsonUtils.serializeForDebug(rawJson, 2);

        if (rawContent.length >= 10000) {
            rawContent = rawContent.substring(0, 10000) + "\n\n... (truncated)";
        }

        tabbedModuleWidget.setTabContent("Raw",
            Ren.TextUtils.htmlEncode(
                rawContent
            )
        );
    };

    return {
        update,
        contentElement
    };
};
