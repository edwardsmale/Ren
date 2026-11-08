/**
 * Updates the stylesheet for a visualisation.
 */
Ren.VisualisationStyles = (visualisation, gridStateGroup) => {

    const visGuid = visualisation.visualisationGuid;

    const stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        visualisation.visualisationGuid,
        "visualisation-type-" + visualisation.visualisationTypeName
    ).getStylesheet();

    let _maxWidth = null;
    let _maxHeight = null;
    let _explicitMaxHeightSet = false;

    /**
     * Sets the maximum width and height for the visualisation, and whether the max height was
     * explicitly set (e.g. via max-height attribute on ren-grid tag).
     *
     * @param {string} maxWidth - The maximum width to set (e.g. "500px" or "80%").
     * @param {string} maxHeight - The maximum height to set (e.g. "500px" or "80%").
     * @param {boolean} explicitMaxHeightSet - Whether the max height was explicitly set (e.g. via
     * max-height attribute on ren-grid tag).
     */
    const setMaxWidthAndHeight = (maxWidth, maxHeight, explicitMaxHeightSet) => {

        if (!maxWidth && !maxHeight) return;

        _maxWidth = maxWidth;
        _maxHeight = maxHeight;

        // Only set _explicitMaxHeightSet to true if explicitly told to.  Don't allow it to be set
        // back to false once it's been set to true.  This ensures that if setMaxWidthAndHeight is
        // called multiple times, once with explicit=true and once with explicit=false (e.g. from
        // popup dimension calculations), the explicit flag is preserved.

        if (explicitMaxHeightSet === true) {
            _explicitMaxHeightSet = true;
        }

        updateStylesheet();
    };

    /**
     * Sets the maximum width for the visualisation, keeping its maximum height.
     *
     * @param {string} maxWidth - The maximum width to set (e.g. "500px" or "80%").
     */
    const setMaxWidth = (maxWidth) => {

        if (!maxWidth) return;

        _maxWidth = maxWidth;

        updateStylesheet();
    };

    let previousStyles = null;

    const updateStylesheet = () => {

        if (!visualisation) return;

        const styles = [];

        if (visualisation.hasDimensions &&
            Ren.StylesUtils.isDimensionSet(visualisation.visualisationLeft) &&
            Ren.StylesUtils.isDimensionSet(visualisation.visualisationTop) &&
            visualisation.visualisationWidth &&
            visualisation.visualisationHeight) {

            const left = Ren.StylesUtils.toCssDimension(visualisation.visualisationLeft);
            const top = Ren.StylesUtils.toCssDimension(visualisation.visualisationTop);

            // Width: unset to override width: -fill-available otherwise 'convert to popup' button
            // appears in the wrong place.
            styles.push("." + visGuid + " { position: absolute; width: unset }");
            styles.push("." + visGuid + " { left: " + left + " }");
            styles.push("." + visGuid + " { top: " + top + " }");

            const viewportWidth = Ren.StylesUtils.convertToPixels(visualisation.visualisationWidth);

            styles.push("." + visGuid + " .ren-visualisation__viewport { width: " + viewportWidth + "px; max-width: " + viewportWidth + "px }");
            styles.push("." + visGuid + " .ren-data-grid__frozen-top-section-viewport { max-width: " + viewportWidth + "px }");
            styles.push("." + visGuid + " .js-ren-visualisation-resize-handle-right { left: " + viewportWidth + "px }");

            const viewportHeight = Ren.StylesUtils.convertToPixels(visualisation.visualisationHeight);
            const height = viewportHeight;

            styles.push("." + visGuid + " .ren-visualisation__viewport { height: " + viewportHeight + "px; max-height: " + viewportHeight + "px }");
            styles.push("." + visGuid + " .ren-data-grid__frozen-left-section-viewport { max-height: " + (height - Ren.DataGridConstants.reportTabsHeight) + "px }");
            styles.push("." + visGuid + " { height: " + viewportHeight + "px; max-height: " + viewportHeight + "px }");
            styles.push("." + visGuid + " .js-ren-visualisation-resize-handle-bottom { top: " + (height + Ren.DataGridConstants.scrollBarHeight) + "px }");
        }
        else {

            if (_maxWidth) {

                styles.push("." + visGuid + " .ren-visualisation__viewport { max-width: " + _maxWidth + "; overflow-x: auto }");
                styles.push("." + visGuid + " .ren-data-grid__frozen-top-section-viewport { max-width: " + _maxWidth + " }");
                styles.push("." + visGuid + " .ren-data-grid { max-width: " + _maxWidth + " }");
            }

            // Only apply max-height if it was explicitly set (e.g. via max-height attribute on
            // ren-grid tag).  Don't apply it automatically for popups, as this prevents
            // client-side dynamic grids from auto-sizing.

            if (_maxHeight && _explicitMaxHeightSet) {

                // Avoid unnecessary vertical scrollbar when 37rem is used.
                const maxHeight = _maxHeight === "37rem" ? "37.25rem" : _maxHeight;

                styles.push("." + visGuid + " .ren-data-grid__frozen-left-section-viewport { max-height: " + maxHeight + " }");
                styles.push("." + visGuid + " .ren-visualisation__viewport { max-height: " + maxHeight + "!important }");
                styles.push("." + visGuid + " .ren-data-grid { max-height: " + maxHeight + " }");
            }
        }

        const newStyles = styles.join("\n");

        if (newStyles === previousStyles) return;

        stylesheet.textContent = styles.join("\n");

        previousStyles = newStyles;
    };

    Ren.Messages.Events.gridStateChanged.handle((newGridState) => {

        if (newGridState && newGridState.gridStateGroup !== gridStateGroup) return;
        updateStylesheet();
    });

    Ren.Messages.Events.visualisationSettingsChanged.handle(changedVisualisation => {

        if (changedVisualisation.visualisationSettingsGroup !== visualisation.visualisationSettingsGroup) return;

        updateStylesheet();
    });

    return {
        setMaxWidthAndHeight,
        setMaxWidth,
        updateStylesheet
    };
};
