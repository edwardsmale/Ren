/**
 * A container of tiles (see Ren.VisualisationContainers) under a heading, laid out in wrapping
 * rows.  It accepts link tiles, added, removed and reordered from its context menu.
 */
Ren.VisualisationTypes_TileGroup = {
    visualisationTypeName: "TileGroup",
    tagName: "ren-tile-group",
    renderImmediately: true,
    availableOptions: {
        heading: "String",

        /**
         * Shown after the heading, in a lighter style, such as "reports".
         */
        subheading: "String",

        /**
         * The width of each tile, as a CSS length.  16rem by default.
         */
        tileWidth: "String",

        /**
         * The gap between the tiles, as a CSS length.
         */
        tileGap: "String",

        moduleCssClass: "String"
    },
    synchronisedOptions: {},
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    containerOptions: {
        flow: "Row",
        childTypes: [
            {
                visualisationTypeName: "LinkTile",
                name: "link tile",
                options: { title: "New link" }
            }
        ]
    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateTileGroup
};
