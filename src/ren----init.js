// This needs to be included before the other ren JS files.  Ren is put on window explicitly, rather
// than assigned as an undeclared name, so that ren.js still runs in strict mode or as a module.
window.Ren = {};

// Properties set on Ren while a report is in use, declared here so that Ren has them all from the
// start.  Adding a property to Ren later changes its shape, which throws away all the optimised
// code that reads anything from Ren: it was the commonest deoptimisation in the tests, on the
// first right-click (see "Object shapes and inline caches" in docs/development.md).
Ren.LastRightClickPosition = undefined;
Ren.isGeneratingPreview = false;
Ren.isGeneratingFullPreview = false;
Ren.isGeneratingDownload = false;

/**
 * Calls the callback once the document has been parsed: on DOMContentLoaded, or, when ren.js is
 * loaded after that has fired (injected, lazy-loaded or added by a single-page app), as soon as the
 * rest of ren.js has run, so that every module has registered its handlers first.
 */
Ren.whenDocumentReady = (callback) => {

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", callback);
    }
    else {
        
        setTimeout(callback);
    }
};

// Once all Ren JS modules have loaded and performed their initialisation, add report context GUIDs
// to all report contexts.
setTimeout(() => {

    Ren.ReportContextGuids.addReportContextGuidAttributes();
});

// Used to indicate that a visualisation cannot be rendered yet because it is waiting for a source
// visualisation to create its dataGroupingSettings.
Ren.NotReady = "NotReady";

Ren.MENU_SEPARATOR = { text: "-" };
Object.freeze(Ren.MENU_SEPARATOR);
