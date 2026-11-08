/**
 * Draws a date/value chart as a pie per period in place of its bars, lines and dots, each slice a
 * series' share of the period's total.  The slices are drawn in each series' own group, so the
 * legend, the series' menus and its colour reach them as they do the series' bars.
 */
Ren.DateValueChart_Pies = (() => {

    // How much of the narrowest period's width, or of the plot's height, a pie spans.
    const PIE_SPAN = 0.9;

    const MAX_HOLE_RADIUS = 0.9;

    const SLICE_CLASS = "ren-data-series__pie-slice";
    const SLICE_GROUP_CLASS = "ren-pie-slice";

    /**
     * Gets a value indicating whether the chart is drawn as pies.
     */
    const isShown = (props) => props.showAsPies === true;

    /**
     * Gets the radius of the hole in the middle of each pie, as a share of the pie's radius.
     */
    const getHoleRadius = (props) =>
        Ren.NumberUtils.clamp(Number(props.pieHoleRadius) || 0, 0, MAX_HOLE_RADIUS);

    const getSeriesName = (props, seriesIndex) =>
        props.series[seriesIndex].label || props.valueHeadings[seriesIndex] || "";

    /**
     * Gets the radius, in the chart group's (screen pixel) units, every pie is drawn at.
     */
    const getRadiusPx = (props, scaleX, scaleY) => {

        const periodWidthPx = (props.piePeriodWidth ?? props.innerWidth) * scaleX;
        const widestRadiusPx = PIE_SPAN / 2 * Math.min(periodWidthPx, props.innerHeight * scaleY);

        return Ren.DateValueChart_PieLabels.getRadiusPx(props, widestRadiusPx, periodWidthPx);
    };

    const round = (value) => Math.round(value * 10000) / 10000;

    // Angles run clockwise from 12 o'clock.
    const pointAt = (angle, radius) =>
        `${round(radius * Math.sin(angle))},${round(-radius * Math.cos(angle))}`;

    /**
     * Gets the path of a whole ring (or disc, without a hole), of radius 1.  The hole is drawn the
     * other way round from the rim, so it is left unfilled.
     */
    const getRingPath = (holeRadius) => {

        let path = "M0,-1A1,1 0 1 1 0,1A1,1 0 1 1 0,-1Z";

        if (holeRadius > 0) {

            const r = round(holeRadius);
            path += `M0,-${r}A${r},${r} 0 1 0 0,${r}A${r},${r} 0 1 0 0,-${r}Z`;
        }

        return path;
    };

    /**
     * Gets the path of a slice of a pie of radius 1, from one angle to another, in radians.  A
     * slice of the whole pie is a ring, as an arc can't end where it starts.
     */
    const getSlicePath = (startAngle, endAngle, holeRadius) => {

        const sweep = endAngle - startAngle;

        if (sweep >= Math.PI * 2 - 1e-9) return getRingPath(holeRadius);

        const largeArc = sweep > Math.PI ? 1 : 0;
        let path = `M${pointAt(startAngle, 1)}A1,1 0 ${largeArc} 1 ${pointAt(endAngle, 1)}`;

        if (holeRadius > 0) {

            const r = round(holeRadius);
            path += `L${pointAt(endAngle, holeRadius)}`
                + `A${r},${r} 0 ${largeArc} 0 ${pointAt(startAngle, holeRadius)}Z`;
        }
        else {

            path += "L0,0Z";
        }

        return path;
    };

    /**
     * Gets the value a series has in a row as a slice: nothing, where it is missing or negative,
     * as a pie can't show less than nothing.
     */
    const getSliceValueFn = (props, seriesIndex) => {

        const heading = props.valueHeadings[seriesIndex];
        const valueFn = Ren.DateValueChart_LastPeriodEstimate.applyEstimatedValue(
            props,
            seriesIndex,
            d => d[heading]
        );

        return d => {

            const value = Number(valueFn(d));

            return value > 0 ? value : 0;
        };
    };

    /**
     * Gets the width of the narrowest period drawn, which every pie is sized to, so the pies are
     * all the one size.
     */
    const getNarrowestPeriodWidth = (props, data) => {

        let narrowest = Infinity;

        for (let index = 0; index < data.length; index++) {

            const width = Ren.DateValueChartCalculator.periodWidth(
                props,
                data[index][props.dateHeading]
            );

            if (width > 0 && width < narrowest) narrowest = width;
        }

        return narrowest === Infinity ? props.innerWidth : narrowest;
    };

    /**
     * Draws a pie for each row, its slices in the groups of the series they belong to, and keeps
     * where each pie and slice is, in plot coordinates, for their labels to be placed by.
     */
    const render = (props, data) => {

        props.piePeriodWidth = getNarrowestPeriodWidth(props, data);

        const seriesIndexes = [];
        const valueFns = [];

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i].isEnabled === false) continue;

            seriesIndexes.push(i);
            valueFns.push(getSliceValueFn(props, i));
        }

        const dataSeriesGroups = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            const seriesNum = seriesIndexes[i] + 1;
            const seriesGroup = Ren.Svg.append(props.chartGroup, "g", {
                "class": `ren-series-${seriesNum}`,
                "data-series": seriesNum
            });

            dataSeriesGroups.push(Ren.Svg.append(seriesGroup, "g", {
                "class": "ren-data-series ren-data-series--pie"
            }));
        }

        const holeRadius = getHoleRadius(props);
        const centreY = props.innerHeight / 2;
        const dateTickFormat = Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
        const pies = [];

        for (let dataIndex = 0; dataIndex < data.length; dataIndex++) {

            const d = data[dataIndex];
            const values = [];
            let total = 0;

            for (let i = 0; i < seriesIndexes.length; i++) {

                values.push(valueFns[i](d));
                total += values[i];
            }

            if (!(total > 0)) continue;

            const centreX = props.xScale.getPixel(
                Ren.DateValueChartCalculator.periodCentre(props, d[props.dateHeading])
            );

            const dateLabel = dateTickFormat(d[props.dateHeading]).replace(/\n/g, " ");
            const pie = { centreX, centreY, total, slices: [] };
            let angle = 0;

            pies.push(pie);

            for (let i = 0; i < seriesIndexes.length; i++) {

                if (values[i] === 0) continue;

                const seriesIndex = seriesIndexes[i];
                const sweep = values[i] / total * Math.PI * 2;

                // Translated apart from the slice, which is scaled about the pie's centre.
                const sliceGroup = Ren.Svg.append(dataSeriesGroups[i], "g", {
                    "class": SLICE_GROUP_CLASS,
                    "data-index": dataIndex,
                    "data-series": seriesIndex + 1,
                    "transform": `translate(${round(centreX)},${round(centreY)})`
                });

                Ren.Svg.setDatum(sliceGroup, d);

                Ren.Svg.setDatum(Ren.Svg.append(sliceGroup, "path", {
                    "class": SLICE_CLASS,
                    "d": getSlicePath(angle, angle + sweep, holeRadius)
                }), d);

                const seriesLabel = getSeriesName(props, seriesIndex);
                const formattedValue = Ren.ValueFormatter.formatValueSimple(
                    values[i],
                    props.valueColumnFormats[seriesIndex]
                );

                const share = Math.round(values[i] / total * 1000) / 10;

                Ren.Svg.append(sliceGroup, "title").textContent =
                    `${dateLabel}\n${seriesLabel}: ${formattedValue} (${share}%)`;

                Ren.DateValueChart_OtherSeries.addTooltip(sliceGroup, props, seriesIndex);

                pie.slices.push({
                    seriesIndex,
                    value: values[i],
                    share: values[i] / total,
                    startAngle: angle,
                    endAngle: angle + sweep
                });

                Ren.DateValueChart_SeriesSubdivisions.renderPieMarks(
                    props,
                    sliceGroup,
                    d,
                    seriesIndex,
                    { pie, centreX, centreY, startAngle: angle, endAngle: angle + sweep },
                    dateLabel
                );

                angle += sweep;
            }
        }

        props.pieLayout = pies;

        Ren.DateValueChart_PieLabels.render(props, pies);
    };

    /**
     * Gets the rules sizing the pies to the chart's scale.  The slices are drawn with a radius of
     * 1 inside series groups scaled unevenly to the plot, so are scaled back to round, as are the
     * bands and grooves subdividing them, which are styled by the subdivisions themselves.
     */
    const buildStyles = (props, scaleX, scaleY) => {

        if (!isShown(props) || !(scaleX > 0) || !(scaleY > 0)) return [];

        const radiusPx = getRadiusPx(props, scaleX, scaleY);
        const Subdivisions = Ren.DateValueChart_SeriesSubdivisions;
        const scaling = `scale: ${radiusPx / scaleX} ${radiusPx / scaleY}; transform-origin: 0 0`;
        const sliceDeclarations = `{ ${scaling}; stroke: white; stroke-width: 1px; `
            + "vector-effect: non-scaling-stroke; stroke-linejoin: round }";

        // A rule each, as a rule is scoped to its chart by a prefix, which reaches only the first
        // of a list of selectors.
        return [
            `.${SLICE_CLASS} ${sliceDeclarations}`,
            `.${Subdivisions.PIE_MARK_CLASS} { ${scaling} }`,
            `.${SLICE_GROUP_CLASS} .${Subdivisions.GROOVE_HIGHLIGHT_CLASS} { ${scaling} }`,
            `.${SLICE_GROUP_CLASS} .${Subdivisions.GROOVE_CLASS} { ${scaling} }`,
            `.${Subdivisions.PIE_OUTLINE_CLASS} { ${scaling} }`
        ];
    };

    /**
     * Gets the element a click at the given point is taken to be on: the slice beneath a pie
     * label where there is one, as a label can reach over a neighbouring slice and would
     * otherwise stand for its own series there, or else the click's own target.
     */
    const getClickTarget = (target, clientX, clientY) => {

        const labelsLayer = target && target.closest
            ? target.closest("." + Ren.DateValueChart_PieLabels.LAYER_CLASS)
            : null;

        if (!labelsLayer || !document.elementsFromPoint) return target;

        const svgNode = labelsLayer.ownerSVGElement;
        const elements = document.elementsFromPoint(clientX, clientY);

        for (let index = 0; index < elements.length; index++) {

            const element = elements[index];

            if (!labelsLayer.contains(element) && element.closest(".ren-pie-slice")
                && svgNode && svgNode.contains(element)) {

                return element;
            }
        }

        return target;
    };

    return {
        SLICE_CLASS,
        MAX_HOLE_RADIUS,
        isShown,
        getClickTarget,
        getHoleRadius,
        getSeriesName,
        getRadiusPx,
        getSlicePath,
        render,
        buildStyles
    };
})();
