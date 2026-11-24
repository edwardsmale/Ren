Ren.DateValueChart_Render_AxisLabel = (() => {

    const appendAxisLabel = (svg, cssClass, text, rotation = -90) => {

        const axisLabel = Ren.Svg.append(svg, "g", { "class": cssClass });

        axisLabel.style.textAnchor = "middle";

        const label = Ren.Svg.append(Ren.Svg.append(axisLabel, "g"), "text", {
            "class": "ren-axis-label",
            "transform": `rotate(${rotation})`
        });

        label.textContent = text ?? "";
        label.style.fontSize = "1rem";
    };

    /**
     * The heading a series' values come from, which is what an axis is named after.  Where the data
     * is split, a series is headed by the split value it covers, so the axis is named after the
     * value column behind it instead - the values on it are that column's, whichever split value's
     * series is nearest to hand.
     */
    const getSeriesSourceHeading = (props, seriesIndex) =>
        getColumnLabel(
            props,
            props.seriesSourceHeadings?.[seriesIndex] ?? props.valueHeadings[seriesIndex]
        );

    // What a value column is called on the chart (see props.valueColumnLabels).
    const getColumnLabel = (props, column) => props.valueColumnLabels?.[column] ?? column;

    const renderDateValueChartAxisLabel = (props) => {

        // Remove old axis labels before appending new ones (in case of redraw).
        const oldLabels = props.svg.querySelectorAll(
            ".ren-value-axis-label, .ren-value-axis-label-2"
        );

        for (let index = 0; index < oldLabels.length; index++) {
            oldLabels[index].remove();
        }

        // An axis' heading is shown or hidden on its own, apart from the axis itself: a chart
        // can be drawn with its values named but not scaled, or scaled but not named.
        const isPies = Ren.DateValueChart_Pies.isShown(props);
        const showLeftHeading = props.showLeftAxisHeading !== false && !isPies;
        const showRightHeading = props.showRightAxisHeading !== false && !isPies;

        if (props.isMultiColumn) {

            if (showLeftHeading) {

                const leftLabel = props.axes.leftAxis.label || getSeriesSourceHeading(props, 0);
                appendAxisLabel(props.svg, "ren-value-axis-label", leftLabel);
            }

            if (Ren.DateValueChart_YScales.hasRightAxis(props) && showRightHeading) {

                const rightLabel = props.axes.rightAxis.label || getSeriesSourceHeading(props, 1);
                appendAxisLabel(props.svg, "ren-value-axis-label-2", rightLabel, 90);
            }
        }
        else if (showLeftHeading) {

            const leftLabel = props.axes.leftAxis.label || getColumnLabel(props, props.valueHeading);
            appendAxisLabel(props.svg, "ren-value-axis-label", leftLabel);
        }
    };

    return {
        renderDateValueChartAxisLabel
    };
})();
