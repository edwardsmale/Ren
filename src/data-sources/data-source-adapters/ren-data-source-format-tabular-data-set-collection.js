/**
 * The tabular data set collection JSON a Ren report endpoint returns, and the format assumed for
 * any JSON that nothing else recognises.
 *
 * So that a plain format that wasn't recognised before it was parsed - columns-and-rows starting
 * with its rows, say - is still read, the parse tells it apart from a collection by what it
 * produces.
 */
Ren.DataSourceFormat_TabularDataSetCollection = (() => {

    const OPENING_BRACE = 123; // {

    const OPENING_BRACKET = 91; // [

    const SPACE = 32;
    const TAB = 9;
    const LINE_FEED = 10;
    const CARRIAGE_RETURN = 13;

    /**
     * Returns a value indicating whether a response body looks like JSON.  Only consulted when the
     * formats that can recognise themselves have declined it.
     *
     * Scanned for its first non-whitespace character rather than trimmed: a response is tens of
     * megabytes, and trimming one just to look at its start copies the whole thing.
     */
    const sniff = (response) => {

        for (let index = 0; index < response.length; index++) {

            const characterCode = response.charCodeAt(index);

            if (characterCode === SPACE || characterCode === TAB ||
                characterCode === LINE_FEED || characterCode === CARRIAGE_RETURN) {

                continue;
            }

            return characterCode === OPENING_BRACE || characterCode === OPENING_BRACKET;
        }

        return false;
    };

    /**
     * Converts a response body into the tabular data set collection it represents, alongside the
     * JSON that represents that collection.  Throws when the body is not valid JSON, for the
     * caller to report.
     */
    const parse = (response, dataSourceUri) => {

        return Ren.DataSourcesAdapter.adaptToTabularDataSetCollection(response, dataSourceUri);
    };

    return {
        name: "tabular-data-set-collection",
        contentTypes: ["application/json"],
        sniff,
        parse
    };
})();
