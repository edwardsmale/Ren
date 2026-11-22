Ren.VisualisationTypes_FindWindow = {
    visualisationTypeName: "FindWindow",
    tagName: "ren-find-window",
    availableOptions: {

    },
    synchronisedOptions: {

    },
    defaultOptions: {
        excludeFromSerialization: true,

        // The window is fitted to the fields it holds - so adding a row of buttons widens or
        // heightens it of its own accord - and they in turn are given the whole of the window,
        // rather than the window being given a size guessed at where it is opened.
        fillAvailableSpace: true,
        fitPopupToContentExactly: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateFindWindow
};
