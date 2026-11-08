/**
 * Creates visualisations from settings (from JSON or from scanify).
 *
 * FLOW:
 * 1.  activateVirtualVisualisations() - For downloaded and settings-only reports, activate virtual
 *   visualisations
 * 2.  resolveAndRequestDataSources() - Resolve SQL filenames to URIs, request data
 * 3.  createVisualisations() - Create visualisation instances
 * 4.  renderUnrenderedVisualisations is triggered by message bus when data is ready
 */
Ren.VisualisationActuizer = (() => {

    /**
     * Determines if a visualisation should be created from settings.
     *
     * Returns false if:
     * - The visualisation was already rendered during scanify (alreadyRendered)
     * - The visualisation is client-side (created by user interaction)
     * - The visualisation was already created (created as child of another visualisation)
     * - The visualisation's data source doesn't exist
     * - The visualisation is non-popup and target element doesn't exist (downloaded reports),
     *   unless it is a container's child, which waits for its container
     */
    const shouldBeActuized = (visualisation) => {

        // If the visualisation is client-side and has a data source URI, but the data source
        // doesn't exist, skip it.
        if (visualisation.clientSide && visualisation.dataSourceUri) {

            const dataSource = Ren.DataSources.getDataSource(visualisation.dataSourceUri);

            if (dataSource === undefined) {

                return false;
            }
        }

        // Don't recreate already-created visualisations - they are created when their parents are
        // rendered.  (But we keep the visualisation settings, and any data grouping settings and
        // grid state, so that settings from those can be applied.)

        // Do create child visualisations, but then mark them as already created so that they are
        // not created again.
        if (visualisation.isAlreadyCreated) {

            return false;
        }

        // In downloaded reports, skip non-popup visualisations that don't have a valid target
        // element.  Popup visualisations are OK because they create their own container.  This
        // prevents errors when trying to appendChild to null.
        if (!visualisation.isPopup && !visualisation.targetElement &&
            !visualisation.containerVisualisationId) {

            const targetSelector = visualisation.targetSelector || ".ren-web-report-page";
            const target = document.querySelector(targetSelector);

            if (!target) {

                return false;
            }
        }

        return true;
    };

    /**
     * Activates virtual visualisations from the settings.  Virtual visualisations (like
     * ren-default-dates) don't have visual output, but they add parameters to the report context.
     * In a live web report the scanifier activates them instead.
     */
    const activateVirtualVisualisations = (visualisations) => {

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation)) continue;

            const visualisationType = Ren.VisualisationTypes.getByTypeName(
                visualisation.visualisationTypeName
            );

            if (visualisationType.isVirtual) {

                // Pass null for element since we don't have the original DOM element in this
                // context.
                Ren.VirtualVisualisationActivator.activateVirtualVisualisation(
                    visualisation,
                    visualisationType,
                    null
                );
            }
        }
    };

    /**
     * Resolves data source URIs and requests data sources for all visualisations.
     * SQL filenames are resolved to full URIs with parameters from the report context. For example:
     * "MyReport" becomes the named data source URI
     * "<namedDataSources>MyReport?startDate=2024-01-01&endDate=2024-12-31"
     *
     * Some URIs need re-resolution after virtual visualisations (like default-dates) run because
     * those visualisations add parameters to the report context that should be included in the
     * final URI.
     */
    const resolveAndRequestDataSources = (visualisations) => {

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation)) continue;

            // Re-resolve URIs that were marked as needing re-resolution (or undefined, which
            // defaults to true).  This happens for visualisations from scanify that were initially
            // resolved before default-dates ran, and now need the date parameters added.
            if (visualisation.reportContext && visualisation.needsUriReResolution !== false) {

                Ren.DataSourceUriResolver.resolveDataSourceUri(
                    visualisation,
                    null
                );

                visualisation.needsUriReResolution = false;
            }

            Ren.DataSources.requestDataSource(visualisation.dataSourceUri);
        }
    };

    /**
     * Gets a value indicating whether a visualisation is rendered as soon as it is created: one in
     * the page, rather than a popup, of a type that renders on creation and needs no data.
     */
    const rendersOnCreation = (visualisation) => {

        const visualisationType = Ren.VisualisationTypes.getByTypeName(
            visualisation.visualisationTypeName
        );

        return visualisationType.renderOnCreation === true &&
            !visualisation.isPopup &&
            !visualisation.dataSourceUri &&
            !visualisation.requiredDataSourceNames &&
            !Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation);
    };

    /**
     * Creates all actualizable visualisations.
     *
     * This creates the visualisation instances but doesn't render them yet.
     * Rendering happens later when data is ready (triggered by renderUnrenderedVisualisations).
     */
    const createVisualisations = (visualisations) => {

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (!shouldBeActuized(visualisation)) continue;

            // Mark that this visualisation was created from serialized settings (not user
            // interaction).
            visualisation.createdByActuizer = true;

            // Visualisations created from serialized settings are not clientSide, which also keeps
            // them from being re-serialized to the settings file.
            if (visualisation.clientSide === undefined) {
                visualisation.clientSide = false;
            }

            // The creator builds the live visualisation from these settings rather than adding to
            // them, so the snapshot the "Reset" menu item restores is taken from what it returns.
            const createdVisualisation =
                Ren.VisualisationCreator.createVisualisation(visualisation);

            Ren.VisualisationOriginalSettings.capture(createdVisualisation);

            // Markup goes into the page straight away rather than in the render pass, so that the
            // visualisations after it can be created in the elements it holds - which is how a
            // settings-only report's HtmlContent lays out the page the rest are anchored in.
            if (rendersOnCreation(createdVisualisation)) {

                Ren.VisualisationRenderer.renderVisualisation(createdVisualisation);
            }
        }
    };

    /**
     * Handles the process of requesting data sources and creating visualisations based on the
     * report settings.
     */
    const processVisualisations = (reportSettings) => {

        const visualisations = reportSettings.visualisations;

        // Activate virtual visualisations (like default-dates) before resolving data sources, so
        // the parameters they add (e.g. date ranges) are included in the resolved URIs.
        if (Ren.UrlContext.isDownloadedReport() || Ren.UrlContext.isSettingsBasedReport()) {
            activateVirtualVisualisations(visualisations);
        }

        resolveAndRequestDataSources(visualisations);
        createVisualisations(visualisations);

        Ren.VisualisationCollection.clearFocus();
        Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
    };

    /**
     * Based on the passed report settings, requests data sources and creates visualisations on the
     * page.
     */
    const actuize = (reportSettings) => {

        if (!reportSettings) return; // Not all web reports have settings files.

        if (!reportSettings.visualisations) return; // Not all settings include visualisations.

        Ren.Messages.Requests.scanPageForDataSources.notify(() => {

            processVisualisations(reportSettings);
        });
    };

    return {
        actuize,
        shouldBeActuized,
        processVisualisations,
        activateVirtualVisualisations,
        resolveAndRequestDataSources,
        createVisualisations
    };
})();
