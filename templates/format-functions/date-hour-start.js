/**
 * Groups date/times by hour, as the sortable date/time the hour they fall in starts at.
 *
 * TAGS: calculation, binning
 */
if (!@value) return null;
return Ren.DateUtils.toSortableStartOfHour(@value);