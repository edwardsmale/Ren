Ren.CreateKeyValueGrid = (tabularData, visualisation) => {

    // How the source rows are laid out when there is more than one of them: one column per row, or
    // one grid row per source row underneath each key.
    const LAYOUT_COLUMNS = "columns";
    const LAYOUT_ROWS = "rows";

    // The longest pair of values that is compared token by token.  The comparison is O(n * m), and
    // beyond this the highlighting is unreadable anyway, so longer values are only marked as
    // differing as a whole.
    const MAX_DIFFERENCE_TOKENS = 400;

    const rowModels = tabularData?.RowModels ?? [];

    // Only the data rows are read: a group row would need the source grouping settings to resolve,
    // and this grid is always built from a flat ad hoc or single row data source.
    const sourceRowCount = Math.min(
        tabularData?.DataRowCount ?? rowModels.length,
        rowModels.length
    );

    const data = Ren.TabularDataAdapter_Array.getDataArray(
        tabularData,
        visualisation,
        null,
        true,
        true,
        0,
        sourceRowCount
    );

    const rowCount = data.length;
    const hasMultipleRows = rowCount > 1;

    const keys = rowCount ? Object.keys(data[0]) : [];

    const columnResolver = Ren.DataGridColumnResolver(tabularData);

    // The name of the auto menu (e.g. "product-code") each key's values are given, or null.
    const keyAutoMenuNames = {};

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {

        const columnIndex = columnResolver.getColumnIndex(keys[keyIndex]);

        keyAutoMenuNames[keys[keyIndex]] = columnIndex === null
            ? null
            : Ren.AutoMenu.getMenuNameForColumn(tabularData.ColumnModels[columnIndex]);
    }

    // The values unformatted, as the auto menus' reports take them, read when first needed.
    let rawData = null;

    const getRawValue = (rowIndex, key) => {

        if (rawData === null) {

            rawData = Ren.TabularDataAdapter_Array.getDataArray(
                tabularData,
                visualisation,
                null,
                false,
                true,
                0,
                sourceRowCount
            );
        }

        return rawData[rowIndex][key];
    };

    /**
     * Gets a value indicating whether a value says nothing: it is absent, blank, or is one of the
     * words a null or undefined value arrives as once formatted.
     */
    const isNullOrUndefinedValue = (value) => {

        if (value === null || value === undefined) return true;

        const text = value.toString().trim().toLowerCase();

        return text === "" || text === "null" || text === "undefined";
    };

    /**
     * Gets the value as it is compared against the other rows' values for the same key: the
     * displayed text, so that 0 and "0" do not read as a difference.
     */
    const getComparableText = (value) =>
        value === null || value === undefined ? "" : value.toString();

    /**
     * Gets a value indicating whether the rows disagree about the value of this key.
     */
    const isDifferingKey = (key) => {

        if (!hasMultipleRows) return false;

        const firstText = getComparableText(data[0][key]);

        for (let rowIndex = 1; rowIndex < rowCount; rowIndex++) {

            if (getComparableText(data[rowIndex][key]) !== firstText) return true;
        }

        return false;
    };

    /**
     * Splits text into the units the difference highlighter compares: runs of word characters, runs
     * of whitespace, and single punctuation characters.  Comparing whole words rather than
     * characters keeps the highlighted regions readable.
     */
    const tokenise = (text) => text.match(/[A-Za-z0-9]+|\s+|[^A-Za-z0-9\s]/g) ?? [];

    /**
     * Appends text to a list of {text, isDifferent} segments, merging it into the previous segment
     * when that segment says the same thing about it, so the rendered spans stay few and wide.
     */
    const pushSegment = (segments, text, isDifferent) => {

        const lastSegment = segments[segments.length - 1];

        if (lastSegment && lastSegment.isDifferent === isDifferent) {

            lastSegment.text += text;
            return;
        }

        segments.push({ text, isDifferent });
    };

    /**
     * Compares two values token by token and returns a segment list for each, marking the parts
     * that are not shared.  Returns null when the values are too long to compare, or when either
     * contains markup - the segments are wrapped in spans, which would split a tag in half.
     */
    const buildValueDifferenceSegments = (leftText, rightText) => {

        if (leftText.indexOf("<") !== -1 || rightText.indexOf("<") !== -1) return null;

        const leftTokens = tokenise(leftText);
        const rightTokens = tokenise(rightText);

        const leftCount = leftTokens.length;
        const rightCount = rightTokens.length;

        if (leftCount > MAX_DIFFERENCE_TOKENS || rightCount > MAX_DIFFERENCE_TOKENS) return null;

        // Longest common subsequence lengths, filled from the end so that the walk below can read
        // each cell's two successors directly.  Row major, one row per left token.
        const width = rightCount + 1;
        const lengths = new Int32Array((leftCount + 1) * width);

        for (let leftIndex = leftCount - 1; leftIndex >= 0; leftIndex--) {

            for (let rightIndex = rightCount - 1; rightIndex >= 0; rightIndex--) {

                if (leftTokens[leftIndex] === rightTokens[rightIndex]) {

                    lengths[leftIndex * width + rightIndex] =
                        lengths[(leftIndex + 1) * width + rightIndex + 1] + 1;
                }
                else {

                    lengths[leftIndex * width + rightIndex] = Math.max(
                        lengths[(leftIndex + 1) * width + rightIndex],
                        lengths[leftIndex * width + rightIndex + 1]
                    );
                }
            }
        }

        const leftSegments = [];
        const rightSegments = [];

        let leftIndex = 0;
        let rightIndex = 0;

        while (leftIndex < leftCount && rightIndex < rightCount) {

            if (leftTokens[leftIndex] === rightTokens[rightIndex]) {

                pushSegment(leftSegments, leftTokens[leftIndex], false);
                pushSegment(rightSegments, rightTokens[rightIndex], false);
                leftIndex++;
                rightIndex++;
            }
            else if (lengths[(leftIndex + 1) * width + rightIndex] >=
                     lengths[leftIndex * width + rightIndex + 1]) {

                pushSegment(leftSegments, leftTokens[leftIndex], true);
                leftIndex++;
            }
            else {

                pushSegment(rightSegments, rightTokens[rightIndex], true);
                rightIndex++;
            }
        }

        while (leftIndex < leftCount) {

            pushSegment(leftSegments, leftTokens[leftIndex], true);
            leftIndex++;
        }

        while (rightIndex < rightCount) {

            pushSegment(rightSegments, rightTokens[rightIndex], true);
            rightIndex++;
        }

        return [leftSegments, rightSegments];
    };

    /**
     * Gets the HTML for a value cell's content.  Values may carry markup of their own, so they are
     * written through as they arrive, with only the newlines turned into breaks.
     */
    const getValueHtml = (value) =>
        value === null || value === undefined
            ? ""
            : Ren.TextUtils.replaceNewlinesWithBRs(value.toString());

    /**
     * Gets the HTML for a value whose differing parts have been picked out.
     */
    const getSegmentsHtml = (segments) => {

        const parts = [];

        for (let index = 0; index < segments.length; index++) {

            const segment = segments[index];
            const html = Ren.TextUtils.replaceNewlinesWithBRs(segment.text);

            parts.push(
                segment.isDifferent
                    ? Ren.HtmlTemplateFunctions.renderHtmlTemplate(
                        "KeyValueGridValueDifference",
                        { html }
                    )
                    : html
            );
        }

        return parts.join("");
    };

    /**
     * Gets the per row HTML for one key's values.  With exactly two rows and difference
     * highlighting on, the two values are compared against each other so that the parts that
     * differ stand out; otherwise each value is rendered as it is.
     */
    const getValueHtmls = (key, isDifferent, highlightDifferences) => {

        if (highlightDifferences && isDifferent && rowCount === 2) {

            const segmentLists = buildValueDifferenceSegments(
                getComparableText(data[0][key]),
                getComparableText(data[1][key])
            );

            if (segmentLists) {

                return [getSegmentsHtml(segmentLists[0]), getSegmentsHtml(segmentLists[1])];
            }
        }

        const htmls = new Array(rowCount);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            htmls[rowIndex] = getValueHtml(data[rowIndex][key]);
        }

        return htmls;
    };

    const getRowLabel = (rowIndex) => "Row " + (rowIndex + 1);

    // In the stacked layout the number stands in a heading cell of its own, styled like the
    // data grid's row headings, so the number alone says what it is.
    const getRowNumberLabel = (rowIndex) => String(rowIndex + 1);

    const renderKeyCell = (key, rowSpan) =>
        Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "KeyValueGridKeyCell",
            { keyText: Ren.TextUtils.addSpacesBeforeCapitals(key), rowSpan }
        );

    const renderRowLabelCell = (label) =>
        Ren.HtmlTemplateFunctions.renderHtmlTemplate("KeyValueGridRowLabelCell", { label });

    // The key and source row of each value cell rendered, in document order.
    let renderedValueCells = [];

    const renderValueCell = (key, rowIndex, valueHtml) => {

        renderedValueCells.push({ key, rowIndex });

        return Ren.HtmlTemplateFunctions.renderHtmlTemplate("KeyValueGridValueCell", { valueHtml });
    };

    /**
     * Gives the value cells of keys with an auto menu that menu.  The value is set on the element,
     * rather than in the template, since it could contain quotes.
     */
    const applyAutoMenus = () => {

        const valueCells = tbody.querySelectorAll(".js-ren-value-cell");

        for (let i = 0; i < valueCells.length; i++) {

            const key = renderedValueCells[i].key;
            const autoMenuName = keyAutoMenuNames[key];

            if (autoMenuName) {

                Ren.AutoMenu.applyMenu(
                    valueCells[i],
                    autoMenuName,
                    getRawValue(renderedValueCells[i].rowIndex, key)
                );
            }
        }
    };

    const renderRow = (modifierClasses, cellsHtml) =>
        Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "KeyValueGridRow",
            { modifierClasses: modifierClasses.join(" "), cellsHtml: cellsHtml.join("") }
        );

    const keyValueGridViewport = document.createElement("div");
    keyValueGridViewport.classList.add("ren-key-value-grid-viewport");

    if (visualisation.maxWidth) {

        keyValueGridViewport.style.maxWidth = visualisation.maxWidth;
        keyValueGridViewport.style.overflowX = "auto";
    }

    if (visualisation.maxHeight) {

        keyValueGridViewport.style.maxHeight = visualisation.maxHeight;
        keyValueGridViewport.style.overflowY = "auto";
    }

    const keyValueGrid = document.createElement("div");
    keyValueGrid.classList.add("ren-key-value-grid");

    keyValueGridViewport.appendChild(keyValueGrid);

    const table = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("EmptyTableTemplate", {
        class: "ren-key-value-grid__table",
        title: tabularData.Title
    });

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    const getLayout = () =>
        visualisation.multipleRowLayout === LAYOUT_ROWS ? LAYOUT_ROWS : LAYOUT_COLUMNS;

    /**
     * Gets the keys that get a place in the grid, in the source data's column order, less those the
     * hide settings leave out.
     */
    const getKeysToShow = () => {

        const hideNullOrUndefinedColumns = visualisation.hideNullOrUndefinedColumns === true;

        const showOnlyDifferingColumns =
            hasMultipleRows && visualisation.showOnlyDifferingColumns === true;

        const keysToShow = [];

        for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {

            const key = keys[keyIndex];

            if (showOnlyDifferingColumns && !isDifferingKey(key)) continue;

            if (hideNullOrUndefinedColumns) {

                // With several rows the key is only empty when none of them has a value for it -
                // one row's blank is itself worth seeing next to another row's value.
                let hasAValue = false;

                for (let rowIndex = 0; rowIndex < rowCount && !hasAValue; rowIndex++) {

                    hasAValue = !isNullOrUndefinedValue(data[rowIndex][key]);
                }

                if (!hasAValue) continue;
            }

            keysToShow.push(key);
        }

        return keysToShow;
    };

    /**
     * Draws the heading row naming each source row's column.  Only the columns layout needs one,
     * and only when there is more than one row to tell apart.
     */
    const populateHead = () => {

        if (!hasMultipleRows || getLayout() !== LAYOUT_COLUMNS) {

            thead.innerHTML = "";
            return;
        }

        const headingCells = new Array(rowCount);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            headingCells[rowIndex] = Ren.HtmlTemplateFunctions.renderHtmlTemplate(
                "KeyValueGridHeadingCell",
                { label: getRowLabel(rowIndex) }
            );
        }

        thead.innerHTML = Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "KeyValueGridHeadingRow",
            { headingCellsHtml: headingCells.join("") }
        );
    };

    /**
     * Gets the classes that say how a grid row is drawn: which stripe it takes, and whether it
     * holds a value the source rows disagree about.  The stripe is a class rather than a nth-child
     * rule because a key can occupy several grid rows, which must stripe as one.
     */
    const getRowModifierClasses = (keyIndex, isDifferent, highlightDifferences) => {

        const modifierClasses = [
            keyIndex % 2 === 0 ? "ren-key-value-grid__row--even" : "ren-key-value-grid__row--odd"
        ];

        if (highlightDifferences && isDifferent) {

            modifierClasses.push("ren-key-value-grid__row--differing");
        }

        return modifierClasses;
    };

    /**
     * The rows of a grid that gives each source row its own column: one grid row per key, with a
     * value cell per source row beside it.
     */
    const renderRowsAcrossColumns = (keysToShow, highlightDifferences) => {

        const rows = [];

        for (let keyIndex = 0; keyIndex < keysToShow.length; keyIndex++) {

            const key = keysToShow[keyIndex];
            const isDifferent = isDifferingKey(key);
            const valueHtmls = getValueHtmls(key, isDifferent, highlightDifferences);

            const cells = [renderKeyCell(key, 1)];

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                cells.push(renderValueCell(key, rowIndex, valueHtmls[rowIndex]));
            }

            rows.push(renderRow(
                getRowModifierClasses(keyIndex, isDifferent, highlightDifferences),
                cells
            ));
        }

        return rows;
    };

    /**
     * The rows of a grid that stacks the source rows: one grid row per source row under each key,
     * with the key cell spanning them.
     */
    const renderRowsDownRows = (keysToShow, highlightDifferences) => {

        const rows = [];

        for (let keyIndex = 0; keyIndex < keysToShow.length; keyIndex++) {

            const key = keysToShow[keyIndex];
            const isDifferent = isDifferingKey(key);
            const valueHtmls = getValueHtmls(key, isDifferent, highlightDifferences);

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                const cells = [];

                const modifierClasses =
                    getRowModifierClasses(keyIndex, isDifferent, highlightDifferences);

                // Only the first of a key's rows carries the key cell; it spans the rest, so the
                // key reads as one heading for the whole block of values.
                if (rowIndex === 0) {

                    modifierClasses.push("ren-key-value-grid__row--first-of-key");
                    cells.push(renderKeyCell(key, rowCount));
                }

                if (hasMultipleRows) cells.push(renderRowLabelCell(getRowNumberLabel(rowIndex)));

                cells.push(renderValueCell(key, rowIndex, valueHtmls[rowIndex]));

                rows.push(renderRow(modifierClasses, cells));
            }
        }

        return rows;
    };

    /**
     * Draws the whole grid.
     */
    const render = () => {

        const layout = getLayout();

        const highlightDifferences =
            hasMultipleRows && visualisation.hideDifferenceHighlighting !== true;

        const keysToShow = getKeysToShow();

        populateHead();

        renderedValueCells = [];

        const rows = layout === LAYOUT_ROWS
            ? renderRowsDownRows(keysToShow, highlightDifferences)
            : renderRowsAcrossColumns(keysToShow, highlightDifferences);

        tbody.innerHTML = rows.join("");

        applyAutoMenus();

        keyValueGrid.classList.toggle(
            "ren-key-value-grid--rows-down-rows",
            hasMultipleRows && layout === LAYOUT_ROWS
        );
    };

    /**
     * Applies a change to one of the grid's settings and remembers it on the visualisation, so that
     * it is saved with the report settings.
     */
    const changeSetting = (settingName, value) => {

        visualisation[settingName] = value;
        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, render);
    };

    const toggleSetting = (settingName) => changeSetting(settingName, !visualisation[settingName]);

    render();

    const contextMenu = Ren.SetUpContextMenu();

    contextMenu.addMenuItems(keyValueGridViewport, [
        {
            section: "Key/Value Grid",
            text: "Show columns containing null or undefined",
            id: "key-value-grid-show-null-or-undefined-columns",
            ticked: () => visualisation.hideNullOrUndefinedColumns !== true,
            action: () => toggleSetting("hideNullOrUndefinedColumns")
        },
        {
            section: "Key/Value Grid",
            text: "Multiple rows",
            id: "key-value-grid-multiple-row-layout",
            visible: () => hasMultipleRows,
            submenu: [
                {
                    text: "Spread across columns",
                    id: "key-value-grid-rows-across-columns",
                    ticked: () => getLayout() === LAYOUT_COLUMNS,
                    action: () => changeSetting("multipleRowLayout", LAYOUT_COLUMNS)
                },
                {
                    text: "Stack down rows",
                    id: "key-value-grid-rows-down-rows",
                    ticked: () => getLayout() === LAYOUT_ROWS,
                    action: () => changeSetting("multipleRowLayout", LAYOUT_ROWS)
                }
            ]
        },
        {
            section: "Key/Value Grid",
            text: "Highlight differences",
            id: "key-value-grid-highlight-differences",
            visible: () => hasMultipleRows,
            ticked: () => visualisation.hideDifferenceHighlighting !== true,
            action: () => toggleSetting("hideDifferenceHighlighting")
        },
        {
            section: "Key/Value Grid",
            text: "Show only columns that differ",
            id: "key-value-grid-show-only-differing-columns",
            visible: () => hasMultipleRows,
            ticked: () => visualisation.showOnlyDifferingColumns === true,
            action: () => toggleSetting("showOnlyDifferingColumns")
        }
    ]);

    keyValueGrid.appendChild(table);

    return {
        element: keyValueGridViewport
    };
};
