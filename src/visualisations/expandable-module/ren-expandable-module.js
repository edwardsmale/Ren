Ren.CreateExpandableModule = (_tabularData, visualisation) => {

    let isExpanded = visualisation.isExpanded ?? false;

    const dynamicStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        visualisation.visualisationGuid,
        visualisation.visualisationTypeName
    );

    const updateStylesheet = () => {

        const styles = [];

        if (isExpanded) {

            styles.push(".ren-expandable-module__expand-icon::before { content: '-' }");
            styles.push(".ren-expandable-module__content { height: fit-content }");
        }
        else {

            styles.push(".ren-expandable-module__expand-icon::before { content: '+' }");
            styles.push(".ren-expandable-module__content { height: 0 }");
        }

        dynamicStylesheet.updateIfChanged(styles);
    };

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-expandable-module");

    const titleRow = Ren.HtmlUtils.create("div")
        ._addClass("ren-expandable-module__title-row");

    element._append(titleRow);

    const expandIcon = Ren.HtmlUtils.create("span")
        ._addClass("ren-expandable-module__expand-icon");

    titleRow._append(Ren.HtmlUtils.create("div")
        ._addClass("ren-expandable-module__title")
        ._text(visualisation.title),
        expandIcon
    );

    expandIcon.addEventListener("click", () => {

        isExpanded = !isExpanded;
        Ren.Messages.Events.expandableModuleToggled.notify(visualisation.key, isExpanded);
        updateStylesheet();
    });

    const expandContent = Ren.HtmlUtils.create("div")
        ._addClass("ren-expandable-module__content");

    const contents = visualisation.contents ?? "";

    Ren.HtmlUtils.setHTML(expandContent, contents);

    element._append(expandContent);

    Ren.Messages.Events.reportAddedToDom.notify();

    Ren.Messages.Events.expandableModuleToggled.notify(visualisation.key, isExpanded);
    updateStylesheet();

    return {
        element
    };
};
