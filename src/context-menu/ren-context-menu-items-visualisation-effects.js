/**
 * Generates the context menu items every visualisation offers for its CSS filter effects.
 */
Ren.ContextMenuItems_VisualisationEffects = (() => {

    const getMenuItems = (visualisation) => [{
        section: "View settings",
        text: "Effects...",
        id: "visualisation-effects",
        action: () => Ren.CreateVisualisationEffectsPopupWindow(
            visualisation,
            Ren.LastRightClickPosition
        )
    }];

    return {
        getMenuItems
    };
})();
