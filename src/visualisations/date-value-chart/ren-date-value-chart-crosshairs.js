/**
 * The crosshairs a date/value chart draws at the pointer while Alt is held.
 *
 * A value partway up the plot is placed by eye against an axis some way off, which a line run
 * across to each axis settles.  They are held behind a key rather than shown on hover, since a
 * pair of lines over the plot is in the way of everything but the one reading being taken.
 *
 * The lines are drawn in the container's own pixels rather than in plot coordinates, so they need
 * no counter-scaling.
 */
Ren.DateValueChart_Crosshairs = (() => {

    // The blue the lines are drawn in, matching the search conversion rate chart's, and how thick
    // they are.  A hairline is enough to line a value up with an axis without covering it.
    const LINE_COLOUR = "#00A7FE";
    const LINE_WIDTH_PX = 1;

    // Where the crosshairs are, so that a test can ask without watching the DOM.
    let lastResult = { shown: false, xPx: null, yPx: null };

    const getDiagnostics = () => lastResult;

    const appendLineDiv = (parent, styles) => {

        const line = document.createElement("div");

        Ren.Svg.setStyles(line, Object.assign({
            "position": "absolute",
            "background": LINE_COLOUR
        }, styles));

        return parent.appendChild(line);
    };

    /**
     * Gets the crosshairs a multi-chart's charts share, run right across all of them from
     * whichever one the pointer is over.  Its element is put over the charts, in a positioned
     * parent they fill.
     */
    const createShared = () => {

        const element = document.createElement("div");

        element.className = "ren-crosshairs ren-crosshairs--shared";

        Ren.Svg.setStyles(element, {
            "position": "absolute",
            "left": "0",
            "top": "0",
            "width": "100%",
            "height": "100%",
            "pointer-events": "none",
            "display": "none"
        });

        const verticalLine = appendLineDiv(element, {
            "top": "0",
            "bottom": "0",
            "width": LINE_WIDTH_PX + "px"
        });
        const horizontalLine = appendLineDiv(element, {
            "left": "0",
            "right": "0",
            "height": LINE_WIDTH_PX + "px"
        });

        // At a pointer's place on the page, read in the element's own pixels, whatever it is
        // scaled by.
        const show = (clientX, clientY) => {

            const rect = element.parentNode?.getBoundingClientRect();

            if (!rect) return;

            const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
            const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : 1;

            element.style.display = "block";
            verticalLine.style.left = Math.round((clientX - rect.left) / (scaleX || 1)) + "px";
            horizontalLine.style.top = Math.round((clientY - rect.top) / (scaleY || 1)) + "px";
        };

        const hide = () => {

            element.style.display = "none";
        };

        return { element, show, hide };
    };

    /**
     * Draws a chart's crosshairs and starts following the pointer over it.  The lines belong to the
     * chart group and the handlers to the svg, so both go with the chart when it is drawn again.
     *
     * @param {object} props - The chart's props, holding the svg and chart group drawn into and the
     *     plot's size in its own coordinates.
     */
    const attach = (props) => {

        if (!props.svg || !props.chartGroup) return;

        // Left out of hit testing, since a line under the pointer would otherwise take the hover
        // off whatever is behind it.
        const group = Ren.Svg.append(props.chartGroup, "g", { "class": "ren-crosshairs" });

        group.style.pointerEvents = "none";

        Ren.DateValueChart_Visibility.setShown(props, ".ren-crosshairs", false);

        const appendLine = () => Ren.Svg.append(group, "line", {
            "class": "ren-crosshair-line",
            "stroke": LINE_COLOUR,
            "stroke-width": LINE_WIDTH_PX,
            "shape-rendering": "crispEdges"
        });

        const verticalLine = appendLine();
        const horizontalLine = appendLine();

        const chartGroupNode = props.chartGroup;

        // Whether the window is being listened to for the Alt key, and where the pointer was when
        // it was last over the chart, so that pressing Alt without moving still draws them.
        let isListening = false;
        let lastPointer = null;
        let lastClientPointer = null;

        // A multi-chart's charts draw the crosshairs they share rather than their own.
        const sharedCrosshairs = props.sharedCrosshairs;

        const hide = () => {

            Ren.DateValueChart_Visibility.setShown(props, ".ren-crosshairs", false);
            sharedCrosshairs?.hide();
            lastResult = { shown: false, xPx: null, yPx: null };
        };

        /**
         * Gets a value indicating whether a pointer position, in the container's pixels from the
         * plot's top left, is over the plot itself rather than the margins around it.
         */
        const isOverPlot = (xPx, yPx) => {

            const widthPx = props.innerWidth * (props.scaleX || 1);
            const heightPx = props.innerHeight * (props.scaleY || 1);

            return xPx >= 0 && xPx <= widthPx && yPx >= 0 && yPx <= heightPx;
        };

        /**
         * Runs each line right across the plot through the pointer, so that either end of it meets
         * the axis the reading is being taken against.
         */
        const draw = (xPx, yPx) => {

            if (!isOverPlot(xPx, yPx)) {

                hide();

                return;
            }

            lastResult = { shown: true, xPx, yPx };

            if (sharedCrosshairs) {

                if (lastClientPointer) {

                    sharedCrosshairs.show(lastClientPointer[0], lastClientPointer[1]);
                }

                return;
            }

            const widthPx = props.innerWidth * (props.scaleX || 1);
            const heightPx = props.innerHeight * (props.scaleY || 1);

            Ren.DateValueChart_Visibility.setShown(props, ".ren-crosshairs", true);

            Ren.Svg.setAttrs(verticalLine, { "x1": xPx, "x2": xPx, "y1": 0, "y2": heightPx });
            Ren.Svg.setAttrs(horizontalLine, { "x1": 0, "x2": widthPx, "y1": yPx, "y2": yPx });
        };

        // A chart redrawn under the pointer is taken out of the DOM without ever seeing a
        // mouseleave, so the listeners have to notice for themselves that it has gone.
        const hasBeenReplaced = () => {

            if (props.svg?.isConnected) return false;

            stopListening();

            return true;
        };

        const altKeyDownHandler = (event) => {

            if (hasBeenReplaced()) return;

            if (event.key === "Alt" && lastPointer) {

                draw(lastPointer[0], lastPointer[1]);
            }
        };

        const altKeyUpHandler = (event) => {

            if (hasBeenReplaced()) return;

            if (event.key === "Alt") {

                hide();
            }
        };

        // Held on the window only while the pointer is over this chart.  A chart is redrawn on
        // every filter and settings change, so listeners left up for the life of the page would
        // pile up, each one holding on to the chart it was drawn for.
        const startListening = () => {

            if (isListening) return;

            isListening = true;

            window.addEventListener("keydown", altKeyDownHandler);
            window.addEventListener("keyup", altKeyUpHandler);
        };

        const stopListening = () => {

            isListening = false;

            window.removeEventListener("keydown", altKeyDownHandler);
            window.removeEventListener("keyup", altKeyUpHandler);
        };

        Ren.Svg.on(props.svg, "mousemove.crosshairs", (event) => {

            startListening();

            // The chart group carries the margins but none of the plot's scaling, so a pointer
            // read against it is in the container's pixels from the plot's top left.
            lastPointer = Ren.Svg.pointer(event, chartGroupNode);
            lastClientPointer = [event.clientX, event.clientY];

            if (event.altKey) {

                draw(lastPointer[0], lastPointer[1]);
            }
            else {

                hide();
            }
        });

        Ren.Svg.on(props.svg, "mouseleave.crosshairs", () => {

            stopListening();

            lastPointer = null;
            lastClientPointer = null;
            hide();
        });
    };

    return {
        attach,
        createShared,
        getDiagnostics
    };
})();
