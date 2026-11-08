/**
    Formats values as a percentage change between before and after values.

    TAGS: format

    @param {string} beforeColumn Specifies the column containing the before value.
    @param {string} afterColumn Specifies the column containing the after value.
*/

const before = rowVals['$beforeColumn'];
const after = rowVals['$afterColumn'];

/* If values are null/undefined/empty, return empty string.  But allow zeros. */

if (!before && before !== 0) return '';
if (!after && after !== 0) return '';

const change = (parseFloat(after) - parseFloat(before)) / Math.max(1, parseFloat(before));

return Ren.ValueFormatter.formatPercentageNoDP(change);
