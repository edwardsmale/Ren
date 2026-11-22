/**
 * The settings a visualisation was created with, kept so that it can be put back the way the report
 * declared it.  Only the visualisations listed in the report settings file have any: one built from
 * markup, or added by the user, has no declared state to return to.
 *
 * The snapshot is taken once the creator has finished with the visualisation, so it holds what the
 * report first drew - the settings file's properties with the type's defaults filled in - rather
 * than the half-built settings object the actuizer passed in.
 */
Ren.VisualisationOriginalSettings = (() => {

    const originalSettingsByVisualisation = new WeakMap();

    // What a visualisation is made of rather than what it is set to: the elements it was drawn
    // into, the instance drawing it, where its data came from and what identifies it.  None of it
    // is a setting, so a reset neither restores nor removes any of it.
    const runtimePropertyNames = new Set([
        "clientSide",
        "container",
        "containingReport",
        "containingReportGuid",
        "contextScopedTypeCount",
        "createdByActuizer",
        "dataSourceUri",
        "element",
        "hasDimensions",
        "hasResizeHandles",
        "instance",
        "isAlreadyCreated",
        "isDestroyed",
        "isRendered",
        "isTargetSelectorGenerated",
        "needsUriReResolution",
        "pagingBarVisualisationGuid",
        "popup",
        "recreate",
        "reportContext",
        "sourceDataGroupingSettings",
        "sourceVisualisationGuid",
        "statBarVisualisationGuid",
        "tabbedModuleTabId",
        "tabularDataTransformers",
        "targetElement",
        "targetSelector",
        "visualisationGuid",
        "visualisationTypeCount",
        "_renderOwner"
    ]);

    /**
     * Gets a value indicating whether a property is one of the visualisation's settings, rather
     * than part of how it is drawn.  A key ending in "Visualisation" holds another visualisation
     * (a stat bar's grid set, say), which is a live object and not a setting.
     */
    const isSettingsProperty = (key, value) => {

        if (runtimePropertyNames.has(key)) return false;

        if (key.endsWith("Visualisation")) return false;

        if (typeof value === "function") return false;

        return !(value instanceof Node);
    };

    /**
     * Gets a copy of a visualisation's settings as they are now, to be put back by restore(), or
     * null where it carries something a JSON round trip cannot describe.
     */
    const snapshot = (visualisation) => {

        const settings = {};
        const keys = Object.keys(visualisation);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (isSettingsProperty(key, visualisation[key])) {
                settings[key] = visualisation[key];
            }
        }

        try {

            return Ren.ObjectUtils.clone(settings);
        }
        catch (error) {

            // Settings that can't be cloned have nothing to be put back to.
            return null;
        }
    };

    /**
     * Takes the snapshot a reset restores.  A visualisation without one is offered no reset.
     */
    const capture = (visualisation) => {

        const settings = snapshot(visualisation);

        if (settings) originalSettingsByVisualisation.set(visualisation, settings);
    };

    /**
     * Gets a value indicating whether a visualisation has settings to be reset to.
     */
    const hasOriginalSettings = (visualisation) =>
        !!visualisation && originalSettingsByVisualisation.has(visualisation);

    /**
     * Removes the settings a visualisation has gained since it was created, so that a grouping or
     * a date marker added later doesn't survive a reset merely because the original said nothing
     * about it.
     */
    const removeAddedSettings = (visualisation, originalSettings) => {

        const keys = Object.keys(visualisation);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (key in originalSettings) continue;

            if (isSettingsProperty(key, visualisation[key])) {
                delete visualisation[key];
            }
        }
    };

    /**
     * Puts back the grouping settings and grid state the report declared for the visualisation's
     * own settings groups, which is where a grid keeps most of what a reset has to undo.  Applied
     * as a variation is: the groups are named the same in every open instance of a report, so only
     * the instance the visualisation belongs to is reset.
     *
     * Settings the report file does not declare - a grid grouped by a ---GroupBy directive alone,
     * say - have no original to go back to and are left as they are.
     */
    const restoreSettingsGroups = (visualisation) => {

        const dataGroupingSettings = Ren.ReportSettings_DataGroupingSettingsCollection
            .getClonedDataGroupingSettings(visualisation.dataGroupingSettingsGroup);

        if (dataGroupingSettings) {

            Ren.Messages.Requests.applyDeserialisedDataGroupingSettings.notify(
                dataGroupingSettings,
                visualisation.containingReportGuid
            );
        }

        const gridState = Ren.ReportSettings_GridStateCollection
            .getClonedGridState(visualisation.gridStateGroup);

        if (gridState) {

            Ren.Messages.Requests.applyDeserialisedGridState.notify(
                gridState,
                visualisation.containingReportGuid
            );
        }
    };

    /**
     * Puts a popup back to the size and position it opened at.  The popup window holds those rather
     * than the visualisation's element, so re-rendering alone would leave it where it was dragged.
     */
    const restorePopupGeometry = (visualisation) => {

        const popup = visualisation.popup;

        if (!popup) return;

        // True so the resize callback is skipped, as in Ren.VisualisationCreator: these are stored
        // dimensions being put back, not a resize to be measured and recorded.
        if (visualisation.popupWidth) {
            popup.setWidth(visualisation.popupWidth, true);
        }

        if (visualisation.popupHeight) {
            popup.setHeight(visualisation.popupHeight, true);
        }

        if (Ren.StylesUtils.isDimensionSet(visualisation.popupLeft)) {
            popup.setLeftPos(visualisation.popupLeft);
        }

        if (Ren.StylesUtils.isDimensionSet(visualisation.popupTop)) {
            popup.setTopPos(visualisation.popupTop);
        }

        if (Ren.StylesUtils.isDimensionSet(visualisation.popupRight)) {
            popup.setRightPos(visualisation.popupRight);
        }

        if (visualisation.popupZoom) {
            popup.setZoom(visualisation.popupZoom);
        }

        popup.setScaleContentToFit(visualisation.scalePopupContentToFit);

        popup.setContentScaleBaseWidth(visualisation.popupContentScaleBaseWidth);
    };

    /**
     * Gives a visualisation the settings in a snapshot, and only those, and keeps the change.
     */
    const applySettings = (visualisation, settings) => {

        removeAddedSettings(visualisation, settings);

        Object.assign(visualisation, Ren.ObjectUtils.clone(settings));

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    /**
     * Puts a visualisation back the way the report declared it and draws it again.
     *
     * The settings groups are restored last: a grid is rebuilt from the live settings its group
     * holds, which are the ones the user changed, so the declared settings are queued behind the
     * re-render to reach the grid it draws rather than the one it replaces.
     */
    const reset = (visualisation) => {

        const originalSettings = originalSettingsByVisualisation.get(visualisation);

        if (!originalSettings) return;

        applySettings(visualisation, originalSettings);

        restorePopupGeometry(visualisation);

        visualisation.recreate();

        restoreSettingsGroups(visualisation);
    };

    /**
     * Puts a visualisation back to a snapshot taken earlier (see snapshot()) and draws it again.
     * Unlike reset(), where a popup sits and its settings groups are left as they are, as a snapshot
     * is of the visualisation's own settings alone.
     */
    const restore = (visualisation, settings) => {

        if (!settings) return;

        applySettings(visualisation, settings);

        visualisation.recreate();
    };

    return {
        capture,
        hasOriginalSettings,
        reset,
        snapshot,
        restore
    };
})();
