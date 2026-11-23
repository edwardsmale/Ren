/**
 * Writes Excel (.xlsx) workbooks in the browser.  A workbook is a ZIP of XML files (Office Open
 * XML, ECMA-376): this writes the few a workbook needs, with each sheet's first row its column
 * headings, in bold and kept in view as the sheet scrolls.
 *
 * A sheet is { name, columns, rows }:
 * - columns: [{ heading, format, width }], with format an Excel number format (such as "0.00%")
 *   and width in characters.  Both are optional.
 * - rows: an array of cell values per row, in the columns' order.  A value is a number, a string,
 *   a Date, a formula as { formula, value } (without its "=", and value the text shown until
 *   Excel works it out), or null, undefined or "" for an empty cell.
 *
 * A Date is written as the time it holds in UTC, so build it with Date.UTC for the wall-clock
 * time you want shown.  A date in a column without a format is shown as yyyy-mm-dd.
 */
Ren.XlsxWriter = (() => {

    const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const NS_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const NS_PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships";
    const NS_CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
    const RELS_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
    const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.";

    const XML_DECLARATION = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";

    const MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const DEFAULT_DATE_FORMAT = "yyyy-mm-dd";

    // Excel's limits: a sheet's name, a cell's text, and a column's width.
    const MAX_SHEET_NAME_LENGTH = 31;
    const MAX_CELL_TEXT_LENGTH = 32767;
    const MAX_COLUMN_WIDTH = 255;

    // The first number format id a workbook can define for itself.
    const FIRST_CUSTOM_FORMAT_ID = 164;

    // The styles every workbook has: 0 is a plain cell, 1 a heading.
    const PLAIN_STYLE = 0;
    const HEADING_STYLE = 1;

    // Day 0 of Excel's dates, as Excel counts them (it takes 1900 as a leap year, so a day before
    // March 1900 is a day out, but no sheet here holds one).
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
    const MS_PER_DAY = 86400000;

    // A sheet's rows go into its XML this many at a time, so a large sheet isn't one string.
    const ROWS_PER_PART = 1000;

    // Characters XML 1.0 can't hold at all.
    const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

    const escapeXml = (text) => String(text)
        .replace(INVALID_XML_CHARS, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    /**
     * Gets a column's letters, from its place counting from 0: A to Z, then AA, AB and so on.
     */
    const getColumnLetters = (index) => {

        let letters = "";

        for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {

            letters = String.fromCharCode(65 + (n - 1) % 26) + letters;
        }

        return letters;
    };

    /**
     * Gets a date as Excel's number for it: days since its day 0, with the time as a fraction.
     */
    const toExcelSerial = (date) => (date.getTime() - EXCEL_EPOCH) / MS_PER_DAY;

    /**
     * Gets a name Excel will take for a sheet: without the characters it can't hold, not starting
     * or ending with an apostrophe, and no longer than 31 characters.
     */
    const toSheetName = (name) => {

        const cleaned = String(name ?? "")
            .replace(/[\\/*?:[\]]/g, " ")
            .replace(INVALID_XML_CHARS, "")
            .substring(0, MAX_SHEET_NAME_LENGTH)
            .replace(/^'+|'+$/g, "");

        return cleaned.trim() ? cleaned : "Sheet";
    };

    /**
     * Gets a name for each sheet, made unique (as Excel needs, ignoring case) by numbering any
     * that would repeat an earlier one.
     */
    const getUniqueSheetNames = (sheets) => {

        const used = new Set();

        return sheets.map((sheet) => {

            const name = toSheetName(sheet.name);

            let unique = name;

            for (let n = 2; used.has(unique.toLowerCase()); n++) {

                const suffix = ` (${n})`;

                unique = name.substring(0, MAX_SHEET_NAME_LENGTH - suffix.length) + suffix;
            }

            used.add(unique.toLowerCase());

            return unique;
        });
    };

    const isDate = (value) => value instanceof Date;

    const isFormula = (value) => value !== null && typeof value === "object" && !isDate(value) &&
        typeof value.formula === "string";

    /**
     * Collects the number formats the sheets use, and gives each a style: a map from format to
     * the style's index, after the plain and heading styles.
     */
    const getFormatStyles = (sheets) => {

        const formatStyles = new Map();

        const add = (format) => {

            if (format && !formatStyles.has(format)) {

                formatStyles.set(format, HEADING_STYLE + 1 + formatStyles.size);
            }
        };

        sheets.forEach((sheet) => {

            sheet.columns.forEach(column => add(column.format));

            const hasDate = sheet.rows.some(row => row.some(isDate));

            if (hasDate && sheet.columns.some(column => !column.format)) add(DEFAULT_DATE_FORMAT);
        });

        return formatStyles;
    };

    const buildStyles = (formatStyles) => {

        const formats = Array.from(formatStyles.keys());

        const numFmts = formats.length
            ? `<numFmts count="${formats.length}">` + formats.map((format, i) =>
                `<numFmt numFmtId="${FIRST_CUSTOM_FORMAT_ID + i}" formatCode="${escapeXml(format)}"/>`
            ).join("") + "</numFmts>"
            : "";

        const font = (bold) =>
            `<font>${bold ? "<b/>" : ""}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;

        const formatXfs = formats.map((_, i) =>
            `<xf numFmtId="${FIRST_CUSTOM_FORMAT_ID + i}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
        ).join("");

        return XML_DECLARATION +
            `<styleSheet xmlns="${NS_MAIN}">` +
            numFmts +
            `<fonts count="2">${font(false)}${font(true)}</fonts>` +
            "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill>" +
            "<fill><patternFill patternType=\"gray125\"/></fill></fills>" +
            "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
            "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
            `<cellXfs count="${2 + formats.length}">` +
            "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
            "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>" +
            formatXfs +
            "</cellXfs>" +
            "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
            "</styleSheet>";
    };

    const styleAttribute = (style) => style === PLAIN_STYLE ? "" : ` s="${style}"`;

    const buildTextCell = (ref, style, text) => {

        const value = String(text).substring(0, MAX_CELL_TEXT_LENGTH);
        const space = /^\s|\s$/.test(value) ? " xml:space=\"preserve\"" : "";

        return `<c r="${ref}"${styleAttribute(style)} t="inlineStr"><is><t${space}>${escapeXml(value)}</t></is></c>`;
    };

    /**
     * Gets a cell's XML, or "" for an empty cell (which is left out).
     */
    const buildCell = (ref, value, columnStyle, dateStyle) => {

        if (value === null || value === undefined || value === "") return "";

        if (typeof value === "number") {

            return isFinite(value) ? `<c r="${ref}"${styleAttribute(columnStyle)}><v>${value}</v></c>` : "";
        }

        if (isDate(value)) {

            const serial = toExcelSerial(value);

            if (!isFinite(serial)) return "";

            const style = columnStyle === PLAIN_STYLE ? dateStyle : columnStyle;

            return `<c r="${ref}"${styleAttribute(style)}><v>${serial}</v></c>`;
        }

        if (isFormula(value)) {

            const cached = value.value === null || value.value === undefined
                ? ""
                : `<v>${escapeXml(String(value.value).substring(0, MAX_CELL_TEXT_LENGTH))}</v>`;

            return `<c r="${ref}"${styleAttribute(columnStyle)} t="str"><f>${escapeXml(value.formula)}</f>${cached}</c>`;
        }

        return buildTextCell(ref, columnStyle, value);
    };

    /**
     * Gets a sheet's XML, in parts.
     */
    const buildSheet = (sheet, formatStyles) => {

        const columnLetters = sheet.columns.map((_, i) => getColumnLetters(i));
        const columnStyles = sheet.columns.map(column =>
            column.format ? formatStyles.get(column.format) : PLAIN_STYLE
        );
        const dateStyle = formatStyles.get(DEFAULT_DATE_FORMAT) ?? PLAIN_STYLE;

        const widths = sheet.columns.map((column, i) => {

            const width = Number(column.width);

            if (!(width > 0)) return "";

            const clamped = Math.min(width, MAX_COLUMN_WIDTH);

            return `<col min="${i + 1}" max="${i + 1}" width="${clamped}" customWidth="1"/>`;
        }).join("");

        const parts = [
            XML_DECLARATION +
            `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_RELS}">` +
            "<sheetViews><sheetView workbookViewId=\"0\">" +
            "<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>" +
            "<selection pane=\"bottomLeft\" activeCell=\"A2\" sqref=\"A2\"/>" +
            "</sheetView></sheetViews>" +
            "<sheetFormatPr defaultRowHeight=\"15\"/>" +
            (widths ? `<cols>${widths}</cols>` : "") +
            "<sheetData>" +
            "<row r=\"1\">" +
            sheet.columns.map((column, i) =>
                buildTextCell(columnLetters[i] + "1", HEADING_STYLE, column.heading ?? "")
            ).join("") +
            "</row>"
        ];

        let part = [];

        sheet.rows.forEach((row, rowIndex) => {

            const rowNumber = rowIndex + 2;

            let cells = "";

            for (let i = 0; i < sheet.columns.length; i++) {

                cells += buildCell(columnLetters[i] + rowNumber, row[i], columnStyles[i], dateStyle);
            }

            part.push(`<row r="${rowNumber}">${cells}</row>`);

            if (part.length === ROWS_PER_PART) {

                parts.push(part.join(""));
                part = [];
            }
        });

        parts.push(part.join("") + "</sheetData></worksheet>");

        return parts;
    };

    const buildWorkbook = (sheetNames) => XML_DECLARATION +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_RELS}">` +
        "<bookViews><workbookView/></bookViews>" +
        "<sheets>" +
        sheetNames.map((name, i) =>
            `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        ).join("") +
        "</sheets>" +
        // A formula's value is worked out when the workbook is opened.
        "<calcPr fullCalcOnLoad=\"1\"/>" +
        "</workbook>";

    const buildWorkbookRels = (sheetCount) => XML_DECLARATION +
        `<Relationships xmlns="${NS_PACKAGE_RELS}">` +
        Array.from({ length: sheetCount }, (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${RELS_TYPE}worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        ).join("") +
        `<Relationship Id="rId${sheetCount + 1}" Type="${RELS_TYPE}styles" Target="styles.xml"/>` +
        "</Relationships>";

    const buildPackageRels = () => XML_DECLARATION +
        `<Relationships xmlns="${NS_PACKAGE_RELS}">` +
        `<Relationship Id="rId1" Type="${RELS_TYPE}officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>";

    const buildContentTypes = (sheetCount) => XML_DECLARATION +
        `<Types xmlns="${NS_CONTENT_TYPES}">` +
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
        `<Override PartName="/xl/workbook.xml" ContentType="${CONTENT_TYPE}sheet.main+xml"/>` +
        Array.from({ length: sheetCount }, (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CONTENT_TYPE}worksheet+xml"/>`
        ).join("") +
        `<Override PartName="/xl/styles.xml" ContentType="${CONTENT_TYPE}styles+xml"/>` +
        "</Types>";

    /**
     * Makes an Excel workbook of the given sheets (see above).  A workbook needs at least one
     * sheet, so none gives one empty sheet.
     * @returns {Promise<Blob>}
     */
    const createWorkbook = async (sheets) => {

        const all = (sheets && sheets.length ? sheets : [{ name: "Sheet" }]).map(sheet => ({
            name: sheet.name,
            columns: sheet.columns || [],
            rows: sheet.rows || []
        }));

        const sheetNames = getUniqueSheetNames(all);
        const formatStyles = getFormatStyles(all);

        const files = [
            { name: "[Content_Types].xml", content: buildContentTypes(all.length) },
            { name: "_rels/.rels", content: buildPackageRels() },
            { name: "xl/workbook.xml", content: buildWorkbook(sheetNames) },
            { name: "xl/_rels/workbook.xml.rels", content: buildWorkbookRels(all.length) },
            { name: "xl/styles.xml", content: buildStyles(formatStyles) },
            ...all.map((sheet, i) => ({
                name: `xl/worksheets/sheet${i + 1}.xml`,
                content: buildSheet(sheet, formatStyles)
            }))
        ];

        const zip = await Ren.ZipWriter.createZip(files);

        return new Blob([zip], { type: MIME_TYPE });
    };

    /**
     * Makes an Excel workbook of the given sheets, and saves it as the given file name.
     * @returns {Promise<void>}
     */
    const download = async (sheets, fileName) => {

        const blob = await createWorkbook(sheets);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return {
        getColumnLetters,
        toExcelSerial,
        toSheetName,
        createWorkbook,
        download
    };
})();
