/**
 * Writes the pieces of SQL the grid's "generate SQL from the selection" menu items are made of, and
 * shows the result in a popup.  Values are the ones the grid holds rather than shows, so a currency
 * column gives a bare number and an enum column the integer behind its label.
 */
Ren.DataGridSqlPopup = (() => {

    const MAX_LINE_LENGTH = 100;

    // Other column types are written unquoted, so long as the value reads as a number.
    const QUOTED_COLUMN_TYPES = ["String", "IndexedString", "Date", "Date/Time"];

    // Their midnight time of day is dropped, which SQL Server reads as the same moment.
    const DATE_COLUMN_TYPES = ["Date", "Date/Time"];

    const escapeIdentifier = (name) => "[" + String(name).replace(/]/g, "]]") + "]";

    /**
     * Writes text as a string literal.  Non-ASCII text gets the N prefix, so characters outside the
     * database's code page survive the paste.
     */
    const escapeStringLiteral = (text) => {

        const literal = "'" + text.replace(/'/g, "''") + "'";

        return /[\u0080-\uFFFF]/.test(text) ? "N" + literal : literal;
    };

    const isNumericText = (text) => /^-?(\d+(\.\d+)?|\.\d+)$/.test(text);

    const removeMidnightTime = (text) => text.replace(/ 00:00:00$/, "");

    /**
     * Gets the integer behind each of an enum column's labels, keyed by label, as the server puts
     * the label rather than the number in the cells.
     */
    const getEnumNumbersByLabel = (columnModel) => {

        if (columnModel.sqlPopupEnumNumbersByLabel) {

            return columnModel.sqlPopupEnumNumbersByLabel;
        }

        const enumValues = columnModel.EnumValues;
        const numbers = new Map();
        const keys = Object.keys(enumValues);

        for (let index = 0; index < keys.length; index++) {

            numbers.set(String(enumValues[keys[index]]), keys[index]);
        }

        columnModel.sqlPopupEnumNumbersByLabel = numbers;

        return numbers;
    };

    const getValueLiteral = (value, columnModel) => {

        if (Ren.IsNull(value)) return "NULL";

        let text = value.toString();

        if (DATE_COLUMN_TYPES.indexOf(columnModel.ColumnType) !== -1) {

            text = removeMidnightTime(text);
        }

        if (columnModel.EnumValues) {

            const number = getEnumNumbersByLabel(columnModel).get(text);

            // A label the enum doesn't know falls through to being written as it reads.
            if (number !== undefined) return number;
        }

        if (QUOTED_COLUMN_TYPES.indexOf(columnModel.ColumnType) === -1 && isNumericText(text)) {

            return text;
        }

        return escapeStringLiteral(text);
    };

    /**
     * Gets the raw value held in a cell, before the grid's formatting.
     */
    const getCellValue = (tabularData, rowIndex, columnIndex) =>
        tabularData.CompressionDictionary.decompressValue(
            tabularData.RowModels[rowIndex].CV[columnIndex],
            columnIndex
        );

    /**
     * Joins parts with commas, wrapping at MAX_LINE_LENGTH, with every line given the indent.
     */
    const joinWrapped = (parts, indent) => {

        const lines = [];

        let line = "";

        for (let index = 0; index < parts.length; index++) {

            const part = parts[index] + (index === parts.length - 1 ? "" : ",");

            if (line === "") {

                line = indent + part;
            }
            else if (line.length + 1 + part.length > MAX_LINE_LENGTH) {

                lines.push(line);
                line = indent + part;
            }
            else {

                line += " " + part;
            }
        }

        if (line !== "") lines.push(line);

        return lines.join("\n");
    };

    const renderPopupContent = (options, contentContainer, popup) => {

        const wrapper = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("DataGridSqlPopup", {});

        const sqlTextArea = wrapper.querySelector(".js-ren-data-grid-sql-popup-sql");
        const extraButton = wrapper.querySelector(".js-ren-data-grid-sql-popup-extra");
        const copyButton = wrapper.querySelector(".js-ren-data-grid-sql-popup-copy");
        const closeButton = wrapper.querySelector(".js-ren-data-grid-sql-popup-close");

        sqlTextArea.value = options.getSql();

        if (options.extraButton && options.extraButton.isAvailable()) {

            extraButton.textContent = options.extraButton.text;
            extraButton.title = options.extraButton.title;

            // The SQL is rewritten rather than edited as text, which a value holding a comma would
            // break.
            extraButton.addEventListener("click", () => {

                options.extraButton.click();

                sqlTextArea.value = options.getSql();
                extraButton.hidden = true;
            });
        }
        else {

            extraButton.hidden = true;
        }

        copyButton.addEventListener(
            "click",
            () => Ren.ClipboardUtils.copyAllOfTextArea(sqlTextArea, copyButton)
        );

        closeButton.addEventListener("click", () => popup.closeWindow());

        // The grid's own key handling (e.g. arrow keys) would otherwise act on the textarea.
        sqlTextArea.addEventListener("keydown", (event) => {

            event.stopPropagation();

            if (event.key === "Escape") {

                event.preventDefault();
                popup.closeWindow();
            }
        });

        contentContainer.appendChild(wrapper);

        setTimeout(() => sqlTextArea.focus(), 0);
    };

    /**
     * Shows some SQL in a popup with a textarea and a Copy all button.
     *
     * @param {object} options - The popup's id, title, width and height, a getSql function, and
     * optionally an extraButton of {text, title, isAvailable, click} that changes the SQL.
     */
    const show = (options) => {

        return Ren.PopupWindow(
            options.id,
            (contentContainer, popup) => renderPopupContent(options, contentContainer, popup),
            options.title,
            {
                centred: true,
                width: options.width,
                height: options.height,
                // The textarea scrolls itself, so that the buttons stay put along the bottom.
                fillAvailableSpace: true,
                verticalScrollbar: false,
                horizontalScrollbar: false,
                isResizable: true,
                closeWhenFocusLost: false
            }
        );
    };

    return {
        escapeIdentifier,
        escapeStringLiteral,
        getValueLiteral,
        getCellValue,
        joinWrapped,
        show
    };
})();
