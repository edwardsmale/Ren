/**
 * Renders a human-readable summary of the report's selected date range, and its comparison range
 * when one is present, e.g. "Q2 2026 compared with Q2 2025".  Its row carries StartDate, EndDate,
 * CompareStartDate and CompareEndDate, from the visualisation's data source or, without one, the
 * report's own dates.
 *
 * TAGS: format, html, report-specific
 *
 * @returns {string} The summary HTML, or an empty string when the range has no recognised summary.
 */

// Nulls from a data source arrive as the null sentinel rather than null, so normalise them before use.
const clean = value => (value === Ren.NullSentinel ? null : value);

const startDate = clean(rowVals.StartDate);
const endDate = clean(rowVals.EndDate);
const compareStartDate = clean(rowVals.CompareStartDate);
const compareEndDate = clean(rowVals.CompareEndDate);

if (compareStartDate && compareEndDate) {

    const comparisonSummary = Ren.DateRangeSummariser.getDateRangeComparisonSummary(
        startDate, endDate, compareStartDate, compareEndDate);

    return comparisonSummary
        ? `<b>${comparisonSummary.dateRangeSummary}</b> compared with <b>${comparisonSummary.compareDateRangeSummary}</b>`
        : "";
}

return Ren.DateRangeSummariser.getDateRangeSummary(startDate, endDate) ?? "";
