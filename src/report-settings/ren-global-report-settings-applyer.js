/**
 * Applies global report settings such as raiseReport by managing dynamic stylesheets.
 */
Ren.GlobalReportSettingsApplyer = (() => {

    let stylesheet;

    const createStylesheet = () => {

        if (stylesheet) return;

        stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet("", "global-report-settings");
    };

    const applyGlobalReportSettings = () => {

        const settings = Ren.GlobalReportSettingsCollection.getAllGlobalSettings();

        const styles = [];

        // A Home page preview sits below the page's own controls, so raising it would overlap them.
        if (settings.raiseReport && !Ren.UrlContext.onHomePage()) {

            styles.push(".ren-web-report--on-page { margin-top: -2.5rem; }");
        }

        createStylesheet();

        stylesheet.updateIfChanged(styles);
    };

    Ren.whenDocumentReady(() => {

        createStylesheet();
    });

    Ren.Messages.Requests.applyDeserialisedGlobalReportSettings.handle(() => {

        applyGlobalReportSettings();
    });
})();
