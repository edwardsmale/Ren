/**
 * A container of task lanes (see Ren.VisualisationContainers) under a row of column headings,
 * each lane having a cell per column for its task tiles.  Lanes are added, removed and reordered
 * from its context menu, and columns from the headings' menu.
 */
Ren.VisualisationTypes_TaskBoard = {
    visualisationTypeName: "TaskBoard",
    tagName: "ren-task-board",
    renderImmediately: true,
    availableOptions: {

        /**
         * The board's columns, in order, each { id, heading, subheading, width }.  A tile names
         * the column it's in by its ID, in its containerSlot.  The width is a CSS length, set by
         * dragging the column's edge.
         */
        columns: "Array",

        /**
         * The width of each column without one of its own, as a CSS length.  18rem by default.
         */
        columnWidth: "String",

        /**
         * The width of the lanes' headings, as a CSS length.  11rem by default.
         */
        laneHeadingWidth: "String",

        /**
         * The width of the list of task questions, as a CSS length, set by dragging its right edge.
         * Up to 60rem by default.
         */
        questionsWidth: "String",

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
                visualisationTypeName: "TaskLane",
                name: "lane",
                options: { heading: "New lane" }
            }
        ]
    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateTaskBoard
};
