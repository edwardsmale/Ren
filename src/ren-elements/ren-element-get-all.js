/**
 * Gets all the ren-* elements on the page.
 */
(() => {

    let selector;

    Ren.GetAllRenElements = () => {

        selector = selector ?? Ren.VisualisationTypes.tagNames.join(",");

        return Array.from(document.querySelectorAll(selector));
    };
})();
