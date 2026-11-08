/**
 * Shows the value as a percentage of the report's total, to two decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatPercentage2DP(value / overallSummaryStats.sum);
