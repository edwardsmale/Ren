/**
 * A dependency-free visualisation that renders a link as a tile: an image and a title, the whole
 * of it the link.  Its parts are edited from its context menu and saved with the report settings.
 */
Ren.VisualisationTypes_LinkTile = {
    visualisationTypeName: "LinkTile",
    tagName: "ren-link-tile",
    renderImmediately: true,
    availableOptions: {
        title: "String",

        /**
         * The URL the tile links to, which the host can map (see Ren.HostUrls.reportUrl).
         */
        url: "String",

        /**
         * The URL of the tile's image, which the host can map (see Ren.HostUrls.imageUrl).
         */
        imageUrl: "String",

        /**
         * A CSS filter applied to the image, such as "hue-rotate(90deg)".
         */
        imageFilter: "String",

        /**
         * Gets a value indicating whether the link opens in a new tab.
         */
        openInNewTab: "Boolean",

        moduleCssClass: "String"
    },
    synchronisedOptions: {},
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateLinkTile
};
