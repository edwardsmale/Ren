/**
 * The date/value chart's "Move earlier" and "Move later", offered on a series, which move it one
 * place among the series drawn: across bars side by side and up a stack.  A split's series are
 * ordered by their size, and an "Other" series always comes last, so neither moves.
 */
Ren.ContextMenuItems_DateValueChart_SeriesOrder = (chart) => {

    const {
        visualisation,
        props,
        getTargetSeriesIndexes,
        isSplitActive,
        rebuildVisualisation
    } = chart;

    const isOtherSeries = (seriesIndex) =>
        Ren.DateValueChart_OtherSeries.isOtherSeries(props, seriesIndex);

    /**
     * Gets the place, from 1, of the series the menu was opened on, where it can be moved, or else
     * null.
     */
    const getMovableSeriesIndex = () => {

        const seriesIndexes = getTargetSeriesIndexes();

        // Away from every series, every series is the target.
        if (seriesIndexes.length !== 1 || isSplitActive() || props.seriesCount < 2) return null;

        const seriesIndex = seriesIndexes[0];

        return isOtherSeries(seriesIndex) ? null : seriesIndex;
    };

    const canMoveTo = (seriesIndex) => seriesIndex >= 1
        && seriesIndex <= props.seriesCount
        && !isOtherSeries(seriesIndex);

    const moveBy = (offset) => {

        const seriesIndex = getMovableSeriesIndex();

        if (seriesIndex === null || !canMoveTo(seriesIndex + offset)) return;

        visualisation.series = Ren.DateValueChart_SeriesOrder.moveSeries(
            visualisation.series,
            props.valueHeadings,
            seriesIndex - 1,
            seriesIndex - 1 + offset
        );

        rebuildVisualisation();
    };

    const buildMoveMenuItem = (text, id, offset, title) => ({
        section: "Series",
        text,
        id,
        title,
        visible: () => {

            const seriesIndex = getMovableSeriesIndex();

            return seriesIndex !== null && canMoveTo(seriesIndex + offset);
        },
        action: () => moveBy(offset)
    });

    const moveSeriesEarlierMenuItem = buildMoveMenuItem(
        "Move earlier",
        "chart-series-move-earlier",
        -1,
        "Moves the series before the one before it, among bars side by side and in a stack"
    );

    const moveSeriesLaterMenuItem = buildMoveMenuItem(
        "Move later",
        "chart-series-move-later",
        1,
        "Moves the series after the one after it, among bars side by side and in a stack"
    );

    return {
        moveSeriesEarlierMenuItem,
        moveSeriesLaterMenuItem
    };
};
