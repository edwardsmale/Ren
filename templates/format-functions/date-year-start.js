/**
 * Groups dates by year, as the sortable date the year they fall in starts on.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfYear(@value);