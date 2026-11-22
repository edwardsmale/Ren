/**
 * A thin wrapper visualisation that renders the report's selected date range (and comparison range,
 * if present) as a human-readable summary.  The markup is simply <ren-date-range-summary />; the
 * rendering is delegated to the generic format-function content module running the
 * "date-range-summary" format function.  Without a data source the row it is given carries the
 * report's own dates, those a data source would have been requested with.
 */
Ren.CreateDateRangeSummary = (tabularData, visualisation) => {

    visualisation.formatFunction = "date-range-summary";
    visualisation.moduleCssClass = "ren-date-range-summary";

    if (tabularData) return Ren.CreateFormatFunctionContentModule(tabularData, visualisation);

    const dates = Ren.DataSourceUriResolver.getDates(visualisation, visualisation.element);

    return Ren.CreateFormatFunctionContentModule(null, visualisation, [{
        StartDate: dates.startDate,
        EndDate: dates.endDate,
        CompareStartDate: dates.compareStartDate,
        CompareEndDate: dates.compareEndDate
    }]);
};
