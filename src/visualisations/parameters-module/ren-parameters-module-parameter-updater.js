/**
* Updates the report URL (either refreshing the whole page or just a single report context) when
* the setting in a report parameters module is changed.
*/
Ren.ParametersModuleParameterUpdater = (() => {

    const updateParameter = (visualisation, key, value) => {

        const url = Ren.UrlUtils.makeSiteRelativeUrl(visualisation.containingReportUrl);

        // Retain any settingsName and isPreset parameters.
        let newUrl = Ren.UrlUtils.mergeCurrentQueryStringSettingsParametersIntoUrl(url);

        newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, key, value);
        newUrl = Ren.TextUtils.removeTrailing(newUrl, "%23"); // Remove trailing encoded hash.

        // Reloading the page would lose an embedded report, so only its report context reloads.
        if (visualisation.reloadsPage && !visualisation.isInsideEmbeddedReport) {

            location.href = newUrl;
        }
        else {

            Ren.ReportContextUrlUpdater.updateReportUrl(newUrl, visualisation);
        }
    };

    const clearParameter = (visualisation, key) => {

        updateParameter(visualisation, key, null);
    };

    return {
        updateParameter,
        clearParameter
    };
})();
