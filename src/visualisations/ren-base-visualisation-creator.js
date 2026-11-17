/**
 * Base factory for creating SVG-rendered visualisations, owning props, the svg, the
 * validator/preparer/style-updater strategies and the context menu, and drawing the visualisation
 * when it is created and again whenever its data or settings change.
 *
 * Which data it reads, and when it is asked to draw, is Ren.VisualisationLifecycle's business, so a
 * visualisation that does not render to an svg can use that without the svg pipeline here.
 */
Ren.BaseVisualisationCreator = (config) => {

    const {
        visualisationName,
        createColumnResolver,        // Optional.
        detectColumns,
        getInitialisation,
        renderVisualisation,
        getContextMenuItems,
        getStyleUpdater,             // Returns { updateStylesheet, handleThemeChange?,
                                     // isStyledByRender? }.
        getValidator,                // Returns { validate }.
        getDataPreparer,             // Returns { prepareData }.
        getQAHelper,                 // Returns { setQa }.
        shouldUseErrorElement,       // Wraps errors in a VisualisationInitialisationError element.
        getRequiredInputColumns,      // Optional; the column indexes it reads, or null for all.
        getUnfilteredColumns          // Optional; the columns whose filters it ignores, or null.
    } = config;

    return (tabularData, visualisation) => {

        let columnResolver = null;
        const props = {};
        // True when renderVisualisation sets the context menu up itself.
        const handleContextMenusInRender = config.handleContextMenusInRender || false;

        const lifecycle = Ren.VisualisationLifecycle({
            tabularData,
            visualisation,
            getRequiredInputColumns,
            getUnfilteredColumns
        });

        // Retried when data grouping settings are next registered.
        if (lifecycle.isAwaitingFilterGroupSource()) {

            return Ren.NotReady;
        }

        // Retried when a tab is next selected, as nobody may ever look at it.  Its data is loaded,
        // so it no longer shows as loading.
        if (Ren.TabRelativeVisualisations.isOnUnshownTab(visualisation)) {

            Ren.LoadingAnimations.removeUnrenderedLoadingAnimation(visualisation);
            return Ren.NotReady;
        }

        lifecycle.ensureFilterGroupSettings();

        const getTabularData = lifecycle.getTabularData;

        const getColumnResolverInstance = () => {

            if (!columnResolver && getTabularData()) {

                if (createColumnResolver) {

                    columnResolver = createColumnResolver(getTabularData());
                }
                else {

                    columnResolver = Ren.DataGridColumnResolver(getTabularData());
                }
            }
            return columnResolver;
        };

        const getInputData = () => lifecycle.getInputData();

        const prepareData = (inputData) => {

            if (!inputData || inputData.length === 0) {

                return null;
            }

            const dataPreparer = getDataPreparer();
            return dataPreparer.prepareData(inputData, props);
        };

        const renderVisualisationInternal = (propsArg, data) => {

            if (!data) {

                return null;
            }

            // The renderers find their container by its guid, so one that has left the page before
            // the deferred first draw has nothing to draw into.
            if (propsArg.guid && !document.querySelector("." + propsArg.guid)) return null;

            const validator = getValidator();
            const validationResult = validator.validate(propsArg, data);

            if (validationResult !== true) {

                if (typeof validationResult === "string") {
                    return validationResult;
                }

                return false;
            }

            // A renderer that cannot draw the data returns a message instead, leaving no svg to
            // hang the context menu off.
            const renderResult = renderVisualisation(propsArg, data, getTabularData(), visualisation);

            if (typeof renderResult === "string") return renderResult;

            if (!handleContextMenusInRender) {

                const svgNode = propsArg.svg;

                // A chart whose container left the page is drawn detached.
                if (!svgNode || !svgNode.parentNode) {

                    return null;
                }

                const element = svgNode.parentNode;

                const contextMenu = Ren.SetUpContextMenu();

                const contextMenuItemsProvider = getContextMenuItems(
                    getTabularData(),
                    contextMenu,
                    visualisation,
                    propsArg
                );

                contextMenuItemsProvider.addShowWindowsMenuItems(element);
            }

            // A renderer that styles what it has just drawn is not styled again, as the pass
            // measures the drawing, which forces the whole page to be restyled and laid out.
            const styleUpdater = getStyleUpdater();

            if (!styleUpdater.isStyledByRender?.(propsArg)) {
                styleUpdater.updateStylesheet(propsArg);
            }

            return true;
        };

        const detectColumnsAndSetup = (inputData, dataGroupingSettings) => {

            const result = detectColumns(
                inputData,
                dataGroupingSettings,
                visualisation,
                props,
                getTabularData(),
                getColumnResolverInstance()
            );

            if (typeof result === "string") {

                return result;
            }

            return null;
        };

        /**
         * Puts a message where the visualisation was, the svg having already been taken away, so
         * that a draw that cannot be made says so rather than leaving an empty space.
         */
        const showErrorElement = (message) => {

            if (!shouldUseErrorElement) return;

            const {
                element: errorElement
            } = Ren.VisualisationInitialisationError.getVisualisationInitialisationErrorElement(
                message
            );

            if (props.element && props.element.parentNode) {

                props.element.parentNode.replaceChild(errorElement, props.element);
                props.element = errorElement;
            }
        };

        const initialiseVisualisation = () => {

            try {

                const { element } = getInitialisation(props, visualisation);

                props.element = element;

                const { inputData, dataGroupingSettings } = getInputData();

                const error = detectColumnsAndSetup(inputData, dataGroupingSettings);

                const qaHelper = getQAHelper();
                qaHelper.setQa(props, inputData);

                if (error) {

                    if (shouldUseErrorElement) {

                        const errorInstance = Ren.VisualisationInitialisationError
                            .getVisualisationInitialisationErrorElement(error);

                        // The error element is what goes on the page, so it is what a redraw
                        // replaces once the data can be drawn.
                        props.element = errorInstance.element;

                        return errorInstance;
                    }

                    throw new Error(error);
                }

                const data = prepareData(inputData);

                let renderError = null;

                requestAnimationFrame(() => {

                    renderError = renderVisualisationInternal(props, data);

                    if (typeof renderError === "string") {

                        showErrorElement(renderError);
                    }
                });

                return { element };
            }
            catch (error) {

                // The stack is logged, not just the message, so the error says where it came from.
                Ren.GlobalErrorHandler.logError(
                    `[${visualisationName}] Error during initialization: ${error?.stack ?? error}`
                );

                if (!shouldUseErrorElement) {
                    Ren.PopupErrorMessage(`Error creating ${visualisationName}: ${error.message}`);
                }

                return null;
            }
        };

        const redraw = () => {

            try {

                if (!lifecycle.hasUsableData()) return;

                props?.svg?.remove();

                const { inputData, dataGroupingSettings } = getInputData();

                // Detected again, to pick up format and other setting changes.
                const setupError = detectColumnsAndSetup(inputData, dataGroupingSettings);

                const qaHelper = getQAHelper();
                qaHelper.setQa(props, inputData);

                if (setupError) {

                    showErrorElement(setupError);
                    return;
                }

                const data = prepareData(inputData);

                // The container may have been replaced with an error element.
                const containerElement = document.querySelector("." + props.guid);

                if (!containerElement && props.element && props.element.parentNode) {

                    const newContainer = document.createElement("div");
                    newContainer.className = props.guid;
                    props.element.parentNode.replaceChild(newContainer, props.element);
                    props.element = newContainer;
                }

                const renderError = renderVisualisationInternal(props, data);

                if (typeof renderError === "string") {

                    showErrorElement(renderError);
                    return;
                }

                const styleUpdater = getStyleUpdater();

                if (styleUpdater.rescaleAfterRedraw) {

                    const container = document.querySelector("." + props.guid);

                    if (container) {

                        const width = container.clientWidth;
                        const height = container.clientHeight;

                        if (width > 0 && height > 0) {
                            styleUpdater.updateStylesheet(props, width, height);
                        }
                    }
                }
            }
            catch (error) {

                Ren.GlobalErrorHandler.logError(
                    `[${visualisationName}] Error during redraw: ${error?.stack ?? error}`
                );
            }
        };

        // For interactions that change how the data is prepared rather than only how it is styled.
        props.redrawVisualisation = () => redraw();

        const instance = initialiseVisualisation();

        if (!instance) {

            return null;
        }

        // The lifecycle decides when each drawing entry point is due.
        const styleUpdater = getStyleUpdater();

        lifecycle.start({
            getElement: () => (props.guid && document.querySelector("." + props.guid)) || null,
            redraw,
            // A redraw detects the columns again, so it takes in a grouping change as well.
            recreate: redraw,
            resize: (width, height) => getStyleUpdater().updateStylesheet(props, width, height),
            themeChanged: styleUpdater.handleThemeChange
                ? () => {

                    styleUpdater.handleThemeChange(props);
                }
                : null
        });

        return instance;
    };
};
