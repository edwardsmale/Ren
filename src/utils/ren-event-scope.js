/**
 * Tells Ren's page-wide event handlers whether an event is Ren's to act on, so that a host page
 * keeps its own right-click menu and keyboard shortcuts outside its reports.  An event is Ren's
 * when it happens in a report context, or in one of Ren's own elements outside them, such as a
 * popup window or context menu added to the body.  Where the body is the report context, every
 * event is Ren's.
 */
Ren.EventScope = (() => {

    const RENS_ELEMENT_SELECTOR =
        ".js-ren-report-context, :not(html, body):is([class^=\"ren-\"], [class*=\" ren-\"])";

    let lastPointerDownInScope = false;

    /**
     * Gets a value indicating whether the target is inside a report context or Ren's own elements.
     */
    const isInScope = (target) => {

        if (!target || !target.closest) return false;

        return target.closest(RENS_ELEMENT_SELECTOR) !== null;
    };

    /**
     * Gets a value indicating whether a key press is Ren's.  With nothing focused, a key press's
     * target is the body, so it's Ren's when the last click was.
     */
    const isKeyboardEventInScope = (event) => {

        const target = event.target;

        if (!target || target === document.body || target === document.documentElement ||
            target === document) {

            return isInScope(document.body) || lastPointerDownInScope;
        }

        return isInScope(target);
    };

    const onPointerDown = (event) => {

        lastPointerDownInScope = isInScope(event.target);
    };

    // Both, as a mousedown can come without a pointerdown, such as one sent by a script.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onPointerDown, true);

    return {
        isInScope,
        isKeyboardEventInScope
    };
})();
