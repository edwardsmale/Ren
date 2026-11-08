/**
 * Parses the attributes of ren-* elements.
 */
Ren.RenElementAttributeParser = (() => {

    const parseRenElementAttributes = (element) => {

        // Parse the attributes of the element into an object.
        const parameters = Array.from(element.attributes).reduce((obj, a) => {

            obj[Ren.TextUtils.convertToCamelCase(a.name)] = a.value;
            return obj;
        }, {});

        for (const key in parameters) {

            if (parameters[key] === "") {
                parameters[key] = true; // boolean attribute, e.g. show-row-and-column-headings
            }
            else if (parameters[key].toLowerCase() === "true") {

                parameters[key] = true;
            }
            else if (parameters[key].toLowerCase() === "false") {

                parameters[key] = false;
            }
            else if (parameters[key].toLowerCase() === "null") {

                parameters[key] = null;
            }
        }

        return parameters;
    };

    return {
        parseRenElementAttributes
    };
})();
