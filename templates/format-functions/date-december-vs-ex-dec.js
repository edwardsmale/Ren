/**
 * Returns whether the date is in December or not.
 *
 * TAGS: calculation, binning
 * BINNING: dates, "December / Non-December", 60
 */
if (!@value) return null;
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return null;
const month = dateObj.getMonth();
const isDecember = month === 11;
return (isDecember ? "0" : "1") + "¬" + (isDecember ? "December" : "Non-December");
