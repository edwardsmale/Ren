/**
 * Parses a date/time in any of the forms Ren recognises and shows what it read, so that the
 * universal parser can be exercised from a report.
 *
 * TAGS: format, calculation
 */
return Ren.DateUtils.parseDateTimeUniversal('@value').toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .replace(".000", "");
