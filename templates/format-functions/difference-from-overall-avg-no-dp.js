/**
 * Shows how far the value is from the report's average, signed, to no decimal places.
 *
 * TAGS: format
 */
if (Ren.IsNull(value)) return value;
return Ren.ValueFormatter.formatNumberPlusNoDP(value - overallSummaryStats.average);
