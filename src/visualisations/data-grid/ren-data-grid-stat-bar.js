/**
 * Adds a StatBar visualisation to a datagrid and positions it at the bottom right of the datagrid.
 */
Ren.DataGrid_StatBar = (dataGrid, gridStateGroup, gridSetElement, gridSetVisualisation) => {

    const onCreated = visualisation => {

        gridSetVisualisation.statBarVisualisationGuid = visualisation.visualisationGuid;

        Ren.StatBarStyleUpdater(visualisation);
    };

    const getPlacement = context => {

        const barGap = Ren.DataGridPaging.barGap;

        // The paging bar sits at the bottom left, so a stat bar that would overlap it goes beneath.
        const wrapsBeneathPagingBar = Ren.DataGridPaging.statBarWrapsBeneathPagingBar(
            dataGrid,
            gridSetVisualisation,
            context.isInPopup
        );

        if (context.onEditorPage) {

            return {
                right: 8,
                bottom: wrapsBeneathPagingBar ? -(22 + context.height + barGap) : -22
            };
        }

        let topPos = context.topPos;

        if (wrapsBeneathPagingBar) topPos += context.height + barGap;

        // If stat bar would overflow popup, position it 22px above its bottom.
        if (context.popupHeight && (topPos + context.height > context.popupHeight)) {
            topPos = context.popupHeight - context.height - 22;
        }

        return {
            left: wrapsBeneathPagingBar
                ? 0
                : Ren.DataGridPaging.getStatBarLeftPos(dataGrid, context.isInPopup),
            top: topPos
        };
    };

    return Ren.DataGrid_Bar(dataGrid, gridStateGroup, gridSetElement, gridSetVisualisation, {
        visualisationTypeName: "StatBar",
        width: Ren.DataGridPaging.statBarWidth,
        onCreated,
        getPlacement
    });
};
