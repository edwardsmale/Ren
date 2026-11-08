/**
 * Adds a PagingBar visualisation to a datagrid and positions it at the bottom left of the datagrid.
 */
Ren.DataGrid_PagingBar = (dataGrid, gridStateGroup, gridSetElement, gridSetVisualisation) => {

    const onCreated = visualisation => {

        gridSetVisualisation.pagingBarVisualisationGuid = visualisation.visualisationGuid;
        dataGrid.pagingBarVisualisation = visualisation;

        Ren.PagingBarStyleUpdater(visualisation);
    };

    const getPlacement = context => {

        if (context.onEditorPage) return { left: 8, bottom: -22 };

        let topPos = context.topPos;

        // Placed as the stat bar is when it would overflow the popup, and above it if it wraps.
        if (context.popupHeight && (topPos + context.height > context.popupHeight)) {

            topPos = context.popupHeight - context.height - 22;

            const statBarWraps = Ren.DataGridPaging.statBarWrapsBeneathPagingBar(
                dataGrid,
                gridSetVisualisation,
                true // isInPopup
            );

            if (statBarWraps) topPos -= context.height + Ren.DataGridPaging.barGap;
        }

        return { left: 0, top: topPos };
    };

    return Ren.DataGrid_Bar(dataGrid, gridStateGroup, gridSetElement, gridSetVisualisation, {
        visualisationTypeName: "PagingBar",
        width: Ren.DataGridPaging.pagingBarWidth,
        onCreated,
        getPlacement
    });
};
