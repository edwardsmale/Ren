Ren.VisualisationRenderer = (() => {

    // tabularDataSet is optional.
    const renderVisualisation = (visualisation, tabularDataSet) => {

        if (visualisation.isRendered) return;

        // Retried as other visualisations render, as its container (or one containing that) will.
        if (Ren.VisualisationContainers.isAwaitingContainer(visualisation)) {

            visualisation.instance = Ren.NotReady;
            return;
        }

        Ren.VisualisationContainingReportContext.populateVisualisationContainingReportContext(
            visualisation
        );

        if (Ren.DataSources.isServerSideDataSource(visualisation.dataSourceUri)) {
            Ren.VisualisationDefaultSettingsGroups.setDefaultSettingsGroups(visualisation);
        }

        // Give the visualisation the properties the report settings hold for it, before it is
        // created and reads them.  This is what restores the context menu settings of a
        // visualisation declared as markup, which is rebuilt from that markup on every load and so
        // is not written to the settings file's visualisations list.
        Ren.VisualisationPropertiesTransformer.applyToVisualisation(visualisation);

        const visualisationType = Ren.VisualisationTypes.getByTypeName(
            visualisation.visualisationTypeName
        );

        // Visualisation types have a function that returns the create function, rather than just a
        // property holding it, because the JS files can be aggregated in any order.

        // Each render is a generation: it registers a fresh batch of message-bus listeners that
        // close over this render's state (dataGroupingSettings, tabularData, groupings). Remove the
        // previous generation's listeners first (this is a re-render or a retry), then tag the new
        // batch with a fresh owner so it too can be removed on the next render or on destroy.  This
        // is what stops superseded generations being pinned in the listener list across re-renders.
        if (visualisation._renderOwner) {
            Ren.Messages.removeListenersByOwner(visualisation._renderOwner);
        }

        const renderOwner = { visualisationGuid: visualisation.visualisationGuid };
        visualisation._renderOwner = renderOwner;

        Ren.Messages.withOwner(renderOwner, () => {

            if (visualisationType.getCreateFunction) {

                // Most visualisations specify a 'createFunction' which we pass to
                // renderVisualisation.
                Ren.WebReportDisplay.renderVisualisation(
                    visualisation,
                    visualisationType.getCreateFunction()
                );
            }
            else if (visualisationType.render) {

                // gridsets have custom 'render' functions with additional logic.
                visualisationType.render(visualisation, tabularDataSet);
            }
        });

        // Visualisation has indicated it doesn't have everything it needs to render yet; defer
        // rendering to the next iteration.  On a tab that isn't shown, what it waits for may not
        // happen until the tab is, so it no longer shows as loading or the page would never finish.
        if (visualisation.instance === Ren.NotReady) {

            if (Ren.TabRelativeVisualisations.isOnUnshownTab(visualisation)) {

                Ren.LoadingAnimations.removeUnrenderedLoadingAnimation(visualisation);
            }

            return;
        }

        // Tagged with this render's owner like the rest of the generation's listeners: the handler
        // it registers closes over the visualisation, so an untagged one would pin every
        // superseded visualisation on the page for the life of the page.
        Ren.Messages.withOwner(renderOwner, () => {

            Ren.VisualisationSettings_Debug(visualisation);
        });
        Ren.LoadingAnimations.removeLoadingAnimation(visualisation);

        // If the visualisation has an element, then ascertain its tabbed module tab ID (if any)
        // and add a CSS class for it.
        if (visualisation?.instance?.element) {

            // If the visualisation has no tabbed module tab ID yet, and has been rendered inside a
            // tabbed module, find the tab ID it has been rendered in and set the attribute to that.
            if (!visualisation.tabbedModuleTabId) {

                const tabbedModuleTab = visualisation.instance.element.closest(".ren-tabbed-module__tab-content");

                if (tabbedModuleTab) {
                    visualisation.tabbedModuleTabId = tabbedModuleTab.getAttribute("data-tab-id");
                }
                else {

                    visualisation.tabbedModuleTabId = null;
                }
            }
        }

        if (visualisationType.supportsEffects && visualisation.element && !visualisation.isVirtual) {

            Ren.VisualisationEffects.applyEffects(visualisation);

            // Standing, so that the visualisation's own menus don't supersede it as they rebuild.
            Ren.AddStandingContextMenuItems(
                visualisation.element,
                "visualisation-effects",
                () => Ren.ContextMenuItems_VisualisationEffects.getMenuItems(visualisation)
            );
        }

        if (visualisationType.supportsFocusMode) {
            Ren.VisualisationFocusMode.setUpFocusModeButton(visualisation);
        }

        // Standing too, and offered only where there are declared settings to go back to.
        if (visualisation.element && !visualisation.isVirtual &&
            Ren.VisualisationOriginalSettings.hasOriginalSettings(visualisation)) {

            Ren.AddStandingContextMenuItems(
                visualisation.element,
                "visualisation-reset",
                () => Ren.ContextMenuItems_VisualisationReset.getMenuItems(visualisation)
            );
        }

        visualisation.isRendered = true;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);

        Ren.Messages.Events.visualisationRendered.notify();
    };

    return {
        renderVisualisation
    };
})();
