/**
 * The number of space-separated words in the value.
 *
 * TAGS: format, calculation, binning
 * BINNING: text, "Word Count", 50
 * OUTPUT: integer
 */
return value == null ? 0 : String(value).split(" ").length;
