/**
 * Resolves the data source URI of a visualisation naming a sqlFilename (a named data source, see
 * Ren.NamedDataSources) or a fetchUri (or src), mixing in the report context's dates, parameters
 * and uploaded files, then declares it to Ren.DataSources as one to fetch in its data format.
 * Unlike a dataSourceUri set directly, it follows the report the visualisation sits in.
 *
 * The parameters added to the URI's query string, which is then sorted by name, are:
 *
 *   startDate, endDate                The report's date range, from <ren-default-dates> or a
 *                                     date selector.
 *   compareStartDate, compareEndDate  The range compared against, where there is one.
 *   uploadedFile, uploadedFiles, uploadedFilesDelimiter, uploadedFilesHaveHeaderRows,
 *   uploadedFilesColumnHeadings, uploadedFilesSkipIISNoise, uploadedFilesApplyBSTCorrection
 *                                     The files uploaded to the visualisation's group, and how
 *                                     they are to be read.
 *
 * along with each of the element's attributes that is not one of its options, and each of the
 * report's own query parameters, all camel-cased.  A report's query parameters win over the
 * attributes, which win over the dates.  Any parameter ending in Date is given as a sortable
 * date, such as 2026-10-21.
 */
Ren.DataSourceUriResolver = (() => {

    const getReportContextElement = (visualisation, element) => {

        if (visualisation.reportContext?.reportContextGuid) {

            const reportContext = document.getElementsByClassName(visualisation.reportContext.reportContextGuid)[0];

            if (reportContext) return reportContext;
        }

        return Ren.HtmlUtils.getContainingReportContext(element);
    };

    /**
     * Gets the report's dates and parameters, and the visualisation's own, that its data source is
     * requested with.  The report's query parameters win over the visualisation's attributes,
     * which win over the dates from <ren-default-dates> and date selectors.
     */
    const getParameters = (visualisation, element) => {

        let reportRequestUrl = visualisation.reportContext?.reportName;
        let reportContextGuid = visualisation.reportContext?.reportContextGuid;

        // Server-side visualisations have a containing report context, but client-side ones don't.

        const reportContextElement = getReportContextElement(visualisation, element);

        if (reportContextElement) {

            reportRequestUrl = reportContextElement.getAttribute("data-request-url");
            reportContextGuid = reportContextElement.getAttribute("data-report-context-guid");
        }

        return Ren.ReportInputParameters.combineParameters([
            Ren.ReportInputParameters.getAdditionalParameters(reportContextGuid),
            visualisation.dataSourceUriParameters,
            Ren.ReportInputParameters.getQueryParameters(reportRequestUrl)
        ]);
    };

    /**
     * Gets the report's date range, and the range compared against, as sortable dates such as
     * 2026-10-21, or null where there isn't one: the dates a data source of the visualisation's
     * would be requested with, for a visualisation that shows them without one.
     */
    const getDates = (visualisation, element) => {

        const parameters = getParameters(visualisation, element);

        Ren.DateUtils.convertAllDatesToSortable(parameters);

        return {
            startDate: parameters.startDate ?? null,
            endDate: parameters.endDate ?? null,
            compareStartDate: parameters.compareStartDate ?? null,
            compareEndDate: parameters.compareEndDate ?? null
        };
    };

    /**
    * @param {Object} visualisation The visualisation settings object to modify.
    * @param {HTMLElement} element Any element inside the report context.
    */
    const resolveDataSourceUri = (visualisation, element) => {

        if (!visualisation) return;

        // One naming neither is still fetchable when it names a format, since the format alone says
        // the URI is to be requested rather than made in the browser.
        if (!visualisation.sqlFilename && !visualisation.fetchUri) {

            if (visualisation.dataFormat && visualisation.dataSourceUri) {

                Ren.DataSources.registerFetchableDataSource(
                    visualisation.dataSourceUri,
                    visualisation.dataFormat
                );
            }

            return;
        }

        // Captured before the URI is overwritten, as a visualisation recreated from settings has no
        // dataSourceUriParameters and would otherwise lose its uploaded-file params.
        const existingUriParams = Ren.UrlUtils.getQueryStringAsObject(visualisation.dataSourceUri ?? "");

        // Where both are given the fetch URI wins.
        visualisation.dataSourceUri = visualisation.fetchUri
            ? visualisation.fetchUri
            : Ren.NamedDataSources.getUri(visualisation.sqlFilename);

        const parameters = getParameters(visualisation, element);

        // Falls back to the existing URI's uploaded-file params, preserving them across reloads.
        const uploadedFileKeys = Ren.DataSourcesUploadedFiles.uploadedFilesParameterKeys;

        for (let i = 0; i < uploadedFileKeys.length; i++) {

            const key = uploadedFileKeys[i];

            if (existingUriParams[key] !== undefined && parameters[key] === undefined) {
                parameters[key] = existingUriParams[key];
            }
        }

        // An uploaded files group's current files win, so the grid fetches them on its first
        // render.
        if (visualisation.uploadedFilesGroup) {

            const groupSettings = Ren.UploadedFilesGroupsCollection.getGroupSettings(
                visualisation.uploadedFilesGroup
            );

            Ren.DataSourcesUploadedFiles.applyGroupSettingsToParameters(parameters, groupSettings);
        }

        Ren.DateUtils.convertAllDatesToSortable(parameters);

        // Shortcuts for setting the start and end dates.
        delete parameters.dateRange;
        delete parameters.compareDateRange;

        visualisation.dataSourceUri = Ren.UrlUtils.replaceQueryString(
            visualisation.dataSourceUri,
            parameters
        );

        visualisation.dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(
            visualisation.dataSourceUri
        );

        Ren.DataSources.registerFetchableDataSource(
            visualisation.dataSourceUri,
            visualisation.dataFormat
        );
    };

    return {
        getDates,
        resolveDataSourceUri
    };
})();
