/**
 * Shows how far the value is from its group's average, signed, to no decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatNumberPlusNoDP(value - groupSummaryStats.average);
