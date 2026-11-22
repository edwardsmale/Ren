/**
 * Limits a date/value chart to the series reaching highest, the ones its legend puts first.  The
 * series beyond the limit are left out as removed ones are, legend entries and all.  The chart
 * saves the limit as legendSeriesLimit, which is unset while every series is shown, and says what
 * the limit is among the pickers at its top right, opening an editor for it when clicked.
 */
Ren.DateValueChart_SeriesLimit = (() => {

    const STATUS_CLASS_NAME = "ren-date-value-chart-series-limit";
    const PICKERS_CLASS_NAME = "ren-date-value-chart-column-pickers";

    // The limit a split making more series than this is held to.  A chart without dates draws a
    // bar per series rather than one per series per date, so has room for more.
    const SPLIT_LIMIT = 24;
    const DATELESS_SPLIT_LIMIT = 50;

    // The highest limit the editor can be set to.
    const MAX_EDITOR_LIMIT = 100;
    const DATELESS_MAX_EDITOR_LIMIT = 500;

    // Gets the most series the limit can be set to show, which is all a split need make.
    const getMostShown = (hasDateColumn) => hasDateColumn
        ? MAX_EDITOR_LIMIT
        : DATELESS_MAX_EDITOR_LIMIT;

    // Gets the chart's limit, or null where it shows every series.
    const getLimit = (visualisation) => visualisation?.legendSeriesLimit > 0
        ? Math.floor(visualisation.legendSeriesLimit)
        : null;

    const getRowsMax = (rows, heading) => {

        let max = -Infinity;

        for (let index = 0; index < rows.length; index++) {

            const value = Ren.TextUtils.parseFloat(rows[index][heading]);

            if (value !== null && value > max) max = value;
        }

        return max;
    };

    /**
     * Gets those of the given headings within a limit, in the order given: the series reaching
     * highest over the rows.  Series reaching the same height are taken in the order given.  Where
     * a group key is given, the limit is applied within each group of series.
     */
    const getLimitedHeadings = (headings, rows, limit, getGroupKey) => {

        if (!limit || headings.length <= limit) return headings;

        const maxes = [];
        const indexes = [];

        for (let index = 0; index < headings.length; index++) {

            maxes.push(getRowsMax(rows || [], headings[index]));
            indexes.push(index);
        }

        indexes.sort((a, b) => maxes[b] - maxes[a] || a - b);

        const isKept = {};
        const keptCounts = new Map();

        for (let position = 0; position < indexes.length; position++) {

            const index = indexes[position];
            const groupKey = getGroupKey ? getGroupKey(headings[index]) : null;
            const keptCount = keptCounts.get(groupKey) || 0;

            if (keptCount < limit) {

                isKept[index] = true;
                keptCounts.set(groupKey, keptCount + 1);
            }
        }

        return headings.filter((heading, index) => isKept[index]);
    };

    // Gets the most series in any one group, or 0 where there are no headings.
    const getLargestGroupSize = (headings, getGroupKey) => {

        const groupSizes = new Map();
        let largest = 0;

        for (let index = 0; index < headings.length; index++) {

            const groupKey = getGroupKey(headings[index]);
            const groupSize = (groupSizes.get(groupKey) || 0) + 1;

            groupSizes.set(groupKey, groupSize);
            largest = Math.max(largest, groupSize);
        }

        return largest;
    };

    /**
     * Gets what the legend says of a limit, out of the number of series there are to limit where
     * that is known.  A limit applied per value column is given the most series any column has.
     */
    const describe = (limit, seriesCount, seriesPerColumnCount) => {

        const ofCount = seriesCount > 0 ? ` of ${seriesCount}` : "";
        const mostLimitable = seriesPerColumnCount ?? seriesCount;

        if (limit && !(mostLimitable > 0 && limit >= mostLimitable)) {

            return seriesPerColumnCount != null
                ? `Showing top ${limit} per column${ofCount} series`
                : `Showing top ${limit}${ofCount} series`;
        }

        return seriesCount > 0 ? `Showing all ${seriesCount} series` : "Showing all series";
    };

    // Gets how many series the limit picks from: those not removed.
    const getSeriesCount = (props) => props.limitableSeriesCount
        ?? (props.valueHeadings || []).length;

    // Gets the most series the limit picks from in any one value column, where it is applied per
    // value column, or null.
    const getSeriesPerColumnCount = (props) => props.limitableSeriesPerColumnCount ?? null;

    // Gets the most series the limit can leave out of any one pick.
    const getMostLimitableCount = (props) => getSeriesPerColumnCount(props)
        ?? getSeriesCount(props);

    const setLimit = (props, limit) => {

        const visualisation = props.visualisation;

        if ((visualisation.legendSeriesLimit ?? null) === (limit ?? null)) return;

        visualisation.legendSeriesLimit = limit ?? undefined;
        visualisation.legendSeriesLimitChosen = true;

        // The axes are re-fitted to the series drawn, so the extents must not be skipped.
        props.skipExtentRecalculation = false;

        Ren.VisualisationSettingsSynchroniser.commitChange(
            visualisation,
            props.redrawVisualisation
        );
    };

    /**
     * Limits a chart split into more series than SPLIT_LIMIT, or DATELESS_SPLIT_LIMIT for one
     * without dates, to the top ones, where it has no tighter limit already and the user has not
     * chosen one, and says so once the chart is drawn.  The limit is saved with the chart, so it
     * says so only the once.
     */
    const limitSplitSeries = (
        visualisation,
        splitValueCount,
        splitColumnHeading,
        hasDateColumn) => {

        const limit = getLimit(visualisation);
        const splitLimit = hasDateColumn ? SPLIT_LIMIT : DATELESS_SPLIT_LIMIT;

        if (visualisation.legendSeriesLimitChosen === true) return;

        if (splitValueCount <= splitLimit || (limit && limit <= splitLimit)) return;

        visualisation.legendSeriesLimit = splitLimit;

        setTimeout(() => {

            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);

            Ren.PopupMessage(
                `Splitting by "${Ren.HtmlUtils.escapeHtml(splitColumnHeading)}" makes ` +
                    `${splitValueCount} series - only the top ${splitLimit} are shown`,
                Ren.PopupMessageTypeEnum.SuccessWithWarning,
                { title: "Series limited", warningTriangle: true, closeWhenFocusLost: false }
            );

        }, 0);
    };

    /**
     * Opens an editor for the limit, with a spin box and a slider running up to the number of
     * series, the last of which shows them all, or up to MAX_EDITOR_LIMIT where there are more, or
     * DATELESS_MAX_EDITOR_LIMIT for a chart without dates.  The chart is redrawn as the limit is
     * changed, a typed one on Enter, and a burst of changes, as when the slider is dragged, is
     * redrawn for the last of them only.  A click outside the editor closes it.
     */
    const openEditor = (props, point) => {

        const seriesCount = Math.max(1, getMostLimitableCount(props));
        const isPerColumn = getSeriesPerColumnCount(props) != null;
        const maxLimit = Math.min(seriesCount, getMostShown(props.hasDateColumn));
        const limit = getLimit(props.visualisation);
        let pendingLimit;
        let isRedrawPending = false;

        const applyPendingLimit = () => {

            isRedrawPending = false;
            setLimit(props, pendingLimit >= seriesCount ? null : pendingLimit);
        };

        Ren.CreateNumberEditorPopupWindow(
            "Series Shown",
            limit ? Math.min(limit, maxLimit) : maxLimit,
            value => {

                pendingLimit = Math.min(maxLimit, Math.max(1, Math.round(value)));

                if (isRedrawPending) return;

                isRedrawPending = true;
                setTimeout(applyPendingLimit, 0);
            },
            {
                label: isPerColumn
                    ? `Top series per column (of up to ${seriesCount})`
                    : `Top series (of ${seriesCount})`,
                min: 1,
                max: maxLimit,
                step: 1,
                width: 200,
                height: 90,
                showSlider: true,
                applyTypedValuesOnEnter: true,
                closeWhenFocusLost: true,
                centredOnPoint: point
            }
        );
    };

    // Gets the limit the picker shows, which may be one the chart's data was gathered with.
    const getShownLimit = (props) =>
        getLimit(props.visualisation) ?? props.gatheredSeriesLimit ?? null;

    // Gets a value indicating whether the limit is offered: where there is one, or more than one
    // series to limit.
    const isOffered = (props) => !!getShownLimit(props) || getSeriesCount(props) >= 2;

    /**
     * Gets the menu item offering the limit, as the picker does, and so in the chart's settings
     * window, where its editor becomes a field.
     */
    const getMenuItem = (props) => ({
        section: "Chart data",
        text: "Series shown...",
        id: "series-limit",
        title: "Limit the series shown to the top ones",
        visible: () => isOffered(props),
        action: () => openEditor(props, Ren.LastRightClickPosition)
    });

    /**
     * Draws the limit as a picker in the given container (see DateValueChart_ColumnPickers), where
     * there is a limit or more than one series to limit.
     */
    const render = (props, container) => {

        const limit = getShownLimit(props);
        const seriesCount = getSeriesCount(props);

        if (!isOffered(props)) return;

        const status = Ren.HtmlUtils.create("button")
            ._addClass(PICKERS_CLASS_NAME + "__picker")
            ._addClass(STATUS_CLASS_NAME)
            ._addClass("js-ren-context-menu-button")
            ._set("type", "button")
            ._set("title", "Limit the series shown");

        const description = describe(limit, seriesCount, getSeriesPerColumnCount(props));

        status.appendChild(
            Ren.HtmlUtils.create("span")
                ._addClass(PICKERS_CLASS_NAME + "__label")
                ._textContent("Show:")
        );

        status.appendChild(
            Ren.HtmlUtils.create("span")
                ._addClass(PICKERS_CLASS_NAME + "__value")
                ._textContent(description.replace(/^Showing /, "").replace(/ series$/, ""))
        );

        status.appendChild(
            Ren.HtmlUtils.create("span")
                ._addClass(PICKERS_CLASS_NAME + "__pencil")
                ._textContent("✎")
        );

        // Kept from the chart beneath, which may start a drag or selection on it.
        status.addEventListener("mousedown", e => e.stopPropagation());
        status.addEventListener("click", e => {

            e.stopPropagation();
            openEditor(props, { x: e.pageX, y: e.pageY });
        });

        container.appendChild(status);
    };

    return {
        describe,
        getLargestGroupSize,
        getLimit,
        getLimitedHeadings,
        getMenuItem,
        getMostShown,
        limitSplitSeries,
        openEditor,
        render
    };
})();
