/**
 * The faint grey band a date/value chart shades the period the pointer is over in, hung below its
 * date axis.
 *
 * An axis of a couple of years of days has a label only every so often, so a value partway between
 * two takes an eye down the chart and back along the axis to place.  The band covers the period
 * the pointer is in, from its start to the start of the next: a bar or point stands in the middle
 * of the period it aggregates, so a line at the period's start would fall between two marks.  It is
 * drawn below the plot rather than up it, so that nothing is laid over the values being read,
 * unless the chart asks for the period to be highlighted up the plot (hoverDateLineFullHeight).
 * That can be asked for alone, in which case the band covers only the plot and no date is printed.
 *
 * The date is printed in a small label at the band's foot, in a strip the chart reserves beneath
 * its axis labels rather than over them.  A day nobody works is printed in red, a weekend or a
 * holiday being the first thing a dip in the figures is checked against.
 *
 * The band is drawn in the container's own pixels rather than in plot coordinates, so it needs no
 * counter-scaling; the period under the pointer is worked out from the chart's current scale as
 * the pointer moves.
 *
 * The hovered date is announced to the other charts in the chart's date range group, which show
 * it in their own band where they show one, so that one date can be read across several charts.
 */
Ren.DateValueChart_HoverDateLine = (() => {

    // The least the band hangs below the date axis by, in visual pixels, where the chart left no
    // room for the label beneath the axis labels.
    const AXIS_OVERSHOOT_PX = 8;

    // How far outside the plot the pointer can stray and still be taken as reading the chart: over
    // the axis labels or just past the last bar, but not over the legend below it.
    const POINTER_MARGIN_PX = 12;

    // The label at the band's foot: the size it is printed at, the padding of the ground it is
    // printed on, and the gap between that ground and the foot of the band.
    const LABEL_FONT_SIZE_PX = 11;
    const LABEL_PADDING_X_PX = 5;
    const LABEL_PADDING_Y_PX = 2;
    const LABEL_GAP_PX = 1;

    // How much clear space is left beneath the label, so that its ground does not sit flush
    // against the bottom of the chart's container.
    const LABEL_EDGE_GAP_PX = 2;

    // The grey the period is shaded in, and how much of it shows through.  The shade has to read at
    // a hair's breadth on a two-year axis without swamping a chart of a dozen months.
    const BAND_COLOUR = "#CCC";
    const BAND_OPACITY = 0.25;

    // What the date is printed in: the usual grey, and the red a day nobody works is called out in.
    const LABEL_COLOUR = "#333333";
    const NON_WORKING_LABEL_COLOUR = "firebrick";

    // What the band is showing.  A band not on the chart was either never drawn or is not being
    // hovered, so the last pointer move's result is exposed to tell them apart.
    let lastResult = {
        shown: false,
        date: null,
        label: null,
        isNonWorking: false,
        fullHeight: false,
        xPx: null,
        values: null
    };

    const getDiagnostics = () => lastResult;

    // The height of the ground the date is printed on, which the values box hangs below.
    const getLabelGroundHeightPx = () => LABEL_FONT_SIZE_PX + LABEL_PADDING_Y_PX * 2;

    /**
     * Gets the room, in visual pixels, a chart showing the hint has to leave beneath its date axis
     * on top of the room the axis' own labels take.  The label is drawn in that space rather than
     * over the axis labels, which are what a reader checks the hint against.
     *
     * A chart showing the values box stacks it below the date, and so asks for both.
     */
    const getReservedHeightPx = (props) => {

        const datePx = props.showHoverDateLine === true
            ? LABEL_GAP_PX + getLabelGroundHeightPx()
            : 0;

        const valuesPx = props.showHoverValues === true
            ? LABEL_GAP_PX + Ren.DateValueChart_HoverValues.getHeightPx(props)
            : 0;

        return datePx + valuesPx === 0 ? 0 : datePx + valuesPx + LABEL_EDGE_GAP_PX;
    };

    /**
     * Gets a value indicating whether the label a period is printed as names a single day, and so
     * is worth naming the weekday of: a chart plotted a day at a time, or one whose dates are
     * grouped by nothing in particular.
     */
    const namesOneDay = (datePeriod) =>
        datePeriod === Ren.DatePeriodEnum.Day || !Ren.DateValueChart_DateTickFormat
            .getTickFormat(datePeriod);

    /**
     * What a period's date is printed as at the band's foot: the axis' own wording for the
     * period, on one line.  A chart whose dates are grouped by nothing in particular is left with
     * the plain date.
     *
     * A label naming a day is opened with the weekday, taken in the same time as the rest of the
     * label so that the two cannot fall on different days.
     */
    const formatDate = (props, date) => {

        const tickFormat = Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
        const periodStart =
            Ren.DateValueChartCalculator.startOfAxisPeriod(date, props.datePeriod) || date;
        const weekday = namesOneDay(props.datePeriod)
            ? `${Ren.ChartDateTime.getWeekdayName(periodStart)}, `
            : "";

        if (!tickFormat) {
            return weekday + Ren.ChartDateTime.createLocalFormat("dd MMM yyyy")(periodStart);
        }

        return weekday + tickFormat(periodStart).split("\n").join(" ");
    };

    /**
     * Gets a value indicating whether a period's date falls on a day that is not worked - a weekend
     * or a holiday.  Only a label naming a single day can be: a month is neither worked nor not.
     *
     * The day is taken as UTC midnight of the date as it reads, which is both the day the utils
     * count in and the day the label was printed from, however the chart's own dates are offset.
     */
    const isNonWorkingDate = (props, date) => {

        if (!namesOneDay(props.datePeriod)) return false;

        const periodStart = Ren.DateUtils.startOfPeriod(date, props.datePeriod) || date;

        const day = new Date(Date.UTC(
            periodStart.getFullYear(),
            periodStart.getMonth(),
            periodStart.getDate()
        ));

        return !Ren.WorkingDayUtils.isWorkingDay(day);
    };

    /**
     * The period the chart plots that a date falls in, as { date, x } naming its start and where
     * that start stands in plot coordinates.
     *
     * Worked out from the scale rather than read off the axis' ticks: an axis with more periods
     * than it has room for ticks is given ticks every so many periods, and the band would then
     * stand at the nearest tick rather than at the period the pointer is over - which the value
     * read from that period would not match.
     */
    const periodForDate = (props, date) => {

        if (!date || !date.getTime) return null;

        const domain = props.xScale.getDomain();

        // A date outside the span the chart plots has no period of its own here, and would
        // otherwise be given whichever end of the axis it is past.
        if (date < domain[0] || date >= domain[1]) return null;

        const periodStart =
            Ren.DateValueChartCalculator.startOfAxisPeriod(date, props.datePeriod) || date;

        return { date: periodStart, x: props.xScale.getPixel(periodStart) };
    };

    /**
     * The period a position given in plot coordinates falls in.  The position is held to the plot,
     * so that a pointer just past either end still reads the period it is nearest.
     */
    const periodAtPlotX = (props, x) => periodForDate(
        props,
        props.xScale.getValue(Math.max(0, Math.min(props.innerWidth, x)))
    );

    /**
     * The stretch a period covers, as { leftPx, widthPx } in the container's pixels and
     * { leftX, rightX } in the plot's own coordinates.  The period is measured the way the chart's
     * own marks are, so the band holds the bar or point drawn for it.  A period the axis has next
     * to no room for is still given a pixel to be seen by.
     */
    const bandForPeriod = (props, period, scaleX) => {

        const span = Ren.DateValueChartCalculator.axisPeriodSpan(props, period.date);

        if (!span || !span.start || !span.end) {

            return {
                leftPx: period.x * scaleX,
                widthPx: 1,
                leftX: period.x,
                rightX: period.x
            };
        }

        const leftX = props.xScale.getPixel(span.start);
        const rightX = props.xScale.getPixel(span.end);
        const leftPx = leftX * scaleX;
        const widthPx = Math.max(1, rightX * scaleX - leftPx);

        return { leftPx, widthPx, leftX, rightX };
    };

    /**
     * Prints the date at the foot of the band and draws the ground it sits on around it.  The
     * label is kept within the plot, so that one at either end of the axis is not left hanging off
     * the chart.
     */
    const drawLabel = (props, elements, text, xPx, topPx) => {

        const groundHeight = LABEL_FONT_SIZE_PX + LABEL_PADDING_Y_PX * 2;

        // The text is centred in its ground rather than sat on a baseline worked out from the
        // font size, which leaves a date with a descender in it hanging out of the bottom.
        elements.labelText.setAttribute("y", topPx + groundHeight / 2);
        elements.labelText.textContent = text ?? "";

        const textWidth = elements.labelText.getComputedTextLength();
        const groundWidth = textWidth + LABEL_PADDING_X_PX * 2;
        const widthPx = props.innerWidth * (props.scaleX || 1);
        const centrePx = Math.max(
            groundWidth / 2,
            Math.min(widthPx - groundWidth / 2, xPx)
        );

        elements.labelText.setAttribute("x", centrePx);

        Ren.Svg.setAttrs(elements.labelGround, {
            "x": centrePx - groundWidth / 2,
            "y": topPx,
            "width": groundWidth,
            "height": groundHeight
        });
    };

    /**
     * Draws the chart's hover band over a period, or hides it where the pointer is not
     * reading the chart.  Positions are in the container's pixels, which is what the group is in.
     *
     * A band shown for another chart's hovered date is left out of the diagnostics, which describe
     * the chart under the pointer.
     */
    const showAtPeriod = (props, elements, period, isMirrored) => {

        if (!period) {

            Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-date-line", false);

            if (isMirrored) return;

            lastResult = {
                shown: false,
                date: null,
                label: null,
                isNonWorking: false,
                fullHeight: false,
                xPx: null,
                values: null
            };

            return;
        }

        const scaleX = props.scaleX || 1;
        const scaleY = props.scaleY || 1;
        const band = bandForPeriod(props, period, scaleX);
        const xPx = band.leftPx + band.widthPx / 2;
        const axisPx = props.innerHeight * scaleY;
        const label = formatDate(props, period.date);
        const isNonWorking = isNonWorkingDate(props, period.date);

        Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-date-line", true);

        const showsLabel = props.showHoverDateLine === true;
        const showsValues = elements.valuesBox !== null;

        elements.labelText.setAttribute(
            "fill",
            isNonWorking ? NON_WORKING_LABEL_COLOUR : LABEL_COLOUR
        );

        // The band hangs below the axis by default: run up the chart it is drawn over the values
        // it is there to help read.  A chart asking for the full height gets it carried to the top
        // of the plot instead.
        const topPx = props.hoverDateLineFullHeight === true ? 0 : axisPx;

        // The label sits at the foot of the space the chart reserved for it, and the band runs down
        // the axis labels to meet it: a label left floating clear of the band reads as belonging to
        // neither period.
        const marginPx = props.margin ? props.margin.bottom : AXIS_OVERSHOOT_PX;
        const stripTopPx = Math.max(
            axisPx + AXIS_OVERSHOOT_PX,
            axisPx + marginPx - getReservedHeightPx(props) + LABEL_GAP_PX
        );

        // The values box takes the top of the strip where no date is printed above it.
        const valuesTopPx = showsLabel
            ? stripTopPx + getLabelGroundHeightPx() + LABEL_GAP_PX
            : stripTopPx;

        // With neither the label nor the box there is nothing below the axis to meet, so the band
        // stops at it.
        const bottomPx = showsLabel || showsValues ? stripTopPx : axisPx;

        Ren.Svg.setAttrs(elements.band, {
            "x": band.leftPx,
            "y": topPx,
            "width": band.widthPx,
            "height": Math.max(AXIS_OVERSHOOT_PX, bottomPx - topPx)
        });

        if (showsLabel) drawLabel(props, elements, label, xPx, stripTopPx);

        const values = showsValues
            ? elements.valuesBox.showAtPeriod(band, xPx, valuesTopPx)
            : null;

        if (isMirrored) return;

        lastResult = {
            shown: true,
            date: Ren.DateUtils.toSortableDate(period.date),
            label: showsLabel ? label : null,
            isNonWorking,
            fullHeight: topPx === 0,
            xPx,
            values
        };
    };

    /**
     * Gets a value indicating whether a pointer position, in the container's pixels from the
     * plot's top left, is one the chart is being read at.
     */
    const isOverPlot = (props, xPx, yPx) => {

        const widthPx = props.innerWidth * (props.scaleX || 1);
        const heightPx = props.innerHeight * (props.scaleY || 1);

        // Below the plot the chart is still being read as far down as the axis labels and the
        // hint's own space beneath them, so the whole bottom margin counts as reading the chart.
        const belowPx = Math.max(
            AXIS_OVERSHOOT_PX,
            props.margin ? props.margin.bottom : AXIS_OVERSHOOT_PX
        );

        return xPx >= -POINTER_MARGIN_PX
            && xPx <= widthPx + POINTER_MARGIN_PX
            && yPx >= -POINTER_MARGIN_PX
            && yPx <= heightPx + POINTER_MARGIN_PX + belowPx;
    };

    /**
     * Draws a chart's hover band and starts following the pointer over it.  The band belongs to the
     * chart group and the handlers to the svg, so both go with the chart when it is drawn again.
     *
     * @param {object} props - The chart's props, holding the svg and chart group drawn into, the
     *     x scale the axis was drawn from, and the plot's size in its own coordinates.
     */
    const attach = (props) => {

        if (!props.svg || !props.chartGroup || !props.xScale) return;

        // Left out of hit testing, since either the band or its label under the pointer would
        // otherwise take the hover off whatever is behind it.
        const group = Ren.Svg.append(props.chartGroup, "g", { "class": "ren-hover-date-line" });

        group.style.pointerEvents = "none";

        // The band shows its date only where the chart asks for the line, rather than the values
        // or the full height alone.
        const showsLabel = props.showHoverDateLine === true;

        Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-date-line", false);
        Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-date-line-ground", showsLabel);
        Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-date-line-label", showsLabel);

        const elements = {
            group,
            // Faint enough to read the plot through, since over the chart it covers whatever is
            // drawn for the period.
            band: Ren.Svg.append(group, "rect", {
                "class": "ren-hover-date-band",
                "fill": BAND_COLOUR,
                "fill-opacity": BAND_OPACITY,
                "shape-rendering": "crispEdges"
            }),

            // Given a ground of its own, so that it is not read over whichever axis label it
            // covers.
            labelGround: Ren.Svg.append(group, "rect", {
                "class": "ren-hover-date-line-ground",
                "fill": "#ffffff",
                "stroke": "#d0d0d0",
                "rx": 2
            }),

            labelText: Ren.Svg.setStyles(
                Ren.Svg.append(group, "text", {
                    "class": "ren-hover-date-line-label",
                    "text-anchor": "middle",
                    "dominant-baseline": "central",
                    "font-size": LABEL_FONT_SIZE_PX,
                    "fill": LABEL_COLOUR
                }),
                { "user-select": "none" }
            ),

            // Built with the band, so the rows it lists are the series the chart was drawn with.
            valuesBox: props.showHoverValues === true
                ? Ren.DateValueChart_HoverValues.create(props, group)
                : null
        };

        const chartGroupNode = props.chartGroup;

        // Announced only as the band moves to another period, rather than on every pointer move.
        let announcedTime = null;

        const showAndAnnounce = (period) => {

            showAtPeriod(props, elements, period, false);

            const time = period ? period.date.getTime() : null;

            if (time === announcedTime || !props.visualisation) return;

            // A chart without a date column hovers over no date the others share.
            if (props.hasDateColumn === false) return;

            announcedTime = time;

            Ren.DateValueChart_DateRange_Following.notifyHoveredDate(
                props.visualisation,
                period ? period.date : null
            );
        };

        props.svg.onmousemove = (event) => {

            // The chart group carries the margins but none of the plot's scaling, so a pointer
            // read against it is in the container's pixels from the plot's top left.
            const pointer = Ren.Svg.pointer(event, chartGroupNode);

            if (!isOverPlot(props, pointer[0], pointer[1])) {

                showAndAnnounce(null);

                return;
            }

            showAndAnnounce(periodAtPlotX(props, pointer[0] / (props.scaleX || 1)));
        };

        props.svg.onmouseleave = () => showAndAnnounce(null);

        // Replaced on each render, so another chart's hovered date is drawn into the current band.
        props.showHoveredDate = (date) => {

            showAtPeriod(props, elements, periodForDate(props, date), true);
        };
    };

    return {
        attach,
        formatDate,
        periodForDate,
        bandForPeriod,
        getReservedHeightPx,
        getDiagnostics
    };
})();
