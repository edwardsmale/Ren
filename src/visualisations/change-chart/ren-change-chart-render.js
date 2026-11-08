/**
 * Draws a change chart: a row per label, with an arrow from its before value to its after value
 * on a shared value axis along the bottom.
 */
Ren.ChangeChart_Render = (() => {

    const ROW_HEIGHT = 25;
    const LEGEND_HEIGHT = 24;
    const AXIS_HEIGHT = 24;
    const RIGHT_MARGIN = 24;
    const LABEL_GAP = 10;
    const POINT_RADIUS = 4;
    const ARROWHEAD_SIZE = 6;
    const MAX_LABEL_WIDTH_FRACTION = 0.4;
    const DEFAULT_WIDTH = 800;
    const MIN_WIDTH = 300;
    const TICK_COUNT = 5;

    /**
     * Gets the plain text of a formatted value, which a format function may give as HTML.
     */
    const toText = (formatted) => {

        if (formatted === null || formatted === undefined) return "";

        const text = String(formatted);

        return text.indexOf("<") === -1 && text.indexOf("&") === -1
            ? text
            : Ren.HtmlUtils.parseHTML(text).body.textContent;
    };

    const formatValue = (props, value) => toText(Ren.ValueFormatter.formatValue(
        value,
        null,
        props.valueFormat,
        props.valueFormatFunction,
        null
    ));

    const formatLabel = (label) => toText(Ren.ValueFormatter.formatValueSimple(label, null));

    /**
     * Gets the width the labels need, measured as drawn, but no more than a share of the chart's.
     */
    const measureLabelWidth = (svg, labels, width) => {

        const measuringText = Ren.Svg.append(svg, "text", { "class": "ren-change-chart__label" });
        let widest = 0;

        for (let index = 0; index < labels.length; index++) {

            measuringText.textContent = labels[index];
            widest = Math.max(widest, measuringText.getComputedTextLength());
        }

        measuringText.remove();

        const maxWidth = Math.floor(width * MAX_LABEL_WIDTH_FRACTION);

        return Math.min(Math.ceil(widest) + LABEL_GAP, maxWidth);
    };

    const createValueScale = (rows, plotLeft, plotRight) => {

        let min = 0;
        let max = 0;

        for (let index = 0; index < rows.length; index++) {

            min = Math.min(min, rows[index].before, rows[index].after);
            max = Math.max(max, rows[index].before, rows[index].after);
        }

        if (min === max) max = min + 1;

        return Ren.ChartScales.createLinearScale(
            [min, max + (max - min) * 0.05],
            [plotLeft, plotRight],
            { nice: true }
        );
    };

    const appendArrowheadMarker = (svg, markerId) => {

        const marker = Ren.Svg.append(Ren.Svg.append(svg, "defs"), "marker", {
            "id": markerId,
            "viewBox": "0 0 10 10",
            "refX": 10,
            "refY": 5,
            "markerWidth": ARROWHEAD_SIZE,
            "markerHeight": ARROWHEAD_SIZE,
            "orient": "auto-start-reverse"
        });

        Ren.Svg.append(marker, "path", {
            "class": "ren-change-chart__arrowhead",
            "d": "M 0 0 L 10 5 L 0 10 z"
        });
    };

    const appendLegend = (svg, props, plotLeft) => {

        const legend = Ren.Svg.append(svg, "g", {
            "class": "ren-change-chart__legend",
            "transform": `translate(${plotLeft},${LEGEND_HEIGHT / 2})`
        });

        const beforeItem = Ren.Svg.append(legend, "g");

        Ren.Svg.append(beforeItem, "circle", {
            "class": "ren-change-chart__before",
            "cx": POINT_RADIUS,
            "r": POINT_RADIUS
        });

        const beforeText = Ren.Svg.append(beforeItem, "text", {
            "class": "ren-change-chart__legend-text",
            "x": POINT_RADIUS * 2 + 6,
            "dy": "0.35em"
        });

        beforeText.textContent = props.beforeLabel;

        const afterX = POINT_RADIUS * 2 + 6 + beforeText.getComputedTextLength() + 24;
        const afterItem = Ren.Svg.append(legend, "g", { "transform": `translate(${afterX},0)` });

        Ren.Svg.append(afterItem, "circle", {
            "class": "ren-change-chart__after",
            "cx": POINT_RADIUS,
            "r": POINT_RADIUS
        });

        const afterText = Ren.Svg.append(afterItem, "text", {
            "class": "ren-change-chart__legend-text",
            "x": POINT_RADIUS * 2 + 6,
            "dy": "0.35em"
        });

        afterText.textContent = props.afterLabel;
    };

    const appendValueAxis = (svg, props, scale, plotTop, plotBottom) => {

        const axis = Ren.Svg.append(svg, "g", { "class": "ren-change-chart__axis" });
        const ticks = scale.getTicks(TICK_COUNT);

        for (let index = 0; index < ticks.length; index++) {

            const x = scale.getPixel(ticks[index]);

            Ren.Svg.append(axis, "line", {
                "class": ticks[index] === 0
                    ? "ren-change-chart__gridline ren-change-chart__gridline--zero"
                    : "ren-change-chart__gridline",
                "x1": x,
                "x2": x,
                "y1": plotTop,
                "y2": plotBottom
            });

            const tickLabel = Ren.Svg.append(axis, "text", {
                "class": "ren-change-chart__tick-label",
                "x": x,
                "y": plotBottom + 16,
                "text-anchor": "middle"
            });

            tickLabel.textContent = formatValue(props, ticks[index]);
        }
    };

    /**
     * Opens a popup report from a URL template filled in from a row, where it has every value
     * the template takes.
     */
    const openPopupReport = (template, title, value, row) => {

        const url = Ren.Links.fillTemplate(template, value, row, true);

        if (url === null) return;

        if (Ren.UrlContext.isDownloadedReport()) {

            window.open(Ren.HostUrls.reportUrl(url), "_blank");
        }
        else {

            Ren.ShowPopupReport(url, title ? Ren.Links.fillTemplate(title, value, row, false) : "");
        }
    };

    const appendRowLabel = (rowGroup, props, labelText, rowData, labelWidth) => {

        const label = Ren.Svg.append(rowGroup, "text", {
            "class": props.labelPopupReport
                ? "ren-change-chart__label ren-change-chart__label--link"
                : "ren-change-chart__label",
            "x": labelWidth - LABEL_GAP,
            "dy": "0.35em",
            "text-anchor": "end",
            "data-label": labelText
        });

        label.textContent = labelText;

        // A long label is cut short, and shown whole in its tooltip.
        if (label.getComputedTextLength() > labelWidth - LABEL_GAP) {

            let shortened = labelText;

            while (shortened.length > 1 && label.getComputedTextLength() > labelWidth - LABEL_GAP) {

                shortened = shortened.substring(0, shortened.length - 1);
                label.textContent = shortened + "…";
            }

            Ren.Svg.append(label, "title").textContent = labelText;
        }

        if (props.labelPopupReport) {

            Ren.Svg.on(label, "click", () => openPopupReport(
                props.labelPopupReport,
                props.labelPopupReportTitle,
                rowData.label,
                rowData.row
            ));
        }

        if (props.labelAutoMenuName) {
            Ren.AutoMenu.applyMenu(label, props.labelAutoMenuName, rowData.label);
        }
    };

    const appendRowChange = (rowGroup, props, labelText, rowData, scale, markerId) => {

        const beforeX = scale.getPixel(rowData.before);
        const afterX = scale.getPixel(rowData.after);
        const direction = Math.sign(afterX - beforeX);

        const change = Ren.Svg.append(rowGroup, "g", {
            "class": rowData.after > rowData.before
                ? "ren-change-chart__change ren-change-chart__change--increase"
                : rowData.after < rowData.before
                    ? "ren-change-chart__change ren-change-chart__change--decrease"
                    : "ren-change-chart__change"
        });

        // The arrow runs between the points' edges, so its head isn't hidden under the after point.
        if (Math.abs(afterX - beforeX) > POINT_RADIUS * 2 + ARROWHEAD_SIZE) {

            Ren.Svg.append(change, "line", {
                "class": "ren-change-chart__arrow",
                "x1": beforeX + direction * POINT_RADIUS,
                "x2": afterX - direction * (POINT_RADIUS + 1),
                "marker-end": `url(#${markerId})`
            });
        }

        Ren.Svg.append(change, "circle", {
            "class": "ren-change-chart__before",
            "cx": beforeX,
            "r": POINT_RADIUS
        });

        Ren.Svg.append(change, "circle", {
            "class": "ren-change-chart__after",
            "cx": afterX,
            "r": POINT_RADIUS
        });

        // A transparent strip over the arrow is easier to hover and click than the arrow itself.
        const hitArea = Ren.Svg.append(change, "rect", {
            "class": props.changePopupReport
                ? "ren-change-chart__hit-area ren-change-chart__hit-area--link"
                : "ren-change-chart__hit-area",
            "x": Math.min(beforeX, afterX) - POINT_RADIUS * 2,
            "y": -ROW_HEIGHT / 2 + 2,
            "width": Math.abs(afterX - beforeX) + POINT_RADIUS * 4,
            "height": ROW_HEIGHT - 4
        });

        Ren.Svg.append(hitArea, "title").textContent = labelText + "\n"
            + props.beforeLabel + ": " + formatValue(props, rowData.before) + "\n"
            + props.afterLabel + ": " + formatValue(props, rowData.after);

        if (props.changePopupReport) {

            Ren.Svg.on(hitArea, "click", () => openPopupReport(
                props.changePopupReport,
                props.changePopupReportTitle,
                rowData.label,
                rowData.row
            ));
        }
    };

    const renderChangeChart = (props, rows) => {

        const container = document.querySelector("." + props.guid);

        if (!container) return;

        props.svg?.remove();

        // Text measures nothing in a hidden tab, so a chart drawn there is drawn again once shown.
        props.isDrawnHidden = container.clientWidth === 0;

        const width = Math.max(container.clientWidth || DEFAULT_WIDTH, MIN_WIDTH);
        const plotTop = LEGEND_HEIGHT;
        const plotBottom = plotTop + rows.length * ROW_HEIGHT;
        const height = plotBottom + AXIS_HEIGHT;

        props.renderedWidth = width;
        props.svg = Ren.Svg.append(container, "svg", {
            "class": "ren-change-chart__svg",
            "width": width,
            "height": height
        });

        const labels = new Array(rows.length);

        for (let index = 0; index < rows.length; index++) {
            labels[index] = formatLabel(rows[index].label);
        }

        const labelWidth = measureLabelWidth(props.svg, labels, width);
        const scale = createValueScale(rows, labelWidth + POINT_RADIUS * 2, width - RIGHT_MARGIN);
        const markerId = props.guid + "-arrowhead";

        appendArrowheadMarker(props.svg, markerId);
        appendLegend(props.svg, props, labelWidth);
        appendValueAxis(props.svg, props, scale, plotTop, plotBottom);

        const rowsGroup = Ren.Svg.append(props.svg, "g", { "class": "ren-change-chart__rows" });

        for (let index = 0; index < rows.length; index++) {

            const rowGroup = Ren.Svg.append(rowsGroup, "g", {
                "class": "ren-change-chart__row",
                "transform": `translate(0,${plotTop + index * ROW_HEIGHT + ROW_HEIGHT / 2})`
            });

            appendRowLabel(rowGroup, props, labels[index], rows[index], labelWidth);
            appendRowChange(rowGroup, props, labels[index], rows[index], scale, markerId);
        }
    };

    return {
        renderChangeChart
    };
})();
