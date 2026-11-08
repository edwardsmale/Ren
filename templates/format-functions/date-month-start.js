/**
 * Groups dates by month, as the sortable date the month they fall in starts on.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfMonth(@value);