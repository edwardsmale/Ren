/**
 * Groups dates by quarter, as the sortable date the quarter they fall in starts on.
 *
 * TAGS: calculation, binning
 */
if (!value) return null;
return Ren.DateUtils.toSortableStartOfQuarter(value);