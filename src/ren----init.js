// This needs to be included before the other ren JS files.  Ren is put on window explicitly, rather
// than assigned as an undeclared name, so that ren.js still runs in strict mode or as a module.
window.Ren = {};

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
