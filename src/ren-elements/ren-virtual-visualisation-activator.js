/**
 * Renders the virtual visualisation, then executes its addParametersFunction if it has one.
 *
 * Visualisations like data sources and default dates are virtual visualisations and should be
 * 'rendered' immediately when the report is being set up, so that they can add any parameters they
 * need before other visualisations are rendered.  In addition, some virtual visualisations need to
 * add parameters (for example to set default dates) and these define a getAddParametersFunction
 * which we call here.
 */
Ren.VirtualVisualisationActivator = (() => {

    /**
     * Renders the virtual visualisation, then executes its addParametersFunction if it has one.
     * @param {Object} visualisation The visualisation to activate
     * @param {Object} visualisationType The visualisation type definition
     * @param {HTMLElement} element The DOM element that was parsed to create the visualisation
     *   (optional)
     */
    const activateVirtualVisualisation = (visualisation, visualisationType, element) => {

        if (!visualisationType.isVirtual) return;

        // If containingReport wasn't set yet, try to find it from the element.
        if (!visualisation.containingReport && element) {
            visualisation.containingReport = Ren.HtmlUtils.getContainingReportContext(element);
        }

        // If still no containing report, try to find it from any element in the DOM.
        if (!visualisation.containingReport) {

            const reportContext = document.querySelector(".js-ren-report-context");

            if (reportContext) {
                visualisation.containingReport = reportContext;
            }
        }

        // Ensure reportContext is populated before calling addParametersFunction.
        Ren.VisualisationContainingReportContext.populateVisualisationContainingReportContext(
            visualisation
        );

        // If STILL no report context, skip the add parameters function.
        if (!visualisation.reportContext) {

            // Still render the visualisation.
            Ren.VisualisationRenderer.renderVisualisation(visualisation);
            return;
        }

        // Call addParametersFunction before rendering to ensure parameters are added as early as
        // possible (especially important for default dates inside filters-bar).
        if (visualisationType.getAddParametersFunction) {

            const addParametersFunction = visualisationType.getAddParametersFunction();
            addParametersFunction(visualisation);
        }

        Ren.VisualisationRenderer.renderVisualisation(visualisation);
    };

    return {
        activateVirtualVisualisation
    };
})();
