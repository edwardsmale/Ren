// Stands in for a downloaded report, which can't save, so offers no editing.
if (location.hash === "#downloaded") {
    Ren.UrlContext.isDownloadedReport = () => true;
}

// A container with a heading, its children in a column, that accepts task tiles and
// others of its own kind.
Ren.Extensions.registerVisualisationType({
    visualisationTypeName: "TestContainer",
    tagName: "ren-test-container",
    renderImmediately: true,
    availableOptions: { heading: "String" },
    containerOptions: {
        flow: "Column",
        childTypes: [
            {
                visualisationTypeName: "TaskTile",
                name: "task",
                options: { taskId: "New", taskTitle: "New task" }
            },
            {
                visualisationTypeName: "TestContainer",
                name: "group",
                options: { heading: "Group" }
            }
        ]
    },
    defaultOptions: { suppressLoadingAnimation: true },
    getCreateFunction: () => (tabularData, visualisation) => {

        const element = document.createElement("section");
        element.className = "test-container";

        const heading = document.createElement("h2");
        heading.className = "test-container__heading";
        heading.textContent = visualisation.heading;

        const children = document.createElement("div");
        children.className = "test-container__children";

        element.append(heading, children);

        Ren.VisualisationContainers.registerChildrenElement(visualisation, children);

        return { element };
    }
});
