/**
 * A dates grid's tick boxes: drawing one, putting them all back in step with the filters, and the
 * clicks and right-clicks on them.
 */
Ren.DateValueChart_DateMarkersGrid_Checkboxes = (() => {

    const checkboxClass = "ren-checkbox-cell js-ren-suppress-context-menu js-ren-date-marker-checkbox";
    const headerCheckboxClass = "js-ren-date-marker-all-checkbox";
    const checkboxStyle = "vertical-align: middle; margin: 0;";

    // Ren.HtmlUtils.escapeHtml is for text between tags and leaves quotes alone, which inside an
    // attribute would end it early.
    const escapeAttribute = (value) => Ren.HtmlUtils.escapeHtml(value).replaceAll("\"", "&quot;");

    // Gets a tick box's tooltip.  A disabled box says only that it cannot be clicked, so the
    // tooltip is what says what is stopping it.
    const getCheckboxTitle = (value, isFilteredOut) =>
        isFilteredOut ? value + " - left out by the grid's filters" : value;

    /**
     * Draws a date's cell in the tick column.  Named by the column's format function, so a box is
     * drawn as the filters currently stand however the dates were last chosen.  The value given is
     * the row's date rather than the tick column's own, since the date is what a tick states in
     * the filter.
     */
    const renderDateCheckbox = (gridId, value) => {

        const text = value == null ? "" : String(value);
        const isFilteredOut =
            Ren.DateValueChart_DateMarkersGrid_Selection.isDateFilteredOut(gridId, text);
        const isShown =
            !isFilteredOut && Ren.DateValueChart_DateMarkersGrid_Selection.isDateShown(gridId, text);

        return "<input type=\"checkbox\" class=\"" + checkboxClass + "\"" +
            " data-date-markers-grid=\"" + gridId + "\"" +
            " data-date-markers-value=\"" + escapeAttribute(text) + "\"" +
            " title=\"" + escapeAttribute(getCheckboxTitle(text, isFilteredOut)) + "\"" +
            (isFilteredOut ? " disabled" : "") +
            (isShown ? " checked" : "") +
            " style=\"" + checkboxStyle + "\">";
    };

    /**
     * Draws the box in a grid's column heading as its dates stand: ticked where every one of them
     * is shown, part-ticked where some are, and clear where none are.  Part-ticked is what a
     * checkbox's indeterminate state is for, and it is the state the grid is usually in - a reader
     * having picked out the dates they are after.
     */
    const refreshHeaderCheckbox = (gridId) => {

        const markerValues = Ren.DateValueChart_DateMarkersGrid_Context.getMarkerValues(gridId);

        let tickableCount = 0;
        let shownCount = 0;

        for (let i = 0; i < markerValues.length; i++) {

            const isFilteredOut = Ren.DateValueChart_DateMarkersGrid_Selection
                .isDateFilteredOut(gridId, markerValues[i]);

            if (isFilteredOut) continue;

            tickableCount++;

            if (Ren.DateValueChart_DateMarkersGrid_Selection.isDateShown(gridId, markerValues[i])) {
                shownCount++;
            }
        }

        const checkboxes = document.querySelectorAll("input." + headerCheckboxClass);

        for (let i = 0; i < checkboxes.length; i++) {

            const checkbox = checkboxes[i];

            if (Number(checkbox.dataset.dateMarkersGrid) !== gridId) continue;

            checkbox.checked = shownCount > 0;
            checkbox.indeterminate = shownCount > 0 && shownCount < tickableCount;
        }
    };

    /**
     * Puts a grid's checkboxes back in step with its filters, for a change made somewhere other
     * than the box itself - a filter module, a column-heading filter popup, "Show every date", the
     * heading's box, or a right-click.  Cells the grid has yet to render are drawn ticked correctly
     * by the format function above.
     */
    const refreshCheckboxes = (gridId) => {

        // Anything that reaches here can have changed which dates the filters keep as well as which
        // of them are ticked, so what was worked out for the last pass of drawing is dropped and
        // asked again.
        Ren.DateValueChart_DateMarkersGrid_Selection.forgetFilteredValues(gridId);

        const checkboxes = document.querySelectorAll("input.js-ren-date-marker-checkbox");

        for (let i = 0; i < checkboxes.length; i++) {

            const checkbox = checkboxes[i];

            if (Number(checkbox.dataset.dateMarkersGrid) !== gridId) continue;

            const value = checkbox.dataset.dateMarkersValue;
            const isFilteredOut = Ren.DateValueChart_DateMarkersGrid_Selection
                .isDateFilteredOut(gridId, value);

            checkbox.disabled = isFilteredOut;
            checkbox.checked = !isFilteredOut
                && Ren.DateValueChart_DateMarkersGrid_Selection.isDateShown(gridId, value);
            checkbox.title = getCheckboxTitle(value, isFilteredOut);
        }

        refreshHeaderCheckbox(gridId);
    };

    document.addEventListener("change", (event) => {

        const checkbox = event.target;
        const classList = checkbox?.classList;

        if (classList?.contains(headerCheckboxClass)) {

            Ren.DateValueChart_DateMarkersGrid_Selection.setAllDatesShown(
                Number(checkbox.dataset.dateMarkersGrid),
                checkbox.checked
            );

            return;
        }

        if (!classList?.contains("js-ren-date-marker-checkbox")) return;

        Ren.DateValueChart_DateMarkersGrid_Selection.setDateShown(
            Number(checkbox.dataset.dateMarkersGrid),
            checkbox.dataset.dateMarkersValue,
            checkbox.checked
        );
    });

    document.addEventListener("contextmenu", (event) => {

        const checkbox = event.target;

        if (!checkbox?.classList?.contains("js-ren-date-marker-checkbox")) return;
        if (event.ctrlKey) return;

        event.preventDefault();

        Ren.DateValueChart_DateMarkersGrid_Selection.setOnlyDateShown(
            Number(checkbox.dataset.dateMarkersGrid),
            checkbox.dataset.dateMarkersValue
        );
    });

    return {
        headerCheckboxClass,
        checkboxStyle,
        renderDateCheckbox,
        refreshCheckboxes,
        refreshHeaderCheckbox
    };
})();
