/**
 * Adds vertical resize handles to data points (bars, line nodes, dots),
 * allowing the y-axis scale to be adjusted by dragging values up/down.
 */
Ren.DateValueChart_ValueResize = (() => {

    const handleColor = "#999";

    /**
     * Lets a handle be dragged up and down, previewing the rescaled plot as it goes and setting
     * its axis' maximum to put the value it labels where it was dropped.
     */
    const attachValueDrag = (
        handle,
        position,
        dataValue,
        axisName,
        yScale,
        props,
        visualisation) => {

        // The state the preview rescales from, and where the plot's baseline is, for the drag in
        // progress.
        let previewState = null;
        let previewBaselineY = 0;
        let topPx = position.topPx;

        const setTop = (newTopPx) => {

            topPx = newTopPx;
            handle.setAttribute("transform", `translate(${position.leftPx},${topPx})`);
        };

        // What the plotted heights are now a fraction of: the height the dragged handle stands
        // at, over the height it started the drag at.
        const getPreviewScaleFactor = () => {

            const startHeight = previewBaselineY - (position.topPx + position.heightPx / 2);

            if (startHeight <= 0) return 1;

            return (previewBaselineY - (topPx + position.heightPx / 2)) / startHeight;
        };

        const onDragStart = () => {

            handle.classList.add("ren-value-resize-handle--active");
            Ren.StylesUtils.holdDragCursor("ns-resize");

            previewBaselineY = props && typeof props.innerHeight === "number"
                ? props.innerHeight
                : Math.max(yScale.getRange()[0], yScale.getRange()[1]);
            previewState = Ren.DateValueChart_ValueResizePreview.capture(props, yScale, handle);
        };

        const onDragMove = (event, delta) => {

            setTop(topPx + delta.dy);

            // Rescale the plot to the handle's new position, so the bars follow the drag.
            Ren.DateValueChart_ValueResizePreview.applyScale(previewState, getPreviewScaleFactor());
        };

        const onDragEnd = () => {

            handle.classList.remove("ren-value-resize-handle--active");
            Ren.StylesUtils.releaseDragCursor();

            // Get the final y position of the handle (center of the handle).
            const handleYPos = topPx + position.heightPx / 2;

            // Calculate what the new max should be.
            const yScaleRange = yScale.getRange();
            const rangeMin = Math.min(yScaleRange[0], yScaleRange[1]);
            const rangeMax = Math.max(yScaleRange[0], yScaleRange[1]);
            const chartHeightPixels = rangeMax - rangeMin;

            // For an inverted scale (as y scales are): range is [height, 0] Bottom of
            // chart is at range[0], top is at range[1] If handle is at pixel position P (from
            // top of SVG), distance from bottom is (height - P)
            const pixelFromBottom = Math.max(0.1, chartHeightPixels - (handleYPos - rangeMin));
            const newMax = (dataValue * chartHeightPixels) / pixelFromBottom;

            if (newMax > 0) {

                // On a chart without a right axis, the right axis' series are drawn on the
                // left axis' scale, so both are set or the drawn axis would not read the bars.
                let axisNames = Ren.DateValueChart_YScales.getAxisNamesOnScale(props, yScale);

                // The hidden axis is never drawn, and never shares its scale.
                if (!axisNames.length) axisNames = [axisName];

                for (let i = 0; i < axisNames.length; i++) {

                    const axis = props.axes[axisNames[i]];

                    axis.maxY = newMax;
                    axis.yExtent = [0, newMax];
                    axis.fromSettings = true;

                    // Update the visualization object for saving.
                    if (visualisation) {

                        if (!visualisation[axisNames[i]]) {
                            visualisation[axisNames[i]] = {};
                        }

                        visualisation[axisNames[i]].maxY = newMax;
                        visualisation[axisNames[i]].fromSettings = true;
                    }
                }

                // The redraw replaces everything the preview moved, drawn to the new maximum.
                previewState = null;

                if (props.scaleMultiChartAxes) {

                    props.scaleMultiChartAxes(axisNames, newMax);
                }
                else {

                    yScale.setDomain([0, newMax]);

                    // Skip extent recalculation since the user explicitly set this value.
                    props.skipExtentRecalculation = true;
                    props.redrawChart();
                }

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }

            // A drag that set no new maximum leaves the chart as it was drawn, the handle
            // dragged back to the point it labels.
            setTop(position.topPx);

            Ren.DateValueChart_ValueResizePreview.restore(previewState);
            previewState = null;
        };

        Ren.Svg.drag(handle, { start: onDragStart, move: onDragMove, end: onDragEnd });
    };

    /**
     * Generic handle renderer for all chart types.
     * config: { handleClass, handleWidth (value or function), handleHeight }
     */
    const addHandles = (chartGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation, config) => {

        data.forEach((d, index) => {

            const dataValue = mainValueFn(d);
            const xValue = crossValueFn(d);
            const xPos = xScale.getPixel(xValue);
            const yPos = yScale.getPixel(dataValue);
            const handleWidth = typeof config.handleWidth === "function" ? config.handleWidth(d) : config.handleWidth;
            const position = {
                leftPx: xPos - handleWidth / 2,
                topPx: yPos - config.handleHeight / 2,
                heightPx: config.handleHeight
            };

            const handle = Ren.Svg.append(chartGroup, "rect", {
                "class": `ren-value-resize-handle ${config.handleClass}`,
                "width": handleWidth,
                "height": config.handleHeight,
                "fill": handleColor,
                "data-index": index,
                "data-value": dataValue,
                "data-axis-name": axisName,
                "transform": `translate(${position.leftPx},${position.topPx})`
            });

            attachValueDrag(handle, position, dataValue, axisName, yScale, props, visualisation);
        });
    };

    /**
     * Adds resize handles to bar tops.
     */
    const addHandlesToBars = (
        seriesGroup,
        data,
        mainValueFn,
        crossValueFn,
        xScale,
        yScale,
        axisName,
        props,
        visualisation,
        bandwidthFn) => {

        addHandles(seriesGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation, {
            handleClass: "ren-value-resize-handle--bar",
            handleWidth: bandwidthFn || (() => 20),
            handleHeight: 20
        });
    };

    /**
     * Adds resize handles to line nodes.
     */
    const addHandlesToLineNodes = (chartGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation) => {

        addHandles(chartGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation, {
            handleClass: "ren-value-resize-handle--line-node",
            handleWidth: 36,
            handleHeight: 14
        });
    };

    /**
     * Adds resize handles to dots.
     */
    const addHandlesToDots = (seriesGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation) => {

        addHandles(seriesGroup, data, mainValueFn, crossValueFn, xScale, yScale, axisName, props, visualisation, {
            handleClass: "ren-value-resize-handle--dot",
            handleWidth: 28,
            handleHeight: 12
        });
    };

    return {
        addHandlesToBars,
        addHandlesToLineNodes,
        addHandlesToDots
    };
})();
