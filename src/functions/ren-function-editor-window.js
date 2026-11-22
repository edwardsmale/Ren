/**
 * Shows function editor windows.
 */
Ren.FunctionEditorWindow = (() => {

    const functionEditorWidgetClassName = "ren-calc-function-editor-window__editor-widget";

    // How far below its otherwise-chosen top the editor window opens, keeping it clear of the
    // toolbars and menus at the top of the page that it would otherwise open over.
    const TOP_POS_DROP = 140;

    // The position the window opens at, dropped down the page by TOP_POS_DROP.  Where the caller
    // names no position, the position a popup window would have opened at for itself is taken here
    // instead, so that the drop has something to apply to (see Ren.PopupPositioning). The window is
    // opened withOffset, so successive windows are shifted clear of each other.
    const getPosition = (leftPos, topPos) => {

        if ((leftPos || leftPos === 0) && (topPos || topPos === 0)) {
            return { leftPos, topPos: topPos + TOP_POS_DROP };
        }

        const defaultPosition = Ren.PopupPositioning.getDefaultPosition();

        return {
            leftPos: defaultPosition.left,
            topPos: defaultPosition.top + TOP_POS_DROP
        };
    };

    // The tag a function saved from an editor is given, by the parameters it lists, where the
    // caller names none.  A value-only function could be binning or sort, so gets no default.
    const DEFAULT_FUNCTION_TAGS = {
        format: "format",
        calc: "calculation",
        style: "style",
        tooltip: "tooltip"
    };

    // The keys suggested as the code is typed.  Where the caller gives no report parameters, those
    // of the report the menu that opened the editor is in are taken.
    const getAutoCompleteSource = (options) => {

        const paras = options?.autoComplete?.paras ?? Ren.ReportInputParameters.getInputParameters(
            Ren.LastRightClickTarget?.closest(".js-ren-report-context") ?? null
        );

        return { tabularData: options?.autoComplete?.tabularData ?? null, paras };
    };

    // The data grid cell (not a heading) the menu that opened the editor was opened on, or null.
    const getSourceCellElement = () => {

        const cellElement = Ren.LastRightClickTarget?.closest?.(".ren-data-grid__cell") ?? null;

        return cellElement && !cellElement.classList.contains("ren-h") ? cellElement : null;
    };

    // Grows the editor's window by the given height, as far as the bottom of the browser window.
    const growWindow = (popup, editorElement, extraHeight) => {

        const windowElement = editorElement.closest(".ren-report-popup-window");

        if (!windowElement) return;

        const room = window.innerHeight - windowElement.getBoundingClientRect().bottom;
        const growth = Math.min(extraHeight, room);

        if (growth > 0) popup.setHeight(popup.getHeight() + growth);
    };

    const showCalcFunctionEditor = (
        getFunction,
        setFunction,
        leftPos,
        topPos,
        options
    ) => {

        let functionEditorWidget = null;

        // Taken now, as the window's content may be rendered after another right-click.
        const sourceCellElement = getSourceCellElement();

        const renderContent = (contentContainer, popup) => {

            const parameterSet = options?.parameterSet ?? "format";

            functionEditorWidget = Ren.FunctionEditorWidget.create(
                functionEditorWidgetClassName,
                getFunction(),
                setFunction,
                () => popup.closeWindow(),
                Ren.FunctionEditorWidget.parameterSets[parameterSet],
                {
                    allowHtml: !!options?.allowHtml,
                    functionTag: options?.functionTag ?? DEFAULT_FUNCTION_TAGS[parameterSet] ?? null
                },
                options?.restoreFunction ? { restoreFunction: options.restoreFunction } : null,
                getAutoCompleteSource(options),
                sourceCellElement,
                parameterSet,
                (extraHeight) => growWindow(popup, functionEditorWidget.element, extraHeight)
            );

            contentContainer.appendChild(
                functionEditorWidget.element
            );

            functionEditorWidget.focus();
        };

        const position = getPosition(leftPos, topPos);

        Ren.PopupWindow(
            "ren-calc-function-editor-window",
            renderContent,
            options?.title ?? "Edit Calculation",
            {
                leftPos: position.leftPos,
                topPos: position.topPos,
                withOffset: true,
                autoSized: true,
                verticalScrollbar: false,
                horizontalScrollbar: false,
                onClose: () => functionEditorWidget.onEditorClosed()
            }
        );
    };

    Ren.Messages.Requests.functionEditorWindow.handle((
        getFunction,
        setFunction,
        leftPos,
        topPos,
        options) => {

        // What it writes wouldn't run, so it says so rather than opening.
        if (!Ren.FormatFunctions.areUserFunctionsAllowed()) {

            Ren.PopupErrorMessage("Writing functions is turned off on this page.", {
                title: "Functions turned off",
                closeWhenFocusLost: true
            });
            return;
        }

        showCalcFunctionEditor(
            getFunction,
            setFunction,
            leftPos,
            topPos,
            options
        );
    });
})();
