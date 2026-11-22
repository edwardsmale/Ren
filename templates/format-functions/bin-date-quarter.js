/**
 * Bins a date into the quarter it falls in, as the sortable date that quarter starts on and the
 * quarter to show, e.g. "Q3 2026".
 *
 * TAGS: calculation, binning
 * BINNING: dates, "By Quarter", 30
 * OUTPUT: date
 */
const date = Ren.DateUtils.parseDateTimeUniversal(value);
if (!date) return value;
const quarterStart = Ren.DateUtils.formatAsSortableDate(Ren.DateUtils.startOfQuarter(date));
return quarterStart + "¬" + Ren.DateUtils.getQuarterNameFromSortableDate(quarterStart);
