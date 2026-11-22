/**
 * Creates a function editor widget.
 */
Ren.FunctionEditorWidget = (() => {

    // The parameters each kind of function is called with, so the editor lists only those.
    const parameterSets = {
        format: [
            "value", "rowVals", "compressedRowVals", "groupSummaryStats", "overallSummaryStats",
            "paras"
        ],
        calc: ["value", "rowVals", "compressedRowVals", "paras"],
        style: [
            "value", "rowVals", "compressedRowVals", "groupSummaryStats", "overallSummaryStats",
            "paras"
        ],
        tooltip: ["value", "rowVals", "compressedRowVals", "paras"],
        filter: ["value", "rowVals", "compressedRowVals", "paras"],
        flagText: ["value", "rowVals", "paras"],
        colour: ["value", "rowVals", "paras"],
        valueOnly: ["value", "paras"]
    };

    // The least time between the applications of a function whose template parameters are being
    // changed, so that dragging a slider does not queue a redraw for every step.
    const LIVE_APPLY_INTERVAL = 150;

    const getParameterName = (parameterElement) =>
        parameterElement.querySelector(".ren-function-editor-widget__parameter-name").textContent;

    /**
     * Creates the widget, listing only the named parameters (all of them if none are named).
     * libraryOptions ({ allowHtml, functionTag }) are passed to Ren.FunctionLibraryMenu.attach.
     * liveApplyOptions ({ restoreFunction }), where given, apply the code as soon as a template
     * parameter input changes it; Cancel then goes back to the code last applied by OK or Apply, or
     * calls restoreFunction where there is none.  autoCompleteSource ({ tabularData, paras })
     * supplies the keys suggested as the parameters are typed (see Ren.FunctionEditorAutoComplete).
     * sourceCellElement, where given, is the data grid cell the editor was opened from, whose
     * grid's cells can then be clicked into the code (see Ren.FunctionEditorCellPicking), and whose
     * row the code is previewed for (see Ren.FunctionEditorAutoPreview). parameterSetName names the
     * parameter set parameterNames was taken from.  growWindow, where given, is called with the
     * height in pixels the editor's window needs to grow by to give the code box its usual height
     * back, once replaced code has taken some of it.
     */
    const create = (
        className, initialContent, setFunction, onClose, parameterNames, libraryOptions,
        liveApplyOptions, autoCompleteSource, sourceCellElement, parameterSetName, growWindow
    ) => {

        const widgetGuid = Ren.RandomUtils.generateRandomClassName("ren-function-editor");

        // The function as it was given, which may be no function, or several.
        const originalFunction = initialContent;

        // A { name, parameters } spec is edited as the named function's code.
        initialContent = Ren.FunctionTemplateParameters.specToCode(initialContent);

        // The description and tags opening the code's header comment are shown in boxes of their
        // own, and the @param lines left in it as the template parameter inputs, rather than in
        // the code.
        let intro = Ren.FunctionLibrary.splitIntro(initialContent);

        // Held apart from the code box, and put back above its code wherever the code is used.
        let header = intro.header;

        initialContent = intro.body;

        const editorElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("FunctionEditorWidget", {
            className: widgetGuid + " " + className,
            initialContent
        });

        const showIntro = () => {

            const descriptionElement =
                editorElement.querySelector(".js-ren-function-editor-description");
            const tagsElement = editorElement.querySelector(".js-ren-function-editor-tags");

            descriptionElement.textContent = intro.description;
            descriptionElement.hidden = intro.description === "";
            tagsElement.textContent = "";
            tagsElement.hidden = !intro.tags.length;

            for (let index = 0; index < intro.tags.length; index++) {

                const tagElement = document.createElement("span");

                tagElement.className = "ren-function-editor-widget__tag ren-function-editor-widget__tag--"
                    + intro.tags[index].replace(/[^\w-]/g, "");
                tagElement.textContent = intro.tags[index];
                tagsElement.appendChild(tagElement);
            }
        };

        const removeUnsuppliedParameters = () => {

            if (!parameterNames) return;

            const parameterElements =
                editorElement.querySelectorAll(".js-ren-function-editor-parameter");

            for (let index = 0; index < parameterElements.length; index++) {

                const parameterElement = parameterElements[index];

                if (parameterNames.indexOf(getParameterName(parameterElement)) === -1) {
                    parameterElement.remove();
                }
            }
        };

        const editBox = editorElement.querySelector('.ren-function-editor-widget__edit-box');

        const highlighting = Ren.FunctionEditorHighlighting.attach(editBox, initialContent);

        const autoComplete = Ren.FunctionEditorAutoComplete.attach(
            editorElement,
            highlighting,
            parameterNames,
            autoCompleteSource
        );

        const getCode = () => header + highlighting.getValue();

        // The code with the description and tags shown apart from it put back in its header.
        const getSource = () =>
            Ren.FunctionLibrary.joinIntro(intro.description, intro.tags, getCode());

        // As getSource gives it, so that Applying the code unchanged is not an edit to undo.
        const originalSource = getSource();

        // The template parameter inputs edit the held header or, where there is none, a header
        // typed into the code box.
        const getParameterCode = () => header !== "" ? header : highlighting.getValue();

        let autoPreview = null;

        const setParameterCode = (code) => {

            if (header !== "") {

                header = code;

                // The code box is left as it is, so fires no input event to update the preview.
                if (autoPreview) autoPreview.schedule();
            }
            else {

                highlighting.updateText(code);
            }
        };

        // Blank code is set as no function (null) rather than as an empty function returning
        // undefined, so that emptying the code box and applying it removes the function.
        const setCode = (code) => setFunction(code.trim() === "" ? null : code);

        let appliedCode = null;
        let appliedSource = null;
        let hasLiveChanges = false;
        let liveApplyTimeout = null;
        let lastLiveApplyTime = 0;

        const cancelLiveApply = () => {

            clearTimeout(liveApplyTimeout);
            liveApplyTimeout = null;
        };

        const applyLive = () => {

            liveApplyTimeout = null;
            lastLiveApplyTime = Date.now();
            hasLiveChanges = true;
            setCode(getCode());
        };

        // Applies the latest code at most once every LIVE_APPLY_INTERVAL.
        const scheduleLiveApply = () => {

            if (liveApplyTimeout !== null) return;

            liveApplyTimeout = setTimeout(
                applyLive,
                Math.max(0, LIVE_APPLY_INTERVAL - (Date.now() - lastLiveApplyTime))
            );
        };

        // The source each Apply replaced, and the source each Undo replaced, each whole with its
        // description and tags, so that going back to it shows them again.
        const undoStack = [];
        const redoStack = [];

        const undoButton = editorElement.querySelector(".js-ren-function-editor-undo-button");
        const redoButton = editorElement.querySelector(".js-ren-function-editor-redo-button");

        const updateUndoRedoButtons = () => {

            undoButton.disabled = !undoStack.length;
            redoButton.disabled = !redoStack.length;
        };

        const getLastAppliedSource = () => appliedSource !== null ? appliedSource : originalSource;

        // Undoing back to the code the editor opened with puts the original function back rather
        // than setting its code.  No function is read as "", which set as it stands would be an
        // empty function returning undefined, so it is set as null.
        const restoreOriginalFunction = () => {

            if (liveApplyOptions) {
                liveApplyOptions.restoreFunction();
            }
            else {

                setFunction(originalFunction === "" ? null : originalFunction);
            }
        };

        // Sets the function to source from the undo or redo stack, putting it in the code box.
        const applyFromHistory = (source) => {

            cancelLiveApply();
            hasLiveChanges = false;

            replaceCode(source);

            // Cancel then puts the original function back too.
            if (source === originalSource) {

                appliedCode = null;
                appliedSource = null;
                restoreOriginalFunction();
            }
            else {

                appliedCode = getCode();
                appliedSource = source;
                setCode(appliedCode);
            }

            updateUndoRedoButtons();
        };

        const undo = () => {

            if (!undoStack.length) return;

            redoStack.push(getLastAppliedSource());
            applyFromHistory(undoStack.pop());
        };

        const redo = () => {

            if (!redoStack.length) return;

            undoStack.push(getLastAppliedSource());
            applyFromHistory(redoStack.pop());
        };

        const setupButtons = () => {

            const applyFunction = () => {

                const code = getCode();
                const source = getSource();
                const lastAppliedSource = getLastAppliedSource();

                cancelLiveApply();
                hasLiveChanges = false;
                appliedCode = code;
                appliedSource = source;

                if (source !== lastAppliedSource) {

                    undoStack.push(lastAppliedSource);
                    redoStack.length = 0;
                    updateUndoRedoButtons();
                }

                Ren.FunctionLibrary.recordRecentFunction(code, libraryOptions?.functionTag);
                setCode(code);
            };

            const cancel = () => {

                cancelLiveApply();

                if (hasLiveChanges) {

                    if (appliedCode !== null) {
                        setCode(appliedCode);
                    }
                    else {

                        liveApplyOptions.restoreFunction();
                    }
                }

                onClose();
            };

            editorElement.querySelector('.ren-function-editor-widget__ok-button')
                .addEventListener('click', () => { applyFunction(); onClose(); });

            editorElement.querySelector('.ren-function-editor-widget__apply-button')
                .addEventListener('click', applyFunction);

            editorElement.querySelector('.ren-function-editor-widget__cancel-button')
                .addEventListener('click', cancel);

            undoButton.addEventListener("click", undo);
            redoButton.addEventListener("click", redo);

            // Keyboard shortcuts.
            editorElement.addEventListener("keydown", (e) => {

                if (e.ctrlKey && e.key === "Enter") {

                    applyFunction();
                    onClose();
                    e.preventDefault();
                }
                else if (e.altKey && e.key === "Enter") {

                    applyFunction();
                    e.preventDefault();
                }
                else if (e.key === "Escape") {

                    cancel();
                    e.preventDefault();
                }
            });
        };

        const setupParameters = () => {

            const parameterElements =
                editorElement.querySelectorAll(".js-ren-function-editor-parameter");

            for (let index = 0; index < parameterElements.length; index++) {

                const parameterElement = parameterElements[index];
                const name = getParameterName(parameterElement);

                // Keep focus (and so the caret) in the textarea rather than the clicked span.
                parameterElement.addEventListener("mousedown", (e) => e.preventDefault());
                parameterElement.addEventListener("click", () => highlighting.insertText(name));
            }
        };

        const hasParameter = (name) => !parameterNames || parameterNames.indexOf(name) !== -1;

        // Bracketed, since a column key is often no identifier.
        const formatColumnAccessor = (columnKey) => "[" + JSON.stringify(columnKey) + "]";

        /**
         * Gets the code reading a grid cell clicked into the code (see
         * Ren.FunctionEditorCellPicking), or null where the function is not given its parameter.
         */
        const formatCellReference = (reference) => {

            const parameterName = reference.parameterName;

            if (parameterName === "rowVals" && reference.isSourceColumn) return "value";

            if (!hasParameter(parameterName)) return null;

            let code = parameterName;

            // A summary stats parameter holds the statistics on the function's own column.
            if (parameterName === "rowVals" || !reference.isSourceColumn) {
                code += formatColumnAccessor(reference.columnKey);
            }

            if (reference.aggregationKey) {
                code += "." + reference.aggregationKey;
            }

            return code;
        };

        /**
         * Keeps the focus in the code box, with the caret at the given position, until the click
         * that a cell reference was inserted on is over, taking it back from anything handling
         * the click that takes it.
         */
        const keepFocusThroughClick = (textarea, caretPosition) => {

            const restoreFocus = () => {

                if (document.activeElement !== textarea) {
                    textarea.focus({ preventScroll: true });
                }

                textarea.setSelectionRange(caretPosition, caretPosition);
            };

            const onBlur = () => Ren.FnUtils.defer(restoreFocus);

            const stopKeepingFocus = () => {

                textarea.removeEventListener("blur", onBlur);
                restoreFocus();
            };

            // The click event follows the mouseup in the same task, so is over by the time this
            // runs.
            const onMouseUp = () => {

                window.removeEventListener("mouseup", onMouseUp, true);
                Ren.FnUtils.defer(stopKeepingFocus);
            };

            textarea.addEventListener("blur", onBlur);
            window.addEventListener("mouseup", onMouseUp, true);
            Ren.FnUtils.defer(restoreFocus);
        };

        const insertCellReference = (reference) => {

            const code = formatCellReference(reference);

            if (code === null) return false;

            const textarea = editorElement.querySelector(".ren-function-editor-widget__edit-textarea");

            highlighting.insertText(code);
            keepFocusThroughClick(textarea, textarea.selectionEnd);

            return true;
        };

        const setupCellPicking = () => {

            if (!sourceCellElement) return null;

            return Ren.FunctionEditorCellPicking.register(
                editorElement.querySelector(".ren-function-editor-widget__edit-textarea"),
                sourceCellElement,
                insertCellReference
            );
        };

        const setupTemplateParameterInputs = () => {

            const inputs = Ren.FunctionEditorTemplateParameterInputs.attach(
                editorElement.querySelector(".js-ren-function-editor-template-parameters"),
                getParameterCode,
                setParameterCode,
                liveApplyOptions ? scheduleLiveApply : null
            );

            editorElement.querySelector(".ren-function-editor-widget__edit-textarea")
                .addEventListener("input", inputs.sync);

            return inputs;
        };

        const setupAutoPreview = () => {

            autoPreview = Ren.FunctionEditorAutoPreview.attach(
                editorElement.querySelector(".js-ren-function-editor-auto-preview"),
                sourceCellElement,
                getCode,
                parameterSetName
            );

            if (!autoPreview) return;

            editorElement.querySelector(".ren-function-editor-widget__edit-textarea")
                .addEventListener("input", autoPreview.schedule);
        };

        // The window keeps the height it opened at, so a description, tags or template parameters
        // that come with replaced code would otherwise squash the code box beneath them.
        const makeRoomForCode = () => {

            if (!growWindow) return;

            const usualHeight =
                Ren.StylesUtils.convertToPixels(getComputedStyle(editBox).flexBasis);

            const shortfall = usualHeight - editBox.offsetHeight;

            if (shortfall > 0) growWindow(shortfall);
        };

        const replaceCode = (code) => {

            intro = Ren.FunctionLibrary.splitIntro(code);
            header = intro.header;
            showIntro();

            // Fires the code box's input event, so the template parameter inputs are rebuilt from
            // the new header.
            highlighting.replaceText(intro.body);

            makeRoomForCode();
        };

        const setupLibraryMenu = () => {

            Ren.FunctionLibraryMenu.attach(
                editorElement.querySelector(".js-ren-function-editor-library-button"),
                {
                    getCode,
                    replaceCode,
                    allowHtml: !!libraryOptions?.allowHtml,
                    functionTag: libraryOptions?.functionTag ?? null,
                    getIntro: () => intro
                }
            );
        };

        showIntro();
        removeUnsuppliedParameters();
        setupButtons();
        setupParameters();
        const templateParameterInputs = setupTemplateParameterInputs();
        setupLibraryMenu();
        const unregisterCellPicking = setupCellPicking();
        setupAutoPreview();

        editorElement.style.width = "800px"; // Set initial width.

        Ren.Messages.Events.popupManuallyResized.handle((windowElement, resizeType) => {

            const popupWindow = editorElement.closest(".ren-report-popup-window");

            if (windowElement !== popupWindow) return;

            if (resizeType === "width" || resizeType === "both") {

                editorElement.style.width = null; // Remove the initial width.
            }
        });

        // preventScroll stops the page jumping to the textarea before its window is positioned.
        const focus = () => {

            const textarea = editorElement.querySelector(".ren-function-editor-widget__edit-textarea");

            if (!textarea) {
                return;
            }

            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        };

        // A colour picker opened from the widget carries on applying its colours live once the
        // editor has closed.  Without live apply there is nothing left for it to do, so it closes.
        const onEditorClosed = () => {

            autoComplete.destroy();

            if (unregisterCellPicking) unregisterCellPicking();

            if (autoPreview) autoPreview.destroy();

            if (!liveApplyOptions) templateParameterInputs.closeColourPickers();
        };

        return {
            element: editorElement,
            focus,
            onEditorClosed
        };
    };

    return {
        parameterSets,
        create
    };
})();
