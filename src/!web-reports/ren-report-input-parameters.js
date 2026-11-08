/**
 * Contains the data parameters for the web report.
 */
Ren.ReportInputParameters = (() => {

    /**
     * Returns the input parameters from the outermost report context.
     */
    const getPageInputParameters = () => {

        const scriptContainingInputParameters = document.querySelector(".js-ren-input-parameters");

        if (!scriptContainingInputParameters) return {};

        return Ren.JsonUtils.parse(scriptContainingInputParameters.textContent);
    };

    /**
     * Returns the input parameters from the containing report, or from the page when the caller
     * has no containing report: a visualisation rendered outside any report context still wants
     * the parameters the report was requested with, and would otherwise fail here.
     */
    const getInputParameters = (containingReport) => {

        if (!containingReport) return getPageInputParameters();

        const scriptContainingInputParameters = containingReport.querySelector(".js-ren-input-parameters");

        if (!scriptContainingInputParameters) return {};

        return Ren.JsonUtils.parse(scriptContainingInputParameters.textContent);
    };

    /**
     * Returns the input parameters of the report context with the given GUID, or from the page
     * where no GUID is given or no context has it, for code that holds only a GUID.
     */
    const getInputParametersForGuid = (reportContextGuid) => {

        if (!reportContextGuid) return getPageInputParameters();

        const reportContext = document.querySelector(
            ".js-ren-report-context[data-report-context-guid=\"" + reportContextGuid + "\"]"
        );

        return getInputParameters(reportContext);
    };

    /**
     * Returns the query parameters from the report request URL.  Camel-cases the keys.
     */
    const getQueryParameters = (reportRequestUrl) => {

        const queryString = Ren.UrlUtils.getAllQueryParameters(reportRequestUrl);

        return Ren.ObjectUtils.makeKeysCamelCase(queryString);
    };

    /**
     * Adds a parameter to the additionalParameters collection, scoped to the reportContextGuid.
     */
    const addParameter = (reportContextGuid, key, value) => {

        if (!additionalParameters[reportContextGuid]) {
            additionalParameters[reportContextGuid] = {};
        }

        additionalParameters[reportContextGuid][Ren.TextUtils.convertToCamelCase(key)] = value;
    };

    // Used by the <ren-default-dates> visualisation.
    const additionalParameters = {};

    const getAdditionalParameters = (reportContextGuid) => {

        return additionalParameters[reportContextGuid] || {};
    };

    const combineParameters = (sources) => {

        const combinedParameters = {};

        for (let i = 0; i < sources.length; i++) {

            const source = sources[i];

            if (!source) continue;

            if (source["startDate"] || source["endDate"]) {

                delete combinedParameters.startDate;
                delete combinedParameters.endDate;
            }

            Ren.ObjectUtils.mergeObject(source, combinedParameters);
        }

        // Delete this query parameter, which is used in report request URLs to prevent statics
        // being included (to avoid including statics when they already exist on the page), and
        // should not be included in data source URIs.
        delete combinedParameters.noStatics;

        return combinedParameters;
    };

    return {
        getPageInputParameters,
        getInputParameters,
        getInputParametersForGuid,
        getAdditionalParameters,
        getQueryParameters,
        addParameter,
        combineParameters
    };
})();
