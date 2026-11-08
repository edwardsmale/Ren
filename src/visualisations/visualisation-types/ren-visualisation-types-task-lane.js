/**
 * A lane of a task board, and a container of task tiles (see Ren.VisualisationContainers), with a
 * cell for each of the board's columns.  Tiles are added, removed and reordered from its context
 * menu, and dragged between its cells and other lanes.
 */
Ren.VisualisationTypes_TaskLane = {
    visualisationTypeName: "TaskLane",
    tagName: "ren-task-lane",
    renderImmediately: true,
    availableOptions: {
        heading: "String",
        moduleCssClass: "String"
    },
    synchronisedOptions: {},
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    containerOptions: {
        flow: "Column",
        childTypes: [
            {
                visualisationTypeName: "TaskTile",
                name: "task",
                options: { taskTitle: "New task", taskStatus: "NotStarted" }
            }
        ]
    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateTaskLane
};
