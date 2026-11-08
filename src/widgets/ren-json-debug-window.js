/**
 * Creates a popup window that shows JSON debug output, using the standard debug window
 * position, size and styling.  The produceJson callback returns the pretty, indented and raw
 * forms of the JSON to display, and is re-run on each update.
 */
Ren.JsonDebugWindow = (windowId, title, leftPos, topPos, produceJson) => {

    const jsonDebugModule = Ren.JsonDebugModule();

    const renderContent = (contentContainer) => {

        Ren.HtmlUtils.enrich(contentContainer)
            ._addClass("ren-debug-window")
            ._append(jsonDebugModule.contentElement);
    };

    Ren.PopupWindow(
        windowId,
        renderContent,
        title,
        {
            withOffset: true,
            leftPos,
            topPos,
            width: 320,
            height: 600,
            verticalScrollbar: true,
            horizontalScrollbar: true
        }
    );

    /**
     * Re-renders the window with the latest JSON.
     */
    const update = () => {

        const json = produceJson();

        jsonDebugModule.update(json.pretty, json.indented, json.raw);
    };

    /**
     * Re-renders the window whenever the serialised form of the state returned by getState
     * differs from the previous time it was checked.
     */
    const updateOnStateChange = (getState) => {

        let prevState = null;

        Ren.MessageBus_Conditions.onCondition(
            () => {

                const state = Ren.JsonUtils.serializeForDebug(getState());
                const condition = prevState !== null && prevState !== state;
                prevState = state;
                return condition;
            },
            () => {

                update();
            }
        );
    };

    update();

    return {
        update,
        updateOnStateChange
    };
};
