/**
 * Adds context menu items to y-axes for scaling the y-axis range and formatting its ticks.
 */
Ren.DateValueChart_ContextMenu_YAxis = (props, visualisation) => {

    const scaleFactors = [
        { text: "2x", factor: 2 },
        { text: "3x", factor: 3 },
        { text: "10x", factor: 10 },
        { text: "100x", factor: 100 }
    ];

    const getSavedAxis = (axisName) => {

        if (!visualisation[axisName]) visualisation[axisName] = {};

        return visualisation[axisName];
    };

    const clearAxisMaximum = (axis) => {

        if (!axis) return;

        axis.fromSettings = false;
        delete axis.maxY;
    };

    const resetYAxisScale = (axisName) => {

        if (visualisation) {

            if (!axisName || axisName === "leftAxis") {

                clearAxisMaximum(getSavedAxis("leftAxis"));
                clearAxisMaximum(props.axes.leftAxis);
            }

            if (!axisName || axisName === "rightAxis") {

                clearAxisMaximum(getSavedAxis("rightAxis"));
                clearAxisMaximum(props.axes.rightAxis);
            }

            if (!axisName || axisName === "hiddenAxis") {

                clearAxisMaximum(getSavedAxis("hiddenAxis"));
                clearAxisMaximum(props.axes.hiddenAxis);
            }
        }

        // Resetting the scale redraws from extents recalculated against the current data.
        if (typeof props.resetScale === "function") {
            props.resetScale();
        }

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const applyYAxisScale = (scale, axisName) => {

        const axis = props.axes[axisName];
        if (!axis) return;

        const newMax = axis.yExtent[1] * scale;

        axis.maxY = newMax;
        axis.yExtent = [0, newMax];
        axis.fromSettings = true;

        if (axis.yScale) {
            axis.yScale.setDomain([0, newMax]);
        }

        if (visualisation) {

            const savedAxis = getSavedAxis(axisName);

            savedAxis.maxY = newMax;
            savedAxis.fromSettings = true;
        }

        // The user has explicitly set this value, so the ratchet must not override it.
        props.skipExtentRecalculation = true;

        if (typeof props.redrawChart === "function") {
            props.redrawChart();
        }

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const findAxisElement = (axisName) => {

        const containerElement = document.querySelector("." + props.guid);
        if (!containerElement) return null;

        return axisName === "leftAxis"
            ? containerElement.querySelector(".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)")
            : containerElement.querySelector(".ren-y-axis-2");
    };

    // A y-axis runs from zero at the bottom of its element to the maximum at the top, so the click
    // is measured up from the bottom of the rectangle (whose height includes the scale transform).
    const getClickHeightFraction = (event, axisName) => {

        const yAxis = findAxisElement(axisName);
        if (!yAxis) return null;

        const axisRect = yAxis.getBoundingClientRect();

        return (axisRect.bottom - event.clientY) / axisRect.height;
    };

    const scaleToValue = (value, axisName) => {

        if (typeof props.scaleToValue === "function") {
            props.scaleToValue(value, axisName);
        }
    };

    const findNearestTick = (ticks, value) => {

        let nearestTick = ticks[0];
        let nearestDistance = Math.abs(ticks[0] - value);

        for (let i = 1; i < ticks.length; i++) {

            const distance = Math.abs(ticks[i] - value);

            if (distance < nearestDistance) {

                nearestDistance = distance;
                nearestTick = ticks[i];
            }
        }

        return nearestTick;
    };

    const scaleUpToClickPosition = (event, axisName) => {

        const heightFraction = getClickHeightFraction(event, axisName);
        if (heightFraction === null) return;

        const axis = props.axes[axisName];
        if (!axis || !axis.yScale) return;

        const [minValue, maxValue] = axis.yScale.getDomain();
        const clickedValue = minValue + (maxValue - minValue) * heightFraction;

        // The new maximum snaps to a tick, so that the axis keeps its round labels.
        const nearestTick = findNearestTick(axis.yScale.getTicks(), clickedValue);

        if (nearestTick !== undefined && nearestTick !== null && nearestTick > 0) {

            scaleToValue(nearestTick, axisName);
        }
    };

    /**
     * Asks for the value the axis is to show up to, offering the one it shows up to now, and
     * scales it to that, rounded up to a tick as the axis' top always is.  Anything but a number
     * above nothing leaves the axis as it was.
     */
    const promptForMaximum = (axisName) => {

        const axis = props.axes[axisName];

        if (!axis) return;

        const current = axis.yScale ? axis.yScale.getDomain()[1] : axis.maxY;
        const value = Ren.DateValueChart_ValueLines.parseValue(
            window.prompt("Show the axis up to:", current ? String(current) : "")
        );

        if (value === null || value <= 0) return;

        scaleToValue(value, axisName);
        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const scaleDownToClickPosition = (event, axisName) => {

        const heightFraction = getClickHeightFraction(event, axisName);
        if (heightFraction === null || heightFraction <= 0) return;

        const axis = props.axes[axisName];
        if (!axis) return;

        // The new maximum puts the highest data value at the clicked height: a highest value of
        // 100 clicked at halfway gives a maximum of 100 / 0.5 = 200.
        const newMax = axis.yExtent[1] / heightFraction;

        if (newMax > 0) {

            scaleToValue(newMax, axisName);
        }
    };

    const getHighestPlottedValue = (axisName) => {

        let highestValue = 0;

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i].valueAxis !== axisName) continue;

            const seriesMax = Ren.ArrayUtils.max(
                props.plottedData ?? props.currentData,
                d => d[props.valueHeadings[i]]
            );

            if (seriesMax !== undefined && seriesMax !== null) {

                highestValue = Math.max(highestValue, seriesMax);
            }
        }

        return highestValue;
    };

    // An axis' format is its own, and leaves its series' formats as they are.  See
    // Ren.DateValueChart_ValueFormats.
    const setAxisFormatFunction = (axisName, valueFormatFunction) => {

        getSavedAxis(axisName).valueFormatFunction = valueFormatFunction
            ? Ren.ArrayUtils.ensureArray(valueFormatFunction)
            : null;

        if (typeof props.redrawChart === "function") {
            props.redrawChart();
        }

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const getAxisFormatFunction = (axisName) => visualisation?.[axisName]?.valueFormatFunction;

    const openCustomAxisFormatEditor = (axisName) => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            () => Ren.FormatFunctionUtils.getCustomCode(getAxisFormatFunction(axisName)),
            (customCode) => setAxisFormatFunction(axisName, customCode),
            null,
            null,
            { centred: true }
        );
    };

    const isOnAxis = (line, axisName) => (line.axis === "rightAxis") === (axisName === "rightAxis");

    const setValueLines = (lines) => {

        props.valueLines = lines;
        props.skipExtentRecalculation = false;

        if (visualisation) {

            visualisation.valueLines = lines;
            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
        }
        else if (typeof props.redrawChart === "function") {

            props.redrawChart();
        }
    };

    /**
     * Asks for a value to draw a line at, suggesting the tick nearest where the axis was
     * right-clicked, then for the line's label, which can be left empty.
     */
    const addValueLine = (axisName, event) => {

        const axis = props.axes[axisName];
        const heightFraction = event ? getClickHeightFraction(event, axisName) : null;
        let suggested = "";

        if (axis?.yScale && heightFraction !== null) {

            const [minValue, maxValue] = axis.yScale.getDomain();

            suggested = findNearestTick(
                axis.yScale.getTicks(),
                minValue + (maxValue - minValue) * heightFraction
            ) ?? "";
        }

        const value = Ren.DateValueChart_ValueLines.parseValue(
            window.prompt("Draw a line at value:", String(suggested))
        );

        if (value === null) return;

        const label = (window.prompt("Label the line (optional):", "") || "").trim();
        const line = { value };

        if (label) line.label = label;
        if (axisName === "rightAxis") line.axis = "rightAxis";

        setValueLines((props.valueLines || []).concat([line]));
    };

    const removeValueLines = (axisName) =>
        setValueLines((props.valueLines || []).filter(line => !isOnAxis(line, axisName)));

    const setValueBands = (bands) => {

        props.valueBands = bands;
        props.skipExtentRecalculation = false;

        if (visualisation) {

            visualisation.valueBands = bands;
            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
        }
        else if (typeof props.redrawChart === "function") {

            props.redrawChart();
        }
    };

    /**
     * Asks for the values a band is to be shaded between, then for its label, which can be left
     * empty.  Anything but a number at either end leaves the chart as it was.
     */
    const addValueBand = (axisName) => {

        const parseValue = Ren.DateValueChart_ValueLines.parseValue;
        const from = parseValue(window.prompt("Shade a band from value:", ""));

        if (from === null) return;

        const to = parseValue(window.prompt("Shade the band to value:", ""));

        if (to === null) return;

        const label = (window.prompt("Label the band (optional):", "") || "").trim();
        const band = { from: Math.min(from, to), to: Math.max(from, to) };

        if (label) band.label = label;
        if (axisName === "rightAxis") band.axis = "rightAxis";

        setValueBands((props.valueBands || []).concat([band]));
    };

    const removeValueBands = (axisName) =>
        setValueBands((props.valueBands || []).filter(band => !isOnAxis(band, axisName)));

    // The submenu is built as the menu opens, so the formats offered are those of the axis' ticks.
    const buildFormatMenuItem = (axisName, idSuffix) => ({
        section: "Y-Axis",
        text: "Format",
        id: "axis-format-" + idSuffix,
        get submenu() {

            const axis = props.axes[axisName];
            const valueFormat = axis?.tickFormats?.format ?? axis?.format;

            const items = Ren.ContextMenuItems_Formatting(
                (_columnIndex, _rowIndex, valueFormatFunction) =>
                    setAxisFormatFunction(axisName, valueFormatFunction),
                {
                    summaryStatsAvailable: false,
                    gridContext: false,
                    columnHasNulls: () => false,
                    getFormatFunction: () => getAxisFormatFunction(axisName)
                }
            ).getMenuItems(null, null, null, valueFormat);

            const submenu = items[0]?.submenu || [];

            return submenu.concat([
                Ren.MENU_SEPARATOR,
                {
                    text: "Custom...",
                    id: "axis-format-custom-" + idSuffix,
                    ticked: () => !!Ren.FormatFunctionUtils.getCustomCode(
                        getAxisFormatFunction(axisName)
                    ),
                    action: () => openCustomAxisFormatEditor(axisName)
                }
            ]);
        }
    });

    const setupYAxisContextMenu = () => {

        const containerElement = document.querySelector("." + props.guid);
        if (!containerElement) return;

        /**
         * Gets the names of the axes drawn to the same scale as an axis.  Without a right axis,
         * the right axis' series are drawn on the left axis' scale, and a scale set by dragging is
         * held on both, so the behaviour is set on both or the other's held scale would stay.
         */
        const getAxisNamesSharingScale = (axisName) => {

            const yScale = props.axes[axisName]?.yScale;
            if (!yScale) return [axisName];

            const axisNames = Ren.DateValueChart_YScales.getAxisNamesOnScale(props, yScale);

            return axisNames.indexOf(axisName) === -1 ? [axisName] : axisNames;
        };

        const setUpdateYScaleBehaviour = (axisName, behaviour) => {

            const locksScaleToCurrentData = behaviour === "Fixed";
            const axisNames = getAxisNamesSharingScale(axisName);

            for (let i = 0; i < axisNames.length; i++) {

                const axis = props.axes[axisNames[i]];

                if (visualisation) {

                    getSavedAxis(axisNames[i]).updateYScaleBehaviour = behaviour;
                }

                if (axis) {

                    axis.updateYScaleBehaviour = behaviour;
                    axis.fromSettings = false;

                    if (locksScaleToCurrentData && props.currentData && props.valueHeadings) {

                        // A maxY is set even where the highest value is zero, or nothing locks the
                        // scale and it carries on moving with each update.
                        axis.maxY = getHighestPlottedValue(axisNames[i]) || axis.yExtent[1] || 1;
                    }
                    else if (!locksScaleToCurrentData) {

                        delete axis.maxY;
                    }
                }
            }

            props.skipExtentRecalculation = false;

            if (typeof props.redrawChart === "function") {
                props.redrawChart();
            }

            if (visualisation) {

                for (let i = 0; i < axisNames.length; i++) {

                    const axis = props.axes[axisNames[i]];
                    const savedAxis = getSavedAxis(axisNames[i]);
                    savedAxis.fromSettings = false;

                    if (!locksScaleToCurrentData) {
                        delete savedAxis.maxY;
                    }
                    else if (axis?.maxY !== undefined) {

                        savedAxis.maxY = axis.maxY;
                    }
                }

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }
        };

        const getUpdateYScaleBehaviour = (axisName) => {

            const behaviour = props.axes[axisName]?.updateYScaleBehaviour
                || Ren.DateValueChart_Pies.getDefaultScaleBehaviour(props);

            // "Unaltered" is the old name of "Fixed", still held by saved settings.
            return behaviour === "Unaltered" ? "Fixed" : behaviour;
        };

        // Saved only where turned off, as an axis starts at zero by default.
        const toggleStartAtZero = (axisName) => {

            const startAtZero = !Ren.DateValueChart_ValueAxisFit.isStartAtZero(props, axisName);

            props.axes[axisName].startAtZero = startAtZero;

            if (visualisation) {

                if (startAtZero) {
                    delete getSavedAxis(axisName).startAtZero;
                }
                else {

                    getSavedAxis(axisName).startAtZero = false;
                }

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }

            // Set here too, as a redraw leaves a scale set by hand as it was.
            Ren.DateValueChart_ValueAxisFit.setAxisMins(props, props.plottedData || []);

            props.skipExtentRecalculation = false;
            props.redrawChart();
        };

        // Saved only where turned on, as an axis is linear by default.
        const toggleLogScale = (axisName) => {

            const logScale = !Ren.DateValueChart_ValueAxisFit.isLogScale(props, axisName);

            props.axes[axisName].logScale = logScale;

            if (visualisation) {

                if (logScale) {
                    getSavedAxis(axisName).logScale = true;
                }
                else {

                    delete getSavedAxis(axisName).logScale;
                }

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }

            Ren.DateValueChart_ValueAxisFit.setAxisMins(props, props.plottedData || []);

            props.skipExtentRecalculation = false;
            props.redrawChart();
        };

        const buildAxisMenuItems = (axisName, axisElement, idSuffix) => {

            const scaleBehaviourItem = (text, behaviour) => ({
                text,
                action: () => setUpdateYScaleBehaviour(axisName, behaviour),
                ticked: () => getUpdateYScaleBehaviour(axisName) === behaviour
            });

            const scaleToClickedPositionItem = (text, scaler) => ({
                section: "Y-Axis",
                text,
                action: () => {

                    const event = axisElement._lastContextMenuEvent;
                    if (event) scaler(event, axisName);
                }
            });

            return [
                {
                    section: "Y-Axis",
                    text: "Reset",
                    action: () => resetYAxisScale(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "-"
                },
                scaleToClickedPositionItem("Set as max", scaleUpToClickPosition),
                scaleToClickedPositionItem("Scale down to here", scaleDownToClickPosition),
                {
                    section: "Y-Axis",
                    text: "Set max...",
                    id: "set-max-" + idSuffix,
                    action: () => promptForMaximum(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "Scale multiply",
                    id: "scale-multiply-" + idSuffix,
                    submenu: scaleFactors.map(({ text, factor }) => ({
                        text,
                        id: "scale-multiply-" + idSuffix + "-" + factor + "x",
                        action: () => applyYAxisScale(factor, axisName)
                    }))
                },
                {
                    section: "Y-Axis",
                    text: "-"
                },
                {
                    section: "Y-Axis",
                    text: "Scale behaviour",
                    id: "scale-behaviour-" + idSuffix,
                    submenu: [
                        scaleBehaviourItem("Always Update", "AlwaysUpdate"),
                        scaleBehaviourItem("Always Update (1/3)", "AlwaysUpdateOneThird"),
                        scaleBehaviourItem("Always Update (Halfway)", "AlwaysUpdateHalfway"),
                        scaleBehaviourItem("Always Update (2/3)", "AlwaysUpdateTwoThirds"),
                        scaleBehaviourItem("Fixed", "Fixed"),
                        scaleBehaviourItem("Ratchet", "Ratchet")
                    ]
                },
                {
                    section: "Y-Axis",
                    text: "-"
                },
                {
                    section: "Y-Axis",
                    text: "Start at zero",
                    id: "start-at-zero-" + idSuffix,
                    title: "Starts the axis at zero, or else at about the lowest value it draws",
                    visible: () => Ren.DateValueChart_ValueAxisFit.canFit(props, axisName)
                        && !Ren.DateValueChart_ValueAxisFit.isLogScale(props, axisName),
                    ticked: () => Ren.DateValueChart_ValueAxisFit.isStartAtZero(props, axisName),
                    action: () => toggleStartAtZero(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "Logarithmic scale",
                    id: "log-scale-" + idSuffix,
                    title: "Gives each power of ten the same height, so that a steady rate of "
                        + "growth draws as a straight line",
                    visible: () => Ren.DateValueChart_ValueAxisFit.isLogScale(props, axisName)
                        || Ren.DateValueChart_ValueAxisFit.canUseLogScale(
                            props,
                            axisName,
                            props.plottedData || []
                        ),
                    ticked: () => Ren.DateValueChart_ValueAxisFit.isLogScale(props, axisName),
                    action: () => toggleLogScale(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "-"
                },
                buildFormatMenuItem(axisName, idSuffix),
                {
                    section: "Y-Axis",
                    text: "-"
                },
                {
                    section: "Y-Axis",
                    text: "Add value line...",
                    id: "value-line-add-" + idSuffix,
                    action: () => addValueLine(axisName, axisElement._lastContextMenuEvent)
                },
                {
                    section: "Y-Axis",
                    text: "Remove value lines",
                    id: "value-lines-remove-" + idSuffix,
                    visible: () => (props.valueLines || []).some(line => isOnAxis(line, axisName)),
                    action: () => removeValueLines(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "Add value band...",
                    id: "value-band-add-" + idSuffix,
                    action: () => addValueBand(axisName)
                },
                {
                    section: "Y-Axis",
                    text: "Remove value bands",
                    id: "value-bands-remove-" + idSuffix,
                    visible: () => (props.valueBands || []).some(band => isOnAxis(band, axisName)),
                    action: () => removeValueBands(axisName)
                }
            ];
        };

        /**
         * Gets the axis's menu items, which stand alone, apart from the chart's axis visibility.
         * That is offered by the chart's menu, which is set up after the chart is first drawn, so
         * it is looked for as the menu opens.
         */
        const getAxisMenuItems = (axisName, axisElement, idSuffix) => {

            const menuItems = buildAxisMenuItems(axisName, axisElement, idSuffix);

            if (props.axisVisibilityMenuItem) {

                menuItems.push(
                    { section: "Y-Axis", text: "-" },
                    Object.assign({}, props.axisVisibilityMenuItem, { section: "Y-Axis" })
                );
            }

            return menuItems;
        };

        const attachAxisContextMenu = (axisElement, axisName, idSuffix) => {

            // The scaling items work from where the axis was right-clicked, which only the event
            // knows, so it is kept on the element for the item's action to read.
            axisElement.addEventListener("contextmenu", (event) => {

                axisElement._lastContextMenuEvent = event;
            }, true);

            Ren.IsolateContextMenu(axisElement);

            Ren.AddContextMenuItems(
                axisElement,
                () => getAxisMenuItems(axisName, axisElement, idSuffix)
            );
        };

        const leftAxisElement = containerElement.querySelector(".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)");

        if (leftAxisElement) {

            attachAxisContextMenu(leftAxisElement, "leftAxis", "left");
        }

        if (Ren.DateValueChart_YScales.hasRightAxis(props)) {

            const rightAxisElement = containerElement.querySelector(".ren-y-axis-2");

            if (rightAxisElement) {

                attachAxisContextMenu(rightAxisElement, "rightAxis", "right");
            }
        }
    };

    return {
        setupYAxisContextMenu
    };
};
