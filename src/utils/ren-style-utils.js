/**
 * Functions for working with CSS styles.
 */
Ren.StylesUtils = (() => {

    /**
     * Converts a CSS value such as '16px' or '1rem' to pixels.  Returned value is numeric.
     */
    const convertToPixels = (value) => {

        if (value === undefined) return undefined;
        let val = parseFloat(value);
        if (isNaN(val)) return value;
        if (value.endsWith && value.endsWith("rem")) val = val * 16;
        return val;
    };

    /**
     * Gets a value indicating whether a position or size setting has been given.  A number, even
     * 0, is given; null, undefined and "" are not.
     */
    const isDimensionSet = (value) => {

        return value !== undefined && value !== null && value !== "";
    };

    /**
     * Converts a position or size setting to a CSS value: a number is in pixels, and a string
     * such as "42rem", "50%" or "calc(100% - 2rem)" is used as it is.
     */
    const toCssDimension = (value) => {

        return typeof value === "number" ? value + "px" : value;
    };

    /**
     * Converts a position or size to the form stored in report settings: a whole number of pixels
     * where it can be ("42rem", "500px", "500" or 499.6 all become a number), and otherwise the
     * string it was given, such as "50%" or "calc(100% - 2rem)".
     */
    const toSettingsDimension = (value) => {

        if (typeof value === "number") return Math.round(value);

        if (typeof value !== "string" || !/^-?(\d+\.?\d*|\.\d+)(px|rem)?$/.test(value.trim())) {
            return value;
        }

        return Math.round(convertToPixels(value.trim()));
    };

    // The id of the stylesheet holding the cursor a drag is being shown with.
    const DRAG_CURSOR_STYLE_ID = "ren-drag-cursor";

    /**
     * Shows a cursor over the whole page for as long as a drag lasts.  A drag keeps the pointer
     * captured, but the cursor stays whatever the element under the pointer asks for, so a pointer
     * that leaves the handle it is dragging - the handle resizing under it, or the pointer
     * outrunning it - would drop back to the page's cursor part way through the drag.
     *
     * @param {string} cursor - The CSS cursor to show, such as "ns-resize" or "col-resize".
     */
    const holdDragCursor = (cursor) => {

        let styleElement = document.getElementById(DRAG_CURSOR_STYLE_ID);

        if (!styleElement) {

            styleElement = document.createElement("style");
            styleElement.id = DRAG_CURSOR_STYLE_ID;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = `* { cursor: ${cursor} !important; }`;
    };

    /**
     * Gives the cursor back to the page once a drag has finished.
     */
    const releaseDragCursor = () => {

        const styleElement = document.getElementById(DRAG_CURSOR_STYLE_ID);

        if (styleElement) styleElement.remove();
    };

    return {
        convertToPixels,
        isDimensionSet,
        toCssDimension,
        toSettingsDimension,
        holdDragCursor,
        releaseDragCursor
    };
})();
