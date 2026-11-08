/**
 * Discovers <ren-*> elements, replacing each with a settings script element (and a target element
 * for a non-virtual visualisation), then actuizes the settings read back from the page.  Runs on
 * page load and whenever new content is added.  Virtual visualisations are activated immediately,
 * so their parameters are set before data sources are requested.
 */
Ren.Scanifier = (() => {

    const scanify = () => {

        Ren.ReportContextElement.upgradeElements();
        Ren.ReportContextGuids.addReportContextGuidAttributes();

        // HTML5 doesn't support self-closing custom tags.
        Ren.RenElementSelfClosingTagFixer.fixSelfClosingRenElements();

        // Excludes elements nested inside HTML-containing visualisations, processed later.
        const renElements = Ren.GetAllRenElements();

        const visualisationTypeCache = new Map();

        for (let i = 0; i < renElements.length; i++) {

            const renElement = renElements[i];

            const visualisation = Ren.RenElementParser.parseRenElement(renElement);

            const tagName = renElement.tagName;
            let visualisationType = visualisationTypeCache.get(tagName);

            if (!visualisationType) {

                visualisationType = Ren.VisualisationTypes.getByTagName(tagName);
                visualisationTypeCache.set(tagName, visualisationType);
            }

            const settingsObject = {

                visualisation
            };

            if (visualisation.dataSourceUri) {
                settingsObject.dataSource = { dataSourceUri: visualisation.dataSourceUri };
            }

            let targetElement = null;

            if (!visualisationType.isVirtual) {

                const { targetElement: createdTargetElement, targetSelector } =
                    Ren.VisualisationTargetElementGenerator.createTargetElementForVisualisation();

                targetElement = createdTargetElement;

                renElement.after(targetElement);
                visualisation.targetSelector = targetSelector;
                visualisation.isTargetSelectorGenerated = true;
            }

            renElement.after(
                Ren.HtmlUtils.create("<script>")
                    ._addClass("js-ren-report-settings")
                    ._attr("type", "application/json")
                    ._textContent(JSON.stringify(settingsObject))
            );

            visualisation.containingReport = Ren.HtmlUtils.getContainingReportContext(renElement);
            visualisation.containingReportUrl = visualisation.containingReport?.getAttribute("data-request-url");

            // Virtual visualisations must add their parameters before data sources are requested.
            if (visualisationType.isVirtual) {

                Ren.VirtualVisualisationActivator.activateVirtualVisualisation(
                    visualisation,
                    visualisationType,
                    renElement
                );
            }
            else {

                Ren.VisualisationDimensionMemory.reserveSpace(visualisation, renElement);

                if (!visualisationType.defaultOptions.suppressLoadingAnimation) {

                    // Inside the target rather than beside it, so it's never a flex or grid item
                    // that the container's gap would be added around.
                    targetElement.prepend(
                        Ren.LoadingAnimations.createTargetedVisualisationLoadingAnimation(
                            visualisation
                        )
                    );
                }
            }

            renElement.remove();
        }

        const reportSettings = Ren.ReportSettingsReader.readReportSettingsFromPage();

        Ren.VisualisationActuizer.actuize(reportSettings);
    };

    return {
        scanify
    };
})();
