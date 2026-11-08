/**
 * Settles where a date/value chart's marker labels are drawn, so that a chart carrying several
 * markers can still be read.
 *
 * The lines are drawn past the top of the plot area into a band of their own - reserved out of the
 * chart's top margin, so the band is beside the plot rather than over it - and the labels sit at
 * the tips of the lines, in lanes: a label goes in the lowest lane it is clear in, and its line is
 * drawn up to it, so a marker whose neighbour is too close sticks out further rather than colliding
 * with it.
 *
 * How much a chart's labels are allowed to say is settled by the layout it is given, kept on the
 * visualisation as markerLabelLayout:
 *
 *     "auto"       Staggered labels where they fit in the band, and numbers with a key beneath the
 *                  chart where they do not.  The default.
 *     "staggered"  Always the labels themselves; any that will not fit are dropped (their lines and
 *                  their hover text stay), rather than the chart being renumbered.
 *     "numbered"   Always numbers with a key, however few markers there are.
 *     "numbers"    Numbers alone, with no key: for a chart whose markers are numbered elsewhere,
 *                  or read from their hover text, and which wants nothing beneath it.
 *     "hover"      Lines with no labels at all: what each stands for is read by hovering it.
 *
 * Whichever is in force, a marker's full detail is always its hover text, so nothing settled here
 * loses information - only the amount of it printed on the chart.
 *
 * Labels are laid out here rather than where they are drawn because their size on screen is known
 * only once the style updater has laid the chart out: the plot area is scaled non-uniformly and the
 * labels counter-scaled against it.  The pass therefore runs after each restyle.
 *
 * Only labels drawn at the top take part.  A marker declaring labelPosition "bottom" is drawn under
 * the plot, there being no band there to stagger it in.
 *
 * Calendar markers are stacked in a track of their own, in the lanes above the other markers'.
 * Their labels are short and say what a number would, so they are never numbered: a layout that
 * numbers the other markers staggers these, and "hover" hides both.
 */
