/**
 * Displays a loading animation in the top-right of the page until the report is fully loaded.
 */
Ren.TopRightLoadingAnimation = (() => {

    let stylesheet = null;

    let isAnimationVisible = true;

    const updateStylesheet = () => {

        const styles = [];

        const display = isAnimationVisible ? "block" : "none";

        styles.push(`.ren-report-header-module-loading-animation { display: ${display} }`);

        stylesheet.textContent = styles.join("\n");
    };

    const hideAnimation = () => {

        isAnimationVisible = false;
        updateStylesheet();
    };

    const createLoadingAnimation = () => {

        return Ren.HtmlTemplateFunctions.reifyHtmlTemplate("LoadingAnimation", {
            size: "16px"
        });
    };

    const initialise = () => {

        stylesheet = Ren.DynamicStylesheets
            .setupDynamicStylesheet("ren-report-header-module-loading-animation")
            .getStylesheet();

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-report-header-module-loading-animation"
            );

        const animation = createLoadingAnimation();

        module.appendChild(animation);

        Ren.ReportHeaderModule.addElement(module);

        Ren.Messages.Events.allReportsLoaded.handle(() => {

            hideAnimation(module);
        });

        updateStylesheet();
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".ren-report-header-module-loading-animation");
    };

    return {
        initialise,
        remove
    };
})();
