/**
 * Logs Ren's own errors through Ren.Log and shows the error indicator.  Where renLogInsert is
 * configured, the page's uncaught errors are caught and logged too, unless the
 * globalErrorHandler feature flag turns that off.  The page's console.error is left alone.
 */
Ren.GlobalErrorHandler = (() => {

    const errorDivId = "ren-global-error-indicator";
    let lastErrorDetails = null;

    const addErrorIndicator = () => {

        let errorDiv = document.getElementById(errorDivId);

        if (!errorDiv) {

            errorDiv = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("globalErrorIndicator");

            errorDiv.id = errorDivId;

            errorDiv.onclick = () => {

                // The indicator has nothing left to say once the popup has said it in full, so it
                // is taken off the page as soon as the popup is up.  A later error puts a fresh one
                // back, carrying that error's details.
                if (showErrorPopup()) removeErrorIndicator();
            };

            document.body.prepend(errorDiv);
        }

        // Expose the most recent error details as data attributes so automated tests can include
        // them in failure messages without needing to open the popup.
        if (lastErrorDetails) {

            errorDiv.setAttribute("data-error-message", lastErrorDetails.message || "");
            errorDiv.setAttribute("data-error-stack", lastErrorDetails.stack || "");
        }
    };

    const removeErrorIndicator = () => {

        const errorDiv = document.getElementById(errorDivId);

        if (errorDiv) errorDiv.remove();
    };

    // Shows the popup holding the last error's details, and returns whether there was an error to
    // show: with none held there is no popup, and the indicator stays as it is.
    const showErrorPopup = () => {

        if (!lastErrorDetails) return false;
        const details = [
            `<b>Message:</b> ${lastErrorDetails.message || ""}`,
            `<b>Source:</b> ${lastErrorDetails.source || ""}`,
            `<b>Line:</b> ${lastErrorDetails.lineno || ""}`,
            `<b>Column:</b> ${lastErrorDetails.colno || ""}`,
            `<b>Stack:</b><pre style='white-space:pre-wrap;background:#f8f8f8;padding:6px;border-radius:4px;'>${lastErrorDetails.stack || lastErrorDetails.error || ""}</pre>`
        ].join("<br>");
        Ren.PopupErrorMessage(details, { title: "JavaScript Error" });

        return true;
    };

    const recordError = (message, source, lineno, colno, error) => {

        lastErrorDetails = {
            message,
            source,
            lineno,
            colno,
            stack: error && error.stack ? error.stack : (typeof error === "string" ? error : "")
        };

        try {

            const outerReportContext = document.querySelector(".js-ren-report-context--on-page");
            const reportName = outerReportContext?.getAttribute("data-report-name") || null;
            const data = {
                message,
                source,
                lineno,
                colno,
                error
            };
            Ren.Log.error("GlobalJsError", reportName, reportName, null, data);
        }
        catch {

            // Depending on the type of error, 'Ren' might not exist yet, in which case the code
            // above will fail.
        }
    };

    /**
     * Gets a value indicating whether the page's uncaught errors are caught.  Only a page that
     * logs to renLogInsert has them caught, and the globalErrorHandler feature flag turns it off
     * there, as a host with an error tracker of its own might want.  Asked at each error rather
     * than once, since ren.js may run before the page's ren.config is parsed.
     */
    const isCatchingPageErrors = () => {

        try {

            return Ren.Endpoints.has("renLogInsert") &&
                !Ren.Config.isFeatureDisabled("globalErrorHandler");
        }
        catch {

            return false;
        }
    };

    // Listeners rather than window.onerror and window.onunhandledrejection, so that a page's own
    // handlers (an error tracker's, say) are left in place and still see every error.
    window.addEventListener("error", (event) => {

        if (!isCatchingPageErrors()) return;

        recordError(event.message, event.filename, event.lineno, event.colno, event.error);
        addErrorIndicator();
    });

    window.addEventListener("unhandledrejection", (event) => {

        if (!isCatchingPageErrors()) return;

        recordError(event.reason, "", 0, 0, event.reason);
        addErrorIndicator();
    });

    /**
     * Writes one of Ren's own errors to the console, as console.error would, then logs it through
     * Ren.Log and shows the error indicator.
     */
    const logError = (...args) => {

        console.error.apply(console, args);

        const error = args.find(a => a instanceof Error) || null;
        const message = error
            ? error.message
            : args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");

        recordError(message, "", 0, 0, error);
        addErrorIndicator();
    };

    const reportError = (error) => {

        recordError(
            error?.message || String(error),
            "",
            0,
            0,
            error instanceof Error ? error : null
        );

        addErrorIndicator();
    };

    return {
        addErrorIndicator,
        logError,
        reportError
    };
})();
