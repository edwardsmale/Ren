(() => {

    /**
     * Binds a popup report's JSON visualisations to the popup's own report context.  The JSON names
     * the report's first context (e.g. "report-context-ProductTimeline"), but a second popup of the
     * same report is given "report-context-ProductTimeline--2nd", and its visualisations would
     * otherwise read the first popup's parameters and render into the first popup's targets.
     */
    const bindVisualisationsToReportContext = (visualisations, reportName, reportContextGuid) => {

        if (!visualisations) return;

        const authoredGuid = "report-context-" + Ren.TextUtils.cleanForCssClassName(reportName);
        const reportContextClassName = "." + reportContextGuid;

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (visualisation.reportContext?.reportContextGuid !== authoredGuid) continue;

            visualisation.reportContext.reportContextGuid = reportContextGuid;

            if (visualisation.gridStateGroup?.startsWith(authoredGuid + " ")) {

                visualisation.gridStateGroup = reportContextGuid +
                    visualisation.gridStateGroup.substring(authoredGuid.length);
            }

            // Target selectors are looked up across the whole document, so are scoped to this
            // popup's report context element, which carries its GUID as a class.
            if (visualisation.targetSelector) {

                visualisation.targetSelector =
                    reportContextClassName + " " + visualisation.targetSelector;
            }
        }
    };

    const loadPopupReportSettings = async (element, settingsName, isPreset, isDefault) => {

        const reportContext = element.querySelector(".js-ren-report-context");

        if (!reportContext) return;

        Ren.ReportSettingsReader.setScopeElement(element);

        const reportName = reportContext.getAttribute("data-report-name");

        if (!reportName) {

            Ren.ReportSettingsReader.clearScopeElement();
            return;
        }

        // Mirror the main settings loader so a named settings file on the popup URL (e.g.
        // "settingsName=Simplified&isPreset=false") is honoured rather than always loading
        // defaults.  With no settings parameters at all, load the report's default settings, which
        // on the Reporting server are its __Default user settings, if it has any.
        const kind = isDefault ? "default" : (isPreset ? "preset" : "user");

        let textResponse;

        try {

            textResponse = await Ren.SettingsStore.load(kind, reportName, settingsName);
        }
        catch (error) {

            Ren.PopupErrorMessage("Error loading report settings");
            Ren.ReportSettingsReader.clearScopeElement();
            return;
        }

        if (textResponse === null) {

            Ren.ReportSettingsReader.clearScopeElement();
            return;
        }

        const settings = Ren.JsonUtils_Lenient.parse(textResponse);

        // Popup reports embed the report inside a report context, so keys like "Foo_Data 1" become
        // "report-context-Foo Foo_Data 1".  Remap to match what the grid expects.
        const reportContextGuid = reportContext.getAttribute("data-report-context-guid");

        if (reportContextGuid) {

            const prefix = reportContextGuid + " ";

            const prefixKeys = (obj) => {

                if (!obj) return obj;

                const result = {};
                const keys = Object.keys(obj);

                for (let i = 0; i < keys.length; i++) {
                    result[prefix + keys[i]] = obj[keys[i]];
                }

                return result;
            };

            settings.dataGroupingSettings = prefixKeys(settings.dataGroupingSettings);
            settings.gridState = prefixKeys(settings.gridState);

            const visualisationProperties = settings.visualisationProperties;

            if (visualisationProperties) {

                const scopedVisualisationProperties = {};
                const visualisationKeys = Object.keys(visualisationProperties);

                for (let i = 0; i < visualisationKeys.length; i++) {

                    const scopedKey = Ren.VisualisationPropertiesTransformer
                        .getReportContextScopedKey(visualisationKeys[i], reportContextGuid);

                    scopedVisualisationProperties[scopedKey] =
                        visualisationProperties[visualisationKeys[i]];
                }

                settings.visualisationProperties = scopedVisualisationProperties;
            }

            bindVisualisationsToReportContext(
                settings.visualisations,
                reportName,
                reportContextGuid
            );
        }

        Ren.ReportSettingsLoader_Applyer.applyReportSettings(settings, true, false);

        // Re-apply the settings to any grids in this popup that have already rendered. Settings are
        // populated into the collections above, which is enough for grids that render after this
        // point (e.g. the first time a report is opened, when its data source is fetched
        // asynchronously).  But when the same report is opened a second time its data source is
        // already cached, so the grid renders synchronously during scanify - before this runs - and
        // would otherwise keep its default settings. These notifications are scoped to this popup's
        // report context, so only this popup's grids react - the settings group alone does not
        // scope them, because a group declared in the report's view is the same literal in every
        // open instance of the report.  We deliberately do not send the global collapseAllGroups /
        // variationsChanged notifications that applyReportSettings would, as those would affect
        // other reports on the page.
        reapplySettingsToRenderedGrids(settings, reportContextGuid);

        if (reportContextGuid) {
            Ren.VisualisationPropertiesTransformer.applyToExistingVisualisations(reportContextGuid);
        }

        Ren.VisualisationActuizer.actuize(settings);
        Ren.ReportSettingsReader.clearScopeElement();
    };

    // The settings fetch shows no loading animation, so the IVTs are told about it this way.
    const loadTrackedPopupReportSettings = (element, settingsName, isPreset, isDefault) => {

        Ren.QA.beginReload();

        return loadPopupReportSettings(element, settingsName, isPreset, isDefault)
            .finally(() => Ren.QA.endReload());
    };

    /**
     * Sends scoped notifications that cause already-rendered grids whose settings group matches to
     * re-apply the given grid state and data grouping settings.
     */
    const reapplySettingsToRenderedGrids = (settings, reportContextGuid) => {

        for (const gridStateGroup in settings.gridState) {

            const gridState = settings.gridState[gridStateGroup];
            gridState.gridStateGroup = gridStateGroup;

            Ren.Messages.Requests.applyDeserialisedGridState.notify(gridState, reportContextGuid);
        }

        for (const dataGroupingSettingsGroup in settings.dataGroupingSettings) {

            const dataGroupingSettings = settings.dataGroupingSettings[dataGroupingSettingsGroup];
            dataGroupingSettings.dataGroupingSettingsGroup = dataGroupingSettingsGroup;

            Ren.Messages.Requests.applyDeserialisedDataGroupingSettings.notify(
                dataGroupingSettings,
                reportContextGuid
            );
        }

        // Re-applying the saved/default data grouping settings above may have reinstated a default
        // column filter (e.g. a "Region" filter in the report's JSON settings).  When the
        // popup was opened via a link carrying a query parameter (e.g. ?Region=...), that
        // parameter is meant to override the default filter.  On the first (uncached) open this
        // happens naturally because the grid renders after these settings are populated; but on a
        // cached reopen the grid is already rendered, so we must re-assert the query parameter
        // filter here, after the default settings have been re-applied, so that it wins.  Messages
        // are processed in order, so this is queued last and therefore applied last.
        for (const dataGroupingSettingsGroup in settings.dataGroupingSettings) {

            Ren.Messages.Requests.reapplyQueryParameterFilters.notify(
                dataGroupingSettingsGroup,
                reportContextGuid
            );
        }
    };

    /**
     * Shows a report in a popup window.  The options may give a popupWidth and popupHeight, each of
     * which is then kept rather than fitted to the report. They may also give a popupReuseId, and a
     * report of one visualisation that sizes itself to its content may ask for its popup to fit
     * that exactly (fitPopupToContentExactly, raisePopupToFitContent), rather than leaving room for
     * a data grid's scroll bars and stat bar.  With scalePopupContentToFit, resizing the popup
     * scales the report to fit rather than laying it out afresh.
     */
    Ren.ShowPopupReport = (reportUrl, title, zoom, options) => {

        // The settings name / preset flag are carried on the popup report's URL (e.g.
        // "...&settingsName=Simplified&isPreset=false").  Capture them here so the popup applies
        // those settings on load, matching what happens when the report is popped out to a full
        // page (which reads the same parameters from window.location).
        const settingsName =
            Ren.ReportSettingsUrlParameters.getReportSettingsNameFromQueryString(reportUrl);
        const isPreset =
            Ren.ReportSettingsUrlParameters.getReportSettingsIsPresetFromQueryString(reportUrl);
        const isDefault =
            !settingsName && Ren.UrlUtils.getParameterValue(reportUrl, "isPreset") == null;

        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "EmbeddedReport",
            reportUrl: reportUrl,
            sourceVisualisation: null,
            isPopup: true,
            isPopupReport: true,
            withOffset: true,
            popupTitle: title,
            popupLeft: 100,
            popupTop: 100,
            popupWidth: options?.popupWidth ?? 1600,
            popupHeight: options?.popupHeight ?? 400,
            popupHasFixedWidth: options?.popupWidth != null,
            popupHasFixedHeight: options?.popupHeight != null,
            popupShowPopoutButton: true,
            horizontalScrollbar: true,
            verticalScrollbar: true,
            popupDelayOpacityMs: 1000,
            popupZoom: zoom ?? null,
            popupReuseId: options?.popupReuseId ?? null,
            fitPopupToContentExactly: options?.fitPopupToContentExactly ?? false,
            raisePopupToFitContent: options?.raisePopupToFitContent ?? false,
            scalePopupContentToFit: options?.scalePopupContentToFit ?? false,
            onReportLoaded: (element) => loadTrackedPopupReportSettings(
                element,
                settingsName,
                isPreset,
                isDefault
            )
        });
    };

})();
