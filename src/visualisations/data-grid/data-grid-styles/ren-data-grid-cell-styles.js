/**
 * Styles a datagrid's cells with the style objects returned by its cell and row style functions,
 * e.g. { "color": "Red", "padding-left": "4px" }.  Each distinct style is given a class with a rule
 * in the grid's own dynamic stylesheet, so cells sharing a style share one rule.
 *
 * Style functions are set per column in the columns of the data rows or a grouping, as
 * cellStyleFunction (styling the column's cells) and rowStyleFunction (styling every cell in the
 * row), and are called with the same arguments as format functions.  The styles of a row's row
 * style functions are merged in column order, and a cell's own style is merged over them.
 */
Ren.DataGridCellStyles = (dataGridGuid) => {

    const STYLED_CELL_CLASS_NAME = "ren-data-grid__cell--styled";

    // Mark cells whose style sets a background or text colour, which row hovering leaves alone.
    const BACKGROUND_STYLED_CELL_CLASS_NAME = "ren-data-grid__cell--styled-background";
    const COLOUR_STYLED_CELL_CLASS_NAME = "ren-data-grid__cell--styled-colour";

    const stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(dataGridGuid, "cell-styles");

    const classNamesByDeclarations = new Map();
    const setsBackgroundByClassName = new Map();
    const setsColourByClassName = new Map();
    const rules = [];
    let hasUnwrittenRules = false;

    // Gets the CSS property name for a style object key, which may be camel cased.
    const toPropertyName = (key) => key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());

    // Gets a value indicating whether text could end the rule it is written into.
    const couldEndRule = (text) => /[{};<]/.test(text);

    /**
     * Gets the declarations for a style object, e.g. "color:Red;padding-left:4px;", leaving out
     * empty values and any that could end the rule they are written into.
     */
    const getDeclarations = (style) => {

        let declarations = "";

        for (const key in style) {

            const value = style[key];

            if (value == null || value === "") continue;

            const propertyName = toPropertyName(key);
            const valueText = String(value);

            if (couldEndRule(propertyName) || couldEndRule(valueText)) continue;

            declarations += propertyName + ":" + valueText + ";";
        }

        return declarations;
    };

    const getClassName = (declarations) => {

        let className = classNamesByDeclarations.get(declarations);

        if (className) return className;

        className = "ren-cs-" + classNamesByDeclarations.size;
        classNamesByDeclarations.set(declarations, className);

        // Values cannot contain a semicolon, so each property name follows the start or a ";".
        setsBackgroundByClassName.set(className, /(^|;)background(-color)?:/.test(declarations));
        setsColourByClassName.set(className, /(^|;)color:/.test(declarations));

        // Qualified by the styled cell class, twice, so that it outranks the grid's row, null cell
        // and column styles, the null cell ones being as specific as it is otherwise and written
        // later.  Selected cells still show as such, being styled !important.
        rules.push(
            ".ren-data-grid__cell." + STYLED_CELL_CLASS_NAME + "." + STYLED_CELL_CLASS_NAME + "." +
                className + "{" + declarations + "}"
        );

        hasUnwrittenRules = true;

        return className;
    };

    /**
     * Calls the style functions of a column, merging the style objects they return into the
     * passed style.  Returns the merged style, which is a new object if null was passed.
     */
    const mergeStyleFunctionResults = (style, styleFunctions, columnIndex, value, rowVals,
        groupSummaryStats, overallSummaryStats, compressedRowVals) => {

        for (let i = 0; i < styleFunctions.length; i++) {

            let result;

            try {

                result = styleFunctions[i](
                    value,
                    rowVals,
                    (groupSummaryStats && groupSummaryStats[columnIndex]) || null,
                    (overallSummaryStats && overallSummaryStats[columnIndex]) || null,
                    compressedRowVals
                );
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[DataGridCellStyles] Error executing style function:",
                    e
                );

                continue;
            }

            if (!result || typeof result !== "object") continue;

            style ??= {};
            Object.assign(style, result);
        }

        return style;
    };

    /**
     * Gets the merged style of a row's row style functions, or null if they return none.
     *
     * @param {Array} rowStyleFunctions - Each column's compiled row style functions, or null.
     * @param {Function} getValue - Gets the value of the row at a column index.
     */
    const getRowStyle = (rowStyleFunctions, getValue, rowVals, groupSummaryStats,
        overallSummaryStats, compressedRowVals) => {

        let style = null;

        for (let columnIndex = 0; columnIndex < rowStyleFunctions.length; columnIndex++) {

            const styleFunctions = rowStyleFunctions[columnIndex];

            if (!styleFunctions?.length) continue;

            style = mergeStyleFunctionResults(
                style,
                styleFunctions,
                columnIndex,
                getValue(columnIndex),
                rowVals,
                groupSummaryStats,
                overallSummaryStats,
                compressedRowVals
            );
        }

        return style;
    };

    /**
     * Gets a cell's style: its row's style with that of its cell style functions merged over it.
     * The row style is not changed, as it is shared by the row's cells.
     */
    const getCellStyle = (rowStyle, cellStyleFunctions, columnIndex, value, rowVals,
        groupSummaryStats, overallSummaryStats, compressedRowVals) => {

        if (!cellStyleFunctions?.length) return rowStyle;

        return mergeStyleFunctionResults(
            rowStyle ? Object.assign({}, rowStyle) : null,
            cellStyleFunctions,
            columnIndex,
            value,
            rowVals,
            groupSummaryStats,
            overallSummaryStats,
            compressedRowVals
        );
    };

    /**
     * Gets the background colour a style gives, or null where it gives none, or gives one that is
     * not a plain colour, such as a gradient.
     */
    const getBackgroundColour = (style) => {

        if (!style) return null;

        let colour = null;

        // The last is the one that takes effect, as declarations are written in key order.
        for (const key in style) {

            const propertyName = toPropertyName(key);

            if (propertyName !== "background-color" && propertyName !== "background") continue;

            const value = style[key];

            colour = typeof value === "string" && Ren.ColourMixer.isColour(value.trim())
                ? value.trim()
                : null;
        }

        return colour;
    };

    const removeStyleClassNames = (cell) => {

        const classNames = Array.from(cell.classList);

        for (let index = 0; index < classNames.length; index++) {

            if (classNames[index].startsWith("ren-cs-")) cell.classList.remove(classNames[index]);
        }

        cell.classList.remove(STYLED_CELL_CLASS_NAME);
        cell.classList.remove(BACKGROUND_STYLED_CELL_CLASS_NAME);
        cell.classList.remove(COLOUR_STYLED_CELL_CLASS_NAME);
    };

    /**
     * Styles a cell, replacing any style it was given before.  Pass a null style to unstyle it.
     * The rules for new styles are only written by writeRules.
     */
    const applyStyle = (cell, style) => {

        // A cell restored from saved HTML has lost its note of its class, so any left is cleared.
        if (cell.cellStyleClassName === undefined
            && cell.classList.contains(STYLED_CELL_CLASS_NAME)) {

            removeStyleClassNames(cell);
        }

        const declarations = style ? getDeclarations(style) : "";
        const className = declarations ? getClassName(declarations) : null;
        const previousClassName = cell.cellStyleClassName ?? null;

        if (className === previousClassName) return;

        if (previousClassName) cell.classList.remove(previousClassName);
        if (className) cell.classList.add(className);

        cell.classList.toggle(STYLED_CELL_CLASS_NAME, !!className);
        cell.classList.toggle(
            BACKGROUND_STYLED_CELL_CLASS_NAME,
            !!className && setsBackgroundByClassName.get(className)
        );

        cell.classList.toggle(
            COLOUR_STYLED_CELL_CLASS_NAME,
            !!className && setsColourByClassName.get(className)
        );

        cell.cellStyleClassName = className;
    };

    /**
     * Writes the rules for any styles applied since last written to the stylesheet.
     */
    const writeRules = () => {

        if (!hasUnwrittenRules) return;

        stylesheet.updateIfChanged(rules);
        hasUnwrittenRules = false;
    };

    return {
        applyStyle,
        getBackgroundColour,
        getCellStyle,
        getRowStyle,
        writeRules
    };
};
