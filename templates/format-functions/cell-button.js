/**
 * Formats values as buttons.
 *
 * TAGS: format, html
 *
 * @param {string} buttonText - The button text.
 * @param {string} buttonCssClass - The CSS class for the button.
 * @param {code} onClick - Code to execute when the button is clicked.
 * @returns {string} The HTML for the button.
 */
const filePath = "@value";
if (!filePath) return '';

return `<button class="$buttonCssClass" onclick="$onClick">$buttonText</button>`;