Ren.DateValueChart_MarkerLabels = (() => {

    // The layouts a chart can be given, as they are written on the visualisation.
    const LAYOUTS = {
        auto: "auto",
        staggered: "staggered",
        numbered: "numbered",
        numbers: "numbers",
        hover: "hover"
    };

    // Everything below is in visual pixels: the labels are counter-scaled against the plot area, so
    // their own coordinates are the pixels they are seen at whatever size the chart is drawn.

    // The size marker labels are drawn at.  Set here rather than left to the document's default so
    // that the room the band needs can be worked out before the labels exist (see estimateLanes),
    // and so that a chart's markers do not change size with the page they are put on.
    const LABEL_FONT_SIZE_PX = 12;

    // The baseline of the lowest lane, measured up from the top of the plot area.  Far enough up
    // that the flag of a label in that lane clears the topmost value on the y axis, which is drawn
    // centred on the top of the plot and so reaches above it: a flag hangs FLAG_PADDING_Y_PX plus
    // the text's descent below its baseline, and the value label half its own height above the
    // line, leaving a few pixels between the two.
    const BAND_BOTTOM_PX = 18;

    // The distance between one lane's baseline and the next's.  A flag stands LABEL_FONT_SIZE_PX
    // plus its padding tall, so this has to be the greater of the two by the gap wanted between
    // the flags of neighbouring lanes.
    const LANE_HEIGHT_PX = 20;

    // The gap two labels in the same lane have to leave each other to count as clear.  Labels that
    // touch read as one, so this is wider than the value labels ask for.
    const LABEL_GAP_PX = 8;

    // How far a marker's line is drawn past its label's baseline, so the label sits against the tip
    // of the line rather than beside its end.
    const LINE_OVER_LABEL_PX = 3;

    // The lanes a band is ever given.  A chart needing more than this has more labels than it can
    // print however they are stacked, and is numbered instead.
    const MAX_LANES = 5;

    // The top margin a chart with no markers keeps (see setChartDimensions), which the band is
    // reserved on top of.
    const BASE_TOP_MARGIN_PX = 20;

    // What a character of a label is taken to be worth while the room for the band is being
    // reserved, the labels not having been drawn - let alone measured - at that point.  Erring
    // high costs a lane that goes unused; erring low costs a label.
    const ESTIMATED_CHAR_WIDTH_PX = 6.9;

    // The flag drawn behind a label, and so the room a label takes beyond the text itself.
    const FLAG_PADDING_X_PX = 4;

    // The widest a flag is ever drawn.  A marker whose label is a sentence would otherwise reach
    // across the chart and leave every marker near it with nowhere to go, so a label wider than
    // this is cut short - the whole of it staying in the marker's hover text, and in the key.
    const MAX_FLAG_WIDTH_PX = 300;

    const ELLIPSIS = "…";

    // The widest a number label is ever drawn, a chart with more markers than this having far more
    // than it could number and still be read (see measureNumberLabels).
    const WIDEST_NUMBER_TEXT = "999";

    const FLAG_PADDING_Y_PX = 2;

    // How far to the side of its line a label sits.
    const LABEL_OFFSET_PX = 4;

    // Where a label's own text is kept while it is being shown as a number, so that a chart put
    // back to staggered labels has them to go back to.
    const LABEL_TEXT_ATTRIBUTE = "data-marker-label-text";

    // What each label's text was cut down to, or null where it fits as it is (see truncateLabels).
    // Labels are drawn at a size of this module's own choosing, so a text measures the same
    // whatever chart it is on and whatever size that chart is drawn at.
    const truncatedTextCache = new Map();

    // The box a label's text takes, kept as offsets from the label's own x and y so that a flag can
    // be sized from where the label now stands without measuring it again (see sizeFlag).  Keyed by
    // the text as drawn and the side of its line it is anchored to.
    const labelBoxCache = new Map();

    /** What the last pass settled on, exposed through the QA hooks. */
    let lastResult = {
        layout: LAYOUTS.auto,
        applied: LAYOUTS.auto,
        lanes: 0,
        placed: 0,
        hidden: 0
    };

    const getDiagnostics = () => lastResult;

    /** Gets a value indicating whether a layout draws numbers in place of the labels themselves. */
    const isNumberedLayout = (layout) =>
        layout === LAYOUTS.numbered || layout === LAYOUTS.numbers;

    /** Gets the layout a chart's marker labels are drawn in, "auto" unless it says otherwise. */
    const getLayout = (visualisation) => {

        const layout = visualisation ? visualisation.markerLabelLayout : null;

        return LAYOUTS[layout] || LAYOUTS.auto;
    };

    /**
     * Puts a chart's marker labels into one of the layouts and redraws, saving the choice with the
     * chart so it opens as the reader left it.  The layout changes how much room the band needs, so
     * this goes through a redraw rather than through the pass alone.
     */
    const setLayout = (visualisation, layout, props) => {

        visualisation.markerLabelLayout = layout === LAYOUTS.auto ? null : layout;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    /** Gets the height a number of lanes needs, measured up from the top of the plot area. */
    const getBandHeightPx = (laneCount) =>
        BAND_BOTTOM_PX
        + Math.max(0, laneCount - 1) * LANE_HEIGHT_PX
        + LABEL_FONT_SIZE_PX
        + LINE_OVER_LABEL_PX;

    /** Gets the baseline one lane's labels are drawn on, as a plot-area y coordinate. */
    const getLaneBaselinePx = (lane) => -(BAND_BOTTOM_PX + lane * LANE_HEIGHT_PX);

    /**
     * Packs labels into lanes: each is given the lowest lane in which it clears everything already
     * put there, so only a crowded chart is stacked at all.
     *
     * The items are sorted and packed left to right, which is what makes one pass enough: a lane's
     * last label is always the rightmost in it, so only that one has to be tested against.
     *
     * @param {object[]} items - One per label, as { index, left, right }, in any order.
     * @param {number} maxLanes - The lanes available; an item that fits in none is given -1.
     * @returns {number[]} The lane each item was given, indexed as the items were passed in.
     */
    const assignLanes = (items, maxLanes) => {

        const lanes = [];
        const sorted = items.slice().sort((a, b) => a.left - b.left);
        const laneByIndex = [];

        for (let i = 0; i < sorted.length; i++) {

            const item = sorted[i];
            let chosenLane = -1;

            for (let lane = 0; lane < maxLanes; lane++) {

                if (lanes[lane] === undefined || lanes[lane] + LABEL_GAP_PX <= item.left) {

                    chosenLane = lane;
                    break;
                }
            }

            if (chosenLane !== -1) lanes[chosenLane] = item.right;

            laneByIndex[item.index] = chosenLane;
        }

        return laneByIndex;
    };

    /** Gets the number of lanes a set of lane assignments actually uses. */
    const getLaneCount = (laneByIndex) => {

        let count = 0;

        for (let i = 0; i < laneByIndex.length; i++) {

            if (laneByIndex[i] >= 0) count = Math.max(count, laneByIndex[i] + 1);
        }

        return count;
    };

    /**
     * Packs labels into lanes as assignLanes does, but keeping each in the lane pinnedLanes gives
     * it where it is still clear there.  The rest take the lowest lane clear of those, which is
     * then pinned for them too.
     *
     * @param {object[]} items - One per label, as { index, left, right }, in any order.
     * @param {object[]} markers - The markers the items' indexes refer to.
     * @param {number} maxLanes - The lanes available; an item that fits in none is given -1.
     * @param {object} pinnedLanes - Lanes by marker key, added to as labels are placed.
     * @returns {number[]} The lane each item was given, indexed as the items were passed in.
     */
    const assignPinnedLanes = (items, markers, maxLanes, pinnedLanes) => {

        const spansByLane = [];

        for (let lane = 0; lane < maxLanes; lane++) spansByLane[lane] = [];

        const isClear = (lane, item) => {

            const spans = spansByLane[lane];

            for (let i = 0; i < spans.length; i++) {

                if (item.left < spans[i].right + LABEL_GAP_PX
                    && spans[i].left < item.right + LABEL_GAP_PX) {

                    return false;
                }
            }

            return true;
        };

        const sorted = items.slice().sort((a, b) => a.left - b.left);
        const laneByIndex = [];
        const unpinned = [];

        for (let i = 0; i < sorted.length; i++) {

            const item = sorted[i];
            const lane = pinnedLanes[markers[item.index].key];

            if (lane >= 0 && lane < maxLanes && isClear(lane, item)) {

                spansByLane[lane].push(item);
                laneByIndex[item.index] = lane;
            }
            else {

                unpinned.push(item);
            }
        }

        for (let i = 0; i < unpinned.length; i++) {

            const item = unpinned[i];
            let chosenLane = -1;

            for (let lane = 0; lane < maxLanes; lane++) {

                if (isClear(lane, item)) {

                    chosenLane = lane;
                    break;
                }
            }

            if (chosenLane !== -1) {

                spansByLane[chosenLane].push(item);
                pinnedLanes[markers[item.index].key] = chosenLane;
            }

            laneByIndex[item.index] = chosenLane;
        }

        return laneByIndex;
    };

    /**
     * Gets the lanes a chart's labels were last laid out in, to hold them in while it is panned
     * (see Ren.DateValueChart_DateRangeWheel), as { layout, applied, bandLanes,
     * calendarFirstLane, own, calendar }: own and calendar map each track's marker keys to lanes,
     * counted from the track's first.
     */
    const captureLanes = (props) => {

        const lastLayout = props.markerLabelsLastLayout;
        const layout = getLayout(props.visualisation);

        const hold = {
            layout,
            applied: lastLayout ? lastLayout.applied : layout,
            bandLanes: props.markerBandLanes,
            calendarFirstLane: lastLayout ? lastLayout.calendarFirstLane : 0,
            own: {},
            calendar: {}
        };

        if (!props.chartGroup) return hold;

        const captureTrack = (isCalendarTrack, lanesByKey, firstLane) => {

            const markers = collectMarkers(props, isCalendarTrack);

            for (let i = 0; i < markers.length; i++) {

                const lane = markers[i].group.getAttribute("data-marker-lane");

                if (lane !== null) lanesByKey[markers[i].key] = parseInt(lane, 10) - firstLane;
            }
        };

        captureTrack(false, hold.own, 0);
        captureTrack(true, hold.calendar, hold.calendarFirstLane);

        return hold;
    };

    /**
     * Gets the lanes a chart being panned holds its labels in, or null where it isn't being panned
     * or has since been put in another layout.
     */
    const getLaneHold = (props, layout) => {

        const hold = Ren.DateValueChart_DateRangeWheel.getPanHold(props)?.markerLanes;

        return hold && hold.layout === layout && layout !== LAYOUTS.hover ? hold : null;
    };

    /**
     * Gets the markers a chart is annotated with - its own, those read from a marker data source
     * and its calendar markers - in the order they are drawn, which is the order they are numbered
     * in.
     */
    const getMarkers = (props) => Ren.DateValueChart_MarkerLines
        .getMarkers(props)
        .concat(Ren.DateValueChart_DateMarkers.getMarkers(props))
        .concat(Ren.DateValueChart_CalendarMarkers.getMarkers(props));

    /**
     * Gets a value indicating whether a marker's label is drawn in the band above the plot rather
     * than beneath it.
     */
    const isBandLabel = (marker) => marker.labelPosition !== "bottom";

    const isCalendarMarker = (marker) => !!marker.calendarPeriod;

    /** Gets the layout the calendar track is drawn in, given the one the chart is set to. */
    const getCalendarLayout = (layout) =>
        layout === LAYOUTS.hover ? LAYOUTS.hover : LAYOUTS.staggered;

    /**
     * Gets the room the band needs, worked out before the labels are drawn by estimating each from
     * the length of its text and packing them as the pass will pack the real ones.  A chart whose
     * labels turn out wider ends up a lane short, which the pass settles by numbering or dropping.
     */
    const estimateLanes = (props, markers, layout) => {

        if (layout === LAYOUTS.hover) return 1;

        const scaleX = props.scaleX || 1;
        const plotWidthPx = props.innerWidth * scaleX;
        const isNumbered = isNumberedLayout(layout);
        const items = [];

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];

            if (!isBandLabel(marker)) continue;

            const text = isNumbered ? String(items.length + 1) : String(marker.label ?? "");
            const width = Math.min(
                MAX_FLAG_WIDTH_PX,
                text.length * ESTIMATED_CHAR_WIDTH_PX + FLAG_PADDING_X_PX * 2
            );

            const x = Ren.NumberUtils.clamp(
                props.xScale.getPixel(marker.date) * scaleX,
                0,
                plotWidthPx
            );

            // A label near the right hand edge is drawn to the left of its line so as not to be
            // clipped, exactly as the renderer draws it (see renderLabel).
            const isNearRightEdge = x > plotWidthPx * 0.9;

            items.push({
                index: items.length,
                left: isNearRightEdge ? x - LABEL_OFFSET_PX - width : x + LABEL_OFFSET_PX,
                right: isNearRightEdge ? x - LABEL_OFFSET_PX : x + LABEL_OFFSET_PX + width
            });
        }

        if (!items.length) return 0;

        const laneByIndex = assignLanes(items, MAX_LANES);
        let isAnyUnplaced = false;

        for (let i = 0; i < items.length; i++) {

            if (laneByIndex[i] < 0) isAnyUnplaced = true;
        }

        // A label with no lane to go in is what "auto" numbers a chart for, and numbers pack into
        // far fewer lanes than the labels they stand in for - so the band reserved is the one those
        // numbers will need rather than the one the labels asked for.
        if (isAnyUnplaced && layout === LAYOUTS.auto) {

            return estimateLanes(props, markers, LAYOUTS.numbered);
        }

        return getLaneCount(laneByIndex);
    };

    /** Gets the lanes each track is estimated to need, as { own, calendar }. */
    const estimateTrackLanes = (props, markers, layout) => {

        const ownMarkers = [];
        const calendarMarkers = [];

        for (let i = 0; i < markers.length; i++) {

            if (isCalendarMarker(markers[i])) {
                calendarMarkers.push(markers[i]);
            }
            else {

                ownMarkers.push(markers[i]);
            }
        }

        return {
            own: ownMarkers.length ? estimateLanes(props, ownMarkers, layout) : 0,
            calendar: calendarMarkers.length
                ? estimateLanes(props, calendarMarkers, getCalendarLayout(layout))
                : 0
        };
    };

    /**
     * Gets what a band was reserved for: the layout in force, the width the labels are packed
     * across and the labels themselves.  Two reserves agreeing on all three pack into the same
     * lanes, which is what lets recordBandUsage's measured lane count stand in for the estimate.
     */
    const getBandSignature = (props, markers, layout) => {

        const parts = [layout, Math.round(props.innerWidth * (props.scaleX || 1))];

        for (let i = 0; i < markers.length; i++) {

            if (!isBandLabel(markers[i])) continue;

            parts.push((isCalendarMarker(markers[i]) ? "calendar:" : "") + markers[i].label);
        }

        return parts.join("");
    };

    /**
     * Gets the lanes one track, as { stacked, availableLanes, markerCount }, was measured to need.
     * A pass with labels left over was not given the lanes to measure what they need, so what it
     * used is a floor rather than a count: ask for a lane more and let the next pass say.
     */
    const getUsedLanes = (track) => track.stacked.hidden
        ? Math.min(MAX_LANES, track.availableLanes + 1)
        : Math.max(track.stacked.laneCount, track.markerCount ? 1 : 0);

    /**
     * Notes the lanes a chart's labels were actually measured into, so that the next reserve for
     * the same labels at the same width takes the lanes they need rather than the ones estimated
     * from their length - an estimate that has to err high, leaving room nothing is drawn in.
     *
     * Where the reserve is a lane out either way the chart is redrawn to put it right: a band a
     * lane too tall gives that room back to the plot, and one too short - a pass that had to hide
     * labels - is grown a lane, up to MAX_LANES a track.  The redraw is asked for from a timer
     * because this pass runs from within the restyle a redraw would start again.
     */
    const recordBandUsage = (props, tracks) => {

        const usedLanes = {
            own: getUsedLanes(tracks.own),
            calendar: getUsedLanes(tracks.calendar)
        };

        const totalLanes = usedLanes.own + usedLanes.calendar;
        const reservedPx = props.markerBandHeightPx || 0;
        const neededPx = totalLanes ? getBandHeightPx(totalLanes) : 0;

        props.markerBandUsedLanes = usedLanes;
        props.markerBandUsedFor = props.markerBandSignature;

        if (!props.redrawChart || !props.markerBandSignature) return;
        if (Math.abs(reservedPx - neededPx) < LANE_HEIGHT_PX) return;

        if (props.markerBandCorrectedFor !== props.markerBandSignature) {

            props.markerBandCorrectedFor = props.markerBandSignature;
            props.markerBandCorrections = 0;
        }

        // Growing a lane at a time takes as many redraws as lanes are added, so more than one
        // correction is allowed for the same labels - but never more than there are lanes to add
        // in both tracks, which is what stops a chart that cannot settle redrawing for ever.
        if (props.markerBandCorrections >= MAX_LANES * 2) return;

        props.markerBandCorrections++;

        setTimeout(props.redrawChart, 0);
    };

    /**
     * Reserves the band the marker lines stick out into, by taking it out of the chart's top margin
     * before the plot area is measured against it, so that the band pushes the plot down rather
     * than covering it.  A chart with no markers keeps the margin it would have had.
     *
     * The margin is set outright rather than added to, so repeated runs settle at the same place.
     */
    const reserveBand = (props) => {

        if (!props.margin || !props.xScale) return;

        const markers = getMarkers(props);
        const layout = getLayout(props.visualisation);
        const signature = getBandSignature(props, markers, layout);

        // The lanes the last pass measured these very labels into where they have not changed
        // since, and what their length suggests where this is the first sight of them.
        // A chart being panned keeps its band, so its labels can keep their lanes.
        const heldBandLanes = getLaneHold(props, layout)?.bandLanes;

        const trackLanes = heldBandLanes
            || (signature === props.markerBandUsedFor
                ? props.markerBandUsedLanes
                : estimateTrackLanes(props, markers, layout));

        const laneCount = trackLanes.own + trackLanes.calendar;

        props.markerBandSignature = signature;
        const bandHeightPx = laneCount ? Math.ceil(getBandHeightPx(laneCount)) : 0;
        const topMarginPx = BASE_TOP_MARGIN_PX + bandHeightPx;

        props.markerBandHeightPx = bandHeightPx;
        props.markerBandLanes = trackLanes;

        if (props.margin.top === topMarginPx) return;

        Ren.ChartProps.setMargin(props, {
            top: topMarginPx,
            right: props.margin.right,
            bottom: props.margin.bottom,
            left: props.margin.left
        });

        props.innerHeight = props.height - props.margin.top - props.margin.bottom;

        // The plot area's own group is placed by the margin, so it moves down with it.  Set here
        // because a redraw does not go back through the chart's setup (see setupSvgAndGroups).
        if (props.chartGroup) {

            props.chartGroup.setAttribute(
                "transform",
                `translate(${props.margin.left},${props.margin.top})`
            );
        }
    };

    /** Gets the lanes the band reserved for this render has room for in one track. */
    const getAvailableLanes = (props, track) => {

        const reserved = props.markerBandLanes ? props.markerBandLanes[track] : 0;

        return Ren.NumberUtils.clamp(reserved || 0, 1, MAX_LANES);
    };

    /** Gets the label of one marker group, as it was drawn before any of this settled otherwise. */
    const getLabelText = (labelNode) => labelNode.getAttribute(LABEL_TEXT_ATTRIBUTE)
        ?? labelNode.textContent;

    /**
     * Gets the marker groups of a chart whose labels are laid out in the band, each with the pieces
     * the pass moves, from either the calendar track or the other.  A group whose label is drawn
     * beneath the plot, or never drawn, is passed over.
     */
    const collectMarkers = (props, isCalendarTrack) => {

        const chartGroupNode = props.chartGroup;

        if (!chartGroupNode) return [];

        const trackSelector = isCalendarTrack
            ? "[data-marker-track='calendar']"
            : ":not([data-marker-track='calendar'])";

        const nodes = chartGroupNode
            .querySelectorAll(".ren-marker-lines .ren-marker-line" + trackSelector);
        const collected = [];

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            if (node.getAttribute("data-marker-label-position") === "bottom") continue;

            const labelNode = node.querySelector(".ren-marker-line-label");
            const lineNode = node.querySelector(".ren-marker-line__line");

            if (!labelNode) continue;

            collected.push({
                group: node,
                wrapper: node.querySelector(".ren-text-wrapper"),
                line: lineNode,
                // Every line the group holds, which is the coloured one and the white one drawn
                // beside it: the two are drawn as one line, so both are drawn up to the same lane
                // (see setLineTop, and renderMarkerLines in ren-date-value-chart-marker-lines.js).
                lines: node.querySelectorAll(".ren-marker-line__line"),
                flag: node.querySelector(".ren-marker-line-flag"),
                label: labelNode,
                text: getLabelText(labelNode),
                key: node.getAttribute("data-marker-date") + "|"
                    + node.getAttribute("data-qa-marker-line"),
                x: lineNode ? parseFloat(lineNode.getAttribute("x1")) || 0 : 0
            });
        }

        // Left to right, so that a numbered chart reads 1, 2, 3 across the page and its key reads
        // in the same order.  The markers are drawn in the order they were declared and resolved,
        // which is not the order they stand in.
        collected.sort((a, b) => a.x - b.x);

        for (let i = 0; i < collected.length; i++) collected[i].index = i;

        return collected;
    };

    /**
     * Puts every label back on show, a pass running over what the one before it left: a chart made
     * wider has to be able to show a label the last pass dropped.
     */
    const showLabels = (markers) => {

        for (let i = 0; i < markers.length; i++) {

            markers[i].wrapper.style.display = "";
        }
    };

    /**
     * Puts every label back the way it was drawn, before anything is measured, so that a chart made
     * wider can show a label the last pass numbered or cut short.
     */
    const resetLabels = (markers) => {

        showLabels(markers);

        for (let i = 0; i < markers.length; i++) {

            markers[i].label.textContent = markers[i].text;
            markers[i].label.removeAttribute(LABEL_TEXT_ATTRIBUTE);
        }
    };

    /**
     * Gets the width a label's text takes, from the character widths Ren keeps rather than from the
     * label itself: measuring where it is drawn has the browser lay the chart out for every
     * measurement, which a chart zoomed out over dates it has never measured pays over and over.
     */
    const measureTextWidthPx = (text) =>
        // The ellipsis is outside the table and would be taken for a character of average width,
        // which is narrower than it is drawn, so it is measured as the three dots it stands for:
        // erring wide costs a character of a label, erring narrow costs the width cap its point.
        Ren.TextUtils.measureText(text.replace(ELLIPSIS, "..."));

    /**
     * Cuts one label's text down to the width a flag is allowed, and gives back what it settled on.
     */
    const measureTruncation = (full, fullWidthPx, maxTextWidthPx) => {

        // The characters that fit, guessed from the width the whole of it took and then walked
        // to the right answer: the guess is only as good as the label's letters are even, and
        // walking is a handful of steps from there either way.
        let length = Math.max(1, Math.floor(full.length * maxTextWidthPx / fullWidthPx));

        while (length > 1
            && measureTextWidthPx(full.slice(0, length) + ELLIPSIS) > maxTextWidthPx) {

            length--;
        }

        while (length < full.length
            && measureTextWidthPx(full.slice(0, length + 1) + ELLIPSIS) <= maxTextWidthPx) {

            length++;
        }

        // Trailing spaces read as a gap before the ellipsis rather than as a word cut short.
        return full.slice(0, length).replace(/\s+$/, "") + ELLIPSIS;
    };

    const applyTruncation = (marker, truncatedText) => {

        marker.label.textContent = truncatedText;
        marker.label.setAttribute(LABEL_TEXT_ATTRIBUTE, marker.text);
    };

    /**
     * Cuts a label short with an ellipsis where it is wider than a flag is ever drawn, so that one
     * long label does not take the room several short ones would have shared.  What it said in full
     * is kept on the label to go back to, and is what the key and the hover text say in any case.
     *
     * A label is only ever measured the first time its text is seen: what it comes to depends on
     * the text and on the width a flag is allowed, neither of which a redraw changes, so a chart
     * being panned or zoomed lays its labels out from the cache.  Even a stretch of dates that is
     * all new costs no layout, the measuring being done from the character widths rather than from
     * the labels themselves (see measureTextWidthPx).
     */
    const truncateLabels = (markers) => {

        const maxTextWidthPx = MAX_FLAG_WIDTH_PX - FLAG_PADDING_X_PX * 2;
        const unmeasured = [];

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];
            const truncated = truncatedTextCache.get(marker.text);

            if (truncated === undefined) {

                unmeasured.push(marker);
            }
            else if (truncated !== null) {

                applyTruncation(marker, truncated);
            }
        }

        for (let i = 0; i < unmeasured.length; i++) {

            const marker = unmeasured[i];

            // Two markers can carry the same text, in which case the second of them is already
            // answered by the first.
            let truncated = truncatedTextCache.get(marker.text);

            if (truncated === undefined) {

                const widthPx = measureTextWidthPx(marker.text);

                if (!widthPx) continue;

                truncated = widthPx <= maxTextWidthPx
                    ? null
                    : measureTruncation(marker.text, widthPx, maxTextWidthPx);

                truncatedTextCache.set(marker.text, truncated);
            }

            if (truncated !== null) {

                applyTruncation(marker, truncated);
            }
        }
    };

    /** Draws every label as its number instead, keeping the text it stood for to go back to. */
    const numberLabels = (markers) => {

        for (let i = 0; i < markers.length; i++) {

            markers[i].label.setAttribute(LABEL_TEXT_ATTRIBUTE, markers[i].text);
            markers[i].label.textContent = String(i + 1);
        }
    };

    /**
     * Measures each label where it stands, as one rectangle per marker in visual pixels.  Only the
     * horizontal extent matters, every label in a lane being at the same height, so they are
     * measured once and stacked without being measured again.
     */
    const measureLabels = (markers) => {

        const items = [];

        for (let i = 0; i < markers.length; i++) {

            const rect = markers[i].label.getBoundingClientRect();

            if (!rect.width) continue;

            items.push({
                index: i,
                left: rect.left - FLAG_PADDING_X_PX,
                right: rect.right + FLAG_PADDING_X_PX
            });
        }

        return items;
    };

    /**
     * Gets where a chart's number labels stand, without measuring any of them.  A number is at most
     * three digits, so the width of the widest stands for all of them, and a label's place is its
     * line's place scaled, plus the fixed offset it is drawn at: the labels are counter-scaled, so
     * that offset and that width are visual pixels whatever size the chart is drawn.  Only how far
     * apart the labels stand matters, so the plot's own origin is left out of every one of them.
     *
     * Reserving a few pixels too many can only push a label into a lane of its own, never let two
     * overlap.
     *
     * @returns {Array} The labels' places, or null where the chart cannot be read this way and they
     *     have to be measured after all.
     */
    const measureNumberLabels = (markers, props) => {

        const scaleX = props ? props.scaleX : 0;

        if (!scaleX) return null;

        const widthPx = measureTextWidthPx(WIDEST_NUMBER_TEXT);
        const items = [];

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];

            // A marker with no line has no place of its own to be worked out from.
            if (!marker.line) return null;

            const linePx = marker.x * scaleX;

            const leftPx = marker.label.getAttribute("text-anchor") === "end"
                ? linePx - LABEL_OFFSET_PX - widthPx
                : linePx + LABEL_OFFSET_PX;

            items.push({
                index: i,
                left: leftPx - FLAG_PADDING_X_PX,
                right: leftPx + widthPx + FLAG_PADDING_X_PX
            });
        }

        return items;
    };

    /** Gets what a label's box is kept under: what it says, and the side of its line it is on. */
    const getLabelBoxCacheKey = (label) =>
        label.textContent + "|" + label.getAttribute("text-anchor");

    /**
     * Gets the box a label's text takes, as offsets from the label's own x and y, measuring it
     * where it has not been measured before.  Null where it cannot be measured.
     */
    const getLabelBox = (label) => {

        const cacheKey = getLabelBoxCacheKey(label);
        const cached = labelBoxCache.get(cacheKey);

        if (cached !== undefined) return cached;

        let measured = null;

        try {

            measured = label.getBBox();
        }
        catch {

            // getBBox throws where the text has not been laid out - a chart rendered into a
            // hidden or detached element - which is not worth reporting: the label is still
            // drawn.
            measured = null;
        }

        // Nothing is kept for a label that could not be measured, so that it is measured again on
        // the pass that follows rather than being left flagless for good.
        if (!measured || !measured.width) return null;

        const labelX = parseFloat(label.getAttribute("x")) || 0;
        const labelY = parseFloat(label.getAttribute("y")) || 0;

        const box = {
            offsetXPx: measured.x - labelX,
            offsetYPx: measured.y - labelY,
            widthPx: measured.width,
            heightPx: measured.height
        };

        labelBoxCache.set(cacheKey, box);

        return box;
    };

    /**
     * Measures the box of every label whose text has not been seen before, before any of them is
     * moved, so that the placing that follows sizes each flag from the cache.  Measuring a label
     * that has just been moved has the browser lay the chart out again for it, which for a chart
     * zoomed out to a stretch of new dates is one layout per marker.
     */
    const primeLabelBoxes = (markers) => {

        for (let i = 0; i < markers.length; i++) {

            if (markers[i].flag) getLabelBox(markers[i].label);
        }
    };

    /**
     * Sizes the flag behind a label to the label as it now stands.  The flag is counter-scaled with
     * the text it sits behind, so the box measured on the text is the box the flag is drawn at.
     */
    const sizeFlag = (marker) => {

        if (!marker.flag) return;

        const label = marker.label;
        const labelX = parseFloat(label.getAttribute("x")) || 0;
        const labelY = parseFloat(label.getAttribute("y")) || 0;
        const box = getLabelBox(label);

        // The label is drawn white, so it cannot be seen without its flag.
        if (!box) {

            marker.flag.style.display = "none";
            return;
        }

        marker.flag.style.display = "";
        marker.flag.setAttribute("x", labelX + box.offsetXPx - FLAG_PADDING_X_PX);
        marker.flag.setAttribute("y", labelY + box.offsetYPx - FLAG_PADDING_Y_PX);
        marker.flag.setAttribute("width", box.widthPx + FLAG_PADDING_X_PX * 2);
        marker.flag.setAttribute("height", box.heightPx + FLAG_PADDING_Y_PX * 2);
    };

    /**
     * Puts one marker's label in a lane and draws its line up to it.  The label's coordinates are
     * visual pixels while the line's are the plot area's, so the line's end is converted through
     * the vertical scale on the way.
     */
    /**
     * Draws a marker's lines up to a given top.  A marker is drawn as a coloured line and a white
     * one beside it, and the pair reads as one, so both are moved.
     */
    const setLineTop = (marker, y1) => {

        const lines = marker.lines;

        if (!lines) return;

        for (let i = 0; i < lines.length; i++) lines[i].setAttribute("y1", y1);
    };

    const placeMarker = (marker, lane, scaleY) => {

        const baselinePx = getLaneBaselinePx(lane);

        marker.label.setAttribute("y", baselinePx);

        sizeFlag(marker);

        setLineTop(marker, (baselinePx - LINE_OVER_LABEL_PX) / (scaleY || 1));

        marker.group.setAttribute("data-marker-lane", lane);
    };

    /**
     * Hides a label that has nowhere to go.  Its line is left drawn - a marker with no room for its
     * name is still a date worth showing - and stops at the top of the plot area.
     */
    const hideLabel = (marker, scaleY) => {

        marker.wrapper.style.display = "none";
        marker.group.removeAttribute("data-marker-lane");

        setLineTop(marker, -BAND_BOTTOM_PX / (scaleY || 1));
    };

    /**
     * Shows each label only while the pointer is over its marker, which suits a chart annotated
     * with more dates than it could ever print.  The whole marker group answers the pointer, the
     * line having been given a wide transparent companion to be caught by, so a line is hoverable
     * without having to be aimed at exactly.  The labels are hidden by the chart's hover-layout
     * stylesheet (see setHoverLayoutStyles).
     */
    const applyHoverLayout = (markers, lane, scaleY) => {

        primeLabelBoxes(markers);

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];

            placeMarker(marker, lane, scaleY);

            // The label is raised above its neighbours' lines while it is shown, so that a label
            // revealed over a crowded stretch of the chart is not crossed by them.
            marker.group.onmouseenter = () => {

                // Moving the group re-enters it under the pointer, so it is moved only where it is
                // not already the last of its neighbours - which is also the only time it needs to
                // be.
                if (marker.group.nextSibling) marker.group.parentNode.appendChild(marker.group);
            };
        }
    };

    /**
     * Hides the labels of every marker the pointer is not over while the chart lays its labels out
     * on hover, and shows them all otherwise.  Only the labels a layout places are hidden, which
     * leaves out those drawn at the foot of the plot (see collectMarkers).
     */
    const setHoverLayoutStyles = (props, isHoverLayout) => {

        if (!props.markerLabelsStylesheet) {

            props.markerLabelsStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "marker-labels")
                .getStylesheet();
        }

        // A hidden label catches no pointer either, or a long one would answer for the lines it
        // covers, and the marker is hovered by its line instead.
        const css = isHoverLayout
            ? `.${props.guid} .ren-marker-lines `
                + ".ren-marker-line:not([data-marker-label-position='bottom']):not(:hover) "
                + ".ren-text-wrapper { opacity: 0; pointer-events: none }\n"
                + `.${props.guid} .ren-marker-lines .ren-marker-line__line--hit `
                + "{ pointer-events: stroke }"
            : "";

        if (props.markerLabelsStylesheet.textContent !== css) {
            props.markerLabelsStylesheet.textContent = css;
        }
    };

    /** Clears the hover handlers a hover layout left behind, so a label shown is a label placed. */
    const clearHoverHandlers = (markers) => {

        for (let i = 0; i < markers.length; i++) {

            markers[i].group.onmouseenter = null;
        }
    };

    /**
     * Stacks the labels into the lanes the band has room for, from firstLane up, hiding any that
     * will not fit.  Given pinnedLanes, labels keep the lanes they were pinned to where they can
     * (see assignPinnedLanes).  Given numberedProps, the labels are numbers and are worked out from
     * the chart rather than measured (see measureNumberLabels).
     *
     * @returns {object} What it managed, as { laneCount, placed, hidden }.
     */
    const stackLabels = (
        markers, availableLanes, scaleY, firstLane, pinnedLanes, numberedProps
    ) => {

        const items = (numberedProps && measureNumberLabels(markers, numberedProps))
            || measureLabels(markers);

        primeLabelBoxes(markers);

        const laneByIndex = pinnedLanes
            ? assignPinnedLanes(items, markers, availableLanes, pinnedLanes)
            : assignLanes(items, availableLanes);
        const result = { laneCount: getLaneCount(laneByIndex), placed: 0, hidden: 0 };

        for (let i = 0; i < markers.length; i++) {

            const lane = laneByIndex[i];

            if (lane === undefined || lane < 0) {

                hideLabel(markers[i], scaleY);
                result.hidden++;
                continue;
            }

            placeMarker(markers[i], firstLane + lane, scaleY);
            result.placed++;
        }

        return result;
    };

    // Where the key's entries are kept, so that a pass settling on the same key as the one before
    // it leaves the key alone.  Rebuilding it would re-lay-out the container it sits in, which is
    // what runs this pass in the first place.
    const KEY_SIGNATURE_ATTRIBUTE = "data-marker-key-signature";

    const KEY_CLASS = "ren-date-value-chart-marker-key";

    /** Gets the entries a key would carry: one per marker whose number is actually drawn. */
    const getKeyEntries = (markers) => {

        const entries = [];

        for (let i = 0; i < markers.length; i++) {

            if (markers[i].wrapper.style.display === "none") continue;

            entries.push({
                number: markers[i].label.textContent,
                text: markers[i].text,
                // The line's colour, not the label's: a label is drawn white on its flag, so what
                // ties a number in the key to the marker it stands at is the line it is drawn at.
                colour: markers[i].line ? markers[i].line.getAttribute("stroke") : null
            });
        }

        return entries;
    };

    /**
     * Puts the key beneath the chart and above the legend, wherever it has ended up.  Worth doing
     * even for an unchanged key: a full render appends a new svg and legend, which leaves a key
     * that outlived them above the chart rather than beneath it.
     */
    const placeKey = (container, key) => {

        const legend = container.querySelector(".ren-date-value-chart-legend-html");

        // Above the legend, the two being read as one strip beneath the chart, and last in the
        // container - which is beneath the chart just the same - where there is no legend.
        if (key.nextElementSibling === legend) return;

        container.insertBefore(key, legend);
    };

    /**
     * Draws the key beneath a numbered chart, saying what each number stands for.  HTML beside the
     * legend rather than part of the chart, so that it wraps onto as many rows as it needs and
     * takes its room from the container instead of from the plot.
     */
    const renderKey = (props, markers) => {

        const container = document.querySelector("." + props.guid);

        if (!container) return;

        const existing = container.querySelector("." + KEY_CLASS);
        const entries = getKeyEntries(markers);
        const signature = entries.map(entry => entry.number + " " + entry.text).join(" | ");

        if (existing && existing.getAttribute(KEY_SIGNATURE_ATTRIBUTE) === signature) {

            placeKey(container, existing);
            return;
        }

        if (existing) existing.remove();

        if (!entries.length) return;

        const key = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("DateValueChartMarkerKey");

        key.setAttribute(KEY_SIGNATURE_ATTRIBUTE, signature);

        for (let i = 0; i < entries.length; i++) {

            const item = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
                "DateValueChartMarkerKeyItem",
                { number: entries[i].number, text: entries[i].text }
            );

            // A number is drawn in the colour of the marker it stands at, which is what ties the
            // two together where a chart's markers are not all one colour.
            item.querySelector(".js-ren-marker-key-number").style.color = entries[i].colour;

            key.appendChild(item);
        }

        container.appendChild(key);
        placeKey(container, key);
    };

    /** Removes a key left by a layout that is no longer in force. */
    const removeKey = (props) => {

        const container = document.querySelector("." + props.guid);
        const key = container ? container.querySelector("." + KEY_CLASS) : null;

        if (key) key.remove();
    };

    /**
     * Lays a chart's marker labels out in the band above the plot area, in whichever layout the
     * chart is set to.
     *
     * @returns {object} What the pass settled on, for the QA hooks.
     */
    const layout = (props) => {

        const requested = getLayout(props.visualisation);
        const result = { layout: requested, applied: requested, lanes: 0, placed: 0, hidden: 0 };

        lastResult = result;

        if (!props || !props.chartGroup) return result;

        setHoverLayoutStyles(props, requested === LAYOUTS.hover);

        const markers = collectMarkers(props, false);
        const calendarMarkers = collectMarkers(props, true);

        if (!markers.length && !calendarMarkers.length) {

            removeKey(props);
            return result;
        }

        const scaleY = props.scaleY || 1;

        // A chart being panned keeps its labels in their lanes, and in the layout "auto" settled
        // on, rather than restacking them for each stretch of dates.
        const hold = getLaneHold(props, requested);

        if (hold) result.applied = hold.applied;

        clearHoverHandlers(markers);

        // A chart drawing numbers never shows what its labels say, so they are neither put back nor
        // cut short only to be written over.
        if (isNumberedLayout(result.applied)) {

            showLabels(markers);
            numberLabels(markers);
        }
        else {

            resetLabels(markers);
            truncateLabels(markers);
        }

        resetLabels(calendarMarkers);
        clearHoverHandlers(calendarMarkers);

        if (requested === LAYOUTS.hover) {

            applyHoverLayout(markers, 0, scaleY);
            applyHoverLayout(calendarMarkers, markers.length ? 1 : 0, scaleY);
            removeKey(props);
            result.placed = markers.length + calendarMarkers.length;

            return result;
        }

        const availableLanes = getAvailableLanes(props, "own");

        let stacked = stackLabels(
            markers,
            availableLanes,
            scaleY,
            0,
            hold ? hold.own : null,
            isNumberedLayout(result.applied) ? props : null
        );

        // What "auto" is for: the labels themselves where the chart has room for them, and numbers
        // where it has not, rather than a chart that silently drops what it cannot fit.  A chart
        // told to stagger keeps the labels and drops the overflow, that being what was asked for.
        if (stacked.hidden && requested === LAYOUTS.auto && !hold) {

            numberLabels(markers);
            stacked = stackLabels(markers, availableLanes, scaleY, 0, null, props);
            result.applied = LAYOUTS.numbered;
        }

        const calendarAvailableLanes = getAvailableLanes(props, "calendar");

        // Moved up only where the other markers now reach into it.
        const calendarFirstLane = hold
            ? Math.max(hold.calendarFirstLane, stacked.laneCount)
            : stacked.laneCount;

        const calendarStacked = stackLabels(
            calendarMarkers,
            calendarAvailableLanes,
            scaleY,
            calendarFirstLane,
            hold ? hold.calendar : null
        );

        props.markerLabelsLastLayout = { applied: result.applied, calendarFirstLane };

        result.lanes = calendarStacked.laneCount
            ? calendarFirstLane + calendarStacked.laneCount
            : stacked.laneCount;
        result.placed = stacked.placed + calendarStacked.placed;
        result.hidden = stacked.hidden + calendarStacked.hidden;

        // Only the layout that promises a key draws one: a chart set to numbers alone is
        // numbered for the sake of what it does not print, so a key beneath it would be the very
        // thing it was set to do without.
        if (result.applied === LAYOUTS.numbered) {
            renderKey(props, markers);
        }
        else {

            removeKey(props);
        }

        // A held band is left as it is, however much of it the labels now in view need.
        if (hold) return result;

        recordBandUsage(props, {
            own: { stacked, availableLanes, markerCount: markers.length },
            calendar: {
                stacked: calendarStacked,
                availableLanes: calendarAvailableLanes,
                markerCount: calendarMarkers.length
            }
        });

        return result;
    };

    return {
        LAYOUTS,
        LABEL_FONT_SIZE_PX,
        getLayout,
        setLayout,
        getLaneBaselinePx,
        reserveBand,
        layout,
        captureLanes,
        getDiagnostics
    };
})();
