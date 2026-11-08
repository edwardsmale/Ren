(() => {

    const getStaticVisualisationGuid = (index) => "ren-visualisation-static-" + index;

    /**
     * Adds a visualisation-guid attribute to each ren-* element.  The GUID is a value with a suffix
     * which increases by one for each ren-* element encountered.
     */
    const addStaticVisualisationGuidAttributes = () => {

        const selector = Ren.VisualisationTypes.tagNames.join(",");

        document.querySelectorAll(selector).forEach((element) => {

            if (element.hasAttribute("visualisation-guid")) return;

            let occurrence = 1;

            while (true) {

                const visualisationGuid = getStaticVisualisationGuid(occurrence);

                if (!document.querySelectorAll(`[visualisation-guid="${visualisationGuid}"]`).length) {

                    element.setAttribute("visualisation-guid", visualisationGuid);
                    return;
                }

                occurrence++;
            }
        });
    };

    // Call the above once all Ren JS modules have loaded and performed their initialisation.
    setTimeout(() => {

        addStaticVisualisationGuidAttributes();
    });
})();
