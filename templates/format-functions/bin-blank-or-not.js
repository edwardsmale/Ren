/**
 * Bins a value into blank and non-blank.
 *
 * TAGS: format, calculation, binning
 * BINNING: universal, "Blank / Non-Blank", 10
 * OUTPUT: text
 */
if (Ren.IsNullOrEmpty(value)) return "0¬Blank";
return "1¬Not Blank";
