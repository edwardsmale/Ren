/**
 * Bins a date into the year it falls in, as the sortable date that year starts on and the year to
 * show, e.g. "2026".
 *
 * TAGS: calculation, binning
 * BINNING: dates, "By Year", 40
 * OUTPUT: date
 */
const date = Ren.DateUtils.parseDateTimeUniversal(value);
if (!date) return value;
const yearStart = Ren.DateUtils.formatAsSortableDate(Ren.DateUtils.startOfYear(date));
return yearStart + "¬" + Ren.DateUtils.sortableDateToYear(yearStart);
