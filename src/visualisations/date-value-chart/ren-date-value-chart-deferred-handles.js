/**
 * Holds back a date/value chart's drag handles until the pointer comes over the chart.
 *
 * The handles are invisible, but there are one or more for every point drawn, and so can be most
 * of what a chart draws; on a report of many charts, drawing them all on each redraw slows every
 * filter change.  They are only ever found by the pointer, so a chart is given its handles the
 * first time the pointer comes over it, or at once if it is over it already - as it is when a
 * drag redraws the chart.
 */
Ren.DateValueChart_DeferredHandles = (() => {

    // The handles waiting on each chart's container, which stays on the page across redraws.
    const pendingByContainer = new WeakMap();

    /**
     * Adds handles to a group once the pointer is over its chart.  They go in a group of their
     * own, appended now, so they stand where they would have been drawn among the rest.
     *
     * @param {object} props - The chart's props.
     * @param {Element} parentGroup - The group they're drawn in.  One drawn over before the
     *     pointer comes gets none.
     * @param {Function} addHandles - Adds them, given the group to add them to.
     */
    const add = (props, parentGroup, addHandles) => {

        const group = Ren.Svg.append(parentGroup, "g", { "class": "ren-drag-handles" });
        const container = props.guid ? document.querySelector("." + props.guid) : null;

        if (!container || container.matches(":hover")) {

            addHandles(group);
            return;
        }

        let pending = pendingByContainer.get(container);

        if (!pending) {

            pending = [];
            pendingByContainer.set(container, pending);

            const addPending = () => {

                container.removeEventListener("pointerenter", addPending);
                pendingByContainer.delete(container);

                for (let i = 0; i < pending.length; i++) {

                    const { group, addHandles } = pending[i];

                    if (group.isConnected) addHandles(group);
                }
            };

            container.addEventListener("pointerenter", addPending);
        }

        pending.push({ group, addHandles });
    };

    return {
        add
    };
})();
