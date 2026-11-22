/**
 * Popped-in popups belonging to a report shown in a popup.  A popped-in popup is sent to the page
 * layer, beneath every floating popup, so one left in the body would be hidden behind the popup
 * report it belongs to.  It is instead moved inside that report's report context element, and
 * positioned relative to it, as it is relative to the page when the report has a page of its own.
 *
 * Ren.PopupVisualisationPlacement decides when a window is moved in or out, and Ren.PopupWindow
 * keeps the room reserved for it up to date as it is positioned or resized.
 */
Ren.PopupReportPoppedInWindows = (() => {

    const inPopupReportWindowClass = "ren-report-popup-window--in-popup-report";

    // Report contexts whose popup report is waiting to be refitted.
    const refitsPending = new WeakSet();

    /**
     * Gets the report context element of the popup report a visualisation belongs to, or null
     * where its report is not shown in a popup.
     */
    const getPopupReportContext = (visualisation) => {

        const reportContextGuid = visualisation.reportContext?.reportContextGuid;

        if (!reportContextGuid) return null;

        const reportContext = document.getElementsByClassName(reportContextGuid)[0];

        if (!reportContext || !Ren.HtmlUtils.isReportContextInsidePopup(reportContext)) return null;

        return reportContext;
    };

    const isInPopupReport = (popupWindow) => {

        return popupWindow.classList.contains(inPopupReportWindowClass);
    };

    const refitPopupReport = (reportContext) => {

        const popupReportWindow = reportContext.closest(".ren-report-popup-window");

        if (popupReportWindow?.style.visibility === "visible") {
            popupReportWindow.popup?.resizeToMatchContent?.();
        }
    };

    /**
     * Sizes the report context to take in its popped-in popups, which being absolutely positioned
     * take up no room of their own, so that the popup report is fitted to them as well.  Where one
     * now overhangs the report, a popup report already fitted to its report is refitted, once the
     * caller has finished positioning it.
     */
    const reserveRoom = (reportContext) => {

        const popupWindows =
            reportContext.querySelectorAll(":scope > ." + inPopupReportWindowClass);

        let right = 0;
        let bottom = 0;

        for (let i = 0; i < popupWindows.length; i++) {

            const popupWindow = popupWindows[i];

            right = Math.max(right, popupWindow.offsetLeft + popupWindow.offsetWidth);
            bottom = Math.max(bottom, popupWindow.offsetTop + popupWindow.offsetHeight);
        }

        const overhangs = right > reportContext.offsetWidth || bottom > reportContext.offsetHeight;

        reportContext.style.minWidth = right ? right + "px" : "";
        reportContext.style.minHeight = bottom ? bottom + "px" : "";

        if (overhangs && !refitsPending.has(reportContext)) {

            refitsPending.add(reportContext);

            Ren.FnUtils.defer(() => {

                refitsPending.delete(reportContext);
                refitPopupReport(reportContext);
            });
        }
    };

    /**
     * Re-sizes the room reserved in a popup window's popup report after it has moved or resized.
     */
    const updateRoom = (popupWindow) => {

        if (isInPopupReport(popupWindow)) reserveRoom(popupWindow.parentElement);
    };

    /**
     * Moves a popup window into a report context where it is on screen now, storing its position
     * relative to the report context.  A zoomed popup report scales what is inside it, so the
     * distance on screen is scaled back.
     */
    const moveIn = (popupWindow, reportContext) => {

        if (popupWindow.parentElement === reportContext) return;

        const rect = popupWindow.getBoundingClientRect();
        const reportContextRect = reportContext.getBoundingClientRect();

        const scale = reportContext.offsetWidth ?
            reportContextRect.width / reportContext.offsetWidth :
            1;

        const previousReportContext = isInPopupReport(popupWindow) ?
            popupWindow.parentElement :
            null;

        reportContext.style.position = "relative";
        reportContext.appendChild(popupWindow);

        popupWindow.classList.add(inPopupReportWindowClass);

        popupWindow.popup.setLeftPos((rect.left - reportContextRect.left) / scale);
        popupWindow.popup.setTopPos((rect.top - reportContextRect.top) / scale);

        if (previousReportContext) reserveRoom(previousReportContext);
    };

    /**
     * Moves a popup window out of its popup report to the body, where it is on screen, storing its
     * page position.
     */
    const moveOut = (popupWindow) => {

        if (!isInPopupReport(popupWindow)) return;

        const reportContext = popupWindow.parentElement;
        const rect = popupWindow.getBoundingClientRect();
        const bodyScrollPos = Ren.HtmlUtils.getBodyScrollPos();

        Ren.HtmlUtils.getBody().appendChild(popupWindow);
        popupWindow.classList.remove(inPopupReportWindowClass);

        popupWindow.popup.setLeftPos(rect.left + bodyScrollPos.left);
        popupWindow.popup.setTopPos(rect.top + bodyScrollPos.top);

        reserveRoom(reportContext);
    };

    /**
     * Lifts a popup window out of its popup report to the body where it is on screen, without
     * storing that position, for a drag or before it is put somewhere else.  Gets a value
     * indicating whether it was in one.
     */
    const liftOut = (popupWindow) => {

        if (!isInPopupReport(popupWindow)) return false;

        const reportContext = popupWindow.parentElement;
        const rect = popupWindow.getBoundingClientRect();
        const bodyScrollPos = Ren.HtmlUtils.getBodyScrollPos();

        Ren.HtmlUtils.getBody().appendChild(popupWindow);
        popupWindow.classList.remove(inPopupReportWindowClass);

        popupWindow.style.left = (rect.left + bodyScrollPos.left) + "px";
        popupWindow.style.top = (rect.top + bodyScrollPos.top) + "px";

        reserveRoom(reportContext);

        return true;
    };

    return {
        getPopupReportContext,
        updateRoom,
        moveIn,
        moveOut,
        liftOut
    };
})();
