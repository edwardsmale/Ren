/**
 * Shows the value as a percentage of its group's largest value, to no decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatPercentageNoDP(value / groupSummaryStats.max);
