/**
 * Shows how far the value is from the report's average, signed, to two decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatNumberPlus2DP(value - overallSummaryStats.average);
