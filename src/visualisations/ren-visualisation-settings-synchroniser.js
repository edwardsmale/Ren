/**
 * Synchronises visualisation settings across visualisations with the same visualisation settings
 * group.
 */
Ren.VisualisationSettingsSynchroniser = (() => {

    const synchroniseVisualisationSettings = (changedVisualisation) => {

        if (!changedVisualisation) return;

        const visualisationSettingsGroup = changedVisualisation.visualisationSettingsGroup;

        const visualisationType = Ren.VisualisationTypes.getByTypeName(
            changedVisualisation.visualisationTypeName
        );

        const synchronisedOptions = Object.keys(visualisationType.synchronisedOptions);

        if (!synchronisedOptions.length) return;

        const visualisationsToUpdate =
            Ren.VisualisationCollection.getVisualisationsByVisualisationSettingsGroup(
                visualisationSettingsGroup
            );

        for (let i = 0; i < visualisationsToUpdate.length; i++) {

            const visualisation = visualisationsToUpdate[i];

            for (let j = 0; j < synchronisedOptions.length; j++) {

                const option = synchronisedOptions[j];

                if (changedVisualisation[option] !== undefined) {
                    visualisation[option] = changedVisualisation[option];
                }
            }
        }
    };

    /**
     * Commits a change made to a visualisation's settings: optionally redraws it, synchronises the
     * change onto the other visualisations in its settings group, and notifies the change so that
     * it is persisted.  This is the only way in, so that the two halves cannot come apart:
     * synchronising without notifying leaves the change on screen but unsaved, which is silent and
     * was easy to do while both calls were written out by hand at every call site.
     *
     * @param {object} visualisation - The visualisation whose settings have changed.  A missing one
     *     is ignored, so callers need no guard of their own.
     * @param {function} [redraw] - Called before synchronising, where the change needs the
     *     visualisation redrawing to show it.
     */
    const commitChange = (visualisation, redraw) => {

        if (!visualisation) return;

        if (redraw) redraw();

        synchroniseVisualisationSettings(visualisation);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    return {
        commitChange
    };
})();
