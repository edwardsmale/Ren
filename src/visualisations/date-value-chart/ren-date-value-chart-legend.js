Ren.DateValueChart_Legend = (() => {

    // The class of the box the legend's items are laid out and scrolled in, across.
    const ITEMS_CLASS_NAME = "ren-legend-items";

    // The most rows of items the legend is laid out in.
    const MAX_ROWS = 3;

    // The widest a legend item is made, in layout pixels, a longer label being cut short.
    const MAX_ITEM_WIDTH = 300;
    const MAX_MEASURED_LIMITED_OUT_ITEMS = 20;

    // The selection is kept against the series it was made from, so it lapses rather than moving
    // on to other series when series are added, removed or rebuilt.
    const getSeriesKey = props => (props.valueHeadings || []).join("\n");

    /**
     * Gets the numbers of the series selected in the legend, in the order they were selected.  The
     * selection is held on the props, as they outlive the legend, which each redraw replaces.
     */
    const getSelectedSeriesIndexes = props => {

        const selection = props.legendSelection;

        if (!selection || selection.seriesKey !== getSeriesKey(props)) return [];

        return selection.seriesIndexes;
    };

    // The chart whose legend a selection was last made in, which the Delete key acts on.
    let lastSelectionProps = null;

    // Selects the given series, boxing their entries and fading the rest back.
    const setSelectedSeriesIndexes = (props, seriesIndexes) => {

        if (seriesIndexes.length > 0) {
            lastSelectionProps = props;
        }
        else if (lastSelectionProps === props) {

            lastSelectionProps = null;
        }

        props.legendSelection = {
            seriesKey: getSeriesKey(props),
            seriesIndexes: seriesIndexes
        };

        Ren.DateValueChart_StyleUpdater.updateSelectionStyles(props);
    };

    /**
     * Shows a selection made in another chart's legend, as a multi-chart's charts show the one
     * made in theirs, without the chart becoming the one the Delete key acts on.
     */
    const showSelection = (props, seriesIndexes) => {

        props.legendSelection = {
            seriesKey: getSeriesKey(props),
            seriesIndexes: seriesIndexes
        };

        Ren.DateValueChart_StyleUpdater.updateSelectionStyles(props);
    };

    const clearSelection = props => {

        if (getSelectedSeriesIndexes(props).length === 0) return;

        setSelectedSeriesIndexes(props, []);
    };

    /**
     * Stops the hover previewing the series of the entry under the pointer until the pointer
     * leaves it, so that what a click on the entry did can be seen.
     */
    const suppressHover = (props, seriesIndex) => {

        cancelHoverEnd(props);

        props.hoverSuppressedSeriesNum = seriesIndex;

        Ren.DateValueChart_StyleUpdater.updateHoverStyles(props);
    };

    // How long a hovered series stays emphasised after the pointer leaves its legend entry.
    const HOVER_END_DELAY_MS = 250;

    const cancelHoverEnd = props => {

        clearTimeout(props.hoverEndTimeout);
        props.hoverEndTimeout = null;
    };

    /**
     * Ends the hover emphasis a moment after the pointer leaves an entry, so that it doesn't
     * flicker off as the pointer crosses the gap to the next entry.
     */
    const endHoverAfterDelay = props => {

        cancelHoverEnd(props);

        if (!props.hoveredSeriesNum) {

            Ren.DateValueChart_StyleUpdater.updateHoverStyles(props);
            return;
        }

        props.hoverEndTimeout = setTimeout(() => {

            props.hoverEndTimeout = null;
            Ren.DateValueChart_StyleUpdater.updateHoverStyles(props);
        }, HOVER_END_DELAY_MS);
    };

    // How far a series must outreach the one before it in the legend to take its place, so that
    // series of much the same size hold their places as the dates drawn change.
    const LEGEND_REORDER_MARGIN = 0.25;

    /**
     * Gets a value indicating whether a series reaching one height clearly outreaches a series
     * reaching another.
     */
    const isClearlyHigher = (seriesMax, otherSeriesMax) => {

        if (otherSeriesMax === -Infinity) return seriesMax !== -Infinity;

        const margin = LEGEND_REORDER_MARGIN
            * Math.max(Math.abs(seriesMax), Math.abs(otherSeriesMax));

        return seriesMax - otherSeriesMax > margin;
    };

    /**
     * Gets the series in the order they were last given in the legend, with any not given there
     * after them, then moves each ahead of those it clearly outreaches.
     */
    const keepPreviousOrder = (props, seriesIndexes, seriesMaxes, isOther) => {

        const previousHeadings = props.legendSeriesHeadings;
        const previousPositions = new Map();

        for (let position = 0; position < previousHeadings.length; position++) {
            previousPositions.set(previousHeadings[position], position);
        }

        const getPreviousPosition = seriesIndex =>
            previousPositions.get(props.valueHeadings[seriesIndex - 1]) ?? Infinity;

        // Ties fall back to the order by height the series come in.
        const order = seriesIndexes.slice().sort((a, b) =>
            (getPreviousPosition(a) - getPreviousPosition(b)) || 0);

        // Each pass moves a series ahead of one it outreaches, and a series is only ever moved
        // ahead of one lower than it, so the passes come to an end.
        let isMoved = true;

        while (isMoved) {

            isMoved = false;

            for (let position = 1; position < order.length; position++) {

                const before = order[position - 1];
                const after = order[position];
                const isOtherBefore = isOther(before) && !isOther(after);
                const isAfterHigher = isOther(before) === isOther(after)
                    && isClearlyHigher(seriesMaxes[after - 1], seriesMaxes[before - 1]);

                if (isOtherBefore || isAfterHigher) {

                    order[position - 1] = after;
                    order[position] = before;
                    isMoved = true;
                }
            }
        }

        return order;
    };

    /**
     * Gets the numbers of the series in the order their legend entries run: highest first by the
     * most each reaches, so that a lasso from the legend's left takes in the largest series.  A
     * legend drawn before keeps its order where the series are of much the same height.
     */
    const getLegendSeriesOrder = props => {

        const data = props.plottedData || [];
        const seriesMaxes = [];
        const seriesIndexes = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const heading = props.valueHeadings[i];
            const seriesMax = Ren.DateValueChart_LastPeriodEstimate.getExtentValue(
                props,
                i,
                Ren.ArrayUtils.max(data, row => row[heading])
            );

            seriesMaxes.push(isFinite(seriesMax) ? seriesMax : -Infinity);
            seriesIndexes.push(i + 1);
        }

        // Series reaching the same height keep the order they are given in.  "Other" series come
        // last, as they gather the series left out.
        const isOther = seriesIndex => Ren.DateValueChart_OtherSeries.isOtherSeries(
            props,
            seriesIndex
        );

        seriesIndexes.sort((a, b) => (isOther(a) - isOther(b))
            || seriesMaxes[b - 1] - seriesMaxes[a - 1]
            || a - b);

        return props.legendSeriesHeadings
            ? keepPreviousOrder(props, seriesIndexes, seriesMaxes, isOther)
            : seriesIndexes;
    };

    // The order set when the legend was last drawn, or the series' own where it has not been.
    const getLegendOrder = props => {

        const legendOrder = props.legendSeriesOrder;

        if (legendOrder && legendOrder.length === props.seriesCount) return legendOrder;

        const seriesIndexes = [];

        for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {
            seriesIndexes.push(seriesIndex);
        }

        return seriesIndexes;
    };

    // Gets the numbers of the series whose entries run from one entry to another, in that order.
    const getSeriesIndexesBetween = (props, fromSeriesIndex, toSeriesIndex) => {

        const legendOrder = getLegendOrder(props);
        const fromPosition = legendOrder.indexOf(fromSeriesIndex);
        const toPosition = legendOrder.indexOf(toSeriesIndex);
        const step = toPosition >= fromPosition ? 1 : -1;
        const seriesIndexes = [];

        for (let position = fromPosition; position !== toPosition + step; position += step) {
            seriesIndexes.push(legendOrder[position]);
        }

        return seriesIndexes;
    };

    /**
     * Selects the clicked series alone, or clears the selection if it was the only one selected.
     * With Ctrl it adds the series to (or takes it from) the selection, and with Shift it adds the
     * series whose entries run from the one last selected to it.
     */
    const selectEntry = (props, seriesIndex, event) => {

        const selectedSeriesIndexes = getSelectedSeriesIndexes(props);

        if (event.ctrlKey || event.metaKey) {

            const newSelection = selectedSeriesIndexes.filter(index => index !== seriesIndex);

            if (newSelection.length === selectedSeriesIndexes.length) {
                newSelection.push(seriesIndex);
            }

            setSelectedSeriesIndexes(props, newSelection);
            return;
        }

        if (event.shiftKey && selectedSeriesIndexes.length > 0) {

            const anchorIndex = selectedSeriesIndexes[selectedSeriesIndexes.length - 1];

            // The range is added from the anchor out, so the entry clicked is the last selected.
            const rangeSeriesIndexes = getSeriesIndexesBetween(props, anchorIndex, seriesIndex);
            const newSelection = selectedSeriesIndexes.filter(
                index => rangeSeriesIndexes.indexOf(index) === -1
            );

            for (let i = 0; i < rangeSeriesIndexes.length; i++) {
                newSelection.push(rangeSeriesIndexes[i]);
            }

            setSelectedSeriesIndexes(props, newSelection);
            return;
        }

        if (selectedSeriesIndexes.length === 1 && selectedSeriesIndexes[0] === seriesIndex) {

            setSelectedSeriesIndexes(props, []);
            return;
        }

        setSelectedSeriesIndexes(props, [seriesIndex]);
    };

    // How far the pointer must move with the button down before a press becomes a lasso.
    const LASSO_THRESHOLD = 4;

    // Set when a lasso has already acted on the press that a click ends.  Only one press can be
    // under way at a time, so it need not be kept per chart.
    let isClickHandled = false;

    const isSeriesShown = (props, seriesIndex) =>
        props.series[seriesIndex - 1]?.isEnabled !== false;

    /**
     * Gets a series' saved settings, adding them where it has none.  They are found by column, as
     * a split chart, or each of a multi-chart's charts, orders them by the series it draws, and by
     * position where they pre-date columns.
     */
    const getSeriesSettings = (props, seriesIndex) => {

        const seriesSettings = props.visualisation.series;
        const column = props.valueHeadings?.[seriesIndex];

        for (let i = 0; column && i < seriesSettings.length; i++) {

            if (seriesSettings[i]?.column === column) return seriesSettings[i];
        }

        const settings = Object.assign({ column }, props.series[seriesIndex]);

        // The settings at the series' position are another column's.
        if (column && seriesSettings[seriesIndex]?.column) {

            seriesSettings.push(settings);
            return settings;
        }

        seriesSettings[seriesIndex] ??= settings;

        return seriesSettings[seriesIndex];
    };

    /**
     * Shows the given series and hides every other, committing the change only if it changes what
     * is shown.
     */
    const setShownSeries = (props, seriesIndexes) => {

        const visualisation = props.visualisation;

        if (!visualisation || !props.series) return;

        let isChanged = false;

        visualisation.series ??= [];

        for (let i = 0; i < props.seriesCount; i++) {

            const isEnabled = seriesIndexes.indexOf(i + 1) !== -1;

            if (isSeriesShown(props, i + 1) === isEnabled) continue;

            if (props.series[i]) props.series[i].isEnabled = isEnabled;

            getSeriesSettings(props, i).isEnabled = isEnabled;
            isChanged = true;
        }

        if (!isChanged) return;

        // The axes are re-fitted to the series shown, so the extents must not be skipped.
        props.skipExtentRecalculation = false;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    const getShownSeriesIndexes = props => {

        const seriesIndexes = [];

        for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {
            if (isSeriesShown(props, seriesIndex)) seriesIndexes.push(seriesIndex);
        }

        return seriesIndexes;
    };

    /**
     * Gets the series shown when every series is shown again: all of them, but for the minor ones
     * where the chart hides those.
     */
    const getRestoredSeriesIndexes = props => {

        const minorHeadings = props.visualisation?.hideMinorSplitSeries
            ? Ren.DateValueChart_SeriesSplit.getMinorSeriesHeadings(
                props.preGroupedData || [],
                props.valueHeadings || []
            )
            : null;

        const seriesIndexes = [];
        const allSeriesIndexes = [];

        for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {

            allSeriesIndexes.push(seriesIndex);

            if (!minorHeadings || !minorHeadings.has(props.valueHeadings[seriesIndex - 1])) {
                seriesIndexes.push(seriesIndex);
            }
        }

        // Hiding every series would leave nothing to show.
        return seriesIndexes.length > 0 ? seriesIndexes : allSeriesIndexes;
    };

    // Shows a hidden series along with those already shown.
    const showSeries = (props, seriesIndex) => {

        const shownSeriesIndexes = getShownSeriesIndexes(props);

        shownSeriesIndexes.push(seriesIndex);

        setShownSeries(props, shownSeriesIndexes);
    };

    /**
     * Shows the series alone, or every series again where it already is alone, so that a second
     * double-click undoes the first.
     */
    const isolateSeries = (props, seriesIndex) => {

        const shownSeriesIndexes = getShownSeriesIndexes(props);

        if (shownSeriesIndexes.length === 1 && shownSeriesIndexes[0] === seriesIndex) {

            setShownSeries(props, getRestoredSeriesIndexes(props));
            return;
        }

        setShownSeries(props, [seriesIndex]);
    };

    const getLegendEntrySeriesIndex = target => {

        const entryElement = target.closest(".ren-legend-entry");

        return entryElement ? parseInt(entryElement.parentNode.getAttribute("data-series")) : null;
    };

    // Gets the numbers of the series whose entries the lasso touches, in legend order.
    const getLassoedSeriesIndexes = (legendNode, lassoRect) => {

        const entries = legendNode.querySelectorAll(".ren-legend-entry");
        const itemsNode = legendNode.querySelector("." + ITEMS_CLASS_NAME);
        const itemsRect = itemsNode ? itemsNode.getBoundingClientRect() : null;
        const seriesIndexes = [];

        for (let i = 0; i < entries.length; i++) {

            const entryRect = entries[i].getBoundingClientRect();

            if (entryRect.right < lassoRect.left || entryRect.left > lassoRect.right
                || entryRect.bottom < lassoRect.top || entryRect.top > lassoRect.bottom) {

                continue;
            }

            // An entry scrolled out of view is not lassoed.
            if (itemsRect && (entryRect.right <= itemsRect.left
                || entryRect.left >= itemsRect.right)) {

                continue;
            }

            seriesIndexes.push(parseInt(entries[i].parentNode.getAttribute("data-series")));
        }

        return seriesIndexes;
    };

    const isSameSelection = (seriesIndexes, otherSeriesIndexes) => {

        if (seriesIndexes.length !== otherSeriesIndexes.length) return false;

        for (let i = 0; i < seriesIndexes.length; i++) {
            if (seriesIndexes[i] !== otherSeriesIndexes[i]) return false;
        }

        return true;
    };

    /**
     * A drag across the legend draws a lasso, selecting the series of the entries it touches in
     * place of the selection, or with Ctrl or Shift in addition to it.  A press that moves less
     * than the threshold is left to be a click.
     */
    const onLegendMouseDown = (props, event) => {

        isClickHandled = false;

        if (event.button !== 0) return;

        // A press on the items' scrollbar scrolls them, and the click it ends in is ignored.
        if (event.target.classList?.contains(ITEMS_CLASS_NAME)
            && event.offsetY >= event.target.clientHeight) {

            isClickHandled = true;
            return;
        }

        const legendNode = event.currentTarget;
        const legendRectAtStart = legendNode.getBoundingClientRect();

        // Held against the legend, so the lasso stays anchored if the page scrolls.
        const startX = event.clientX - legendRectAtStart.left;
        const startY = event.clientY - legendRectAtStart.top;

        const isAdding = event.ctrlKey || event.metaKey || event.shiftKey;
        const selectionBefore = isAdding ? getSelectedSeriesIndexes(props) : [];

        let lassoElement = null;

        const finish = () => {

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);

            if (lassoElement) lassoElement.remove();
        };

        const onMouseMove = moveEvent => {

            // A redraw during the drag replaces the legend.
            if (!legendNode.isConnected) {

                finish();
                return;
            }

            const legendRect = legendNode.getBoundingClientRect();
            const anchorX = legendRect.left + startX;
            const anchorY = legendRect.top + startY;

            if (!lassoElement) {

                if (Math.abs(moveEvent.clientX - anchorX) < LASSO_THRESHOLD
                    && Math.abs(moveEvent.clientY - anchorY) < LASSO_THRESHOLD) {

                    return;
                }

                lassoElement = appendDiv(legendNode, "ren-legend-lasso", {});
            }

            // The lasso is drawn inside the legend, so is kept within it.
            const lassoRect = {
                left: Math.max(legendRect.left, Math.min(anchorX, moveEvent.clientX)),
                top: Math.max(legendRect.top, Math.min(anchorY, moveEvent.clientY)),
                right: Math.min(legendRect.right, Math.max(anchorX, moveEvent.clientX)),
                bottom: Math.min(legendRect.bottom, Math.max(anchorY, moveEvent.clientY))
            };

            lassoElement.style.left =
                (lassoRect.left - legendRect.left - legendNode.clientLeft) + "px";
            lassoElement.style.top = (lassoRect.top - legendRect.top - legendNode.clientTop) + "px";
            lassoElement.style.width = (lassoRect.right - lassoRect.left) + "px";
            lassoElement.style.height = (lassoRect.bottom - lassoRect.top) + "px";

            const lassoedSeriesIndexes = getLassoedSeriesIndexes(legendNode, lassoRect);
            const newSelection = selectionBefore.filter(
                index => lassoedSeriesIndexes.indexOf(index) === -1
            );

            for (let i = 0; i < lassoedSeriesIndexes.length; i++) {
                newSelection.push(lassoedSeriesIndexes[i]);
            }

            if (isSameSelection(newSelection, getSelectedSeriesIndexes(props))) return;

            setSelectedSeriesIndexes(props, newSelection);
        };

        const onMouseUp = () => {

            if (lassoElement !== null) isClickHandled = true;

            finish();
        };

        // Stops the drag selecting the text of the entries it crosses.
        event.preventDefault();

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    /**
     * A click on an entry's marker or label selects its series as selectEntry describes, and a
     * click anywhere else in the legend clears the selection.  A plain click on a hidden series'
     * entry shows it instead, and a double-click shows the series alone, or every series again
     * where it already was alone.  The entry clicked isn't previewed until the pointer leaves it.
     */
    const onLegendClicked = (props, event) => {

        // The click a lasso ends on has already been acted on.
        if (isClickHandled) {

            isClickHandled = false;
            return;
        }

        const seriesIndex = getLegendEntrySeriesIndex(event.target);

        if (!seriesIndex) {

            clearSelection(props);
            return;
        }

        suppressHover(props, seriesIndex);

        const isModified = event.ctrlKey || event.metaKey || event.shiftKey;

        // The click count is used rather than a dblclick event, as a redraw can replace the entry
        // clicked.  The series shown alone needs no selection to stand out.
        if (!isModified && event.detail === 2) {

            clearSelection(props);
            isolateSeries(props, seriesIndex);
            return;
        }

        // A hidden series isn't plotted, so has nothing to select, and is shown instead.
        if (!isModified && !isSeriesShown(props, seriesIndex)) {

            showSeries(props, seriesIndex);
            return;
        }

        selectEntry(props, seriesIndex, event);
    };

    /**
     * Shows a hidden series, or hides a shown one but for the last, keeping the focus on its
     * entry through the redraw.
     */
    const toggleSeriesShown = (props, seriesIndex) => {

        props.focusedLegendSeriesNum = seriesIndex;

        if (!isSeriesShown(props, seriesIndex)) {

            showSeries(props, seriesIndex);
            return;
        }

        const shownSeriesIndexes = getShownSeriesIndexes(props)
            .filter(shownSeriesIndex => shownSeriesIndex !== seriesIndex);

        if (shownSeriesIndexes.length > 0) setShownSeries(props, shownSeriesIndexes);
    };

    // Enter or Space toggles a focused entry's series, and the arrows move between the entries.
    const onLegendKeyDown = (props, event) => {

        const entry = event.target.closest && event.target.closest(".ren-legend-entry");

        if (!entry) return;

        if (event.key === "Enter" || event.key === " ") {

            event.preventDefault();
            toggleSeriesShown(props, getLegendEntrySeriesIndex(entry));
            return;
        }

        const next = Ren.DateValueChart_Accessibility.getAdjacentEntry(
            Array.from(event.currentTarget.querySelectorAll(".ren-legend-entry")),
            entry,
            event.key
        );

        if (!next) return;

        event.preventDefault();
        next.focus();
    };

    // Where the last press on each chart's svg went down, so a drag across the plot isn't then
    // read as a click on it.
    const pressBySvgNode = new WeakMap();

    const isDragEnd = (svgNode, event) => {

        const press = pressBySvgNode.get(svgNode);
        const threshold = Ren.DateValueChart_DateRangeSelection.DRAG_THRESHOLD_PX;

        return !!press && (Math.abs(event.clientX - press.clientX) >= threshold
            || Math.abs(event.clientY - press.clientY) >= threshold);
    };

    /**
     * A click on a bar, line or dot selects its series as a click on its legend entry would, and
     * a click on empty space clears the selection, and the cross filters a click on a series set.
     * An Alt+click is left to the bars' own highlighting.
     */
    const onChartClicked = (props, event) => {

        if (event.button !== 0 || event.altKey || props.showLegend === false) return;

        const target =
            Ren.DateValueChart_Pies.getClickTarget(event.target, event.clientX, event.clientY);
        const seriesElement = target.closest && target.closest("[data-series]");

        if (!seriesElement) {

            const legendProps = props.sharedLegendProps || props;

            if (Ren.DateValueChart_DateRangeSelection.isOnEmptySpace(target)
                && !isDragEnd(props.svg, event)
                && getSelectedSeriesIndexes(legendProps).length) {

                clearSelection(legendProps);
                Ren.DateValueChart_CrossFiltering.clearFilters(props);
            }

            return;
        }

        const legend = getLegend(props, parseInt(seriesElement.getAttribute("data-series")));

        if (legend.seriesNum) selectEntry(legend.props, legend.seriesNum, event);
    };

    /**
     * Gets the props of the chart whose legend a chart's series are in, and the number the legend
     * gives one of them: a multi-chart's legend for each of its charts, or else the chart's own.
     */
    const getLegend = (props, seriesNum) => {

        const legendProps = props.sharedLegendProps;

        return legendProps
            ? {
                props: legendProps,
                seriesNum: Ren.DateValueChart_MultiChart.getChartSeriesNum(
                    props,
                    legendProps,
                    seriesNum
                )
            }
            : { props, seriesNum };
    };

    // Set on the svg rather than added to it, as the svg outlives the redraws that call this.
    const attachChartClicks = props => {

        if (!props.svg) return;

        const svgNode = props.svg;

        if (!pressBySvgNode.has(svgNode)) {

            pressBySvgNode.set(svgNode, null);

            svgNode.addEventListener("mousedown", (event) => {

                pressBySvgNode.set(svgNode, { clientX: event.clientX, clientY: event.clientY });
            });
        }

        svgNode.onclick = event => onChartClicked(props, event);
    };

    /**
     * Darkens and shadows the label of the legend entry for the series whose bar, line or dot is
     * under the pointer, and underlines the entry, or none where there is none.  A shadow rather
     * than bold, as bold would widen the label and could wrap it.  Kept in its own stylesheet,
     * keyed by series, so as to hold through the legend being redrawn.
     */
    const setChartHoveredSeries = (props, seriesNum) => {

        if (props.chartHoveredSeriesNum === seriesNum) return;

        props.chartHoveredSeriesNum = seriesNum;

        if (!props.chartHoverLegendStylesheet) {

            props.chartHoverLegendStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "chart-hover-legend")
                .getStylesheet();
        }

        const entryClass = `.${props.guid} .ren-legend-item.ren-series-${seriesNum}`;

        // Important to win over the label's inline colour.  The line beneath the entry is
        // positioned out of the flow, so as not to change the entry's size.
        props.chartHoverLegendStylesheet.textContent = seriesNum
            ? `${entryClass} .ren-legend-text { color: black !important; `
                + "text-shadow: 0 0 1px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.4) }\n"
                + `${entryClass} .ren-legend-entry { position: relative }\n`
                + `${entryClass} .ren-legend-entry::after { content: ""; position: absolute; `
                + "left: 0; right: 0; bottom: -5px; height: 2px; background: black }"
            : "";
    };

    const getChartSeriesNum = target => {

        const seriesElement = target && target.closest && target.closest("[data-series]");

        return seriesElement ? parseInt(seriesElement.getAttribute("data-series")) : null;
    };

    // Set on the svg rather than added to it, as the svg outlives the redraws that call this.
    const attachChartHover = props => {

        if (!props.svg) return;

        const svgNode = props.svg;

        svgNode.onmouseover = event => {

            const legend = getLegend(props, getChartSeriesNum(event.target));

            setChartHoveredSeries(legend.props, legend.seriesNum);
        };

        svgNode.onmouseout = event => {

            if (svgNode.contains(event.relatedTarget)) return;

            setChartHoveredSeries(getLegend(props, null).props, null);
        };
    };

    /**
     * Gets a value indicating whether removing the given series would leave a series other than
     * an "Other" series, as removal always does.
     */
    const isAnySeriesLeft = (props, seriesIndexes) => {

        for (let index = 0; index < (props.valueHeadings || []).length; index++) {

            if (seriesIndexes.indexOf(index + 1) === -1
                && !Ren.DateValueChart_OtherSeries.isOtherHeading(props.valueHeadings[index])) {

                return true;
            }
        }

        return false;
    };

    /**
     * The Delete key removes the series selected in a legend, as "Remove series" in their menu
     * does, unless it is typed into a field.  At least one series is kept, so with every series
     * selected it does nothing.
     */
    const onKeyDown = event => {

        if (event.key !== "Delete" || !lastSelectionProps) return;
        if (!Ren.EventScope.isKeyboardEventInScope(event)) return;

        const target = event.target;

        if (target.closest && target.closest("input, textarea, select, [contenteditable]")) return;

        const props = lastSelectionProps;
        const seriesIndexes = getSelectedSeriesIndexes(props);
        const legendNode = document.querySelector(
            "." + props.guid + " .ren-date-value-chart-legend-html"
        );

        // A chart since redrawn without its legend, or closed, keeps no selection to act on.
        if (seriesIndexes.length === 0 || !legendNode) {

            lastSelectionProps = null;
            return;
        }

        event.preventDefault();

        if (!isAnySeriesLeft(props, seriesIndexes)) return;

        Ren.DateValueChart_SeriesRemoval.removeSeries(props, seriesIndexes.slice());
    };

    document.addEventListener("keydown", onKeyDown);

    /**
     * Appends the coloured marker for a series, shaped to match how the series is drawn: a line for
     * a line series, a dot for a point series, and a square for a bar series.
     */
    const appendColourMarker = (parent, seriesType, pointRadius) => {

        if (seriesType === "line") {

            const markerSvg = Ren.Svg.append(parent, "svg", { "class": "ren-legend-colour-rect" });

            Ren.Svg.setStyles(markerSvg, {
                "flex-shrink": "0",
                "overflow": "visible",
                "background-color": "transparent"
            });

            // Its width and dash pattern follow the series' line, from the chart's stylesheet.
            Ren.Svg.append(markerSvg, "line", {
                "x1": "0%",
                "y1": "50%",
                "x2": "100%",
                "y2": "50%",
                "stroke-linecap": "round"
            });

            return markerSvg;
        }

        if (seriesType === "point") {

            const markerSvg = Ren.Svg.append(parent, "svg", { "class": "ren-legend-colour-rect" });

            Ren.Svg.setStyles(markerSvg, {
                "flex-shrink": "0",
                "background-color": "transparent"
            });

            Ren.Svg.append(markerSvg, "circle", { "cx": "50%", "cy": "50%", "r": pointRadius });

            return markerSvg;
        }

        return appendDiv(parent, "ren-legend-colour-rect", { "flex-shrink": "0" });
    };

    const appendDiv = (parent, className, styles) => {

        const div = document.createElement("div");

        div.className = className;
        Ren.Svg.setStyles(div, styles);

        return parent.appendChild(div);
    };

    /**
     * Gives a split series' label the auto menu of the column the chart is split by, for the value
     * the series covers.  The "(other)" series lumps several values together, so has none.
     */
    const applySplitValueAutoMenu = (props, seriesIndex, element) => {

        const seriesSplit = props.seriesSplit;

        if (!seriesSplit?.autoMenuName) return;

        const splitValue = seriesSplit.splitValueBySeriesHeading[props.valueHeadings[seriesIndex]];

        if (splitValue === Ren.DateValueChart_SeriesSplit.OTHER_VALUE) return;

        Ren.AutoMenu.applyMenu(element, seriesSplit.autoMenuName, splitValue);
    };

    /**
     * Scrolls the legend's items across as the wheel turns, where they overflow it, until they
     * can scroll no further that way, when the page is scrolled instead.
     */
    const onItemsWheel = event => {

        const itemsNode = event.currentTarget;

        if (event.deltaX !== 0 || event.deltaY === 0 || event.ctrlKey) return;

        const maxScrollLeft = itemsNode.scrollWidth - itemsNode.clientWidth;

        if (maxScrollLeft <= 0) return;

        if (event.deltaY < 0 ? itemsNode.scrollLeft <= 0 : itemsNode.scrollLeft >= maxScrollLeft) {
            return;
        }

        event.preventDefault();
        itemsNode.scrollLeft += event.deltaY;
    };

    const renderLegend = props => {

        // Remove existing legend if present.
        const container = document.querySelector("." + props.guid);

        container?.querySelector(".ren-date-value-chart-legend-html")?.remove();

        // The legend replaced may have been hovered, and would not report the pointer leaving.
        cancelHoverEnd(props);
        Ren.DateValueChart_StyleUpdater.updateHoverStyles(props);

        props.legendSeriesOrder = getLegendSeriesOrder(props);

        props.legendSeriesHeadings = props.legendSeriesOrder.map(
            seriesIndex => props.valueHeadings[seriesIndex - 1]
        );

        // A multi-chart's charts share the legend drawn beneath them all.
        if (props.showLegend === false || props.multiChartRange || !container) {

            // The chart is cleared of a selection made before the legend was hidden.
            Ren.DateValueChart_StyleUpdater.updateSelectionStyles(props);
            return;
        }

        // Create legend as flex item that takes only needed space.
        // Scalable dimensions (padding, font-size, rect size) are set via updateStylesheet.
        const legendContainer = appendDiv(container, "ren-date-value-chart-legend-html", {
            "position": "relative",
            "flex": "0 0 auto",
            "margin": "0",
            "background": "white",
            "border-top": "1px solid #cccccc",
            "box-sizing": "border-box"
        });

        // The items scroll across beneath the series limit, which stays put.
        const itemsContainer = appendDiv(legendContainer, ITEMS_CLASS_NAME, {
            "display": "flex",
            "flex-direction": "row",
            "flex-wrap": "wrap",
            "overflow-x": "auto",
            "overflow-y": "hidden"
        });

        itemsContainer.addEventListener("wheel", onItemsWheel, { passive: false });
        legendContainer.addEventListener("mousedown", event => onLegendMouseDown(props, event));
        legendContainer.addEventListener("click", event => onLegendClicked(props, event));
        legendContainer.addEventListener("keydown", event => onLegendKeyDown(props, event));

        legendContainer.addEventListener("mouseover", event => {

            // Only the marker and label, as a click takes them, so the blank space beside an
            // entry is blank to a hover too.
            const seriesNum = getLegendEntrySeriesIndex(event.target);

            // An entry just clicked isn't previewed until left.
            if (seriesNum && seriesNum === props.hoverSuppressedSeriesNum) {

                cancelHoverEnd(props);
                Ren.DateValueChart_StyleUpdater.updateHoverStyles(props);
                return;
            }

            props.hoverSuppressedSeriesNum = null;

            if (!seriesNum) {

                endHoverAfterDelay(props);
                return;
            }

            cancelHoverEnd(props);
            Ren.DateValueChart_StyleUpdater.updateHoverStyles(props, seriesNum);
        });

        legendContainer.addEventListener("mouseleave", () => {

            props.hoverSuppressedSeriesNum = null;
            endHoverAfterDelay(props);
        });

        for (let position = 0; position < props.legendSeriesOrder.length; position++) {

            const i = props.legendSeriesOrder[position] - 1;
            const heading = props.series[i]?.label || props.valueHeadings[i];
            const seriesType = props.seriesTypeStrings ? props.seriesTypeStrings[i] : "bar";
            const isEnabled = props.series[i].isEnabled !== false;

            const itemDiv = appendDiv(itemsContainer, `ren-legend-item ren-series-${i + 1}`, {
                "display": "flex",
                "align-items": "center"
            });

            itemDiv.setAttribute("data-series", i + 1);
            itemDiv.setAttribute("data-series-enabled", isEnabled ? "true" : "false");

            // The marker and label together, which is what a selection boxes.  The items are all
            // as wide as the widest, so the item itself would take in the space beside a label.
            const entryDiv = appendDiv(itemDiv, "ren-legend-entry", {
                "display": "flex",
                "align-items": "center",
                "outline-offset": "1px",
                "user-select": "none"
            });

            // The visualisation's effects recolour the series, so recolour their markers too.  They
            // go on a wrapper, as the marker's own filter is the series' colour variant.
            const markerWrapper = appendDiv(
                entryDiv,
                Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME,
                { "display": "flex", "flex-shrink": "0" }
            );

            Ren.DateValueChart_Accessibility.makeLegendEntryButton(entryDiv, isEnabled);

            appendColourMarker(markerWrapper, seriesType, 3)
                .style.cursor = "pointer";

            entryDiv.style.minWidth = "0";

            // A label too long for the items' widest width is cut short (see alignItems).
            const legendText = appendDiv(entryDiv, "ren-legend-text", {
                "color": "#333",
                "cursor": "pointer",
                "overflow": "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "min-width": "0"
            });

            legendText.textContent = heading ?? "";

            Ren.DateValueChart_OtherSeries.addTooltip(legendText, props, i);

            applySplitValueAutoMenu(props, i, legendText);
        }

        Ren.DateValueChart_StyleUpdater.updateSelectionStyles(props);

        // A redraw toggled from an entry focuses the entry that replaced it.
        if (props.focusedLegendSeriesNum) {

            itemsContainer.querySelector(
                `.ren-legend-item[data-series="${props.focusedLegendSeriesNum}"] .ren-legend-entry`
            )?.focus();

            props.focusedLegendSeriesNum = null;
        }
    };

    /**
     * Gets the width of the widest item the series beyond the legend's limit would have, measured
     * as copies of an item shown, so that the items are wide enough for any series a change of
     * dates brings into the legend.
     */
    const getWidestLimitedOutItem = (props, itemsNode, items, layoutScale) => {

        // There can be thousands, so only the longest few are measured.
        const headings = (props.limitedOutHeadings || [])
            .slice()
            .sort((a, b) => String(b).length - String(a).length)
            .slice(0, MAX_MEASURED_LIMITED_OUT_ITEMS);

        if (items.length === 0 || headings.length === 0) return 0;

        const copies = [];

        for (let index = 0; index < headings.length; index++) {

            const copy = items[0].cloneNode(true);

            copy.style.position = "absolute";
            copy.style.visibility = "hidden";
            copy.querySelector(".ren-legend-text").textContent = headings[index];

            itemsNode.appendChild(copy);
            copies.push(copy);
        }

        let widest = 0;

        for (let index = 0; index < copies.length; index++) {

            widest = Math.max(widest, copies[index].getBoundingClientRect().width * layoutScale);
        }

        for (let index = 0; index < copies.length; index++) {
            copies[index].remove();
        }

        return widest;
    };

    // Gives each label cut short by MAX_ITEM_WIDTH its full text as a tooltip.
    const addCutShortLabelTitles = items => {

        const cutShortTexts = [];

        for (let index = 0; index < items.length; index++) {

            const text = items[index].querySelector(".ren-legend-text");

            if (text && !text.hasAttribute("data-full-text-title")
                && text.scrollWidth > text.clientWidth) {

                cutShortTexts.push(text);
            }
        }

        for (let index = 0; index < cutShortTexts.length; index++) {

            const text = cutShortTexts[index];

            text.title = text.title ? text.textContent + "\n\n" + text.title : text.textContent;
            text.setAttribute("data-full-text-title", "");
        }
    };

    /**
     * Gets how many columns of items fit across the legend, each item being as wide as the first,
     * which has been given the width of the widest.
     */
    const getColumnCount = (itemsNode, items, layoutScale) => {

        const itemsStyle = getComputedStyle(itemsNode);
        const columnGap = parseFloat(itemsStyle.columnGap) || 0;
        const itemMargin = parseFloat(getComputedStyle(items[0]).marginRight) || 0;
        const itemWidth = items[0].getBoundingClientRect().width * layoutScale;
        const contentWidth = itemsNode.clientWidth
            - parseFloat(itemsStyle.paddingLeft)
            - parseFloat(itemsStyle.paddingRight);

        const columnWidth = itemWidth + itemMargin + columnGap;

        return Math.max(1, Math.floor((contentWidth + columnGap) / columnWidth));
    };

    /**
     * Gives every legend item the width of the widest, and lays the items out down columns rather
     * than along rows, so that the highest series, which come first, are all at the left however
     * many rows there are.  Only done when the legend is new or its sizes or width have changed, as
     * it has to measure each item.
     *
     * @param {object} props - The chart's props.
     * @param {boolean} isResized - Whether the legend's sizes have changed since it was aligned.
     * @returns {boolean} Whether the legend's height changed, which resizes the plot.
     */
    const alignItems = (props, isResized) => {

        const legendNode = document.querySelector(
            "." + props.guid + " .ren-date-value-chart-legend-html"
        );

        if (!legendNode) return false;

        // The legend is stretched across the chart, so its width doesn't follow its layout.
        const legendWidth = String(legendNode.clientWidth);

        if (!isResized && legendNode.getAttribute("data-items-aligned") === legendWidth) {
            return false;
        }

        if (!props.legendItemsStylesheet) {

            props.legendItemsStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "legend-items")
                .getStylesheet();
        }

        const itemsNode = legendNode.querySelector("." + ITEMS_CLASS_NAME);

        if (!itemsNode) return false;

        const heightBefore = legendNode.offsetHeight;
        const items = itemsNode.querySelectorAll(".ren-legend-item");

        // The items are measured at their own widths, flowing along rows.
        props.legendItemsStylesheet.textContent = "";
        itemsNode.style.display = "flex";

        // Client rects are scaled by any transform on the way up (a zoomed or scale-to-fit popup),
        // so are scaled back to layout widths, or the widest label would no longer fit and wrap.
        const legendRectWidth = legendNode.getBoundingClientRect().width;
        const layoutScale = legendRectWidth ? legendNode.offsetWidth / legendRectWidth : 1;

        let widest = getWidestLimitedOutItem(props, itemsNode, items, layoutScale);

        for (let i = 0; i < items.length; i++) {
            widest = Math.max(widest, items[i].getBoundingClientRect().width * layoutScale);
        }

        // The widest item seen is kept while the legend is the same width, so that the gaps
        // between items hold steady as the dates drawn change which series are shown.
        const keptWidth = props.legendItemWidth;

        if (keptWidth && keptWidth.key === legendWidth) {
            widest = Math.max(widest, keptWidth.width);
        }

        props.legendItemWidth = { key: legendWidth, width: widest };

        const itemWidth = Math.ceil(Math.min(widest, MAX_ITEM_WIDTH));

        props.legendItemsStylesheet.textContent =
            `.${props.guid} .ren-legend-item { width: ${itemWidth}px; padding-right: 1rem }`;

        if (widest > MAX_ITEM_WIDTH) {
            addCutShortLabelTitles(items);
        }

        if (items.length > 0) {

            // As few rows as the columns that fit allow, each column filled before the next.
            // Beyond MAX_ROWS the legend grows no taller, its items scrolling across instead.
            const columnCount = getColumnCount(itemsNode, items, layoutScale);
            const rowCount = Math.min(MAX_ROWS, Math.ceil(items.length / columnCount));

            itemsNode.style.display = "grid";
            itemsNode.style.gridTemplateRows = `repeat(${rowCount}, auto)`;
            itemsNode.style.gridAutoFlow = "column";
            itemsNode.style.gridAutoColumns = "max-content";
            itemsNode.style.justifyContent = "start";
        }

        legendNode.setAttribute("data-items-aligned", legendWidth);

        return legendNode.offsetHeight !== heightBefore;
    };

    return {
        renderLegend,
        alignItems,
        getSelectedSeriesIndexes,
        showSelection,
        clearSelection,
        attachChartClicks,
        attachChartHover
    };
})();
