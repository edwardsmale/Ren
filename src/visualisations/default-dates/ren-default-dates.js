/**
 * Adds the date parameters from the passed visualisation to the additionalParameters collection.
 */
Ren.SetDefaultDates = (visualisation) => {

    let startDate = null;
    let endDate = null;

    if (!visualisation.reportContext) {
        return;
    }

    const reportContextGuid = visualisation.reportContext.reportContextGuid;

    if (visualisation.startDate) {

        Ren.ReportInputParameters.addParameter(reportContextGuid, "startDate", visualisation.startDate);
        startDate = visualisation.startDate;
    }

    if (visualisation.endDate) {

        Ren.ReportInputParameters.addParameter(reportContextGuid, "endDate", visualisation.endDate);
        endDate = visualisation.endDate;
    }

    if (visualisation.compareStartDate) {

        Ren.ReportInputParameters.addParameter(reportContextGuid, "compareStartDate", visualisation.compareStartDate);
    }

    if (visualisation.compareEndDate) {

        Ren.ReportInputParameters.addParameter(reportContextGuid, "compareEndDate", visualisation.compareEndDate);
    }

    if (visualisation.dateRange) {

        const dateRange = Ren.DateAcronyms.getSortableDateRangeByAcronym(
            visualisation.dateRange,
            visualisation.wholeWeeks,
            visualisation.wholeMonths,
            visualisation.wholeQuarters,
            visualisation.wholeYears,
            visualisation.upToToday
        );

        startDate = dateRange.getStartDate();
        endDate = dateRange.getEndDate();

        Ren.ReportInputParameters.addParameter(reportContextGuid, "dateRange", visualisation.dateRange);
        Ren.ReportInputParameters.addParameter(reportContextGuid, "startDate", startDate);
        Ren.ReportInputParameters.addParameter(reportContextGuid, "endDate", endDate);
    }

    if (visualisation.compareDateRange) {

        const compareDateRange = Ren.DateAcronyms.getCompareDateRangeByAcronym(
            visualisation.compareDateRange,
            startDate,
            endDate
        );

        Ren.ReportInputParameters.addParameter(reportContextGuid, "compareDateRange", visualisation.compareDateRange);
        Ren.ReportInputParameters.addParameter(reportContextGuid, "compareStartDate", compareDateRange.getStartDate());
        Ren.ReportInputParameters.addParameter(reportContextGuid, "compareEndDate", compareDateRange.getEndDate());
    }

    return null; // No HTML to render.
};
