/**
 * Renders visualisations other than gridsets and datagrids.
 */
Ren.WebReportDisplay = (() => {

    const renderVisualisation = (visualisation, createFunction) => {

        const tabularData = Ren.DataSources.cloneTabularDataAndApplyTransformationsForVisualisation(
            visualisation
        );

        const instance = createFunction(tabularData, visualisation);

        if (!instance) return; // Some visualisations have no visual representation.

        if (instance === Ren.NotReady) {

            visualisation.instance = instance; // Ren.NotReady
            return;
        }

        instance.container = visualisation.element;
        visualisation.element.innerHTML = "";
        visualisation.element.appendChild(instance.element);

        visualisation.instance = instance;

        // Only fire if the rendered content contains <ren-*> elements that need scanning.
        // Firing unconditionally causes a cascade: each render triggers scanify(), which
        // renders more visualisations, each of which fires this again.
        const renSelector = Ren.VisualisationTypes.tagNames.join(",");

        if (instance.element.querySelector(renSelector)) {

            Ren.Messages.Events.reportAddedToDom.notify();
        }
    };

    return {
        renderVisualisation
    };
})();
