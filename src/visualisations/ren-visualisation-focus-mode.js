/**
 * Focus mode, as in Power BI: a button at the top-right of a visualisation shows it on its own in a
 * full screen popup window, and only the same button puts it back.  The visualisation's element is
 * moved into the window rather than recreated, so it keeps its state, and a placeholder holds its
 * place meanwhile, whether on the page or in a popup window of its own.  Nothing about it is saved.
 *
 * A visualisation type opts in with supportsFocusMode.
 */
Ren.VisualisationFocusMode = (() => {

    const BUTTON_SELECTOR = ".js-ren-visualisation-focus-mode-button";
    const FOCUSED_CLASS_NAME = "ren-visualisation--focused";
    const FOCUSED_BUTTON_CLASS_NAME = "ren-visualisation__focus-mode-button--focused";
    const POPUP_CLASS_NAME = "ren-visualisation-focus-mode-popup";

    // visualisation -> { popup, placeholder, onBrowserWindowResize }
    const sessions = new WeakMap();

    const isFocused = (visualisation) => sessions.has(visualisation);

    /**
     * Gets a value indicating whether the visualisation can be focused: its type supports it, and
     * it is not inside another visualisation's focus mode window.  One in a popup window of its own
     * can be, and goes back into that window afterwards.
     */
    const canFocus = (visualisation) => {

        const visualisationType = Ren.VisualisationTypes.getByTypeName(
            visualisation.visualisationTypeName
        );

        if (!visualisationType?.supportsFocusMode || visualisation.isVirtual) return false;

        const element = visualisation.element;

        if (!element) return false;

        return isFocused(visualisation) || !element.closest("." + POPUP_CLASS_NAME);
    };

    const getTitle = (visualisation) => visualisation.title ||
        visualisation.popupTitle ||
        Ren.TextUtils.addSpacesBeforeCapitals(visualisation.visualisationTypeName);

    /**
     * Tells the visualisation, once the browser has laid it out, that it has a different amount of
     * room.  A chart rescales itself to its container, and a grid recomputes its dimensions.
     */
    const notifyResized = (visualisation) => {

        requestAnimationFrame(() => {

            const element = visualisation.element;

            if (!element) return;

            Ren.Messages.Events.visualisationContainerResize.notify(
                visualisation.visualisationGuid,
                element.clientWidth,
                element.clientHeight
            );

            Ren.Messages.Events.columnResized.notify();
            Ren.Messages.Requests.repaint.notify();
        });
    };

    const updateButton = (visualisation) => {

        const button = visualisation.element?.querySelector(":scope > " + BUTTON_SELECTOR);

        if (!button) return;

        const focused = isFocused(visualisation);

        button.classList.toggle(FOCUSED_BUTTON_CLASS_NAME, focused);
        button.title = focused ? "Back to report" : "Focus mode";
    };

    /**
     * Creates what holds the visualisation's place on the page while it is focused, the same size
     * as it, and put where it is if it is positioned absolutely.
     */
    const createPlaceholder = (element) => {

        const placeholder = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "VisualisationFocusModePlaceholder",
            {}
        );

        const style = getComputedStyle(element);

        placeholder.style.width = element.offsetWidth + "px";
        placeholder.style.height = element.offsetHeight + "px";

        if (style.position === "absolute") {

            placeholder.style.position = "absolute";
            placeholder.style.left = style.left;
            placeholder.style.top = style.top;
        }

        return placeholder;
    };

    const endSession = (visualisation) => {

        const session = sessions.get(visualisation);

        if (!session) return null;

        sessions.delete(visualisation);
        window.removeEventListener("resize", session.onBrowserWindowResize);

        return session;
    };

    /**
     * Puts the visualisation back where it was, in its own popup window if it has one, as the focus
     * mode window starts to close.  Where what was around it has since been replaced, its
     * placeholder with it, it is left in the focus mode window to be destroyed along with it.
     */
    const restore = (visualisation) => {

        const session = endSession(visualisation);

        if (!session) return;

        const element = visualisation.element;

        if (!element) return;

        element.classList.remove(FOCUSED_CLASS_NAME);

        if (!session.placeholder.isConnected) return;

        session.placeholder.replaceWith(element);

        updateButton(visualisation);
        notifyResized(visualisation);
    };

    const enter = (visualisation) => {

        if (isFocused(visualisation) || !canFocus(visualisation)) return;

        const element = visualisation.element;

        const session = {
            popup: null,
            placeholder: createPlaceholder(element),
            onBrowserWindowResize: () => notifyResized(visualisation)
        };

        element.replaceWith(session.placeholder);
        element.classList.add(FOCUSED_CLASS_NAME);

        sessions.set(visualisation, session);

        session.popup = Ren.PopupWindow(
            POPUP_CLASS_NAME,
            (contentContainer) => {

                contentContainer.appendChild(element);
            },
            getTitle(visualisation),
            {
                isFullScreen: true,
                hasFixedWidth: true,
                hasFixedHeight: true,
                horizontalScrollbar: false,
                verticalScrollbar: false,
                fillAvailableSpace: true,

                // Ctrl + wheel zooms a date/value chart's dates, and the window fills the browser
                // window already.
                disableWheelZoom: true,
                onClosing: () => restore(visualisation)
            }
        );

        // Called once the window is shown.
        session.popup.notifyContainerResize = () => notifyResized(visualisation);

        window.addEventListener("resize", session.onBrowserWindowResize);

        updateButton(visualisation);
        notifyResized(visualisation);
    };

    /**
     * Ends focus mode by closing the window, which puts the visualisation back.
     */
    const exit = (visualisation) => {

        const session = sessions.get(visualisation);

        if (session) session.popup.closeWindow();
    };

    const toggle = (visualisation) => {

        if (isFocused(visualisation)) {
            exit(visualisation);
        }
        else {

            enter(visualisation);
        }
    };

    /**
     * Gives a rendered visualisation its focus mode button.  Whether it has one is read from its
     * element rather than remembered, since rendering empties the element.
     */
    const setUpFocusModeButton = (visualisation) => {

        if (!canFocus(visualisation)) return;

        const element = visualisation.element;

        if (!element.querySelector(":scope > " + BUTTON_SELECTOR)) {

            const button = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
                "VisualisationFocusModeButton",
                {}
            );

            // Kept from the visualisation beneath, which may start a drag or selection on it.
            button.addEventListener("mousedown", (e) => {

                e.stopPropagation();
            });

            button.addEventListener("click", (e) => {

                e.stopPropagation();
                toggle(visualisation);
            });

            element.appendChild(button);
        }

        updateButton(visualisation);
    };

    /**
     * Ends focus mode for a visualisation being destroyed, whose element has already been taken
     * away, closing its window and removing its placeholder.
     */
    const abandon = (visualisation) => {

        const session = endSession(visualisation);

        if (!session) return;

        session.placeholder.remove();
        session.popup.closeWindow();
    };

    return {
        isFocused,
        enter,
        exit,
        setUpFocusModeButton,
        abandon
    };
})();
