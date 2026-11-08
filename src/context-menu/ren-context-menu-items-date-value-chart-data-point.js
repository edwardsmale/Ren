/**
 * The date/value chart's "Show rows", offered on a bar, line or dot, which opens a popup grid of
 * the rows behind the data point right-clicked, as double-clicking it does.
 */
Ren.ContextMenuItems_DateValueChart_DataPoint = (chart) => {

    const { props } = chart;

    /**
     * Gets the data point right-clicked, or null where the right-click was on none.
     */
    const getClickedDataPoint = () => {

        const clickPosition = Ren.LastRightClickPosition;

        if (!clickPosition) return null;

        return Ren.DateValueChart_DataPointGrid.getDataPoint(
            props,
            Ren.LastRightClickTarget,
            clickPosition.x - window.scrollX,
            clickPosition.y - window.scrollY
        );
    };

    const showData = () => {

        const dataPoint = getClickedDataPoint();

        if (!dataPoint) return;

        Ren.DateValueChart_DataPointGrid.showDataPointGrid(
            props,
            dataPoint.seriesIndex,
            dataPoint.row,
            dataPoint.subdivision
        );
    };

    const showDataMenuItem = {
        text: "Show rows",
        id: "chart-show-data-point-rows",
        visible: () => getClickedDataPoint() !== null,
        action: () => showData()
    };

    return {
        showDataMenuItem
    };
};
