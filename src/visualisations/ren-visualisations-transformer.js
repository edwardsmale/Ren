/**
 * Transforms report visualisations for serialization.
 */
Ren.VisualisationsTransformer = (() => {

    // The positions and sizes stored as whole numbers of pixels where they can be.
    const DIMENSION_KEYS = [
        "popupLeft",
        "popupTop",
        "popupRight",
        "popupWidth",
        "popupHeight",
        "popupContentScaleBaseWidth",
        "visualisationLeft",
        "visualisationTop",
        "visualisationWidth",
        "visualisationHeight"
    ];

    // Position and size keys kept together in this order, rather than alphabetically.
    const POSITION_KEY_GROUPS = [
        ["popupLeft", "popupTop", "popupWidth", "popupHeight"],
        ["visualisationLeft", "visualisationTop", "visualisationWidth", "visualisationHeight"]
    ];

    /**
     * Gets a copy of the visualisation with each group of position and size keys in Left, Top,
     * Width, Height order, placed where the group's first key comes in the existing order.
     */
    const withPositionKeysOrdered = (visualisation) => {

        const result = {};
        const keys = Object.keys(visualisation);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (result.hasOwnProperty(key)) continue;

            const group = POSITION_KEY_GROUPS.find(g => g.includes(key));

            if (!group) {

                result[key] = visualisation[key];
                continue;
            }

            for (let j = 0; j < group.length; j++) {

                const groupKey = group[j];

                if (visualisation.hasOwnProperty(groupKey)) {
                    result[groupKey] = visualisation[groupKey];
                }
            }
        }

        return result;
    };

    /**
     * Stores a visualisation's positions and sizes as whole numbers of pixels, leaving any that
     * pixels cannot express, such as "50%", as they are.
     */
    const normaliseDimensions = (visualisation) => {

        for (let i = 0; i < DIMENSION_KEYS.length; i++) {

            const key = DIMENSION_KEYS[i];

            if (Ren.StylesUtils.isDimensionSet(visualisation[key])) {
                visualisation[key] = Ren.StylesUtils.toSettingsDimension(visualisation[key]);
            }
        }
    };

    /**
     * Gets a data source URI with only its uploaded-files parameters kept.  The rest are
     * re-resolved whenever the settings are loaded, but nothing else names the uploaded files, and
     * the server's cleanup of old uploaded files treats the settings files as references to their
     * folders.
     */
    const withoutReResolvedUriParameters = (dataSourceUri) => {

        if (!dataSourceUri.includes("?")) return dataSourceUri;

        const parameters = Ren.UrlUtils.getQueryStringAsObject(dataSourceUri);
        const parametersToKeep = {};
        const keysToKeep = Ren.DataSourcesUploadedFiles.uploadedFilesParameterKeys;

        for (let i = 0; i < keysToKeep.length; i++) {

            const key = keysToKeep[i];

            if (parameters[key] !== undefined) parametersToKeep[key] = parameters[key];
        }

        return Ren.UrlUtils.sortDataSourceUriParameters(
            Ren.UrlUtils.replaceQueryString(dataSourceUri, parametersToKeep)
        );
    };

    /**
     * Removes the re-resolved parameters from a settings object's data source URI.  One naming no
     * SQL file or fetch URI to rebuild it from keeps its URI exactly as written.
     */
    const removeReResolvedUriParameters = (settings) => {

        if (!settings.sqlFilename && !settings.fetchUri) return settings;
        if (typeof settings.dataSourceUri !== "string") return settings;

        settings.dataSourceUri = withoutReResolvedUriParameters(settings.dataSourceUri);

        return settings;
    };

    /**
     * Transforms the collection's serializable visualisations ready for serialization, or the
     * given visualisationsToTransform instead.
     */
    const transform = (isForDownloadedReport, visualisationsToTransform) => {

        const result = [];

        const visualisations = visualisationsToTransform ??
            Ren.VisualisationCollection.getVisualisationsToSerialize();

        visualisations.forEach(visualisation => {

            let transformedVisualisation = Object.assign({}, visualisation);

            delete transformedVisualisation.container;
            delete transformedVisualisation.containingReport;
            delete transformedVisualisation.containingReportGuid;
            delete transformedVisualisation.createdByActuizer;
            delete transformedVisualisation.element;
            delete transformedVisualisation.hasDimensions;
            delete transformedVisualisation.hasResizeHandles;
            delete transformedVisualisation.instance;
            delete transformedVisualisation.isRendered;
            delete transformedVisualisation._renderOwner;
            delete transformedVisualisation.sourceDataGroupingSettings;
            delete transformedVisualisation.sourceVisualisationGuid;
            delete transformedVisualisation.targetElement;
            delete transformedVisualisation.statBarVisualisationGuid;
            delete transformedVisualisation.pagingBarVisualisationGuid;
            delete transformedVisualisation.visualisationTypeCount;
            delete transformedVisualisation.contextScopedTypeCount;

            // For downloaded reports, clientSide is removed so that visualisations are recreated.
            if (isForDownloadedReport) {

                // Without clientSide a tabbed module is rebuilt as though from a view, deriving
                // tab IDs from header text and laid out as a block, so its tab-scoped popups would
                // match no tab.  The live tab IDs and its client-side origin are recorded first.
                if (transformedVisualisation.tabs) {

                    transformedVisualisation.tabs = Ren.TabbedModuleTabIds.captureLiveTabIds(
                        visualisation.instance?.element ?? visualisation.element,
                        transformedVisualisation.tabs
                    );

                    if (visualisation.clientSide) {
                        transformedVisualisation.isClientSideModule = true;
                    }
                }

                delete transformedVisualisation.clientSide;
            }

            if (!isForDownloadedReport) {

                delete transformedVisualisation.visualisationGuid;

                // A generated target element won't exist after a reload, but an authored selector
                // (such as an anchor in the view) will.
                if (transformedVisualisation.isTargetSelectorGenerated) {
                    delete transformedVisualisation.targetSelector;
                }

                delete transformedVisualisation.isTargetSelectorGenerated;
            }

            if (transformedVisualisation.reportContext) {

                transformedVisualisation.reportContext = Object.assign({}, transformedVisualisation.reportContext);
                delete transformedVisualisation.reportContext.usedDefaultSettingsGroupCounts;
                delete transformedVisualisation.reportContext.element;
            }

            delete transformedVisualisation.popup;

            // E.g. sourceVisualisation, or a stat bar's gridSetVisualisation.
            Object.keys(transformedVisualisation).forEach(key => {

                if (key.endsWith("Visualisation")) {
                    delete transformedVisualisation[key];
                }
            });

            // Date markers are saved as the dates kept, not those unticked, however the dates grid
            // held the filter.
            if (transformedVisualisation.dateMarkers) {

                transformedVisualisation.dateMarkers = Ren.DateValueChart_DateMarkers
                    .withoutFilterNegations(transformedVisualisation.dateMarkers);
            }

            Ren.ChartEnumSettings.writeEnumKeys(transformedVisualisation);

            // Turning off a chart's last calendar marker period leaves null behind.
            if (transformedVisualisation.calendarMarkers === null) {
                delete transformedVisualisation.calendarMarkers;
            }

            if (!isForDownloadedReport) {

                // The actuizer treats undefined as true.
                delete transformedVisualisation.needsUriReResolution;

                // Left out rather than saved to be ignored, which also keeps a date change from
                // churning every URI in the file.
                removeReResolvedUriParameters(transformedVisualisation);

                if (transformedVisualisation.dateMarkers?.sqlFilename) {

                    // Cloned, as the shallow copy still shares the chart's marker configuration.
                    transformedVisualisation.dateMarkers = removeReResolvedUriParameters(
                        Object.assign({}, transformedVisualisation.dateMarkers)
                    );
                }
            }
            else {

                // A downloaded report is offline, so its URIs must stay as they were downloaded.
                transformedVisualisation.needsUriReResolution = false;
            }

            transformedVisualisation = Ren.ObjectUtils.sortKeys(
                transformedVisualisation,
                1,
                [
                    "visualisationTypeName",
                    "sqlFilename",
                    "dataSourceUri",
                    "reportContext",
                    "dataGroupingSettingsGroup",
                    "gridStateGroup",
                    "visualisationSettingsGroup"
                ]
            );

            transformedVisualisation = withPositionKeysOrdered(transformedVisualisation);

            const defaultOptions = Ren.VisualisationTypes_CommonDefaultOptions[0];

            Object.keys(defaultOptions).forEach(key => {

                if (transformedVisualisation[key] === defaultOptions[key]) {
                    delete transformedVisualisation[key];
                }
            });

            normaliseDimensions(transformedVisualisation);

            if (transformedVisualisation.isPopup || transformedVisualisation.isInsidePopup) {

                // Preserves the saved popup dimensions on report load.
                transformedVisualisation.resizeToFitContentOnLoad = false;
                delete transformedVisualisation.initialMaxWidth;
                delete transformedVisualisation.initialMaxHeight;
            }

            result.push(transformedVisualisation);
        });

        return result;
    };

    return {
        transform
    };
})();
