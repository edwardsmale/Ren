/**
    Appends a string if the value in the source column is truthy.

    TAGS: format

    @param {string} sourceColumn Specifies the column containing the true/false value
    @param {string} stringToAppend Specifies the string to append
*/

if (@(Ren.TextUtils.isTrue(rowVals["$sourceColumn"]))) {
    return value + "$stringToAppend";
}
else {
    return value;
}