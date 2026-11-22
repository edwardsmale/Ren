/**
 * Where a popup visualisation's window is put.  Most float over the page, in the body, but a
 * tab-relative one is put inside its tab's content, and one popped in to a report shown in a popup
 * inside that report's report context, so that each is positioned relative to, and shown and
 * hidden with, what it belongs to.
 *
 * Ren.PopupWindow has its window placed whenever where it belongs may have changed - as it is
 * created, popped in or out, or dropped after a drag - and Ren.TabRelativeVisualisations re-places
 * tab-relative windows as tabbed modules re-render, so no caller has to remember to.
 */
Ren.PopupVisualisationPlacement = (() => {

    /**
     * Moves a visualisation's popup window into the element it belongs in, or out to the page.
     * Only a re-placing of tab-relative windows may put one in a tab that is not displayed: one
     * newly created there would measure its scale-to-fit content as empty, so it is left in the
     * body until then.
     */
    const place = (visualisation, popupWindow, canEnterHiddenTab) => {

        const tabs = Ren.TabRelativeVisualisations;

        if (tabs.isLinkedToTab(visualisation)) {

            const tabContent = tabs.findTabContentForVisualisation(visualisation);

            // Mid-rerender, a new tab content has not yet been given its tab ID.  Moved to the
            // body, the window would measure itself against its removed tab content and be
            // stranded in the page's top-left corner, so a later re-placing puts it in.
            if (!tabContent) return;

            // offsetParent is null when an element or an ancestor is display: none.
            if (!canEnterHiddenTab && tabContent.offsetParent === null) return;

            Ren.PopupReportPoppedInWindows.liftOut(popupWindow);
            tabs.attachToTabContent(visualisation, popupWindow, tabContent);
            tabs.clearEmptyClippingTabContents();

            return;
        }

        if (tabs.detachFromTabContent(popupWindow)) tabs.clearEmptyClippingTabContents();

        const reportContext = popupWindow.popup.isPoppedIn ?
            Ren.PopupReportPoppedInWindows.getPopupReportContext(visualisation) :
            null;

        if (reportContext) {

            Ren.PopupReportPoppedInWindows.moveIn(popupWindow, reportContext);
        }
        else {

            Ren.PopupReportPoppedInWindows.moveOut(popupWindow);
        }
    };

    /**
     * Lifts a popup window out of whatever it was put in to the body for a drag, which positions
     * it in page coordinates, leaving it where it is on screen.  Its drop places it again.
     */
    const liftOutForDrag = (popupWindow) => {

        return Ren.TabRelativeVisualisations.detachFromTabContent(popupWindow) ||
            Ren.PopupReportPoppedInWindows.liftOut(popupWindow);
    };

    return {
        place,
        liftOutForDrag
    };
})();
