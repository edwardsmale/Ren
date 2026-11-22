/**
 * Adds the variation links to the top of the datagrid.
 */
Ren.AddDataGridVariations = (dataGridSections, dataGridGuid, visualisation) => {

    // Don't show the variations controls for ad hoc visualisations, since they do not have 
    // variations, and adding variations for them wouldn't make sense.
    if (visualisation.isAdHoc) return;

    let lastClickedVariationName = null;

    const stylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(dataGridGuid, "data-grid-variations")
        .getStylesheet();

    const helpers = (() => {

        /**
         * Generates a js-* class name for the variation link containing the variation name.
         */
        const variationLinkJsClassName = (variationName) => {

            const cleanedVariationName = Ren.TextUtils.removeAllExceptLettersDigitsAndSpaces(variationName);
            const kebabVariationName = Ren.TextUtils.convertToKebabCase(cleanedVariationName);

            return "js-ren-data-grid-variation-link-" + kebabVariationName;
        };

        /**
         * Generates a qa-ren-* class name for the variation link containing the variation name.
         */
        const variationLinkQaClassName = (variationName) => {

            const cleanedVariationName = Ren.TextUtils.removeAllExceptLettersDigitsAndSpaces(variationName);
            const kebabVariationName = Ren.TextUtils.convertToKebabCase(cleanedVariationName);

            return "qa-ren-data-grid-variation-link-" + kebabVariationName;
        };

        const createVariationLinksContainer = () =>
            Ren.HtmlUtils.create("div")
                ._addClass(
                    "ren-data-grid__variation-links",
                    "ren-u-flex-horizontal",
                    "qa-ren-data-grid-variation-links"
                )
                ._attr("title", "Settings Variations - click for options");

        const createVariationIcon = () => {

            return Ren.HtmlUtils.create("span")
                ._addClass(
                    "ren-data-grid__variation-icon"
                );
        };

        const createVariationMenuButton = () => {

            return Ren.HtmlUtils.create("span")
                ._addClass(
                    "ren-data-grid__variation-menu-button",
                    "qa-ren-data-grid-variations-menu-button"
                );
        };

        const getSettingsTypeClassNames = variation => {

            const classNames = [];

            if (variation.hasDataGroupingSettings) {
                classNames.push("ren-data-grid__variation-link--has-data-grouping-settings");
            }

            if (variation.hasGridState) {
                classNames.push("ren-data-grid__variation-link--has-grid-state");
            }

            if (variation.hasDataGroupingSettings && variation.hasGridState) {
                classNames.push("ren-data-grid__variation-link--has-both");
            }

            return classNames;
        };

        const createVariationLink = (linkText, tooltip, classNames, variationName) =>
            Ren.HtmlUtils.create("a")
                ._addClass(
                    "ren-data-grid__variation-link",
                    variationLinkJsClassName(variationName),
                    variationLinkQaClassName(variationName),
                    "qa-ren-data-grid-variation-link"
                )
                ._addClass(classNames)
                ._attr("href", "javascript:void(0)")
                ._text(linkText)
                ._attr("title", tooltip);

        const showDataGridVariationsWindow = () => {

            const popupLeft = Math.round(window.scrollX + 128);
            const popupTop = Math.round(window.scrollY + 160);

            Ren.VisualisationCreator.createVisualisation({
                visualisationTypeName: "DataGridVariationsWindow",
                popupTitle: "🔖 Data Grid Variations",
                isPopup: true,
                popupLeft: popupLeft,
                popupTop: popupTop,
                dataGridGuid: visualisation.dataGridGuid,
                dataGroupingSettingsGroup: visualisation.dataGroupingSettingsGroup,
                gridStateGroup: visualisation.gridStateGroup,
                sourceVisualisation: visualisation,
                sourceVisualisationGuid: visualisation.visualisationGuid
            });
        };

        return {
            variationLinkJsClassName,
            createVariationLinksContainer,
            createVariationIcon,
            createVariationMenuButton,
            getSettingsTypeClassNames,
            createVariationLink,
            showDataGridVariationsWindow
        };
    })();

    const updateStylesheet = () => {

        let styles = [];

        if (lastClickedVariationName) {

            const className = helpers.variationLinkJsClassName(lastClickedVariationName);
            styles.push(`.${className} { filter: contrast(2) brightness(0.75); text-shadow: 0 0 0 #00000091 }`);
        }

        styles = styles.map(s => `.${visualisation.visualisationGuid} ` + s);
        stylesheet.textContent = styles.join("\n");
    };

    Ren.Messages.Events.reportSettingsLoaded.handle(() => {

        lastClickedVariationName = null;
        updateStylesheet();
    });

    const variationLinks = helpers.createVariationLinksContainer();
    dataGridSections.dataGrid.prepend(variationLinks);

    const renderVariations = () => {

        variationLinks._empty();

        const variations = Ren.ReportSettings_Variations.getVariations(
            visualisation.dataGroupingSettingsGroup,
            visualisation.gridStateGroup
        );

        if (variations.length) {

            const variationIcon = helpers.createVariationIcon();
            variationLinks.appendChild(variationIcon);
        }

        variations.forEach((variation, i) => {

            const linkText = variation.variationLabel;
            const tooltip = variation.variationTooltip;
            const classNames = helpers.getSettingsTypeClassNames(variation);

            if (variation.className) {
                classNames.push(variation.className);
            }

            const variationLink = helpers.createVariationLink(
                linkText,
                tooltip,
                classNames,
                variation.variationName
            );

            variationLinks.appendChild(variationLink);

            variationLink.addEventListener("click", () => {

                Ren.Messages.Requests.applyVariation.notify(
                    visualisation.dataGroupingSettingsGroup,
                    visualisation.gridStateGroup,
                    variation.variationName,
                    visualisation.containingReportGuid
                );
            });

            if (i < variations.length - 1) {
                variationLink._addClass("ren-data-grid__variation-link--with-separator");
            }

            const variationLinksMenuItems = [{
                text: "Delete",
                actionParameters: [false],
                action: () => {

                    Ren.Messages.Requests.removeVariation.notify(
                        visualisation.dataGroupingSettingsGroup,
                        visualisation.gridStateGroup,
                        variation.variationName
                    );
                }
            }];

            Ren.AddContextMenuItems(variationLinks, variationLinksMenuItems);
        });

        const variationMenuButton = helpers.createVariationMenuButton();
        variationLinks.appendChild(variationMenuButton);

        variationMenuButton.addEventListener("click", () => {

            helpers.showDataGridVariationsWindow();
        });
    };

    renderVariations();

    Ren.Messages.Events.variationsChanged.handle(() => {

        renderVariations();
    });

    /**
     * Highlights the named variation in this grid's stylesheet, but only if the groups match this
     * visualisation — prevents cross-grid interference when multiple grids are on the same page.
     */
    const highlightVariation = (dgsGroup, gsGroup, variationName, containingReportGuid) => {

        if (gsGroup !== visualisation.gridStateGroup) return;

        if (!Ren.ReportContextMatch.isSameGroup(
            dgsGroup,
            containingReportGuid,
            visualisation.dataGroupingSettingsGroup,
            visualisation.containingReportGuid
        )) return;

        lastClickedVariationName = variationName;
        updateStylesheet();
    };

    Ren.Messages.Requests.applyVariation.handle((dgsGroup, gsGroup, variationName, containingReportGuid) =>
        highlightVariation(dgsGroup, gsGroup, variationName, containingReportGuid));

    Ren.Messages.Requests.createOrUpdateVariation.handle((dgsGroup, gsGroup, variationName) =>
        highlightVariation(dgsGroup, gsGroup, variationName));
};
