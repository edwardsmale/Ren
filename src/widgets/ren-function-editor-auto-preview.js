/**
 * Shows beneath a function editor's code what the code gives for the row of the grid cell the
 * editor was opened from, a second after the code stops changing.  The grid registers a source
 * that works the code out for one of its cells (see
 * Ren.DataGridCellSelection_FunctionEditorPreviewSource).
 *
 * The preview is on unless the grid's autoPreviewEnabled setting is false.  Where the setting is
 * undefined, a preview taking a second or more sets it to false, so that a slow function does not
 * hold up the editor on every change.
 */
Ren.FunctionEditorAutoPreview = (() => {

    const DEBOUNCE_DELAY = 100;

    const SLOW_PREVIEW_DURATION = 1000;

    const PLACEHOLDER = "Preview";

    const DISABLED_PLACEHOLDER = "Auto preview is off";

    // Format functions return markup for the cell, so a result with a tag in it is rendered.
    const HTML_REGEX = /<[a-z][^>]*>|&[a-z#0-9]+;/i;

    // The grids' preview sources, keyed by their container elements.
    const sources = new WeakMap();

    /**
     * Registers the preview source ({ visualisation, createPreview }) of the grid in a container.
     */
    const registerSource = (containerElement, source) => {

        sources.set(containerElement, source);
    };

    const findSource = (sourceCellElement) => {

        for (let element = sourceCellElement.parentElement; element;
            element = element.parentElement) {

            const source = sources.get(element);

            if (source) return source;
        }

        return null;
    };

    const formatResult = (result) => {

        if (result === undefined) return "";

        if (result === null) return "null";

        if (typeof result === "object") return JSON.stringify(result);

        return String(result);
    };

    const showResult = (previewElement, text, isError) => {

        if (!isError && HTML_REGEX.test(text)) {
            previewElement.innerHTML = text;
        }
        else {

            previewElement.textContent = text;
        }
    };

    /**
     * Shows the preview in a preview box, returning { schedule, destroy }, or null where the editor
     * was not opened from a cell its code can be previewed for, in which case the box stays
     * hidden.  getCode gets the code, and parameterSetName names the parameters it is given (see
     * Ren.FunctionEditorWidget.parameterSets).
     */
    const attach = (previewElement, sourceCellElement, getCode, parameterSetName) => {

        const source = sourceCellElement ? findSource(sourceCellElement) : null;
        const preview = source ? source.createPreview(sourceCellElement, parameterSetName) : null;

        if (!preview) return null;

        const visualisation = source.visualisation;
        let timeout = null;

        const isEnabled = () => visualisation.autoPreviewEnabled !== false;

        const isDisabledShown = () => previewElement.dataset.placeholder === DISABLED_PLACEHOLDER;

        const showDisabled = () => {

            previewElement.textContent = "";
            previewElement.dataset.placeholder = DISABLED_PLACEHOLDER;
        };

        const show = () => {

            timeout = null;

            if (!isEnabled()) {

                showDisabled();
                return;
            }

            const startTime = performance.now();
            let text;
            let isError = false;

            try {

                text = formatResult(preview.evaluate(getCode()));
            }
            catch (e) {

                text = "Error: " + (e?.message ?? e);
                isError = true;
            }

            if (visualisation.autoPreviewEnabled === undefined &&
                performance.now() - startTime >= SLOW_PREVIEW_DURATION) {

                visualisation.autoPreviewEnabled = false;
                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
                showDisabled();
                return;
            }

            showResult(previewElement, text, isError);
            previewElement.dataset.placeholder = PLACEHOLDER;
        };

        const schedule = () => {

            clearTimeout(timeout);
            timeout = setTimeout(show, DEBOUNCE_DELAY);
        };

        // The "Auto preview" menu item can be clicked while the editor is open.
        const settingsChangedListener = Ren.Messages.Events.visualisationSettingsChanged.handle(
            (changedVisualisation) => {

                if (changedVisualisation !== visualisation) return;

                if (!isEnabled()) {

                    clearTimeout(timeout);
                    timeout = null;
                    showDisabled();
                }
                else if (isDisabledShown()) {

                    show();
                }
            }
        );

        const destroy = () => {

            clearTimeout(timeout);
            timeout = null;
            Ren.Messages.removeListener(settingsChangedListener);
        };

        previewElement.hidden = false;

        // Deferred, so that the editor's window is shown before the first preview is worked out.
        timeout = setTimeout(show, 0);

        return {
            schedule,
            destroy
        };
    };

    return {
        registerSource,
        attach
    };
})();
