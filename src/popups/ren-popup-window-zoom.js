/**
 * Scales the popup window when Ctrl + mouse wheel is used.
 */
Ren.PopupWindow_Zoom = (_window, options) => {

    const setScale = (scale) => {

        scale = Ren.NumberUtils.round(scale, 3);

        options.scale = scale;

        _window.style.transform = "scale(" + scale + ")";

        if (options.onZoom) {
            options.onZoom(scale);
        }
    };

    const updateScale = (delta) => {

        let newScale;

        if (delta > 0) {
            newScale = Math.max(0.1, options.scale - 0.05);
        }
        else {

            newScale = Math.min(3, options.scale + 0.05);
        }

        setScale(newScale);
    };

    const mouseWheelHandler = (e) => {

        if (!e.ctrlKey) return;

        e.preventDefault();

        // Held off the browser's own zoom too, so a slip off the content doesn't scale the page.
        const isDisabled = typeof options.disableWheelZoom === "function"
            ? options.disableWheelZoom()
            : options.disableWheelZoom;

        if (isDisabled) return;

        const delta = Math.sign(e.deltaY);

        updateScale(delta);
    };

    _window.addEventListener("wheel", mouseWheelHandler);
    _window.style.transformOrigin = "0 0";

    return {
        setScale: setScale
    };
};
