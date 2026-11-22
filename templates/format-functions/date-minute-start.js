/**
 * Groups date/times by minute, as the sortable date/time the minute they fall in starts at.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfMinute(@value);