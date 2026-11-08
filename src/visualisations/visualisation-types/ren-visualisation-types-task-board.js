/**
 * A container of task lanes (see Ren.VisualisationContainers) under a row of column headings,
 * each lane having a cell per column for its task tiles.  Lanes are added, removed and reordered
 * from its context menu.
 */
Ren.VisualisationTypes_TaskBoard = {
    visualisationTypeName: "TaskBoard",
    tagName: "ren-task-board",
    renderImmediately: true,
    availableOptions: {

        /**
         * The board's columns, in order, each { id, heading, subheading }.  A tile names the
         * column it's in by its ID, in its containerSlot.
         */
        columns: "Array",

        /**
         * The width of each column, as a CSS length.  15.5rem by default.
         */
        columnWidth: "String",

        /**
         * The width of the lanes' headings, as a CSS length.  8rem by default.
         */
        laneHeadingWidth: "String",

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
