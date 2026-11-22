/**
 * Sorts quarter names - "Q1 2025" - into date order rather than alphabetical order.
 *
 * TAGS: calculation, sort
 */
const match = value?.match(/^Q(\d)\s(\d{4})$/);
if (match) return parseInt(match[2] + match[1]);
return 0;
