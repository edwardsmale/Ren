/**
 * Groups date/times by second, as the sortable date/time the second they fall in starts at.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfSecond(@value);