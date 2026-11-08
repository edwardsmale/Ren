/**
 * Maintains the paging bar's dynamic stylesheet, showing it only for the active datagrid of a grid
 * set that is paged.
 */
Ren.PagingBarStyleUpdater = (pagingBarVisualisation) => {

    const pagingBarStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        pagingBarVisualisation.visualisationGuid,
        "PagingBar"
    );

    const updateStylesheet = () => {

        const gridSetVisualisation = pagingBarVisualisation.gridSetVisualisation;

        if (!gridSetVisualisation.instance) return; // e.g. Editor page

        const activeDataGridGuid = gridSetVisualisation.instance.getActiveDataGridGuid();

        const isShown = activeDataGridGuid === pagingBarVisualisation.sourceVisualisationGuid &&
            Ren.DataGridPaging.getPageSize(gridSetVisualisation) !== null;

        const visibility = isShown ? "visible" : "hidden";
        const pointerEvents = isShown ? "auto" : "none";

        pagingBarStylesheet.updateIfChanged([
            ` { visibility: ${visibility}; pointer-events: ${pointerEvents} }`
        ]);
    };

    Ren.Messages.Events.visualisationSettingsChanged.handle((changedVisualisation) => {

        if (pagingBarVisualisation.isDestroyed) return false;

        if (changedVisualisation.visualisationSettingsGroup !==
            pagingBarVisualisation.visualisationSettingsGroup) return;

        updateStylesheet();
    });

    Ren.Messages.Events.dataGridTabChanged.handle(() => {

        if (pagingBarVisualisation.isDestroyed) return false;

        updateStylesheet();
    });

    updateStylesheet();

    return {
        updateStylesheet
    };
};
