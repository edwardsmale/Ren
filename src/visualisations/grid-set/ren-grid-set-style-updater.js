/**
 * Maintains the gridset's dynamic stylesheet.
 */
Ren.GridSetStyleUpdater = (visualisation) => {

    const gridSetStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        visualisation.visualisationGuid,
        "GridSet"
    );

    const updateStylesheet = () => {

        const styles = [];

        const quickLinksVisibility = visualisation.quickLinks ? "visible" : "hidden";

        styles.push(`.js-ren-dataGrid-quick-links { visibility: ${quickLinksVisibility} }`);

        if (!visualisation.quickLinks && !visualisation.variations) {

            styles.push(" { transform: translateY(-18px); margin-bottom: -18px; }");
        }

        const variationsVisibility = visualisation.variations ? "visible" : "hidden";

        styles.push(`.ren-data-grid__variation-links { visibility: ${variationsVisibility} }`);

        const variationLinksLeft = 0;

        styles.push(`.ren-data-grid__variation-links { left: ${variationLinksLeft}rem }`);

        if (Ren.Config.isFeatureDisabled("variationLinks")) {

            styles.push(".ren-data-grid__variation-links { display: none }");
        }

        if (visualisation.showColumnHeaderDownArrows) {

            styles.push(".ren-h { padding-right: 1.5rem }");
        }
        else {

            styles.push(".ren-data-grid__header-cell-down-arrow-button-container { display: none }");
        }

        if (visualisation.style) {

            styles.push(` { ${visualisation.style} }`);
        }

        gridSetStylesheet.updateIfChanged(styles);
    };

    Ren.Messages.Events.visualisationSettingsChanged.handle(changedVisualisation => {

        if (changedVisualisation.visualisationSettingsGroup !== visualisation.visualisationSettingsGroup) return;

        updateStylesheet();
    });

    updateStylesheet();

    return {
        updateStylesheet
    };
};
