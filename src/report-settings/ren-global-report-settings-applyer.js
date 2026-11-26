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

        const showReportHeader = Ren.GlobalReportSettingsCollection.getShowReportHeader();

        // A Home page preview sits below the page's own controls, so raising it would overlap them.
        // Without the header, the report already starts at the top of the page.
        if (settings.raiseReport && showReportHeader && !Ren.UrlContext.onHomePage()) {

            styles.push(".ren-web-report--on-page { margin-top: -2.5rem; }");
        }

        if (!showReportHeader) {

            styles.push(".ren-report-header-module { display: none; }");
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
