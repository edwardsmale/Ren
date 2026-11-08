Ren.VisualisationRenderer_All = (() => {

    /**
     * Retries the visualisations that returned Ren.NotReady, if there are any.
     */
    const retryNotReadyVisualisations = () => {

        const visualisations = Ren.VisualisationCollection.getUnrenderedVisualisations();

        for (let index = 0; index < visualisations.length; index++) {

            if (visualisations[index].instance === Ren.NotReady) {

                Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
                return;
            }
        }
    };

    // Visualisations waiting for another's data grouping settings, or for their tab to be shown.
    // One waiting on a visualisation that rendered without registering any waits no longer.
    Ren.Messages.Events.dataGroupingSettingsRegistered.handle(() => retryNotReadyVisualisations());
    Ren.Messages.Events.tabbedModuleTabChanged.handle(() => retryNotReadyVisualisations());
    Ren.Messages.Events.visualisationRendered.handle(() => retryNotReadyVisualisations());

    Ren.Messages.Requests.renderUnrenderedVisualisations.handle(() => {

        const visualisations = Ren.VisualisationCollection.getUnrenderedVisualisations();

        if (!visualisations.length) return;

        // In downloaded reports, some visualisations (like DateSelector and DateRangeSummary) can
        // render without their data source because they have fallback mechanisms to get their
        // data from other sources.
        const isDownloadedReport = Ren.UrlContext.isDownloadedReport();
        const visualisationTypesThatCanRenderWithoutData = ['DateSelector', 'DateRangeSummary'];

        // First pass: render visualisations that need immediate rendering.

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation)) continue;

            const visualisationType = Ren.VisualisationTypes.getByTypeName(
                visualisation.visualisationTypeName
            );

            if (!visualisationType?.renderImmediately) continue;

            // Render immediately.
            if (visualisation.requiredDataSourceNames) {

                const allDataSourcesLoaded = visualisation.requiredDataSourceNames.every(
                    name => Ren.DataSources.isNamedDataSourceLoaded(name)
                );

                if (allDataSourcesLoaded) {

                    Ren.VisualisationRenderer.renderVisualisation(visualisation);
                }
            }
            else if (visualisation.dataSourceUri) {

                if (Ren.DataSources.isDataSourceLoaded(visualisation.dataSourceUri)) {

                    Ren.VisualisationRenderer.renderVisualisation(visualisation);
                }
            }
            else {

                Ren.VisualisationRenderer.renderVisualisation(visualisation);
            }
        }

        // Second pass: render remaining visualisations.
        for (let j = 0; j < visualisations.length; j++) {

            const visualisation = visualisations[j];

            // Skip if already rendered (by immediate rendering pass).
            if (visualisation.isRendered) continue;

            if (Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation)) {

                // The report context specified in the visualisation doesn't yet exist in the DOM.
                // Create a report settings script element whose visualisations collection just
                // contains this visualisation.  This will effectively defer rendering of the
                // visualisation until the report context element is available and scanify runs.

                // Don't do this if the visualisation already has an element.
                if (visualisation.element) continue;

                const reportSettingsScriptElement = Ren.HtmlUtils.create("script")
                    ._addClass("js-ren-report-settings")
                    ._attr("type", "application/json")
                    ._html(JSON.stringify({ visualisations: [visualisation] }));

                Ren.HtmlUtils.getBody()._append(reportSettingsScriptElement);

                continue;
            }

            if (visualisation.requiredDataSourceNames) {

                // Some visualisation types need multiple data sources, and they may not be the
                // same necessarily as the 'data-source-uri' attribute on the ren element.  These
                // visualisations define the requiredDataSourceNames property and are rendered once
                // all of the data sources are loaded.
                const allDataSourcesLoaded = visualisation.requiredDataSourceNames.every(
                    name => Ren.DataSources.isNamedDataSourceLoaded(name)
                );

                if (allDataSourcesLoaded) {

                    Ren.VisualisationRenderer.renderVisualisation(visualisation);
                }
            }
            else if (visualisation.dataSourceUri) {

                if (Ren.DataSources.isDataSourceLoaded(visualisation.dataSourceUri)) {

                    Ren.VisualisationRenderer.renderVisualisation(visualisation);
                }
                else if (isDownloadedReport && visualisationTypesThatCanRenderWithoutData.includes(visualisation.visualisationTypeName)) {

                    // In downloaded reports, some visualisations can render without their data
                    // source because they have fallback mechanisms (e.g., DateSelector can get
                    // dates from the report context parameters instead of from its data source).
                    Ren.VisualisationRenderer.renderVisualisation(visualisation);
                }
            }
            else {

                Ren.VisualisationRenderer.renderVisualisation(visualisation);
            }
        }
    });
})();
