/**
 * Shows how far the value is from its group's average, signed, to two decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatNumberPlus2DP(value - groupSummaryStats.average);
