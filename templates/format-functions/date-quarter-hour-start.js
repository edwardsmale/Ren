/**
 * Groups date/times by quarter hour, as the sortable date/time the 15 minutes they fall in
 * start at.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfQuarterHour(@value);