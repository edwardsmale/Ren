/**
 * Colours a date/value chart's value labels drawn clear of their marks to read over whatever they
 * have landed on, worked out geometrically from the marks' rectangles and any shaded lines' fills.
 * Runs after the declutter pass.  A label straddling surfaces that want opposite text colours also
 * gets a halo in the colour of the surface behind most of it.
 */
Ren.DateValueChart_LabelContrast = (() => {

    // The chart is drawn on the report's white background.
    const PLOT_BACKGROUND_COLOUR = "#ffffff";

    // How much of a label a surface has to cover to have a say in its colour, so a bar clipping a
    // corner does not flip it.
    const MIN_SURFACE_FRACTION = 0.12;

    // In screen pixels, as label text is counter-scaled by the .text-wrapper rule.
    const HALO_WIDTH_PX = 2.5;

    // Lines are left out, as a thin stroke covers too little of a label to matter.
    const SURFACE_SELECTOR = ".ren-data-series__bar, .ren-data-series__point";

    // A shaded line's fill is no rectangle, and is see-through, so is tinted into the background
    // rather than counted as a surface.
    const AREA_SELECTOR = ".ren-data-series__line-area";

    // A label inside a bar is already coloured for that bar by the stylesheet, unless the bar is
    // too small to hold it...  A series' names in its bars are coloured here, as an estimate's bar
    // and a bar its colour function colours differ from the series' colour.
    const LABEL_CLASSES = [
        "ren-bar-value-label--outside",
        "ren-bar-value-label--overflowing",
        "ren-bar-series-name-label",
        "ren-line-value-label",
        "ren-point-value-label"
    ];

    const SERIES_CLASS_PATTERN = /^series-(\d+)$/;

    let lastResult = { coloured: 0, haloed: 0, skipped: 0 };

    const getDiagnostics = () => lastResult;

    /** Gets a value indicating whether an element carries one of a list of class names. */
    const hasAnyClass = (node, classNames) => {

        for (let i = 0; i < classNames.length; i++) {

            if (node.classList.contains(classNames[i])) return true;
        }

        return false;
    };

    /** Gets the area two rectangles have in common, in square pixels. */
    const intersectionArea = (a, b) => {

        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

        return width > 0 && height > 0 ? width * height : 0;
    };

    /**
     * Gets a mark's series, and whether it is an estimate, from the groups it sits in up to root.
     */
    const markContext = (node, root) => {

        const context = { seriesIndex: -1, isEstimate: false };
        let current = node;

        while (current && current !== root) {

            const classes = current.classList;

            if (classes) {

                if (classes.contains("ren-estimate-mark")) context.isEstimate = true;

                if (context.seriesIndex === -1) {

                    for (let i = 0; i < classes.length; i++) {

                        const match = SERIES_CLASS_PATTERN.exec(classes[i]);

                        if (match) {

                            context.seriesIndex = parseInt(match[1], 10) - 1;
                            break;
                        }
                    }
                }
            }

            current = current.parentNode;
        }

        return context;
    };

    /**
     * Gets the colour a mark is filled with: its computed fill where that is a plain colour,
     * otherwise (a gradient) its series' own colour.
     */
    const unfilteredSurfaceColour = (props, node) => {

        const context = markContext(node, props.chartGroup);

        const computedFill = window.getComputedStyle(node).fill;

        if (Ren.Colours.toRgb(computedFill) !== null) return computedFill;

        const seriesIndex = context.seriesIndex === -1 ? 0 : context.seriesIndex;
        const series = props.series && props.series[seriesIndex];
        const colour = (series && series.colour)
            || Ren.DateValueChart_SeriesColours.getDefaultColour(
                seriesIndex,
                props.visualisation?.colourScheme
            );

        if (!context.isEstimate) return colour;

        // Mirrors the style updater, which barely fades an in-place estimate.
        const mode = Ren.DateValueChart_LastPeriodEstimate.getMode(props, seriesIndex);
        const strength = mode === Ren.EstimateLastPeriodEnum.InPlace
            ? Ren.DateValueChart_StyleUpdater.IN_PLACE_PASTEL_STRENGTH
            : undefined;

        return Ren.Colours.toPastel(colour, strength);
    };

    /**
     * Gets the colour a mark is drawn in, through any filter over it (a colour variant such as
     * "Dark").
     */
    const surfaceColour = (props, node) => {

        const filter = window.getComputedStyle(node).filter;

        return Ren.Colours.applyFilter(unfilteredSurfaceColour(props, node), filter);
    };

    /** Gets every mark a label could land on, with its rectangle and colour. */
    const collectSurfaces = (props) => {

        const nodes = props.chartGroup.querySelectorAll(SURFACE_SELECTOR);
        const surfaces = [];

        for (let i = 0; i < nodes.length; i++) {

            const rect = nodes[i].getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) continue;

            surfaces.push({ rect: rect, colour: surfaceColour(props, nodes[i]) });
        }

        return surfaces;
    };

    /** Gets every shaded line's fill, with its colour and opacity, in the order they are painted.
     */
    const collectAreas = (props) => {

        const nodes = props.chartGroup.querySelectorAll(AREA_SELECTOR);
        const areas = [];

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];
            const matrix = node.getScreenCTM();
            const rect = node.getBoundingClientRect();

            if (!matrix || rect.width === 0 || rect.height === 0) continue;

            const opacity = parseFloat(window.getComputedStyle(node).fillOpacity);

            areas.push({
                node: node,
                rect: rect,
                screenToArea: matrix.inverse(),
                colour: surfaceColour(props, node),
                opacity: isNaN(opacity) ? 1 : opacity
            });
        }

        return areas;
    };

    /** Gets a colour laid over another at an opacity, as a hex colour. */
    const blendColours = (under, over, opacity) => {

        const below = Ren.Colours.toRgb(under);
        const above = Ren.Colours.toRgb(over);

        if (below === null || above === null) return under;

        const mix = (lower, upper) => lower + (upper - lower) * opacity;

        return Ren.Colours.rgbToHex(
            mix(below.red, above.red),
            mix(below.green, above.green),
            mix(below.blue, above.blue)
        );
    };

    /**
     * Gets the colour of the plot behind a label's centre, which is the white background tinted by
     * whichever shaded lines' fills are over it.
     */
    const backgroundColourOf = (labelRect, areas) => {

        let colour = PLOT_BACKGROUND_COLOUR;

        if (!areas.length) return colour;

        const x = (labelRect.left + labelRect.right) / 2;
        const y = (labelRect.top + labelRect.bottom) / 2;

        for (let i = 0; i < areas.length; i++) {

            const area = areas[i];

            if (x < area.rect.left || x > area.rect.right) continue;
            if (y < area.rect.top || y > area.rect.bottom) continue;

            const point = new DOMPoint(x, y).matrixTransform(area.screenToArea);

            if (!area.node.isPointInFill(point)) continue;

            colour = blendColours(colour, area.colour, area.opacity);
        }

        return colour;
    };

    /**
     * Gets the area of a label each surface colour covers, the background taking what is left.
     * Overlapping marks are each counted in full, so the total can exceed the label's area.
     */
    const coverageOf = (labelRect, surfaces, backgroundColour) => {

        const labelArea = (labelRect.right - labelRect.left) * (labelRect.bottom - labelRect.top);
        const coverage = [];
        let covered = 0;

        for (let i = 0; i < surfaces.length; i++) {

            const area = intersectionArea(labelRect, surfaces[i].rect);

            if (area === 0) continue;

            covered += area;
            let existing = null;

            for (let j = 0; j < coverage.length; j++) {

                if (coverage[j].colour === surfaces[i].colour) existing = coverage[j];
            }

            if (existing) {
                existing.area += area;
            }
            else {

                coverage.push({ colour: surfaces[i].colour, area: area });
            }
        }

        coverage.push({
            colour: backgroundColour,
            area: Math.max(0, labelArea - covered)
        });

        return { labelArea: labelArea, entries: coverage };
    };

    /**
     * Gets a label's fill for the surface covering most of it, and a halo in that surface's colour
     * where another significant surface wants the opposite fill.
     */
    const resolveLabelColours = (coverage) => {

        const entries = coverage.entries;
        let dominant = entries[0];

        for (let i = 1; i < entries.length; i++) {

            if (entries[i].area > dominant.area) dominant = entries[i];
        }

        const fill = Ren.Colours.contrastingTextColour(dominant.colour);
        let haloColour = null;

        for (let i = 0; i < entries.length; i++) {

            const isSignificant = entries[i].area / coverage.labelArea >= MIN_SURFACE_FRACTION;

            if (isSignificant && Ren.Colours.contrastingTextColour(entries[i].colour) !== fill) {

                haloColour = dominant.colour;
                break;
            }
        }

        return { fill: fill, haloColour: haloColour };
    };

    /** Puts a label back to the colour its stylesheet rules give it. */
    const clearLabelColours = (labelNode) => {

        labelNode.style.fill = "";
        labelNode.style.paintOrder = "";
        labelNode.style.stroke = "";
        labelNode.style.strokeWidth = "";
        labelNode.style.strokeLinejoin = "";
    };

    const applyLabelColours = (labelNode, colours) => {

        labelNode.style.fill = colours.fill;

        if (colours.haloColour === null) return;

        labelNode.style.paintOrder = "stroke";
        labelNode.style.stroke = colours.haloColour;
        labelNode.style.strokeWidth = HALO_WIDTH_PX + "px";
        labelNode.style.strokeLinejoin = "round";
    };

    /**
     * Colours a chart's value labels for what is behind them.  All measuring is done between the
     * resets and the applies, so the pass costs a single layout.
     *
     * @returns {object} { coloured, haloed, skipped }, for the QA hooks.
     */
    const applyContrast = (props) => {

        const result = { coloured: 0, haloed: 0, skipped: 0 };
        lastResult = result;

        if (!props || !props.chartGroup) return result;

        const layerClass = Ren.DateValueChart_RenderValueLabels.LABELS_LAYER_CLASS;
        const layerNode = props.chartGroup.querySelector("." + layerClass);

        if (!layerNode) return result;

        const allLabels = layerNode.querySelectorAll("text");
        const labels = [];

        // Unless the bar was coloured by its series' colour function.
        const isInsideColouredBar = (labelNode) =>
            labelNode.classList.contains("ren-bar-value-label--inside")
            && Ren.DateValueChart_SeriesColourFunction.hasColourFunction(
                props,
                markContext(labelNode, layerNode).seriesIndex
            );

        for (let i = 0; i < allLabels.length; i++) {

            if (!hasAnyClass(allLabels[i], LABEL_CLASSES) && !isInsideColouredBar(allLabels[i])) {
                continue;
            }

            clearLabelColours(allLabels[i]);
            labels.push(allLabels[i]);
        }

        if (!labels.length) return result;

        const labelRects = [];
        let isAnyLabelDrawn = false;

        for (let i = 0; i < labels.length; i++) {

            const rect = labels[i].getBoundingClientRect();

            labelRects.push(rect);

            if (rect.width && rect.height) isAnyLabelDrawn = true;
        }

        // The marks are only worth gathering - and colouring is only worth doing - where a label
        // actually lands on one.  A chart whose series all hide their values still draws its
        // labels, at no size, and measuring every bar behind them would be for nothing.
        if (!isAnyLabelDrawn) {

            result.skipped = labels.length;
            return result;
        }

        const surfaces = collectSurfaces(props);
        const areas = collectAreas(props);

        for (let i = 0; i < labels.length; i++) {

            // Labels of a series with values hidden are still drawn, but have no size.
            if (labelRects[i].width === 0 || labelRects[i].height === 0) {

                result.skipped++;
                continue;
            }

            const backgroundColour = backgroundColourOf(labelRects[i], areas);
            const colours = resolveLabelColours(
                coverageOf(labelRects[i], surfaces, backgroundColour)
            );

            applyLabelColours(labels[i], colours);

            result.coloured++;
            if (colours.haloColour !== null) result.haloed++;
        }

        return result;
    };

    return {
        applyContrast,
        getDiagnostics
    };
})();
