/**
 * The shared figures and rules for a datagrid's paging, and for fitting its paging bar and stat bar
 * alongside one another beneath the grid.
 */
Ren.DataGridPaging = (() => {

    const pagingBarWidth = 300;
    const statBarWidth = 500;
    const barHeight = 22;
    const barGap = 4;

    const pageSizes = [10, 25, 50, 100, 250, 500];

    /**
     * Gets a grid set's page size as a number, or null where it is not paged.  A page-size
     * attribute arrives as a string.
     */
    const getPageSize = (gridSetVisualisation) => {

        const pageSize = parseInt(gridSetVisualisation?.pageSize, 10);

        return pageSize > 0 ? pageSize : null;
    };

    const defaultPageSize = 25;
    const maxCustomPageSize = 10000;

    // Keyed by settings group rather than visualisation so it outlives a re-rendered grid set, and
    // kept off the visualisation so that it is never saved into the report settings.
    const pageSizesWhenDisabled = new Map();

    /**
     * Sets a grid set's page size, where null turns paging off.  The setting lives on the grid set,
     * whose settings change is what its datagrids page by, and what the report settings save.
     */
    const setPageSize = (gridSetVisualisation, pageSize) => {

        gridSetVisualisation.pageSize = pageSize;

        Ren.VisualisationSettingsSynchroniser.commitChange(gridSetVisualisation);
    };

    /**
     * Turns a grid set's paging off by removing its page size, so that none is saved, remembering
     * it for the page's lifetime so that turning paging back on restores it.
     */
    const disablePaging = (gridSetVisualisation) => {

        const pageSize = getPageSize(gridSetVisualisation);

        if (pageSize === null) return;

        const settingsGroup = gridSetVisualisation.visualisationSettingsGroup;

        pageSizesWhenDisabled.set(settingsGroup, pageSize);

        // The synchroniser only copies defined options, so the removal is made on each by hand.
        const visualisations =
            Ren.VisualisationCollection.getVisualisationsByVisualisationSettingsGroup(settingsGroup);

        for (let i = 0; i < visualisations.length; i++) {
            delete visualisations[i].pageSize;
        }

        delete gridSetVisualisation.pageSize;

        Ren.VisualisationSettingsSynchroniser.commitChange(gridSetVisualisation);
    };

    const enablePaging = (gridSetVisualisation) => {

        if (getPageSize(gridSetVisualisation) !== null) return;

        const rememberedPageSize =
            pageSizesWhenDisabled.get(gridSetVisualisation.visualisationSettingsGroup);

        setPageSize(gridSetVisualisation, rememberedPageSize || defaultPageSize);
    };

    const openCustomPageSizePopup = (gridSetVisualisation, centredOnPoint) => {

        Ren.CreateNumberEditorPopupWindow(
            "Page Size",
            getPageSize(gridSetVisualisation) || defaultPageSize,
            pageSize => setPageSize(gridSetVisualisation, Math.round(pageSize)),
            {
                label: "Per page",
                min: 1,
                max: maxCustomPageSize,
                width: 160,
                height: 60,
                centredOnPoint: centredOnPoint,
                applyTypedValuesOnEnter: true
            }
        );
    };

    /**
     * Gets the left position of the stat bar, which sits at the bottom right of the datagrid.
     */
    const getStatBarLeftPos = (dataGrid, isInPopup) => {

        const rightPos = Math.min(
            dataGrid.dimensions.dataGridWidth - 2,
            dataGrid.container.clientWidth
        );

        let leftPos = rightPos - statBarWidth;

        if (isInPopup) leftPos -= 30;

        return Math.max(0, leftPos);
    };

    /**
     * Gets a value indicating whether the stat bar would overlap the paging bar, and so wraps
     * beneath it.
     */
    const statBarWrapsBeneathPagingBar = (dataGrid, gridSetVisualisation, isInPopup) => {

        if (!dataGrid.pagingBarVisualisation) return false;
        if (!gridSetVisualisation.statBar) return false;
        if (getPageSize(gridSetVisualisation) === null) return false;

        const statBarLeftPos = getStatBarLeftPos(dataGrid, isInPopup);

        return statBarLeftPos < pagingBarWidth + barGap;
    };

    return {
        barGap,
        barHeight,
        pageSizes,
        pagingBarWidth,
        statBarWidth,
        disablePaging,
        enablePaging,
        getPageSize,
        openCustomPageSizePopup,
        setPageSize,
        getStatBarLeftPos,
        statBarWrapsBeneathPagingBar
    };
})();
