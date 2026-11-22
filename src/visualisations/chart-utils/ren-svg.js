/**
 * The few DOM helpers the charts draw their SVG with.
 */
Ren.Svg = (() => {

    const NAMESPACE = "http://www.w3.org/2000/svg";

    /**
     * Sets attributes from an object of them, removing any whose value is null or undefined.
     */
    const setAttrs = (element, attrs) => {

        const names = Object.keys(attrs);

        for (let i = 0; i < names.length; i++) {

            const value = attrs[names[i]];

            if (value == null) {
                element.removeAttribute(names[i]);
            }
            else {

                element.setAttribute(names[i], value);
            }
        }

        return element;
    };

    /**
     * Sets inline styles from an object of them, removing any whose value is null or undefined.
     */
    const setStyles = (element, styles) => {

        const names = Object.keys(styles);

        for (let i = 0; i < names.length; i++) {

            const value = styles[names[i]];

            if (value == null) {
                element.style.removeProperty(names[i]);
            }
            else {

                element.style.setProperty(names[i], value);
            }
        }

        return element;
    };

    const create = (tag, attrs) => {

        const element = document.createElementNS(NAMESPACE, tag);

        if (attrs) setAttrs(element, attrs);

        return element;
    };

    /**
     * Appends a new SVG element to parent.
     */
    const append = (parent, tag, attrs) => parent.appendChild(create(tag, attrs));

    /**
     * Inserts a new SVG element into parent before the child given, or last without one.
     */
    const insertBefore = (parent, tag, attrs, child) =>
        parent.insertBefore(create(tag, attrs), child || null);

    /**
     * Records the datum an element was drawn for, returning the element.
     */
    const setDatum = (element, datum) => {

        element.renDatum = datum;

        return element;
    };

    /**
     * Gets the datum an element was drawn for.
     */
    const getDatum = element => element.renDatum;

    /**
     * Gets an event's [x, y] in node's coordinates.
     */
    const pointer = (event, node) => {

        while (event.sourceEvent) event = event.sourceEvent;

        if (node === undefined) node = event.currentTarget;

        if (node) {

            const svg = node.ownerSVGElement || node;

            if (svg.createSVGPoint) {

                const point = new DOMPoint(event.clientX, event.clientY)
                    .matrixTransform(node.getScreenCTM().inverse());

                return [point.x, point.y];
            }

            if (node.getBoundingClientRect) {

                const rect = node.getBoundingClientRect();

                return [
                    event.clientX - rect.left - node.clientLeft,
                    event.clientY - rect.top - node.clientTop
                ];
            }
        }

        return [event.pageX, event.pageY];
    };

    /**
     * Listens for an event in place of whatever was bound under the same name before, so an
     * element that outlives a redraw does not pile up listeners.  The name is the event type,
     * optionally followed by a dot and a name of its own ("mousemove.crosshairs"), so that two
     * listeners for one type can be told apart.  A null handler only removes the old one.
     */
    const on = (element, name, handler) => {

        const handlers = element.renHandlers || (element.renHandlers = {});
        const type = name.split(".")[0];

        if (handlers[name]) element.removeEventListener(type, handlers[name]);

        handlers[name] = handler;

        if (handler) element.addEventListener(type, handler);

        return element;
    };

    const preventDefault = event => event.preventDefault();

    // The click a drag ends with is swallowed, so the chart under the handle does not take it for
    // a click of its own.
    const swallowNextClick = () => {

        const swallow = (event) => {

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        window.addEventListener("click", swallow, true);
        setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    };

    /**
     * Lets an element be dragged with the main button.  start and end are given the event, and
     * move is also given how far the pointer moved since the last one, in the parent's
     * coordinates, as { dx, dy }.  The press goes no further than the element, so the chart under
     * it starts no date range selection of its own.
     */
    const drag = (element, handlers) => {

        element.style.touchAction = "none";

        element.addEventListener("pointerdown", (downEvent) => {

            if (downEvent.button !== 0 || downEvent.ctrlKey) return;

            // Also keeps the browser from firing the mousedown the chart listens for.
            downEvent.preventDefault();
            downEvent.stopImmediatePropagation();

            const pointerId = downEvent.pointerId;
            const parent = element.parentNode;
            let last = pointer(downEvent, parent);
            let hasMoved = false;

            const onMove = (event) => {

                if (event.pointerId !== pointerId) return;

                const current = pointer(event, parent);
                const dx = current[0] - last[0];
                const dy = current[1] - last[1];

                if (dx === 0 && dy === 0) return;

                last = current;
                hasMoved = true;

                if (handlers.move) handlers.move(event, { dx, dy });
            };

            const onEnd = (event) => {

                if (event.pointerId !== pointerId) return;

                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onEnd);
                window.removeEventListener("pointercancel", onEnd);
                window.removeEventListener("selectstart", preventDefault);

                if (hasMoved) swallowNextClick();

                if (handlers.end) handlers.end(event);
            };

            // Followed on the window, so a pointer that outruns the handle keeps dragging it.
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onEnd);
            window.addEventListener("pointercancel", onEnd);
            window.addEventListener("selectstart", preventDefault);

            if (handlers.start) handlers.start(downEvent);
        });

        return element;
    };

    return {
        NAMESPACE,
        setAttrs,
        setStyles,
        append,
        insertBefore,
        setDatum,
        getDatum,
        pointer,
        on,
        drag
    };
})();
