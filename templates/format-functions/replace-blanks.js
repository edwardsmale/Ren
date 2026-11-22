/**
    Replaces blank values with a default string.

    TAGS: format

    @param {string} replacement Specifies the string to return if the value is null or undefined
*/

if (@value === null || @value === undefined || @(value?.trim()) === "") {
    return "$replacement";
}
else {
    return value;
}