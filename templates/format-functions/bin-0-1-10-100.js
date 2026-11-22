/**
 * Bins a number into 0, 1, 2-10, 11-100 and 100+, as a sortable value and the label to show.
 *
 * TAGS: format, calculation, binning
 * BINNING: numbers, "0 1 10 100+", 10
 */
if (Ren.IsNull(value)) return "-";
if (value === 0) return "000¬0";
if (value === 1) return "001¬1";
if (value <= 10) return "002-10¬2-10";
if (value <= 100) return "011-100¬11-100";
return "100¬100+";
