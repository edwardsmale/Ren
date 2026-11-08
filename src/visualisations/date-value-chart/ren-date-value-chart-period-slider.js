/**
 * The date slider: a timeline beneath a date/value chart's plot, lined up with it, running from
 * the first period its data holds to the last - each month, quarter or year drawn to scale - with
 * a window over the dates the chart shows.  Dragging the window, or clicking a period, sets the
 * chart's date range to that period as it goes, and "All" clears it.  Dragging either end of the
 * window takes in more or fewer periods, and so draws a multi-chart as more or fewer charts.  Its
 * periods are always coarser than the chart's own bins, so that each is several bars wide.
 */
Ren.DateValueChart_PeriodSlider = (() => {

    const CLASS_NAME = "ren-date-value-chart-period-slider";

    const ALL_LABEL = "All";

    const WINDOW_COLOUR = "#3366cc";
    const WINDOW_FILL = "rgba(51, 102, 204, 0.18)";
    const YEAR_DIVIDER_COLOUR = "#b0b0b0";
    const LABEL_GAP_PX = 6;
    const WINDOW_TRANSITION = "left 0.1s ease, width 0.1s ease";

    // The periods shift and an arrow key move the window's end by.
    const RESIZE_STEPS = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

    const DateRange = () => Ren.DateValueChart_DateRange;

    /**
     * Gets the period a slider steps by from its stored unit ("month", "quarter" or "year"), or
     * null where the chart has no slider.
     */
    const getPeriod = (unit) => {

        switch (unit) {

            case "month": return Ren.DatePeriodEnum.Month;
            case "quarter": return Ren.DatePeriodEnum.Quarter;
            case "year": return Ren.DatePeriodEnum.Year;
            default: return null;
        }
    };

    /**
     * Gets the period the chart's own bars are drawn at.
     */
    const getBinPeriod = (props) =>
        Ren.DateValueChart_GroupingApplyer.getEffectiveBinPeriod(props)
            ?? props.datePeriod
            ?? Ren.DatePeriodEnum.Day;

    /**
     * Gets a value indicating whether a chart can have a slider stepping by a stored unit, which
     * must be coarser than its bars, as a period of one bar would leave the chart a single bar.
     */
    const canStepBy = (props, unit) => {

        const datePeriod = getPeriod(unit);

        return !!datePeriod && !props.isAllTime && datePeriod > getBinPeriod(props);
    };

    /**
     * Gets the stops for the periods the rows hold dates in, oldest first and after the "All"
     * stop, each as { range, label } where the range is the one stored on the chart.  Contiguous
     * stops take in the periods between that hold no dates, so as to make a timeline.
     */
    const getStops = (rows, dateHeading, datePeriod, isContiguous) => {

        const stops = [{ range: null, label: ALL_LABEL }];

        if (!rows || !dateHeading || !datePeriod) return stops;

        const starts = {};
        let previousDay = null;

        for (let index = 0; index < rows.length; index++) {

            const date = DateRange().toComparableDate(rows[index][dateHeading]);

            if (date === null) continue;

            // Rows come mostly in date order, so a day is floored once for its run of rows.
            const day = date.substring(0, 10);

            if (day === previousDay) continue;

            previousDay = day;
            starts[DateRange().floorToPeriod(day, datePeriod)] = true;
        }

        const sortedStarts = Object.keys(starts).sort();
        const fromDates = isContiguous ? fillGaps(sortedStarts, datePeriod) : sortedStarts;

        for (let index = 0; index < fromDates.length; index++) {

            const from = fromDates[index];
            const to = DateRange().getInclusiveTo(DateRange().addPeriods(from, datePeriod, 1));
            const range = { from, to };

            stops.push({ range, label: DateRange().describe(range) });
        }

        return stops;
    };

    const fillGaps = (sortedStarts, datePeriod) => {

        if (sortedStarts.length === 0) return sortedStarts;

        const last = sortedStarts[sortedStarts.length - 1];
        const filled = [];
        let from = sortedStarts[0];

        while (from <= last) {

            filled.push(from);
            from = DateRange().addPeriods(from, datePeriod, 1);
        }

        return filled;
    };

    /**
     * Gets the index of the stop for a stored range, or -1 where the range is none of them.
     */
    const findStopIndex = (stops, range) => {

        for (let index = 0; index < stops.length; index++) {

            if (DateRange().isSameRange(stops[index].range, range)) return index;
        }

        return -1;
    };

    /**
     * Gets the stops a stored range runs from and to, as { first, last }, or null where it does
     * not start and end with them.  No range is the "All" stop alone.
     */
    const findSpan = (stops, range) => {

        const stopIndex = findStopIndex(stops, range);

        if (stopIndex >= 0) return { first: stopIndex, last: stopIndex };

        if (!DateRange().isSameRange({ from: range.from, to: range.to }, range)) return null;

        let first = -1;

        for (let index = 1; index < stops.length; index++) {

            if (first < 0 && stops[index].range.from === range.from) first = index;

            if (first > 0 && stops[index].range.to === range.to) return { first, last: index };
        }

        return null;
    };

    /**
     * Gets a chart's timeline, as { stops, extent }, worked out again only once its rows or period
     * change.
     */
    const getChartTimeline = (props, datePeriod) => {

        const cached = props.periodSliderStops;

        if (cached
            && cached.rows === props.rawInputData
            && cached.datePeriod === datePeriod
            && cached.dateHeading === props.dateHeading) {

            return cached.timeline;
        }

        const timeline = {
            stops: getStops(props.rawInputData, props.dateHeading, datePeriod, true),
            extent: DateRange().getDataExtent(props.rawInputData, props.dateHeading)
        };

        props.periodSliderStops = {
            rows: props.rawInputData,
            datePeriod,
            dateHeading: props.dateHeading,
            timeline
        };

        return timeline;
    };

    /**
     * Gets where each stop's period starts and ends along the timeline, as fractions of it, with
     * the first and last times it spans.
     */
    const getBounds = (stops, datePeriod) => {

        const toTime = DateRange().toTime;
        const lastFrom = stops[stops.length - 1].range.from;
        const firstTime = toTime(stops[1].range.from);
        const span = toTime(DateRange().addPeriods(lastFrom, datePeriod, 1)) - firstTime;
        const bounds = [null];

        for (let index = 1; index < stops.length; index++) {

            const from = stops[index].range.from;
            const end = toTime(DateRange().addPeriods(from, datePeriod, 1));

            bounds.push({
                start: (toTime(from) - firstTime) / span,
                end: (end - firstTime) / span
            });
        }

        return { bounds, firstTime, span };
    };

    /**
     * Gets a period's label beneath the timeline: its year, quarter or month alone, as the year
     * of a quarter or month is written in the row below.
     */
    const getPeriodText = (from, datePeriod) => {

        const month = Number(from.substring(5, 7));

        if (datePeriod === Ren.DatePeriodEnum.Year) return from.substring(0, 4);

        if (datePeriod === Ren.DatePeriodEnum.Quarter) return "Q" + Math.ceil(month / 3);

        return Ren.DateUtils.monthNamesAbbrv[month - 1];
    };

    /**
     * Gets a period's position in its year (or the year itself, for years), from which the
     * labels kept where there is no room for them all are picked, so that they fall evenly.
     */
    const getPeriodNumber = (from, datePeriod) => {

        const month = Number(from.substring(5, 7));

        if (datePeriod === Ren.DatePeriodEnum.Year) return Number(from.substring(0, 4));

        if (datePeriod === Ren.DatePeriodEnum.Quarter) return (month - 1) / 3;

        return month - 1;
    };

    /**
     * Gets every how many periods a label can be kept, finest first.
     */
    const getLabelSteps = (datePeriod) => {

        if (datePeriod === Ren.DatePeriodEnum.Year) return [1, 2, 5, 10, 20, 50, 100];

        if (datePeriod === Ren.DatePeriodEnum.Quarter) return [1, 2, 4];

        return [1, 2, 3, 6, 12];
    };

    const applyRange = (props, range) => {

        const visualisation = props.visualisation;

        DateRange().applyToChart(visualisation, props, range);
        DateRange().notifyRangeChanged(visualisation, range);
    };

    /**
     * Gets the range stored for a stop: those of the periods its window ends with, or none for
     * "All".  A multi-chart's latest periods are stored as no range, so that it keeps to the
     * latest as the data moves on.
     */
    const getStopRange = (slider, stopIndex) => {

        const stops = slider.renStops;
        const windowSize = slider.renWindowSize;

        if (slider.renIsMultiChart && stopIndex === stops.length - 1) return null;

        if (stopIndex === 0 || windowSize === 1) return stops[stopIndex].range;

        return {
            from: stops[stopIndex - windowSize + 1].range.from,
            to: stops[stopIndex].range.to
        };
    };

    /**
     * Gets the stop a window ends at, kept to the timeline.
     */
    const clampStopIndex = (slider, stopIndex) => stopIndex === 0 && !slider.renIsMultiChart
        ? 0
        : Math.min(Math.max(stopIndex, slider.renWindowSize), slider.renStops.length - 1);

    /**
     * Gets the stops the chart's stored range runs from and to, as { first, last }, or null where
     * it does not start and end with them.
     */
    const findSelectedSpan = (slider, range) => {

        if (!slider.renIsMultiChart) return findSpan(slider.renStops, range);

        for (let index = slider.renWindowSize; index < slider.renStops.length; index++) {

            if (DateRange().isSameRange(getStopRange(slider, index), range)) {
                return { first: index - slider.renWindowSize + 1, last: index };
            }
        }

        return null;
    };

    /**
     * Gets the stops a slider's window runs from and to, as { first, last }, the whole timeline
     * for "All".
     */
    const getWindowSpan = (slider) => slider.renStopIndex === 0
        ? { first: 1, last: slider.renStops.length - 1 }
        : {
            first: slider.renStopIndex - slider.renWindowSize + 1,
            last: slider.renStopIndex
        };

    /**
     * Sets the chart's range to a stop's, unless it is already there.
     */
    const select = (slider, stopIndex) => {

        if (stopIndex < 0) return;

        stopIndex = clampStopIndex(slider, stopIndex);

        if (stopIndex === slider.renStopIndex) return;

        slider.renStopIndex = stopIndex;
        applyRange(slider.renProps, getStopRange(slider, stopIndex));
    };

    /**
     * Gets the most periods a slider's window can take in.  A multi-chart's slider is only drawn
     * where the data holds more periods than it has charts, so it keeps one out.
     */
    const getMaxWindowSize = (slider) => slider.renIsMultiChart
        ? Math.min(slider.renStops.length - 2, Ren.DateValueChart_MultiChartWheel.MAX_CHART_COUNT)
        : slider.renStops.length - 1;

    /**
     * Sets the chart's range to the periods from one stop to another, unless it is already there.
     * A multi-chart is drawn as one chart for each of them, as zooming it with the wheel does, and
     * the charts drawn as its count before are drawn as the new count too.
     */
    const selectSpan = (slider, first, last) => {

        const windowSize = last - first + 1;
        const isResized = windowSize !== slider.renWindowSize;

        if (last === slider.renStopIndex && !isResized) return;

        const props = slider.renProps;
        const visualisation = props.visualisation;
        const current = DateRange().getRange(visualisation?.chartDataGroupingSettings);
        const previousSignature = DateRange().getRangeSignature(visualisation);

        slider.renStopIndex = last;
        slider.renWindowSize = windowSize;

        if (!slider.renIsMultiChart) {

            applyRange(props, getStopRange(slider, last));

            return;
        }

        if (isResized) {

            Ren.DateValueChart_MultiChart.setMaxChartCount(visualisation, props, windowSize);
        }

        const range = getStopRange(slider, last);

        if (DateRange().isSameRange(range, current)) {

            // Only the count of charts has changed, which leaves the range nothing to redraw.
            Ren.VisualisationSettingsSynchroniser.commitChange(
                visualisation,
                props.redrawVisualisation
            );
        }
        else {

            DateRange().applyToChart(visualisation, props, range);
        }

        DateRange().notifyRangeChanged(visualisation, range, previousSignature);
    };

    /**
     * Moves one end of the window to the period boundary nearest a point across the timeline,
     * keeping at least one period in it, and no more than it can take in.
     */
    const resizeTo = (slider, edge, clientX) => {

        const rect = slider.renTrack.getBoundingClientRect();

        if (!rect.width) return;

        const bounds = slider.renBounds;
        const fraction = (clientX - rect.left) / rect.width;
        const span = getWindowSpan(slider);
        let nearest = 1;

        for (let index = 2; index < bounds.length; index++) {

            const boundary = edge === "start" ? bounds[index].start : bounds[index].end;
            const nearestBoundary = edge === "start" ? bounds[nearest].start : bounds[nearest].end;

            if (Math.abs(boundary - fraction) < Math.abs(nearestBoundary - fraction)) {
                nearest = index;
            }
        }

        const maxWindowSize = getMaxWindowSize(slider);

        if (edge === "start") {

            const first = Math.min(nearest, span.last);

            selectSpan(slider, Math.max(first, span.last - maxWindowSize + 1), span.last);
        }
        else {

            const last = Math.max(nearest, span.first);

            selectSpan(slider, span.first, Math.min(last, span.first + maxWindowSize - 1));
        }
    };

    /**
     * Gets the index of the stop whose period lies under a point across the timeline, taking the
     * first or last where the point is beyond it.  A window several periods wide is centred on
     * the point, so is taken to end that many periods on.
     */
    const getStopIndexAt = (slider, clientX) => {

        const rect = slider.renTrack.getBoundingClientRect();

        if (!rect.width) return -1;

        const bounds = slider.renBounds;
        const fraction = (clientX - rect.left) / rect.width
            + (slider.renWindowSize - 1) / 2 / (bounds.length - 1);

        for (let index = 1; index < bounds.length; index++) {

            if (fraction < bounds[index].end) return index;
        }

        return bounds.length - 1;
    };

    const appendDiv = (parent, suffix, styles) => {

        const node = document.createElement("div");

        node.className = CLASS_NAME + "__" + suffix;
        Ren.Svg.setStyles(node, styles);
        parent.appendChild(node);

        return node;
    };

    const createAllButton = (slider) => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = CLASS_NAME + "__all";
        button.textContent = ALL_LABEL;
        button.title = "Show every date";

        Ren.Svg.setStyles(button, {
            "grid-column": "1",
            "grid-row": "1",
            "justify-self": "end",
            "margin": "0 8px 0 4px",
            "padding": "0 6px",
            "font": "inherit",
            "line-height": "14px",
            "color": "inherit",
            "border": "1px solid #c8c8c8",
            "border-radius": "3px",
            "background": "white",
            "cursor": "pointer"
        });

        button.addEventListener("click", () => select(slider, 0));

        slider.appendChild(button);

        return button;
    };

    /**
     * Puts an unseen strip over one end of the window, centred on its border, for that end to be
     * dragged.  Only the cursor shows it is there.
     */
    const createHandle = (slider, edge) => {

        const handle = appendDiv(slider.renWindow, "handle", {
            "position": "absolute",
            "top": "-2px",
            "bottom": "-2px",
            "left": edge === "start" ? "-7px" : null,
            "right": edge === "end" ? "-7px" : null,
            "width": "12px",
            "cursor": "ew-resize",
            "pointer-events": "auto",
            "touch-action": "none"
        });

        handle.classList.add(CLASS_NAME + "__handle--" + edge);

        return handle;
    };

    const createTrack = (slider, stops, datePeriod) => {

        const track = appendDiv(slider, "track", {
            "grid-column": "2",
            "grid-row": "1",
            "position": "relative",
            "height": "16px",
            "background": "#ececec",
            "border-radius": "3px",
            "cursor": "pointer",
            "touch-action": "none",
            "outline": "none"
        });

        track.tabIndex = 0;
        track.setAttribute("role", "slider");
        track.setAttribute("aria-label", "Date");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", String(stops.length - 1));

        const bounds = slider.renBounds;

        // Quarters and months are divided into years more boldly than among themselves.
        for (let index = 1; index < stops.length; index++) {

            const isYearStart = datePeriod !== Ren.DatePeriodEnum.Year
                && stops[index].range.from.substring(5) === "01-01";

            const segment = appendDiv(track, "period", {
                "position": "absolute",
                "top": "0",
                "bottom": "0",
                "left": bounds[index].start * 100 + "%",
                "width": (bounds[index].end - bounds[index].start) * 100 + "%",
                "box-sizing": "border-box",
                "border-left": index === 1
                    ? null
                    : "1px solid " + (isYearStart ? YEAR_DIVIDER_COLOUR : "white")
            });

            segment.title = stops[index].label;
        }

        slider.renWindow = appendDiv(track, "window", {
            "position": "absolute",
            "top": "0",
            "bottom": "0",
            "box-sizing": "border-box",
            "border": "2px solid " + WINDOW_COLOUR,
            "border-radius": "3px",
            "background": WINDOW_FILL,
            "pointer-events": "none",
            "transition": WINDOW_TRANSITION
        });

        slider.renHandles = [createHandle(slider, "start"), createHandle(slider, "end")];

        return track;
    };

    const createPeriodLabels = (slider, stops, datePeriod) => {

        const row = appendDiv(slider, "labels", {
            "grid-column": "2",
            "grid-row": "2",
            "position": "relative",
            "height": "13px"
        });

        const bounds = slider.renBounds;
        const labelNodes = [null];

        for (let index = 1; index < stops.length; index++) {

            const label = document.createElement("span");

            label.textContent = getPeriodText(stops[index].range.from, datePeriod);

            Ren.Svg.setStyles(label, {
                "position": "absolute",
                "left": (bounds[index].start + bounds[index].end) * 50 + "%",
                "transform": "translateX(-50%)",
                "white-space": "nowrap"
            });

            row.appendChild(label);
            labelNodes.push(label);
        }

        return labelNodes;
    };

    /**
     * Writes each year beneath the quarters or months it holds.
     */
    const createYearLabels = (slider, stops) => {

        const row = appendDiv(slider, "years", {
            "grid-column": "2",
            "grid-row": "3",
            "position": "relative",
            "height": "13px"
        });

        const bounds = slider.renBounds;
        const yearNodes = [];
        let groupStart = 1;

        for (let index = 1; index < stops.length; index++) {

            const year = stops[index].range.from.substring(0, 4);
            const isLastOfYear = index === stops.length - 1
                || stops[index + 1].range.from.substring(0, 4) !== year;

            if (!isLastOfYear) continue;

            const group = appendDiv(row, "year", {
                "position": "absolute",
                "top": "0",
                "bottom": "0",
                "left": bounds[groupStart].start * 100 + "%",
                "width": (bounds[index].end - bounds[groupStart].start) * 100 + "%",
                "box-sizing": "border-box",
                "border-left": groupStart === 1 ? null : "1px solid " + YEAR_DIVIDER_COLOUR,
                "text-align": "center",
                "overflow": "hidden"
            });

            const label = document.createElement("span");

            label.textContent = year;
            group.appendChild(label);
            yearNodes.push(label);

            groupStart = index + 1;
        }

        return yearNodes;
    };

    /**
     * Shows as many of the period labels as there is room for, evenly, always showing the one for
     * the period selected, and the years whose quarters or months are wide enough to hold them.
     */
    const layoutLabels = (slider) => {

        const width = slider.renTrack.clientWidth;

        if (!width) return;

        const labelNodes = slider.renLabelNodes;
        const bounds = slider.renBounds;
        const stops = slider.renStops;
        const datePeriod = slider.renDatePeriod;
        const selectedIndex = slider.renStopIndex;
        const firstSelectedIndex = selectedIndex - slider.renWindowSize + 1;
        const labelWidths = [0];
        let widest = 0;
        let narrowest = 1;

        for (let index = 1; index < labelNodes.length; index++) {

            const isSelected = selectedIndex > 0
                && index >= firstSelectedIndex
                && index <= selectedIndex;

            Ren.Svg.setStyles(labelNodes[index], {
                "display": null,
                "font-weight": isSelected ? "bold" : null,
                "color": isSelected ? "#222222" : null
            });

            labelWidths.push(labelNodes[index].offsetWidth);
            widest = Math.max(widest, labelWidths[index]);
            narrowest = Math.min(narrowest, bounds[index].end - bounds[index].start);
        }

        const steps = getLabelSteps(datePeriod);
        let step = 0;

        for (let index = 0; index < steps.length; index++) {

            if (width * narrowest * steps[index] >= widest + LABEL_GAP_PX) {

                step = steps[index];
                break;
            }
        }

        const getCentre = (index) => width * (bounds[index].start + bounds[index].end) / 2;

        for (let index = 1; index < labelNodes.length; index++) {

            const number = getPeriodNumber(stops[index].range.from, datePeriod);
            let isShown = index === selectedIndex || (step > 0 && number % step === 0);

            // The selected label is shown whether or not it falls on a step, so others give way.
            if (isShown && selectedIndex > 0 && index !== selectedIndex) {

                const room = (labelWidths[index] + labelWidths[selectedIndex]) / 2 + LABEL_GAP_PX;

                isShown = Math.abs(getCentre(index) - getCentre(selectedIndex)) >= room;
            }

            if (!isShown) labelNodes[index].style.display = "none";
        }

        const yearNodes = slider.renYearNodes;

        for (let index = 0; index < yearNodes.length; index++) {

            const group = yearNodes[index].parentNode;

            yearNodes[index].style.visibility =
                yearNodes[index].offsetWidth + LABEL_GAP_PX <= group.clientWidth ? "" : "hidden";
        }
    };

    /**
     * Moves a slider's window over the dates its chart shows: a period's, or the whole timeline
     * for "All".  A range set some other way, such as by zooming, is drawn where it falls, dashed.
     */
    const showRange = (slider) => {

        const props = slider.renProps;
        const stops = slider.renStops;
        const range = DateRange().getRange(props.visualisation?.chartDataGroupingSettings);
        const span = findSelectedSpan(slider, range);
        const stopIndex = span ? span.last : -1;

        // "All" keeps the window's width for the next period picked.
        if (stopIndex > 0) slider.renWindowSize = span.last - span.first + 1;

        const firstIndex = stopIndex > 0 ? span.first : stopIndex;
        let start = 0;
        let end = 1;

        if (stopIndex > 0) {

            start = slider.renBounds[firstIndex].start;
            end = slider.renBounds[stopIndex].end;
        }
        else if (stopIndex < 0) {

            const resolved = DateRange().resolveFromExtent(
                slider.renExtent,
                getBinPeriod(props),
                range
            );

            const toFraction = (boundary) => Math.min(Math.max(
                (DateRange().toTime(boundary) - slider.renFirstTime) / slider.renSpan,
                0
            ), 1);

            if (resolved) {

                start = resolved.from ? toFraction(resolved.from) : 0;
                end = resolved.toExclusive ? toFraction(resolved.toExclusive) : 1;
            }
        }

        slider.renStopIndex = stopIndex;

        Ren.Svg.setStyles(slider.renWindow, {
            "left": start * 100 + "%",
            "width": (end - start) * 100 + "%",
            "border-style": stopIndex < 0 ? "dashed" : "solid"
        });

        // A range that is no run of periods has no ends to drag.
        for (let index = 0; index < slider.renHandles.length; index++) {

            slider.renHandles[index].style.display = stopIndex < 0 ? "none" : "";
        }

        let text = DateRange().describe(range) || ALL_LABEL;

        if (stopIndex >= 0) {

            text = firstIndex === stopIndex
                ? stops[stopIndex].label
                : stops[firstIndex].label + " to " + stops[stopIndex].label;
        }

        slider.renTrack.setAttribute("aria-valuenow", String(Math.max(stopIndex, 0)));
        slider.renTrack.setAttribute("aria-valuetext", text);

        const allButton = slider.renAllButton;

        if (allButton) {

            allButton.setAttribute("aria-pressed", String(stopIndex === 0));
            Ren.Svg.setStyles(allButton, {
                "background": stopIndex === 0 ? WINDOW_FILL : "white",
                "border-color": stopIndex === 0 ? WINDOW_COLOUR : "#c8c8c8"
            });
        }

        layoutLabels(slider);
    };

    /**
     * Gets which end of the window a handle pressed at a point drags.  Where the window is narrow
     * enough for its handles to overlap, the point's side of its middle decides.
     */
    const getHandleEdge = (slider, target, clientX) => {

        if (slider.renHandles.indexOf(target) < 0) return null;

        const rect = slider.renWindow.getBoundingClientRect();

        return clientX < rect.left + rect.width / 2 ? "start" : "end";
    };

    /**
     * Lets the window be dragged, a period clicked, or the arrow keys step through the periods,
     * with "All" before the first.  Its handles, or shift with the arrow keys, move its ends.  The
     * chart follows each period as it is reached.
     */
    const listen = (slider) => {

        const track = slider.renTrack;

        const endDrag = (event) => {

            if (track.hasPointerCapture(event.pointerId)) {
                track.releasePointerCapture(event.pointerId);
            }

            slider.renDragEdge = null;
            track.style.cursor = "pointer";
            slider.renWindow.style.transition = WINDOW_TRANSITION;
        };

        track.addEventListener("pointerdown", (event) => {

            if (event.button !== 0) return;

            // Keeps the drag from selecting text, which leaves focus to be given explicitly.
            event.preventDefault();
            track.focus({ preventScroll: true });
            track.setPointerCapture(event.pointerId);

            // The window keeps up with the pointer, rather than sliding after it.
            slider.renWindow.style.transition = "none";

            slider.renDragEdge = getHandleEdge(slider, event.target, event.clientX);

            if (slider.renDragEdge) {

                track.style.cursor = "ew-resize";

                return;
            }

            track.style.cursor = "grabbing";
            select(slider, getStopIndexAt(slider, event.clientX));
        });

        track.addEventListener("pointermove", (event) => {

            if (!track.hasPointerCapture(event.pointerId)) return;

            if (slider.renDragEdge) {
                resizeTo(slider, slider.renDragEdge, event.clientX);
            }
            else {

                select(slider, getStopIndexAt(slider, event.clientX));
            }
        });

        track.addEventListener("pointerup", endDrag);
        track.addEventListener("pointercancel", endDrag);

        track.addEventListener("keydown", (event) => {

            const last = slider.renStops.length - 1;
            const current = Math.max(slider.renStopIndex, 0);
            let stopIndex = null;

            const resizeStep = RESIZE_STEPS[event.key];

            if (event.shiftKey && resizeStep && slider.renStopIndex > 0) {

                const span = getWindowSpan(slider);

                event.preventDefault();
                selectSpan(
                    slider,
                    span.first,
                    Math.min(
                        Math.max(span.last + resizeStep, span.first),
                        last,
                        span.first + getMaxWindowSize(slider) - 1
                    )
                );

                return;
            }

            switch (event.key) {

                case "ArrowRight":
                case "ArrowUp":
                    stopIndex = Math.min(current + 1, last);
                    break;
                case "ArrowLeft":
                case "ArrowDown":
                    // A window several periods wide steps back from the first to "All".
                    stopIndex = current - 1 < slider.renWindowSize && slider.renAllButton
                        ? 0
                        : Math.max(current - 1, 0);
                    break;
                case "Home":
                    stopIndex = 1;
                    break;
                case "End":
                    stopIndex = last;
                    break;
                case "Escape":
                    // A multi-chart's slider has no "All", so goes back to the latest.
                    stopIndex = slider.renAllButton ? 0 : last;

                    if (stopIndex === slider.renStopIndex) stopIndex = null;

                    break;
            }

            if (stopIndex === null) return;

            event.preventDefault();
            select(slider, stopIndex);
        });
    };

    const createSlider = (props, timeline, datePeriod, windowSize, isMultiChart) => {

        const slider = document.createElement("div");
        const stops = timeline.stops;
        const { bounds, firstTime, span } = getBounds(stops, datePeriod);

        slider.className = CLASS_NAME;

        Ren.Svg.setStyles(slider, {
            "flex": "0 0 auto",
            "display": "grid",
            "row-gap": "2px",
            "align-items": "center",
            "padding": "6px 0 4px",
            "font-size": "11px",
            "line-height": "13px",
            "color": "#666666",
            "background": "white",
            "border-top": "1px solid #e0e0e0",
            "box-sizing": "border-box",
            "user-select": "none"
        });

        slider.renProps = props;
        slider.renStops = stops;
        slider.renExtent = timeline.extent;
        slider.renDatePeriod = datePeriod;
        slider.renBounds = bounds;
        slider.renFirstTime = firstTime;
        slider.renSpan = span;
        slider.renStopIndex = -1;
        slider.renWindowSize = windowSize;
        slider.renIsMultiChart = isMultiChart;

        // A multi-chart always shows some periods, however few charts it has, so has no "All",
        // nor a plot to line up with.
        if (!isMultiChart) {

            slider.renAllButton = createAllButton(slider);
        }
        else {

            slider.renAllButton = null;
            slider.style.gridTemplateColumns = "8px 1fr 8px";
        }

        slider.renTrack = createTrack(slider, stops, datePeriod);
        slider.renLabelNodes = createPeriodLabels(slider, stops, datePeriod);
        slider.renYearNodes = datePeriod === Ren.DatePeriodEnum.Year
            ? []
            : createYearLabels(slider, stops);

        listen(slider);

        if (typeof ResizeObserver !== "undefined") {

            slider.renResizeObserver = new ResizeObserver(() => layoutLabels(slider));
            slider.renResizeObserver.observe(slider.renTrack);
        }

        return slider;
    };

    /**
     * Lines the timeline up with the plot, the "All" button standing in the margin to its left.
     */
    const align = (props) => {

        const container = document.querySelector("." + props.guid);
        const slider = container && container.querySelector(":scope > ." + CLASS_NAME);

        if (!slider || !props.margin) return;

        slider.style.gridTemplateColumns =
            `minmax(${props.margin.left}px, max-content) 1fr ${props.margin.right}px`;
    };

    const remove = (slider) => {

        if (slider.renResizeObserver) slider.renResizeObserver.disconnect();

        slider.remove();
    };

    /**
     * Draws the chart's slider beneath its plot, or removes the one it has where it has none.
     * Called once the plot's svg is in place, the slider going between it and the legend.
     */
    const render = (props) => {

        const container = document.querySelector("." + props.guid);

        if (!container) return;

        const previous = container.querySelector(":scope > ." + CLASS_NAME);
        const datePeriod = getPeriod(props.periodSlider);
        const settings = props.visualisation?.chartDataGroupingSettings;

        // One of a multi-chart's charts has a range of its own, which a slider would not change.
        const timeline = canStepBy(props, props.periodSlider)
            && !props.multiChartRange
            && !!props.svg
            && DateRange().canHoldRange(settings)
            ? getChartTimeline(props, datePeriod)
            : null;

        const stops = timeline && timeline.stops.length > 1 ? timeline.stops : null;

        // Each period dragged past redraws the chart, so the slider being dragged is kept, with
        // the new svg put in before it (see setupSvgAndGroups), as one put in its place would
        // drop the drag.
        if (previous
            && previous.renStops === stops
            && previous.renProps === props
            && !previous.renIsMultiChart
            && previous.previousSibling === props.svg) {

            align(props);
            showRange(previous);

            return;
        }

        // A slider moved by the keyboard is focused again once replaced.
        const hadFocus = !!previous && previous.contains(document.activeElement);

        if (previous) remove(previous);

        if (!stops) return;

        const slider = createSlider(props, timeline, datePeriod, 1, false);

        container.insertBefore(slider, props.svg.nextSibling);

        align(props);
        showRange(slider);

        if (hadFocus) slider.renTrack.focus({ preventScroll: true });
    };

    /**
     * Draws a multi-chart's slider beneath the grid of its charts, its window as many periods
     * wide as there are charts, where the data holds more periods than that.  Otherwise removes
     * the slider the chart has.  The charts are put in before a slider kept from the last draw,
     * as one put in its place would drop a drag.
     */
    const renderMultiChart = (props, container, grid) => {

        const previous = container.querySelector(":scope > ." + CLASS_NAME);
        const datePeriod = getPeriod(props.multiChartPeriod);
        const windowSize = Ren.DateValueChart_MultiChart.getMaxChartCount(props);

        const timeline = props.multiChartSlider
            && !!datePeriod
            && !props.isAllTime
            && DateRange().canHoldRange(props.visualisation?.chartDataGroupingSettings)
            ? getChartTimeline(props, datePeriod)
            : null;

        const stops = timeline && timeline.stops.length - 1 > windowSize ? timeline.stops : null;

        // The slider is kept as its window's ends are dragged, which change the count of charts.
        if (previous
            && previous.renStops === stops
            && previous.renProps === props
            && previous.renIsMultiChart
            && previous.previousSibling === grid) {

            previous.renWindowSize = windowSize;
            showRange(previous);

            return;
        }

        const hadFocus = !!previous && previous.contains(document.activeElement);

        if (previous) remove(previous);

        if (!stops) return;

        const slider = createSlider(props, timeline, datePeriod, windowSize, true);

        container.insertBefore(slider, grid.nextSibling);

        showRange(slider);

        if (hadFocus) slider.renTrack.focus({ preventScroll: true });
    };

    return {
        CLASS_NAME,
        align,
        canStepBy,
        findStopIndex,
        getPeriod,
        getStops,
        render,
        renderMultiChart
    };
})();
