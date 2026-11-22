/**
 * Formats a value as currency in the largest unit it reaches, keeping a decimal
 * place only below ten of that unit (£1.5m, £32k).
 *
 * TAGS: format
 *
 * @returns {string} The abbreviated currency string.
 */
return Ren.ValueFormatter.formatCurrencyAbbreviatedAutoDP(value);