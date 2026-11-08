/**
 * Shows the value as a percentage of its group's total, to two decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatPercentage2DP(value / groupSummaryStats.sum);
