/**
 * The pickers at a date/value chart's top right, to the left of its focus mode button: one naming
 * the column its data is split by, one naming the column its bars or slices are subdivided by, the
 * limit on the series shown (see DateValueChart_SeriesLimit), and one naming the column its values
 * are aggregated from.  The column pickers open a menu of the columns they can be switched to when
 * clicked.  They belong to the chart as a whole, so a multi-chart has one set rather than a set per
 * chart.  A titled chart shows them in a row kept free beneath its title.
 */
Ren.DateValueChart_ColumnPickers = (() => {

    const CLASS_NAME = "ren-date-value-chart-column-pickers";

    // The pickers each chart was last drawn with.  A change made from a picker's menu may rebuild
    // the chart, leaving the pickers its menu was opened from acting on the chart as it was.
    const latestPickersByVisualisation = new WeakMap();

    const openMenu = (e, visualisation, builderName) => {

        e.stopPropagation();

        const buildMenuItems = () => latestPickersByVisualisation.get(visualisation)[builderName]();

        Ren.ContextMenuRenderer.open(
            buildMenuItems(),
            { x: e.pageX, y: e.pageY },
            e.shiftKey,
            buildMenuItems
        );
    };

    const appendPicker = (container, visualisation, label, value, title, builderName) => {

        const button = Ren.HtmlUtils.create("button")
            ._addClass(CLASS_NAME + "__picker")
            ._addClass("js-ren-context-menu-button")
            ._set("type", "button")
            ._set("title", title);

        button.appendChild(
            Ren.HtmlUtils.create("span")._addClass(CLASS_NAME + "__label")._textContent(label)
        );

        button.appendChild(
            Ren.HtmlUtils.create("span")._addClass(CLASS_NAME + "__value")._textContent(value)
        );

        button.appendChild(
            Ren.HtmlUtils.create("span")._addClass(CLASS_NAME + "__pencil")._textContent("✎")
        );

        // Kept from the chart beneath, which may start a drag or selection on it.
        button.addEventListener("mousedown", e => e.stopPropagation());
        button.addEventListener("click", e => openMenu(e, visualisation, builderName));

        container.appendChild(button);
    };

    /**
     * Draws the pickers on the chart's element, replacing any drawn before, where it has any to
     * draw.  pickers is what the chart's menu items know of its columns (see
     * ContextMenuItems_DateValueChart_SeriesColumns).
     */
    const render = (visualisation, props, pickers) => {

        const element = visualisation?.element;

        if (!element || visualisation.isVirtual) return;

        element.querySelector(":scope > ." + CLASS_NAME)?.remove();

        latestPickersByVisualisation.set(visualisation, pickers);

        const valueColumn = pickers.getValueColumn();
        const hasSplitColumn = pickers.hasSplitColumn();
        const container = Ren.HtmlUtils.create("div")._addClass(CLASS_NAME);

        if (hasSplitColumn) {

            appendPicker(
                container,
                visualisation,
                "Split by:",
                pickers.getSplitColumn() ?? "None",
                "Change the column the data is split by",
                "buildSplitColumnMenuItems"
            );
        }

        if (pickers.hasSubdivideColumn()) {

            appendPicker(
                container,
                visualisation,
                "Subdivide by:",
                pickers.getSubdivideColumn() ?? "None",
                "Change the column the bars or slices are subdivided by",
                "buildSubdivideColumnMenuItems"
            );
        }

        Ren.DateValueChart_SeriesLimit.render(props, container);

        if (valueColumn != null) {

            appendPicker(
                container,
                visualisation,
                "Value:",
                valueColumn,
                "Change the column the values are taken from",
                "buildValueColumnMenuItems"
            );
        }

        if (container.childElementCount > 0) {
            element.appendChild(container);
        }
    };

    return {
        render
    };
})();
