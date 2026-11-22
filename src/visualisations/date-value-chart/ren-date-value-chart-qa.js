/**
 * Provides QA functions for the date value chart.
 */
Ren.QA.DateValueChart = (() => {

    let dates = [];
    let values = [];

    const getDates = () => dates;
    const getValues = () => values;

    const set = (dateValuePairs) => {

        dates = Object.keys(dateValuePairs);
        values = Object.values(dateValuePairs);
    };

    const setQaDateValueChart = (props, inputData) => {

        const dateValuePairs = [];

        // The grouped rows the chart itself plots, rather than props.currentData, which is not yet
        // up to date when this runs during a redraw.
        const groupedData = props.preGroupedData || inputData;

        if (props.dateHeading) {

            for (let i = 0; i < groupedData.length; i++) {

                const date = groupedData[i][props.dateHeading];
                const value = groupedData[i][props.valueHeading];

                dateValuePairs[date] = value;
            }
        }

        set(dateValuePairs);
    };

    /**
     * Gets the workings of the last marker line render, to tell a mis-declared marker from one
     * whose date is not on the chart.
     */
    const getMarkerLines = () => Ren.DateValueChart_MarkerLines.getDiagnostics();

    /**
     * Gets the workings of the last pass over the marker labels, to tell a dropped label from one
     * that was never resolved.
     */
    const getMarkerLabelPlacements = () => Ren.DateValueChart_MarkerLabels.getDiagnostics();

    /**
     * Gets the workings of the last pass over the value labels: how many were placed, flipped to
     * the other side of their point, and dropped.
     */
    const getValueLabelPlacements = () => Ren.DateValueChart_DeclutterValueLabels.getDiagnostics();

    /**
     * Gets the workings of the last pass colouring the value labels, which works out what is behind
     * a label from the geometry rather than reading it off the chart.
     */
    const getValueLabelContrast = () => Ren.DateValueChart_LabelContrast.getDiagnostics();

    /**
     * Gets the workings of the last pass over the date axis labels, to tell an axis that was
     * thinned from one that never had the ticks.
     */
    const getDateAxisLabelPlacements = () =>
        Ren.DateValueChart_DeclutterDateAxisLabels.getDiagnostics();

    /**
     * Gets where the hover date line is standing, as it is only on the chart while hovered.
     */
    const getHoverDateLine = () => Ren.DateValueChart_HoverDateLine.getDiagnostics();

    /**
     * Gets the workings of the last pass over the line names: the layout used, and where each
     * name was placed, in the chart group's units.
     */
    const getLineNamePlacements = () => Ren.DateValueChart_LineNames.getDiagnostics();

    let plottedSeries = [];

    /**
     * Records the values each series was last plotted at, after any running totals or shares.
     */
    const setPlottedData = (props, rows) => {

        plottedSeries = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const heading = props.valueHeadings[i];

            plottedSeries.push(rows.map(row => row[heading]));
        }
    };

    /**
     * Gets the values the series at the given (0-based) index was last plotted at.
     */
    const getPlottedValues = (seriesIndex) => plottedSeries[seriesIndex] || [];

    return {
        getDates,
        getPlottedValues,
        setPlottedData,
        getValues,
        getMarkerLines,
        getMarkerLabelPlacements,
        getValueLabelPlacements,
        getValueLabelContrast,
        getDateAxisLabelPlacements,
        getHoverDateLine,
        getLineNamePlacements,
        setQaDateValueChart
    };
})();
