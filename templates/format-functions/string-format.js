/**
    Replaces '{0}' in the format string with the cell value.

    TAGS: format

    @param {string} format The format string.  {0} will be replaced with the cell value.
*/

return `$format`.split(`{0}`).join(value);
