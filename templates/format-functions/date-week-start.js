/**
 * Groups dates by week, as the sortable date the week they fall in starts on.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfWeek(@value);