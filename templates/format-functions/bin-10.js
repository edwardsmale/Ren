/**
 * Bins a number into ranges of ten, as a sortable value and the label to show.
 *
 * TAGS: format, calculation, binning
 * OUTPUT: text
 */
if (value === null || value === undefined) return "-";
if (typeof value !== "number") return value;
if (value === 0) return "0000000000¬0";
if (value > 0 && value < 10) return "0000000001¬0-9";
const floor = Math.floor(value / 10);
const rangeText = floor * 10 === 0 ? "0" : floor * 10 + "-" + (floor * 10 + 9);
const sortableValue = (floor * 10 + 1).toFixed(0).padStart(10, "0");
return sortableValue + "¬" + rangeText;