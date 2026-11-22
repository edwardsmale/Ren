/**
 * Scales a popup window's content to fit the window's width as it is resized.  The content keeps
 * the layout width it had when the user first resized the window (the base width), and is scaled
 * from that.  Its layout height follows the window, so a taller window shows more of it rather
 * than scaling it.
 */
Ren.PopupWindow_ContentScale = (_window, contentContainer, options) => {

    const SCALED_CONTENT_CLASS = "ren-report-popup-window__content-container--scaled";

    let baseWidth = options.contentScaleBaseWidth || null;

    // The container's own inline size, put back when it stops being scaled.
    let unscaledWidth = null;
    let unscaledHeight = null;

    const removeScale = () => {

        if (!contentContainer.classList.contains(SCALED_CONTENT_CLASS)) return;

        contentContainer.classList.remove(SCALED_CONTENT_CLASS);

        contentContainer.style.width = unscaledWidth;
        contentContainer.style.height = unscaledHeight;
        contentContainer.style.transform = "";
    };

    const update = () => {

        if (!baseWidth) {

            removeScale();
            return;
        }

        if (!contentContainer.classList.contains(SCALED_CONTENT_CLASS)) {

            unscaledWidth = contentContainer.style.width;
            unscaledHeight = contentContainer.style.height;

            contentContainer.classList.add(SCALED_CONTENT_CLASS);
        }

        // Layout sizes, so the window's own Ctrl + wheel zoom is left out.
        const scale = Ren.NumberUtils.round(_window.clientWidth / baseWidth, 4);

        if (!scale) return;

        contentContainer.style.width = baseWidth + "px";
        contentContainer.style.height = (_window.clientHeight / scale) + "px";
        contentContainer.style.transform = "scale(" + scale + ")";
    };

    /**
     * Gets a value indicating whether the content is laid out at a base width and scaled.
     */
    const hasBaseWidth = () => baseWidth !== null;

    /**
     * Sets the width the content is laid out at before it is scaled, or with null stops scaling
     * it until the user next resizes the window.
     */
    const setBaseWidth = (width) => {

        baseWidth = width || null;

        if (options.onContentScaleBaseChanged) {
            options.onContentScaleBaseChanged(baseWidth);
        }

        update();
    };

    /**
     * Takes the window's current width as the base width, unless it already has one.
     */
    const fixBaseWidth = () => {

        if (hasBaseWidth()) return;

        setBaseWidth(_window.clientWidth);
    };

    const resizeObserver = new ResizeObserver(() => {

        update();
    });

    resizeObserver.observe(_window);

    const disconnect = () => {

        resizeObserver.disconnect();
    };

    return {
        disconnect,
        fixBaseWidth,
        hasBaseWidth,
        setBaseWidth
    };
};
