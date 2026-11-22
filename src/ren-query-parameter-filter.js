/**
 * Applies URL query parameter filters to reports on load.
 * For each URL query parameter, if a column with a matching ColumnId exists, a data-row filter
 * is applied.  Works for both full-page reports (window.location) and popup/embedded reports
 * (reportContext element's data-request-url).
 *
 * A full-page report's URL hash may also carry a tab's row filters, or their session storage key
 * (see addRowFiltersToUrl), as a popup grid popped out to its own page does.  Kept out of the
 * query string, they are not sent to the server as report parameters.
 */
Ren.QueryParameterFilter = (() => {

    const skipParams = ["startdate", "enddate", "sql", "sqlfilename", "uploadedfiles", "isembeddedreport"];

    const ROW_FILTERS_HASH_KEY = "rowFilters";
    const ROW_FILTERS_STORAGE_HASH_KEY = "rowFiltersKey";
    const ROW_FILTERS_STORAGE_KEY_PREFIX = "ren-row-filters";

    const getParametersFromUrl = (urlString) => {

        const params = {};
        const queryStart = urlString.indexOf("?");

        if (queryStart === -1) return params;

        const pairs = urlString.substring(queryStart + 1).split("&");

        for (let i = 0; i < pairs.length; i++) {

            const separatorIndex = pairs[i].indexOf("=");
            if (separatorIndex === -1) continue;

            const key = decodeURIComponent(pairs[i].substring(0, separatorIndex));
            const value = decodeURIComponent(pairs[i].substring(separatorIndex + 1));

            if (key) params[key] = value;
        }

        return params;
    };

    const getReportUrl = (visualisation) => {

        if (window.location.search) return window.location.search;

        const reportContextElement = visualisation?.reportContext?.element;

        if (reportContextElement) return reportContextElement.getAttribute("data-request-url") ?? "";

        return "";
    };

    /**
     * Removes row filters stored for earlier pop-outs, other than those this page was opened with.
     */
    const removeStoredRowFilters = () => {

        const ownKey = Ren.HashUtils.readHash()[ROW_FILTERS_STORAGE_HASH_KEY];
        const keys = [];

        for (let index = 0; index < sessionStorage.length; index++) {

            const key = sessionStorage.key(index);

            if (key.startsWith(ROW_FILTERS_STORAGE_KEY_PREFIX) && key !== ownKey) keys.push(key);
        }

        for (let index = 0; index < keys.length; index++) {
            sessionStorage.removeItem(keys[index]);
        }
    };

    /**
     * Adds a tab's row filters to a URL's hash, as { tab, columnFilters, predicates }: the tab's
     * title, its column filters as { column, values, isNegated }, and its row filter predicates.
     * They may carry other details of the grid they came from, for the page to read.
     *
     * They are kept in session storage, which a tab opened from this one copies, with only their
     * key in the hash, so that the URL stays short.  Where storage is unavailable they go in the
     * hash itself, only URI-encoded, which leaves the JSON's "&"s and "="s as they are.
     */
    const addRowFiltersToUrl = (url, rowFilters) => {

        const json = JSON.stringify(rowFilters);

        try {

            removeStoredRowFilters();

            const key = Ren.RandomUtils.generateRandomClassName(ROW_FILTERS_STORAGE_KEY_PREFIX);

            sessionStorage.setItem(key, json);

            return Ren.HashUtils.addHashParameter(url, ROW_FILTERS_STORAGE_HASH_KEY, key);
        }
        catch (error) {

            console.warn("[QueryParameterFilter] Row filters not stored; put in the URL", error);

            return Ren.HashUtils.addHashParameter(
                url,
                ROW_FILTERS_HASH_KEY,
                encodeURIComponent(json)
            );
        }
    };

    const getStoredRowFiltersJson = (key) => {

        try {
            return sessionStorage.getItem(key);
        }
        catch (error) {

            return null;
        }
    };

    const getRowFiltersFromHash = () => {

        const hash = Ren.HashUtils.readHash();
        const storageKey = hash[ROW_FILTERS_STORAGE_HASH_KEY];
        let json = null;

        if (storageKey) {

            json = getStoredRowFiltersJson(decodeURIComponent(storageKey));

            if (!json) {
                console.warn("[QueryParameterFilter] Row filters no longer in session storage");
            }
        }
        else if (hash[ROW_FILTERS_HASH_KEY]) {

            json = decodeURIComponent(hash[ROW_FILTERS_HASH_KEY]);
        }

        if (!json) return null;

        try {
            return JSON.parse(json);
        }
        catch (error) {

            console.warn("[QueryParameterFilter] Unreadable row filters", error);

            return null;
        }
    };

    const isColumnResolved = (tabularData, column) =>
        tabularData.columnResolver.getColumnIndex(column) !== null;

    /**
     * Gets a value indicating whether every column a predicate names is in the tabular data, as
     * one added by the grid it came from (a calculated column, say) may not be.
     */
    const arePredicateColumnsResolved = (tabularData, predicate) => {

        if (predicate?.column != null && !isColumnResolved(tabularData, predicate.column)) {
            return false;
        }

        const columns = predicate?.columns;

        if (!Array.isArray(columns)) return true;

        for (let i = 0; i < columns.length; i++) {

            if (!isColumnResolved(tabularData, columns[i])) return false;
        }

        return true;
    };

    /**
     * Replaces the filters of the page's own grid of the hash's tab with the hash's row filters,
     * so that it shows the rows the grid they came from did.
     */
    const applyHashRowFilters = (dataGroupingSettings, tabularData, visualisation) => {

        if (visualisation?.isPopup || visualisation?.isInsidePopup) return;
        if (visualisation?.isInsideEmbeddedReport) return;

        const reportContext = visualisation?.reportContext;

        if (reportContext?._hashRowFiltersApplied) return;

        const rowFilters = getRowFiltersFromHash();

        if (!rowFilters || rowFilters.tab !== tabularData.Title) return;

        const sortFilterGroup = dataGroupingSettings.sortFilterGroup;
        const predicates = (rowFilters.predicates ?? [])
            .filter(predicate => arePredicateColumnsResolved(tabularData, predicate));
        const columnFilters = rowFilters.columnFilters ?? [];

        sortFilterGroup.unfilter();

        // Applied before the column filters, to avoid an intermediate regroup.
        if (predicates.length) {
            sortFilterGroup.setRowFilterPredicates(predicates);
        }

        for (let i = 0; i < columnFilters.length; i++) {

            const columnFilter = columnFilters[i];

            if (!isColumnResolved(tabularData, columnFilter.column)) continue;

            if (columnFilter.isNegated) {
                sortFilterGroup.setColumnFilterNegated(columnFilter.column, true);
            }

            sortFilterGroup.setAllFilter(columnFilter.column, columnFilter.values);
        }

        if (reportContext) reportContext._hashRowFiltersApplied = true;
    };

    /**
     * Applies URL query parameter filters to a dataGroupingSettings/tabularData pair immediately
     * after the sortFilterGroup has been set up.  Called from ren-data-grid.js after groupings
     * are initialised.  A flag on the reportContext ensures this runs only once per report load,
     * so that child visualisations (e.g. filter module internals) are unaffected.
     */
    const applyFiltersToDataGroupingSettings = (dataGroupingSettings, tabularData, visualisation) => {

        applyHashRowFilters(dataGroupingSettings, tabularData, visualisation);

        const reportContext = visualisation?.reportContext;

        if (reportContext?._queryParameterFiltersApplied) return;

        const url = getReportUrl(visualisation);
        const params = getParametersFromUrl(url);

        let anyApplied = false;

        for (const paramName in params) {

            if (skipParams.includes(paramName.toLowerCase())) continue;

            const paramValue = params[paramName];
            if (!paramValue) continue;

            for (let i = 0; i < tabularData.ColumnModels.length; i++) {

                if (tabularData.ColumnModels[i].ColumnId === paramName) {

                    dataGroupingSettings.sortFilterGroup.filter(paramName, [paramValue]);
                    anyApplied = true;
                    break;
                }
            }
        }

        if (anyApplied && reportContext) {

            reportContext._queryParameterFiltersApplied = true;
        }
    };

    /**
     * Re-applies URL query parameter filters even if they have already been applied once for this
     * report load.  Used when a popup report is opened a second time: its data source is cached, so
     * the grid renders synchronously and then has its saved/default settings re-applied on top
     * (see ren-popup-report.js), which would otherwise clobber the query parameter filter.  The
     * URL parameter is meant to override the report's default filters, so it must win - hence we
     * clear the once-per-load guard and re-apply.
     */
    const reapplyFiltersToDataGroupingSettings = (dataGroupingSettings, tabularData, visualisation) => {

        const reportContext = visualisation?.reportContext;

        if (reportContext) reportContext._queryParameterFiltersApplied = false;

        applyFiltersToDataGroupingSettings(dataGroupingSettings, tabularData, visualisation);
    };

    return {
        addRowFiltersToUrl,
        getRowFiltersFromHash,
        applyFiltersToDataGroupingSettings,
        reapplyFiltersToDataGroupingSettings
    };
})();
