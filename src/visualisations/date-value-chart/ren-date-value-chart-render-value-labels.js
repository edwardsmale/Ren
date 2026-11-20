Ren.DateValueChart_RenderValueLabels = (() => {

    // Min bar height (SVG units) for the label to sit inside the bar rather than above it.  This is
    // only a first guess, as Ren.DateValueChart_BarValueLabelLayout settles it in screen pixels.
    const labelInsideThreshold = 100;

    // Value labels go into one layer of their own, raised above the plot once it is drawn, so that
    // a series rendered later cannot paint its bars over an earlier series' labels.
    const LABELS_LAYER_CLASS = "ren-value-labels-layer";

    // A shaded line's labels hang beneath its points, inside its own shading, as above them they
    // would sit in the shading of the series above and read as that series'.
    const LINE_LABEL_BELOW_WRAPPER_CLASS = "ren-line-value-label-wrapper--below";

    /** Gets the chart's value label layer, created on first use. */
    const getLabelsLayer = (props) => {

        return props.chartGroup.querySelector("." + LABELS_LAYER_CLASS)
            || Ren.Svg.append(props.chartGroup, "g", { "class": LABELS_LAYER_CLASS });
    };

    /**
     * Gets the layer's group for one series, created on first use.  It carries the series' own
     * class, which the per-series colour and show/hide rules match on.
     *
     * @param {object} props - The chart's props, holding the chart group.
     * @param {string} [seriesClass] - The series' class as a selector (".series-2"), or none for
     *     the layer itself.
     */
    const getSeriesLabelsGroup = (props, seriesClass) => {

        const layer = getLabelsLayer(props);

        if (!seriesClass) return layer;

        return layer.querySelector(seriesClass)
            || Ren.Svg.append(layer, "g", { "class": seriesClass.replace(/^\./, "") });
    };

    /**
     * Raises the value label layer above everything else in the chart group.  Called once the plot
     * is complete, as the layer is created when the first series is labelled.
     */
    const raiseLabelsLayer = (props) => {

        if (!props.chartGroup) return;

        const layer = props.chartGroup.querySelector("." + LABELS_LAYER_CLASS);
        if (layer) layer.parentNode.appendChild(layer);
    };

    /**
     * Gets a value indicating whether a bar's label sits within the bar rather than above it.
     *
     * @param {number} y - The y the label is drawn at, which is the top of the bar it labels.
     * @param {number} [barBottom] - The y of the series' baseline.
     * @param {number} [barHeight] - A stacked segment's own height, which the baseline says
     *     nothing about.
     */
    const isLabelInsideBar = (y, barBottom, barHeight) =>
        (barHeight ?? (barBottom - y)) >= labelInsideThreshold;

    /**
     * Gets the attributes giving the bar layout pass a bar's extent: the end its value is at, the
     * end it stands on, and whether it is a stacked segment, whose label is centred on it.
     *
     * @param {number} y - The y the label is drawn at: the bar's top, or a segment's middle.
     * @param {number} [barBottom] - The y of the series' baseline.
     * @param {number} [barHeight] - A stacked segment's own height.
     */
    const getBarExtentAttrs = (y, barBottom, barHeight) => {

        if (barHeight === undefined || barHeight === null) {
            return { "data-bar-end": y, "data-bar-base": barBottom };
        }

        return {
            "data-bar-end": y - barHeight / 2,
            "data-bar-base": y + barHeight / 2,
            "data-bar-stacked": "true"
        };
    };

    const LABEL_CONFIGS = {
        bar: {
            dataSeriesSelector: ".ren-data-series--bar",
            labelsGroupClass: "ren-bar-value-labels",
            getWrapperClass: (y, barBottom, barHeight) => {

                const isInside = isLabelInsideBar(y, barBottom, barHeight);
                return "ren-text-wrapper " + (isInside ? "ren-bar-value-label-wrapper--inside" : "ren-bar-value-label-wrapper--outside");
            },
            getLabelClass: (y, barBottom, barHeight) => {

                const isInside = isLabelInsideBar(y, barBottom, barHeight);
                return "ren-bar-value-label " + (isInside ? "ren-bar-value-label--inside" : "ren-bar-value-label--outside");
            },
            getDataAttrs: (y, barBottom, barHeight) => getBarExtentAttrs(y, barBottom, barHeight),
            requiresBarBottom: true
        },
        line: {
            dataSeriesSelector: ".ren-data-series--line",
            labelsGroupClass: "ren-line-value-labels",
            getWrapperClass: () => "ren-text-wrapper ren-line-value-label-wrapper",
            getLabelClass: () => "ren-line-value-label",
            getDataAttrs: (y) => ({
                "data-line-point-y": y
            })
        },
        point: {
            dataSeriesSelector: ".ren-data-series--point",
            labelsGroupClass: "ren-point-value-labels",
            getWrapperClass: () => "ren-text-wrapper ren-point-value-label-wrapper",
            getLabelClass: () => "ren-point-value-label",
            getDataAttrs: (y) => ({
                "data-point-y": y
            })
        }
    };

    /**
     * Gets the label config for a type, with the bar config's inside/outside decisions closed over
     * the bar baseline.
     *
     * @param {string} labelType - "bar", "line" or "point".
     * @param {object} props - The chart's props.
     * @param {number} [barBottom] - The y of the bar baseline, for the bar labels.
     */
    const resolveConfig = (labelType, props, barBottom) => {

        const baseConfig = LABEL_CONFIGS[labelType];
        const config = Object.assign({}, baseConfig);

        if (labelType === "line" && props.shadeLines === true) {

            const wrapperClass = baseConfig.getWrapperClass();
            config.getWrapperClass = () => wrapperClass + " " + LINE_LABEL_BELOW_WRAPPER_CLASS;
        }

        if (baseConfig.requiresBarBottom) {

            const wrappedGetWrapperClass = baseConfig.getWrapperClass;
            const wrappedGetLabelClass = baseConfig.getLabelClass;
            const wrappedGetDataAttrs = baseConfig.getDataAttrs;

            config.getWrapperClass = (y, barHeight) => wrappedGetWrapperClass(y, barBottom, barHeight);
            config.getLabelClass = (y, barHeight) => wrappedGetLabelClass(y, barBottom, barHeight);
            config.getDataAttrs = (y, barHeight) => wrappedGetDataAttrs(y, barBottom, barHeight);
        }

        return config;
    };

    /**
     * Gets the tooltip of a value label, worded as the tooltip of the mark it labels.
     *
     * @param {string} [seriesClass] - The class of the series the label belongs to (".series-2").
     * @param {object} point - The labelled point, as given to appendValueLabel.
     * @param {string} labelText - The label's own text, which is an estimate's value as shown.
     */
    const getLabelTooltipText = (props, seriesClass, point, format, labelText) => {

        const tickFormat = Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
        const dateLabel = tickFormat
            ? tickFormat(point.date).replace(/\n/g, " ")
            : Ren.ChartDateTime.createLocalFormat("dd MMM yyyy")(point.date);

        const seriesIndex = seriesClass
            ? parseInt(seriesClass.replace(/^\.(ren-)?series-/, ""), 10) - 1
            : 0;

        const seriesLabel = props.series?.[seriesIndex]?.label || props.valueHeadings[seriesIndex];

        const estimate = point.isEstimate
            ? Ren.DateValueChart_LastPeriodEstimate.getRefreshedEstimate(props, seriesIndex)
            : null;

        let valueLabel;

        if (estimate) {

            valueLabel = Ren.DateValueChart_LastPeriodEstimate.getEstimateTooltipValue(
                props,
                seriesIndex,
                estimate
            );
        }
        else if (point.isEstimate) {

            valueLabel = `${labelText} (estimated)`;
        }
        else {

            valueLabel = Ren.ValueFormatter.formatValueSimple(point.value, format);
        }

        const text = `${dateLabel}\n${seriesLabel}: ${valueLabel}`;
        const otherTooltip = Ren.DateValueChart_OtherSeries.getTooltip(props, seriesIndex);

        return otherTooltip ? text + "\n\n" + otherTooltip : text;
    };

    /**
     * Appends one value label, positioned at the point it labels.  Its colour is left to the
     * contrast pass, as what it lands on is not known until the style updater has laid it out.
     *
     * @param {Element} labelsGroup - The group the label is appended to.
     * @param {object} config - A config from resolveConfig.
     * @param {object} point - The point to label, as { x, y, value } in plot coordinates, with an
     *     optional barHeight where the bar it labels is not measured from the baseline, an
     *     optional date, which gives the label a tooltip, and isEstimate where it is an estimate.
     */
    const appendValueLabel = (
        props,
        seriesClass,
        labelsGroup,
        config,
        point,
        format,
        formatFunction
    ) => {

        const { x, y, value, barHeight } = point;

        const wrapperClass = config.getWrapperClass(y, barHeight);
        const labelClass = config.getLabelClass(y, barHeight);

        const labelText = Ren.ValueFormatter.formatValue(
            value,
            null,
            format,
            formatFunction,
            null,
            null,
            null,
            null
        );

        const wrapper = Ren.Svg.append(labelsGroup, "g", {
            "class": wrapperClass,
            "data-x": x,
            "transform": `translate(${x}, ${y})`
        });

        Ren.Svg.setAttrs(wrapper, config.getDataAttrs(y, barHeight));

        if (config.requiresBarBottom && point.date) {

            wrapper.setAttribute(
                "data-bar-width",
                Ren.ChartBarSeries.getBarWidth(props, point.date)
            );
        }

        const text = Ren.Svg.append(wrapper, "text", {
            "class": labelClass,
            "x": 0,
            "y": 0,
            "text-anchor": "middle"
        });

        text.textContent = labelText ?? "";

        if (point.date) {

            Ren.Svg.append(wrapper, "title").textContent =
                getLabelTooltipText(props, seriesClass, point, format, labelText);
        }

        return wrapper;
    };

    const createValueLabelRenderer = (labelType) => {

        return (props, data, mainValueFn, crossValueFn, yScale, seriesClass, customCrossValueFn, format, formatFunction) => {

            const config = resolveConfig(labelType, props, yScale.getPixel(0));
            const crossValueFnToUse = (labelType === "bar" && customCrossValueFn) ? customCrossValueFn : crossValueFn;
            renderValueLabelsGeneric(props, data, mainValueFn, crossValueFnToUse, yScale, seriesClass, config, format, formatFunction);
        };
    };

    const renderValueLabelsGeneric = (props, data, mainValueFn, crossValueFn, yScale, seriesClass, config, format, formatFunction) => {

        const chartGroup = props.chartGroup;
        const selector = config.dataSeriesSelector;

        const selectedGroup = seriesClass
            ? chartGroup.querySelector(`${seriesClass} ${selector}`)
                || chartGroup.querySelector(`${selector}${seriesClass}`)
            : chartGroup.querySelector(selector);

        // A series that was not plotted has nothing to label.
        if (!selectedGroup) {
            return;
        }

        const labelsGroup = Ren.Svg.append(getSeriesLabelsGroup(props, seriesClass), "g", {
            "class": config.labelsGroupClass
        });

        const labelFormat = format !== undefined ? format : props.valueColumnFormats?.[0];
        const labelFormatFunction = formatFunction !== undefined ? formatFunction : props.valueColumnFormatFunctions?.[0];

        data.forEach((d, index) => {

            try {

                const value = mainValueFn(d);
                const y = yScale.getPixel(value);

                // A value with no point, such as the first period's change, has no label.
                if (y === undefined) return;

                appendValueLabel(
                    props,
                    seriesClass,
                    labelsGroup,
                    config,
                    {
                        x: props.xScale.getPixel(crossValueFn(d)),
                        y,
                        value,
                        date: d[props.dateHeading]
                    },
                    labelFormat,
                    labelFormatFunction
                );
            }
            catch (error) {

                Ren.GlobalErrorHandler.logError(
                    `[DateValueChartValueLabels] Error appending label at index ${index}: ` +
                    error.message
                );
            }
        });
    };

    // The caption is offset in ems so it reads as a second line of the label at any size.  A line
    // series' labels sit above the point, so its caption drops a further line to clear the node,
    // unless they hang beneath it.  A dot can be too large for that to clear it, so a dot's caption
    // goes above the label.
    const ESTIMATE_CAPTION_TEXT = "EST";
    const ESTIMATE_CAPTION_CLASS = "ren-estimate-period-label";
    const ESTIMATE_CAPTION_OFFSET_EM = 1.15;
    const ESTIMATE_CAPTION_LINE_EXTRA_OFFSET_EM = 1;
    const LINE_LABEL_CLASS = "ren-line-value-label";
    const POINT_LABEL_CLASS = "ren-point-value-label";

    /**
     * Adds the "EST" caption beneath a value label (above a dot's), naming its value as the last
     * period's estimate.
     * Its own class keeps it shown for a series whose value labels are turned off.
     *
     * @param {Element} [wrapper] - The label's wrapper group.
     * @returns {Element|null} The caption, or null where there was no label.
     */
    const appendEstimateCaption = (wrapper) => {

        const label = wrapper ? wrapper.querySelector("text") : null;
        if (!label) return null;

        const labelClass = label.getAttribute("class");
        let offsetEm = ESTIMATE_CAPTION_OFFSET_EM;

        if (labelClass.indexOf(POINT_LABEL_CLASS) !== -1) {
            offsetEm = -ESTIMATE_CAPTION_OFFSET_EM;
        }
        else if (labelClass.indexOf(LINE_LABEL_CLASS) !== -1 &&
            !wrapper.classList.contains(LINE_LABEL_BELOW_WRAPPER_CLASS)) {

            offsetEm += ESTIMATE_CAPTION_LINE_EXTRA_OFFSET_EM;
        }

        const caption = Ren.Svg.append(wrapper, "text", {
            "class": `${labelClass} ${ESTIMATE_CAPTION_CLASS}`,
            "x": 0,
            "y": 0,
            "dy": `${offsetEm}em`,
            "text-anchor": "middle"
        });

        caption.textContent = ESTIMATE_CAPTION_TEXT;

        return caption;
    };

    /**
     * Labels points that the caller has positioned itself, such as the last period's estimate and
     * a stacked series' segments, shaped as a series' own so later passes treat them alike.
     *
     * @param {string} labelType - "bar", "line" or "point".
     * @param {object} props - The chart's props, holding the chart group.
     * @param {string} [seriesClass] - The class of the series the labels belong to (".series-2").
     * @param {object[]} points - The points to label, as { x, y, value } in plot coordinates, each
     *     with an optional barHeight where the bar it labels is not measured from the baseline, an
     *     optional date for its tooltip, and isEstimate where it is an estimate.
     * @param {number} [barBottom] - The y of the bar baseline, needed for the bar labels.
     */
    const renderValueLabelsIntoGroup = (labelType, props, seriesClass, points, format, formatFunction, barBottom) => {

        const config = resolveConfig(labelType, props, barBottom);
        const labelsGroup = Ren.Svg.append(getSeriesLabelsGroup(props, seriesClass), "g", {
            "class": config.labelsGroupClass
        });

        for (let i = 0; i < points.length; i++) {

            try {

                appendValueLabel(
                    props,
                    seriesClass,
                    labelsGroup,
                    config,
                    points[i],
                    format,
                    formatFunction
                );
            }
            catch (error) {

                Ren.GlobalErrorHandler.logError(
                    `[DateValueChartValueLabels] Error appending label at index ${i}: ` +
                    error.message
                );
            }
        }

        return labelsGroup;
    };

    const renderBarValueLabels = createValueLabelRenderer("bar");
    const renderLineValueLabels = createValueLabelRenderer("line");
    const renderPointValueLabels = createValueLabelRenderer("point");

    return {
        LABELS_LAYER_CLASS,
        LINE_LABEL_BELOW_WRAPPER_CLASS,
        getSeriesLabelsGroup,
        raiseLabelsLayer,
        renderBarValueLabels,
        renderLineValueLabels,
        renderPointValueLabels,
        renderValueLabelsIntoGroup,
        appendEstimateCaption
    };
})();
