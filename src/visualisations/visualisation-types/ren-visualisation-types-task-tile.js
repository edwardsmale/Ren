/**
 * A dependency-free visualisation that renders a task on a project's task board.  It is declared in
 * a report's settings, anchored by targetSelector, so the text and status edited on the page are
 * saved with the report settings.
 */
Ren.VisualisationTypes_TaskTile = {
    visualisationTypeName: "TaskTile",
    tagName: "ren-task-tile",
    renderImmediately: true,
    availableOptions: {

        /**
         * The short ID other tasks name the task by, such as "D2".
         */
        taskId: "String",

        taskTitle: "String",

        /**
         * The task's size, shown as a coloured badge: "XS", "S", "M", "L" or "XL".
         */
        taskSize: "String",

        /**
         * The IDs of the tasks that must be done first, such as "C, E, P".
         */
        taskPrerequisites: "String",

        /**
         * "NotStarted" (the default), "InProgress", "InReview" or "Complete".
         */
        taskStatus: "String",

        /**
         * The task's text, as HTML.
         */
        contentHtml: "String",

        moduleCssClass: "String"
    },
    synchronisedOptions: {},
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateTaskTile
};
