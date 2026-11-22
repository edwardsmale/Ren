/**
 * Bins a number into negative, zero and positive.
 *
 * TAGS: format, calculation, binning
 * BINNING: numbers, "Positive/Zero/Negative", 50
 */
const val = Ren.TextUtils.parseFloat(value);
if (val === null) return "";
if (val < 0) return "0¬Negative";
if (val > 0) return "2¬Positive";
return "1¬Zero";
