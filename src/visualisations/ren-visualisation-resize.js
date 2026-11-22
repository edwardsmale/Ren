/**
 * Lets a visualisation declared as markup (a <ren-*> element in a web report's view) be resized on
 * the page.  An ID on the element gives its saved settings a stable key, so an ID is what opts a
 * visualisation in to being resized.  There are handles on the right edge, the bottom edge and the
 * bottom-right corner, usable only in edit mode (done in CSS).
 */
Ren.VisualisationResize = (() => {

    const MINIMUM_SIZE_PX = 40;

    const HANDLES_SELECTOR = ".js-ren-visualisation-resize-handles";

    const STYLESHEET_NAME = "visualisation-resize";

    /**
     * The dynamic stylesheet carrying each visualisation's size.  Held here rather than on the
     * visualisation itself, which is shallow-cloned into the report settings and so should carry no
     * DOM references.
     */
    const stylesheetsByVisualisation = new WeakMap();

    /**
     * Gets the visualisation's stylesheet, making a new one where it has none. The one held here is
     * only reused while its element is still on the page, since recreating a visualisation drops
     * its dynamic stylesheets.
     */
    const getStylesheet = (visualisation) => {

        const stylesheet = stylesheetsByVisualisation.get(visualisation);

        if (stylesheet && stylesheet.getStylesheet()) return stylesheet;

        const newStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
            visualisation.visualisationGuid,
            STYLESHEET_NAME
        );

        stylesheetsByVisualisation.set(visualisation, newStylesheet);

        return newStylesheet;
    };

    /**
     * Gets a value indicating whether a visualisation is one the user can resize: it was named by
     * the ID of its <ren-*> element, it is not a popup, and it has an element on the page.
     */
    const isResizable = (visualisation) =>
        !!visualisation.settingsId && !visualisation.isPopup && !!visualisation.element;

    /**
     * Gets a dimension in pixels, or null where the visualisation has not been given one.  The
     * saved values are px strings, but a report's author can write any CSS length in the markup.
     */
    const getDimensionPixels = (value) => {

        if (!value) return null;

        // A length convertToPixels cannot make sense of ("auto", say) is handed back unchanged, so
        // what comes out is only usable when it is a number.
        const pixels = Ren.StylesUtils.convertToPixels(value);

        return typeof pixels === "number" && pixels > 0 ? Math.round(pixels) : null;
    };

    /**
     * Writes the visualisation's size to its stylesheet, on its container and on a grid set's
     * viewport (with !important, since a grid set sizes its viewport inline).
     *
     * Returns whether the visualisation has a size of its own.
     */
    const applyDimensions = (visualisation) => {

        if (!isResizable(visualisation)) return false;

        const width = getDimensionPixels(visualisation.resizedWidth);
        const height = getDimensionPixels(visualisation.resizedHeight);

        // A visualisation that has never been resized is left to size itself, and is given no
        // stylesheet at all.
        if (!width && !height) return false;

        const styles = [];

        if (width) {

            styles.push(`{ width: ${width}px; max-width: ${width}px }`);
            styles.push(
                `.ren-visualisation__viewport ` +
                `{ width: ${width}px !important; max-width: ${width}px !important }`
            );
        }

        if (height) {

            styles.push(`{ height: ${height}px }`);
            styles.push(
                `.ren-visualisation__viewport ` +
                `{ height: ${height}px !important; max-height: ${height}px !important }`
            );
        }

        getStylesheet(visualisation).updateIfChanged(styles);

        return true;
    };

    /**
     * Tells the visualisation, and the report around it, that it now has a different amount of
     * room.  A chart rescales itself to its container on visualisationContainerResize; a grid
     * recomputes its dimensions on repaint, and repositions its quick links on columnResized.
     */
    const notifyResized = (visualisation) => {

        const element = visualisation.element;

        if (!element) return;

        Ren.Messages.Events.visualisationContainerResize.notify(
            visualisation.visualisationGuid,
            element.clientWidth,
            element.clientHeight
        );

        Ren.Messages.Events.columnResized.notify();
        Ren.Messages.Requests.repaint.notify();
    };

    /**
     * Gets the scale a rendered size implies against its untransformed layout size, so that a
     * visualisation inside a zoomed ancestor follows the mouse.  Where the two agree, 1 is returned
     * so that ordinary visualisations see no sub-pixel drift.
     */
    const getScale = (renderedSize, layoutSize) => {

        if (!layoutSize || !renderedSize) return 1;

        const scale = renderedSize / layoutSize;

        return Math.abs(scale - 1) < 0.01 ? 1 : scale;
    };

    /**
     * Drags one of the handles.  resizesWidth and resizesHeight say which of the two dimensions the
     * handle changes; the corner handle changes both.
     */
    const startResize = (visualisation, mouseDownEvent, resizesWidth, resizesHeight) => {

        mouseDownEvent.preventDefault();

        const element = visualisation.element;

        const initialRect = element.getBoundingClientRect();
        const initialWidth = initialRect.width;
        const initialHeight = initialRect.height;
        const initialMouseX = mouseDownEvent.pageX;
        const initialMouseY = mouseDownEvent.pageY;

        const scaleX = getScale(initialRect.width, element.offsetWidth);
        const scaleY = getScale(initialRect.height, element.offsetHeight);

        const previousUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";

        const mouseMoveHandler = (moveEvent) => {

            moveEvent.preventDefault();

            if (resizesWidth) {

                const width = (initialWidth + (moveEvent.pageX - initialMouseX)) / scaleX;
                visualisation.resizedWidth = Math.max(MINIMUM_SIZE_PX, Math.round(width)) + "px";
            }

            if (resizesHeight) {

                const height = (initialHeight + (moveEvent.pageY - initialMouseY)) / scaleY;
                visualisation.resizedHeight = Math.max(MINIMUM_SIZE_PX, Math.round(height)) + "px";
            }

            applyDimensions(visualisation);
            notifyResized(visualisation);
        };

        const mouseUpHandler = (upEvent) => {

            upEvent.preventDefault();

            document.body.style.userSelect = previousUserSelect;
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);

            // The size is now the visualisation's own setting, so the report knows it has changed.
            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        };

        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
    };

    /**
     * Gives a rendered visualisation its resize handles and its saved size.
     *
     * Whether the handles are there is read from the container rather than remembered, since
     * rendering removes them but a redraw does not.
     */
    const setUpResizing = (visualisation) => {

        if (!isResizable(visualisation)) return;

        if (applyDimensions(visualisation)) {

            // The visualisation drew itself before its saved size reached it, so it is told about
            // the room it now has once the browser has laid the new size out.
            Ren.FnUtils.defer(() => {

                notifyResized(visualisation);
            }, 200);
        }

        if (visualisation.element.querySelector(HANDLES_SELECTOR)) return;

        const handles = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("VisualisationResizeHandles", {});

        const addHandleListener = (selector, resizesWidth, resizesHeight) => {

            handles.querySelector(selector).addEventListener("mousedown", (e) => {

                if (e.which !== 1) return;

                startResize(visualisation, e, resizesWidth, resizesHeight);
            });
        };

        addHandleListener(".js-ren-visualisation-resize-handle-right", true, false);
        addHandleListener(".js-ren-visualisation-resize-handle-bottom", false, true);
        addHandleListener(".js-ren-visualisation-resize-handle-bottom-right", true, true);

        visualisation.element.appendChild(handles);
    };

    return {
        isResizable,
        applyDimensions,
        setUpResizing
    };
})();
