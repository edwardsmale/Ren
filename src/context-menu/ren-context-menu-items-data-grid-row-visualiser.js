/**
 * Function for getting the menu item for opening a row in each of its row visualisers (see
 * Ren.DataGridCellSelection_DoubleClickVisualisationCreator), and for choosing which of them a
 * double-click opens.
 */
Ren.ContextMenuItems_DataGridRowVisualiser = (dataGridCellSelection) => {

    // A grid has a key/value grid and at most one visualisation of its own to choose between.
    const MAX_ROW_VISUALISER_COUNT = 2;

    const getRowVisualiser = (index) => dataGridCellSelection.getRowVisualisers()[index];

    const isRowVisualiserVisible = (index) =>
        index < dataGridCellSelection.getRowVisualisers().length;

    const getMenuItem = () => {

        const openSubmenu = [];
        const defaultSubmenu = [];

        // The row visualisers are read as the menu opens, as the settings naming them can be
        // applied after the menu is built.
        for (let i = 0; i < MAX_ROW_VISUALISER_COUNT; i++) {

            const index = i;

            openSubmenu.push({
                text: () => getRowVisualiser(index).text,
                id: "row-visualiser-" + index,
                visible: () => isRowVisualiserVisible(index),
                action: () => dataGridCellSelection.createRowVisualisation(
                    getRowVisualiser(index).visualisationTypeName
                )
            });

            defaultSubmenu.push({
                text: () => getRowVisualiser(index).text,
                id: "row-visualiser-default-" + index,
                visible: () => isRowVisualiserVisible(index),
                ticked: () => dataGridCellSelection.getDefaultRowVisualiser() ===
                    getRowVisualiser(index).visualisationTypeName,
                action: () => dataGridCellSelection.setDefaultRowVisualiser(
                    getRowVisualiser(index).visualisationTypeName
                )
            });
        }

        openSubmenu.push(Ren.MENU_SEPARATOR);

        openSubmenu.push({
            text: "Default",
            id: "row-visualiser-default",
            visible: () => isRowVisualiserVisible(1),
            submenu: defaultSubmenu
        });

        return {
            section: "Create",
            text: "Row visualiser",
            id: "row-visualiser",
            visible: () => dataGridCellSelection.getSelectedVisualisableRowIndex() !== null,
            submenu: openSubmenu
        };
    };

    return {
        getMenuItem
    };
};
