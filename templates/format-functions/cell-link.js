/**
 * Formats values as links, using the cell values as the URLs.
 *
 * TAGS: format, html
 *
 * @returns {string} The HTML for the link.
 */

const url = value;
if (!url) return '';

return '<a href="@url" target="_blank">@value</a>';