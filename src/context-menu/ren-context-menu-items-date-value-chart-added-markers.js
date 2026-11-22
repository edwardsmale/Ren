/**
 * The date/value chart's "Add marker at <period>...", offered on a date axis tick or a data
 * series item, which adds a marker line at the start of the period right-clicked, labelled as the
 * reader asks, and "Remove this marker", offered on a marker at a date of its own.
 */
Ren.ContextMenuItems_DateValueChart_AddedMarkers = (chart, getClickedPeriod) => {

    const { visualisation, props } = chart;

    const setMarkerLines = (markerLines) => {

        visualisation.markerLines = markerLines;
        props.markerLines = markerLines;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    /**
     * Gets the period right-clicked, where a marker can be added at its start.  A period shorter
     * than a day is plotted in wall-clock time, so is left out, as is all time, which has no
     * dates for a marker to stand at.
     */
    const getMarkablePeriod = () => {

        if (props.isAllTime || props.datePeriod < Ren.DatePeriodEnum.Day) return null;

        return getClickedPeriod();
    };

    const addMarker = () => {

        const period = getMarkablePeriod();

        if (!period) return;

        // Apply can be pressed more than once, so the marker is added the first time and
        // relabelled after.
        let addedIndex = null;

        const applyLabel = (label) => {

            if (addedIndex === null) {

                const markerLines = Ren.DateValueChart_MarkerLines.addDateSpec(
                    visualisation.markerLines,
                    period.start,
                    label
                );

                addedIndex = markerLines.length - 1;
                setMarkerLines(markerLines);
                return;
            }

            const markerLines = Ren.DateValueChart_MarkerLines.removeSpec(
                visualisation.markerLines,
                addedIndex
            );

            const spec = { date: period.start };
            const text = (label || "").trim();

            if (text) spec.label = text;

            markerLines.splice(addedIndex, 0, spec);
            setMarkerLines(markerLines);
        };

        Ren.CreateTextEditorPopupWindow(
            "Marker Label",
            "",
            applyLabel,
            { width: 320, height: 110 }
        );
    };

    // Unsectioned, so that it follows what was clicked.
    const addMarkerMenuItem = {
        text: () => {

            const period = getMarkablePeriod();

            return period ? `Add marker at ${period.label}...` : "Add marker...";
        },
        id: "chart-add-marker",
        visible: () => getMarkablePeriod() !== null,
        action: addMarker
    };

    /**
     * Gets the index among the chart's marker lines of the marker right-clicked, or null where
     * the right-click was not on one added at a date of its own.
     */
    const getClickedSpecIndex = () => {

        const target = Ren.LastRightClickTarget;
        const element = target && target.closest
            ? target.closest("[data-marker-spec-index]")
            : null;

        if (!element || !props.svg || !props.svg.contains(element)) return null;

        const index = Number(element.getAttribute("data-marker-spec-index"));

        return Number.isInteger(index) ? index : null;
    };

    const removeMarkerMenuItem = {
        text: "Remove this marker",
        id: "chart-remove-marker",
        visible: () => getClickedSpecIndex() !== null,
        action: () => {

            const index = getClickedSpecIndex();

            if (index === null) return;

            setMarkerLines(Ren.DateValueChart_MarkerLines.removeSpec(
                visualisation.markerLines,
                index
            ));
        }
    };

    return {
        addMarkerMenuItem,
        removeMarkerMenuItem
    };
};
