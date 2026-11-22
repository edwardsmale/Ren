/**
 * What a plain data source - columns-and-rows or an array of objects - can say about one of its
 * columns, in place of what Ren would infer from the column's values:
 *
 *   { "name": "Price", "heading": "Unit price", "type": "number", "format": "currency" }
 *
 * Everything but the name is optional.  The type is one of number, date, datetime and string, and
 * the format one of those in FORMAT_TYPES below, in any case.  Given one without the other, the
 * other follows from it.
 */
Ren.DataSourceColumnHints = (() => {

    const COLUMN_TYPES = {
        number: "Number",
        date: "Date",
        datetime: "Date/Time",
        string: "String"
    };

    // The formats a hint can name, each with the type of column it formats.
    const FORMAT_TYPES = {
        General: "String",
        Number: "Number",
        Integer: "Number",
        Currency: "Number",
        Percentage: "Number",
        Id: "Number",
        Date: "Date",
        DateTime: "Date/Time"
    };

    // The format of a column whose hint names its type alone.
    const DEFAULT_FORMAT_NAMES = {
        Number: "Number",
        Date: "Date",
        "Date/Time": "DateTime",
        String: "General"
    };

    const FORMAT_NAMES = Object.keys(FORMAT_TYPES);

    const getFormatName = (format) => {

        const lowerCaseFormat = String(format).toLowerCase();

        for (let index = 0; index < FORMAT_NAMES.length; index++) {

            if (FORMAT_NAMES[index].toLowerCase() === lowerCaseFormat) return FORMAT_NAMES[index];
        }

        return undefined;
    };

    /**
     * Gets a column's hint as { heading, columnType, columnFormat }, throwing on one Ren can't use.
     */
    const readHint = (column) => {

        const name = column.name;

        if (column.heading !== undefined && typeof column.heading !== "string") {
            throw new Error(`The column "${name}" has a heading that isn't a string.`);
        }

        let columnType = undefined;
        let formatName = undefined;

        if (column.type !== undefined) {

            columnType = COLUMN_TYPES[String(column.type).toLowerCase()];

            if (!columnType) {

                throw new Error(
                    `The column "${name}" has an unknown type, "${column.type}".  ` +
                    `Expected one of: ${Object.keys(COLUMN_TYPES).join(", ")}.`
                );
            }
        }

        if (column.format !== undefined) {

            formatName = getFormatName(column.format);

            if (!formatName) {

                throw new Error(
                    `The column "${name}" has an unknown format, "${column.format}".  ` +
                    `Expected one of: ${FORMAT_NAMES.join(", ").toLowerCase()}.`
                );
            }

            if (columnType && FORMAT_TYPES[formatName] !== columnType) {

                throw new Error(
                    `The column "${name}" can't be of type ${column.type} with format ` +
                    `${column.format}.`
                );
            }

            columnType = FORMAT_TYPES[formatName];
        }
        else if (columnType) {

            formatName = DEFAULT_FORMAT_NAMES[columnType];
        }

        return {
            heading: column.heading,
            columnType,
            columnFormat: formatName ? Ren.SpreadsheetColumnFormatEnum[formatName] : undefined
        };
    };

    /**
     * Reads a data source's columns, each of which is a name or a hint, into their names and
     * a lookup of the hints by name.
     */
    const read = (columns) => {

        const names = [];
        const hints = {};

        for (let index = 0; index < columns.length; index++) {

            const column = columns[index];

            if (typeof column === "string") {

                names.push(column);
                continue;
            }

            if (!column || typeof column.name !== "string") {
                throw new Error(`Column ${index} has no name.`);
            }

            names.push(column.name);
            hints[column.name] = readHint(column);
        }

        return { names, hints };
    };

    /**
     * Converts a value to the type its column's hint names, throwing on one that isn't of it.
     * Dates are only checked here, and are put in Ren's own form along with inferred ones.
     */
    const convertValue = (value, columnType, columnName) => {

        if (value === null || value === undefined || value === "") return value ?? null;

        if (columnType === "String") return typeof value === "string" ? value : String(value);

        if (columnType === "Number") {

            const number = typeof value === "string" ? Number(value) : value;

            if (typeof number !== "number" || isNaN(number)) {

                throw new Error(
                    `The column "${columnName}" has a value that isn't a number: ${value}`
                );
            }

            return number;
        }

        if (Ren.DateUtils.parseDateTimeUniversal(value, true) === null) {

            throw new Error(
                `The column "${columnName}" has a value that isn't a date: ${value}`
            );
        }

        return value;
    };

    return {
        convertValue,
        read
    };
})();
