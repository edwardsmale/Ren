/**
 * Lets the periods a chart plots be stepped through from the keyboard.  The chart takes the focus
 * from Tab, then the left and right arrows, Home and End move a highlight from period to period,
 * and each period's date and its shown series' values are announced to a screen reader.  Escape
 * clears the highlight.
 */
Ren.DateValueChart_PeriodFocus = (() => {

    const GROUP_CLASS = "ren-period-focus";
    const ANNOUNCER_CLASS = "ren-chart-announcer";
    const HIGHLIGHT_COLOUR = "#2F6FED";
    const KEYS = ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"];

    /**
     * Gets the rows a chart plots that stand for a period, in their order along the axis.
     */
    const getRows = (props) => {

        const rows = props.plottedData || [];
        const dated = [];

        for (let i = 0; i < rows.length; i++) {

            const date = rows[i] ? rows[i][props.dateHeading] : null;

            if (date instanceof Date && isFinite(date.getTime())) dated.push(rows[i]);
        }

        return dated;
    };

    /**
     * Gets the index of the period a key moves the highlight to, from the highlighted one, or null
     * where it leaves none highlighted.  With none highlighted, the right arrow starts from the
     * first period and the left from the last, and the arrows stop at the ends.
     */
    const getTargetIndex = (index, count, key) => {

        if (count === 0 || key === "Escape") return null;

        if (key === "Home") return 0;

        if (key === "End") return count - 1;

        if (key === "ArrowRight") return index === null ? 0 : Math.min(index + 1, count - 1);

        if (key === "ArrowLeft") return index === null ? count - 1 : Math.max(index - 1, 0);

        return index;
    };

    /**
     * Gets what is announced for a period: its date as the axis words it, then each shown series'
     * name and value.
     */
    const describePeriod = (props, row) => {

        const date = Ren.DateValueChart_HoverDateLine.formatDate(props, row[props.dateHeading]);
        const seriesIndexes = Ren.DateValueChart_HoverValues.getShownSeriesIndexes(props);
        const parts = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            const index = seriesIndexes[i];
            const name = props.series[index].label || props.valueHeadings[index];
            const value = Ren.DateValueChart_HoverValues.formatSeriesValue(props, index, row);

            parts.push(`${name} ${value}`);
        }

        return parts.length > 0 ? `${date}: ${parts.join(", ")}` : date;
    };

    /**
     * Gets the chart's live region, made the first time it is needed and kept through redraws.
     * It is hidden from sight but not from a screen reader.
     */
    const getAnnouncer = (props) => {

        const container = props.svg.parentNode;
        let announcer = container.querySelector(`:scope > .${ANNOUNCER_CLASS}`);

        if (announcer) return announcer;

        announcer = document.createElement("div");
        announcer.className = ANNOUNCER_CLASS;
        announcer.setAttribute("aria-live", "polite");
        announcer.setAttribute("role", "status");

        Ren.Svg.setStyles(announcer, {
            "position": "absolute",
            "width": "1px",
            "height": "1px",
            "overflow": "hidden",
            "clip-path": "inset(50%)",
            "white-space": "nowrap"
        });

        container.appendChild(announcer);

        return announcer;
    };

    const clearHighlight = (props) => {

        const existing = props.chartGroup
            ? props.chartGroup.querySelector(`:scope > .${GROUP_CLASS}`)
            : null;

        if (existing) existing.remove();
    };

    /**
     * Highlights the period at an index, behind the series, and announces it.
     */
    const showPeriod = (props, index) => {

        clearHighlight(props);

        const row = getRows(props)[index];

        if (!row || !props.chartGroup || !props.xScale) return;

        const period = Ren.DateValueChart_HoverDateLine.periodForDate(
            props,
            row[props.dateHeading]
        );

        if (period) {

            const band = Ren.DateValueChart_HoverDateLine.bandForPeriod(props, period, 1);
            const group = Ren.Svg.append(props.chartGroup, "g", {
                "class": GROUP_CLASS,
                "pointer-events": "none"
            });

            Ren.Svg.append(group, "rect", {
                "class": "ren-focused-period",
                "data-period-index": index,
                "x": band.leftX,
                "y": 0,
                "width": Math.max(1, band.rightX - band.leftX),
                "height": props.innerHeight,
                "fill": HIGHLIGHT_COLOUR,
                "fill-opacity": 0.12
            });

            props.chartGroup.insertBefore(group, props.chartGroup.firstChild);
        }

        getAnnouncer(props).textContent = describePeriod(props, row);
    };

    const onKeyDown = (props, event) => {

        if (KEYS.indexOf(event.key) === -1) return;

        const count = getRows(props).length;
        const index = getTargetIndex(props.focusedPeriodIndex ?? null, count, event.key);

        event.preventDefault();
        props.focusedPeriodIndex = index;

        if (index === null) {

            clearHighlight(props);
            getAnnouncer(props).textContent = "";
            return;
        }

        showPeriod(props, index);
    };

    /**
     * Makes the chart focusable and steps through its periods from the keyboard.  Called on every
     * redraw, it listens to each SVG only once, and highlights again the period that was
     * highlighted, where one still is.
     */
    const attach = (props) => {

        const svg = props.svg;

        if (!svg || !svg.parentNode || Ren.DateValueChart_Pies.isShown(props)) return;

        svg.setAttribute("tabindex", "0");
        svg.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End Escape");

        if (!svg.renPeriodFocusAttached) {

            svg.renPeriodFocusAttached = true;
            svg.addEventListener("keydown", event => onKeyDown(props, event));
            svg.addEventListener("blur", () => {

                props.focusedPeriodIndex = null;
                clearHighlight(props);
            });
        }

        const index = props.focusedPeriodIndex ?? null;

        if (index !== null && index < getRows(props).length) showPeriod(props, index);
    };

    return {
        getRows,
        getTargetIndex,
        describePeriod,
        attach
    };
})();
