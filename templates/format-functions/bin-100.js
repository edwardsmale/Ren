/**
 * Bins a number into ranges of a hundred, as a sortable value and the label to show.
 *
 * TAGS: format, calculation, binning
 * OUTPUT: text
 */
if (value === null || value === undefined) return "-";
if (typeof value !== "number") return value;
if (value === 0) return "0000000000¬0";
if (value > 0 && value < 100) return "0000000001¬0-99";
const floor = Math.floor(value / 100);
const rangeText = floor * 100 === 0 ? "0" : floor * 100 + "-" + (floor * 100 + 99);
const sortableValue = (floor * 100 + 1).toFixed(0).padStart(10, "0");
return sortableValue + "¬" + rangeText;
