/**
 * Generates the context menu item every visualisation the report settings declare offers for
 * putting itself back the way it was declared.
 */
Ren.ContextMenuItems_VisualisationReset = (() => {

    const getMenuItems = (visualisation) => [{

        // At the end, since it undoes everything the sections above it set.
        positionAtEndOfMenu: true,
        text: "Reset",
        id: "visualisation-reset",
        action: () => {

            Ren.VisualisationOriginalSettings.reset(visualisation);
        }
    }];

    return {
        getMenuItems
    };
})();
