/**
 * A change chart shows how a value moved between two times for each of a list of things: a row per
 * label, with an arrow from its before value to its after value.
 */
Ren.VisualisationTypes_ChangeChart = {
    visualisationTypeName: "ChangeChart",
    tagName: "ren-change-chart",
    availableOptions: {
        dataSourceUri: "String",
        settingsGroup: "String",
        dataTabIndex: "Number",
        dataTabGroup: "String",
        selectedColumns: "Array",

        // The columns of the labels and of the values before and after.  Without them the first
        // shown text column is the labels, and the first two shown number columns the values.
        labelHeading: "String",
        beforeHeading: "String",
        afterHeading: "String",

        // What the legend and tooltips call the values before and after.  Without them they're
        // called by their columns' headings.
        beforeLabel: "String",
        afterLabel: "String",

        // The format function spec the values and the axis are shown in, such as
        // [{ "name": "percentage-no-dp" }], or a format function's name.  Without one they are
        // shown in the before column's format.
        valueFormatFunction: "Array",

        // Popup reports opened by clicking a label, or a row's arrow, as URL templates taking
        // "{value}" (the label) and "{row.Heading}" (see Ren.Links), with their popups' titles.
        labelPopupReport: "String",
        labelPopupReportTitle: "String",
        changePopupReport: "String",
        changePopupReportTitle: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        visualisationWidth: "50rem",
        popupWidth: "50rem",
        popupHeight: "37.5rem",
        dataTabIndex: 1,
        dataTabGroup: null,
        resizeToFitContentOnLoad: false
    },
    applyDefaultLogic: (_visualisation, parameters) => {

        if (parameters.dataTabGroup) {
            parameters.dataTabIndex = null;
        }

        // A single format function can be named in markup, which can't give an array.
        if (typeof parameters.valueFormatFunction === "string") {
            parameters.valueFormatFunction = [{ name: parameters.valueFormatFunction }];
        }
    },
    getCreateFunction: () => Ren.CreateChangeChart
};
