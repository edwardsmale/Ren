/**
 * Returns an element to display when a visualisation fails to initialise (e.g. because the user's
 * selected columns are not of the correct types).
 */
Ren.VisualisationInitialisationError = (() => {

    const getVisualisationInitialisationErrorElement = (error) => {

        const element = Ren.HtmlUtils.create("div")
            ._addClass("ren-visualisation-initialisation-error")
            ._html(`
                    <div class="ren-visualisation-initialisation-error__content">
                        <span class="ren-visualisation-initialisation-error__icon">&#9888;</span>
                        <span class="ren-visualisation-initialisation-error__text">${error}</span>
                    </div>
                `);

        return {
            element
        };
    };

    return {
        getVisualisationInitialisationErrorElement
    };
})();
