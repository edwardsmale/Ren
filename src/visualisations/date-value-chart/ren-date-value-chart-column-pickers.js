/**
 * The pickers at a date/value chart's top right, to the left of its focus mode button: one naming
 * the column its data is split by, one naming the column its bars or slices are subdivided by, the
 * limit on the series shown (see DateValueChart_SeriesLimit), and one naming the column its values
 * are aggregated from.  The column pickers open a menu of the columns they can be switched to when
 * clicked.  They belong to the chart as a whole, so a multi-chart has one set rather than a set per
 * chart.  A titled chart shows them in a row kept free beneath its title.  Last comes a cog opening
 * the chart's settings window (see DateValueChart_SettingsWindow).
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
     * Gets the outline of a cog of eight teeth with a hole through its middle, in a 24-unit square,
     * filled even-odd so that the hole is left empty.
     */
    const getCogPath = () => {

        const TEETH = 8;
        const CENTRE = 12;
        const TIP_RADIUS = 11.5;
        const ROOT_RADIUS = 8.4;
        const HOLE_RADIUS = 3.9;

        // Half the width of a tooth, the same at its tip as at its root, so that it is square.
        const HALF_TOOTH_WIDTH = 2.4;

        const point = (radius, angle) =>
            (CENTRE + radius * Math.sin(angle)).toFixed(2) + " " +
            (CENTRE - radius * Math.cos(angle)).toFixed(2);

        const commands = [];

        for (let tooth = 0; tooth < TEETH; tooth++) {

            const angle = tooth * 2 * Math.PI / TEETH;
            const rootHalfAngle = Math.asin(HALF_TOOTH_WIDTH / ROOT_RADIUS);
            const tipHalfAngle = Math.asin(HALF_TOOTH_WIDTH / TIP_RADIUS);

            commands.push(
                (tooth ? "A " + ROOT_RADIUS + " " + ROOT_RADIUS + " 0 0 1 " : "M ") +
                    point(ROOT_RADIUS, angle - rootHalfAngle),
                "L " + point(TIP_RADIUS, angle - tipHalfAngle),
                "A " + TIP_RADIUS + " " + TIP_RADIUS + " 0 0 1 " + point(TIP_RADIUS, angle + tipHalfAngle),
                "L " + point(ROOT_RADIUS, angle + rootHalfAngle)
            );
        }

        commands.push(
            "A " + ROOT_RADIUS + " " + ROOT_RADIUS + " 0 0 1 " +
                point(ROOT_RADIUS, -Math.asin(HALF_TOOTH_WIDTH / ROOT_RADIUS)),
            "Z",
            "M " + point(HOLE_RADIUS, 0),
            "A " + HOLE_RADIUS + " " + HOLE_RADIUS + " 0 1 0 " + point(HOLE_RADIUS, Math.PI),
            "A " + HOLE_RADIUS + " " + HOLE_RADIUS + " 0 1 0 " + point(HOLE_RADIUS, 0),
            "Z"
        );

        return commands.join(" ");
    };

    const COG_PATH = getCogPath();

    const createCogIcon = () => {

        const icon = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        const path = document.createElementNS(Ren.Svg.NAMESPACE, "path");

        // Sized here as well as in its style, as an icon with only a viewBox shrinks to nothing in
        // a button sized to its content.
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("width", "14");
        icon.setAttribute("height", "14");
        icon.setAttribute("aria-hidden", "true");
        icon.classList.add(CLASS_NAME + "__settings-icon");

        path.setAttribute("d", COG_PATH);
        path.setAttribute("fill-rule", "evenodd");

        icon.appendChild(path);

        return icon;
    };

    const appendSettingsButton = (container, visualisation) => {

        const button = Ren.HtmlUtils.create("button")
            ._addClass(CLASS_NAME + "__picker")
            ._addClass(CLASS_NAME + "__settings")
            ._set("type", "button")
            ._set("title", "Chart settings");

        button.appendChild(createCogIcon());

        button.addEventListener("mousedown", e => e.stopPropagation());

        button.addEventListener("click", e => {

            e.stopPropagation();
            Ren.DateValueChart_SettingsWindow.open(visualisation);
        });

        container.appendChild(button);
    };

    /**
     * Draws the pickers on the chart's element, replacing any drawn before.  pickers is what the
     * chart's menu items know of its columns (see ContextMenuItems_DateValueChart_SeriesColumns).
     */
    const render = (visualisation, props, pickers) => {

        const element = visualisation?.element;

        if (!element || visualisation.isVirtual) return;

        element.querySelector(":scope > ." + CLASS_NAME)?.remove();

        latestPickersByVisualisation.set(visualisation, pickers);
        Ren.DateValueChart_SettingsWindow.update(visualisation, props);

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

        appendSettingsButton(container, visualisation);

        element.appendChild(container);
    };

    return {
        render
    };
})();
