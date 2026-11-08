/**
 * Generates context menu items to do with visualisations.
 */
Ren.ContextMenuItems_Visualisations = (() => {

    const getMenuItems = (dataSourceUri, sqlFilename) => {

        return [{
            section: "Visualisations",
            text: "Create Visualisation",
            id: "create-visualisation",
            submenu: [
                {
                    text: "Grid",
                    action: () => {

                        Ren.VisualisationCreator.createVisualisation(
                            {
                                dataSourceUri,
                                sqlFilename,
                                visualisationTypeName: "GridSet",
                                isPopup: true,
                                sourceVisualisation: null
                            }
                        );
                    }
                },
                {
                    text: "Word Cloud",
                    action: () => {

                        Ren.VisualisationCreator.createVisualisation(
                            {
                                dataSourceUri,
                                sqlFilename,
                                visualisationTypeName: "WordCloud",
                                isPopup: true,
                                sourceVisualisation: null
                            }
                        );
                    }
                }
            ]
        }];
    };

    return {
        getMenuItems
    };
})();
