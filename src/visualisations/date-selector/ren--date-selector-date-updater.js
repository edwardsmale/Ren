/**
 * Updates the report URL (either refreshing the whole page or just a single report context) when
 * the selected date range is changed.
 */
Ren.DateSelectorDateUpdater = (() => {

    const updateDateRange = (visualisation, startDate, endDate, compareStartDate, compareEndDate) => {

        const url = Ren.UrlUtils.makeSiteRelativeUrl(visualisation.containingReportUrl);

        let newUrl = url;

        // Retain any settingsName and isPreset parameters.
        newUrl = Ren.UrlUtils.mergeCurrentQueryStringSettingsParametersIntoUrl(newUrl);

        newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "StartDate", startDate);
        newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "EndDate", endDate);

        if (compareStartDate && compareEndDate) {

            newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "CompareStartDate", compareStartDate);
            newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "CompareEndDate", compareEndDate);
        }

        newUrl = Ren.TextUtils.removeTrailing(newUrl, "%23"); // Remove trailing encoded hash.

        // Reloading the page would lose an embedded report, so only its report context reloads.
        if (visualisation.reloadsPage && !visualisation.isInsideEmbeddedReport) {

            location.href = newUrl;
        }
        else {

            Ren.ReportContextUrlUpdater.updateReportUrl(newUrl, visualisation);
        }
    };

    return {
        updateDateRange
    };
})();
