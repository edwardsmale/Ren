/**
 * Shows the value as a percentage of the report's largest value, to no decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatPercentageNoDP(value / overallSummaryStats.max);
