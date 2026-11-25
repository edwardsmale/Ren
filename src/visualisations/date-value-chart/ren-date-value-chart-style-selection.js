/**
 * Styles the series selected or hovered in a date/value chart's legend: the rest are faded, and the
 * selected series' bars edged and lines drawn thicker.
 */
Ren.DateValueChart_StyleSelection = (() => {

    const {
        getSeriesColour,
        buildLineStyles,
        getSelectedSeriesNums,
        LINE_NAMES_LAYER_CLASS,
        PIE_LABELS_LAYER_CLASS,
        SUBDIVISION_LABELS_LAYER_CLASS,
        valueLabelClasses
    } = Ren.DateValueChart_StyleBuilders;

    // How much of its colour a selected series' bar edges keep.
    const SELECTED_BAR_EDGE_SHADE = 0.6;
    const SELECTED_BAR_EDGE_WIDTH_PX = 2;

    const SELECTED_LEGEND_ENTRY_OUTLINE = "1px solid #777777";

    // While any series is selected, the rest are faded and brightened back so the selection stands
    // out.
    const UNSELECTED_SERIES_OPACITY = 0.3;
    const UNSELECTED_SERIES_BRIGHTNESS = 0.5;

    // A pie's labels are faded less, so the rest of the slices' labels can still be read.
    const UNSELECTED_PIE_LABEL_OPACITY = 0.7;

    // While series are highlighted from the legend, the other shown series' entries are faded, if
    // less than a switched-off series' entry is, so the two can still be told apart.
    const UNHIGHLIGHTED_LEGEND_ITEM_OPACITY = 0.5;

    /**
     * Marks the series selected or hovered in a multi-chart's legend on each of its charts, which
     * number their series by the columns their own periods hold.
     */
    const shareLegendHighlights = (props) => {

        const charts = props.sharedLegendCharts;

        if (!charts) return;

        const MultiChart = Ren.DateValueChart_MultiChart;
        const selectedSeriesNums = getSelectedSeriesNums(props);

        for (let index = 0; index < charts.length; index++) {

            const chart = charts[index];
            const chartSeriesNums = [];

            for (let i = 0; i < selectedSeriesNums.length; i++) {

                const seriesNum = MultiChart.getChartSeriesNum(props, chart, selectedSeriesNums[i]);

                if (seriesNum) chartSeriesNums.push(seriesNum);
            }

            Ren.DateValueChart_Legend.showSelection(chart, chartSeriesNums);
            updateHoverStyles(
                chart,
                MultiChart.getChartSeriesNum(props, chart, props.hoveredSeriesNum)
            );
        }
    };

    /**
     * Marks the series selected in the legend, boxing their entries, and on the chart: their bars'
     * edges are darkened, their lines and nodes thickened, their dots ringed, and the other series
     * faded back.  The rules are keyed by series, so hold through redraws, and are kept apart so as
     * not to be rewritten with every resize.
     */
    const updateSelectionStyles = (props) => {

        if (!props.selectionStylesheet) {

            props.selectionStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "selection")
                .getStylesheet();
        }

        const selectedSeriesNums = getSelectedSeriesNums(props);

        const styles = [];

        for (let i = 0; i < selectedSeriesNums.length; i++) {

            const seriesIndex = selectedSeriesNums[i] - 1;

            if (!props.series[seriesIndex]) continue;

            const seriesClass = `.${props.guid} .ren-series-${seriesIndex + 1}`;
            const edgeColour = Ren.Colours.scaleBrightness(
                getSeriesColour(props, seriesIndex),
                SELECTED_BAR_EDGE_SHADE
            ) || "black";

            styles.push(
                `${seriesClass} .ren-data-series__bar { stroke: ${edgeColour}; `
                + `stroke-width: ${SELECTED_BAR_EDGE_WIDTH_PX}px; `
                + "vector-effect: non-scaling-stroke }"
            );

            // Qualified by the series' parent to outrank the unselected line's rules in the main
            // stylesheet.
            const lineStyles = buildLineStyles(
                `.${props.guid} .ren-chart-group > .ren-series-${seriesIndex + 1}`,
                props,
                seriesIndex,
                true
            );

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            styles.push(`${seriesClass} .ren-data-series__point-ring { display: inline }`);
            styles.push(
                `${seriesClass} .ren-legend-entry { outline: ${SELECTED_LEGEND_ENTRY_OUTLINE} }`
            );
        }

        // A selection of only hidden series has nothing to stand out, so the rest are left
        // unfaded.  Hidden series' legend entries are already faded further.
        let isAnySelectedSeriesShown = false;

        for (let i = 0; i < selectedSeriesNums.length; i++) {

            const series = props.series[selectedSeriesNums[i] - 1];

            if (series && series.isEnabled !== false) {

                isAnySelectedSeriesShown = true;
                break;
            }
        }

        if (isAnySelectedSeriesShown) {

            for (let i = 0; i < props.seriesCount; i++) {

                if (selectedSeriesNums.indexOf(i + 1) !== -1) continue;

                const seriesClass = `.ren-series-${i + 1}`;

                styles.push(
                    `.${props.guid} .ren-chart-group > ${seriesClass}, `
                    + `.${props.guid} .ren-value-labels-layer > ${seriesClass}, `
                    + `.${props.guid} .${LINE_NAMES_LAYER_CLASS} > ${seriesClass}, `
                    + `.${props.guid} .${SUBDIVISION_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${UNSELECTED_SERIES_OPACITY}; `
                    + `filter: brightness(${UNSELECTED_SERIES_BRIGHTNESS}) }`
                );

                styles.push(
                    `.${props.guid} .${PIE_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${UNSELECTED_PIE_LABEL_OPACITY}; }`
                );

                styles.push(
                    `.${props.guid} .ren-legend-item${seriesClass}:not([data-series-enabled='false']) `
                    + `{ opacity: ${UNHIGHLIGHTED_LEGEND_ITEM_OPACITY} }`
                );
            }
        }

        const css = styles.join("\n");

        if (props.selectionStylesheet.textContent !== css) {
            props.selectionStylesheet.textContent = css;
        }

        updateHighlightedValueLabels(props);
        shareLegendHighlights(props);
    };

    /**
     * Gets the 1-based numbers of the series that are highlighted: the one whose legend entry is
     * hovered, those selected, and the one left shown alone, as a double-click on its legend entry
     * does.
     */
    const getHighlightedSeriesNums = (props) => {

        const seriesNums = getSelectedSeriesNums(props).slice();
        const shownSeriesNums = [];

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i] && props.series[i].isEnabled !== false) {
                shownSeriesNums.push(i + 1);
            }
        }

        if (props.seriesCount > 1 && shownSeriesNums.length === 1) {
            seriesNums.push(shownSeriesNums[0]);
        }

        if (props.hoveredSeriesNum) seriesNums.push(props.hoveredSeriesNum);

        return seriesNums;
    };

    /**
     * Hides the value labels of the series faded back while others are highlighted, and shows the
     * highlighted series' labels where the chart is set to, whether or not the series' own labels
     * are on, letting them go again once the series isn't highlighted.  The rules are kept in their
     * own stylesheet, and are doubled in specificity so as to win over the series' own.
     */
    const updateHighlightedValueLabels = (props) => {

        if (!props.highlightLabelsStylesheet) {

            props.highlightLabelsStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "highlighted-value-labels")
                .getStylesheet();
        }

        const styles = [];
        const seriesNums = getHighlightedSeriesNums(props);

        // As with the fading, a highlight of only hidden series leaves the rest alone.  Hidden
        // labels measure as empty, so the decluttering below no longer gives way to them.
        let isAnyHighlightedSeriesShown = false;

        for (let i = 0; i < seriesNums.length; i++) {

            const series = props.series[seriesNums[i] - 1];

            if (series && series.isEnabled !== false) {

                isAnyHighlightedSeriesShown = true;
                break;
            }
        }

        if (isAnyHighlightedSeriesShown) {

            for (let i = 0; i < props.seriesCount; i++) {

                if (seriesNums.indexOf(i + 1) !== -1) continue;

                styles.push(
                    `.${props.guid}.${props.guid} .ren-value-labels-layer > .ren-series-${i + 1} `
                    + "{ display: none }"
                );
            }
        }

        if (props.showValueLabelsWhenHighlighted === true) {

            for (let i = 0; i < seriesNums.length; i++) {

                const series = props.series[seriesNums[i] - 1];

                if (!series || series.isEnabled === false) continue;

                for (let j = 0; j < valueLabelClasses.length; j++) {

                    styles.push(
                        `.${props.guid}.${props.guid} .ren-series-${seriesNums[i]} `
                        + `.${valueLabelClasses[j].className} { display: block }`
                    );
                }
            }
        }

        const css = styles.join("\n");

        if (props.highlightLabelsStylesheet.textContent === css) return;

        props.highlightLabelsStylesheet.textContent = css;

        // Showing or hiding a series' values changes which labels collide, and a label shown only
        // now could not be measured to be placed before.
        Ren.DateValueChart_BarValueLabelLayout.layout(props);
        Ren.DateValueChart_DeclutterValueLabels.declutter(props);
        Ren.DateValueChart_BarSeriesNames.layout(props);
        Ren.DateValueChart_LineNames.layout(props);
        Ren.DateValueChart_PieLabels.layout(props);
        Ren.DateValueChart_SeriesSubdivisions.layout(props);
        Ren.DateValueChart_LabelContrast.applyContrast(props);
    };

    /**
     * Previews the series whose legend entry the pointer is over by emphasising it as a selected
     * series is and fading back the plotted series that are neither it nor selected, or removes
     * the preview where there is none.  The rules are kept in their own stylesheet, and are doubled
     * in specificity so as to win over the main stylesheet's and a selection's.
     *
     * @param {object} props - The chart's props.
     * @param {number} [seriesNum] - The 1-based number of the hovered series.
     */
    const updateHoverStyles = (props, seriesNum) => {

        if (!props.hoverStylesheet) {

            props.hoverStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "hover")
                .getStylesheet();
        }

        const styles = [];
        const hoveredSeries = seriesNum ? props.series[seriesNum - 1] : null;

        // A hidden series isn't plotted, so has nothing to preview.
        props.hoveredSeriesNum = hoveredSeries && hoveredSeries.isEnabled !== false
            ? seriesNum
            : null;

        const hoveredNum = props.hoveredSeriesNum;

        if (hoveredNum) {

            const edgeColour = Ren.Colours.scaleBrightness(
                getSeriesColour(props, hoveredNum - 1),
                SELECTED_BAR_EDGE_SHADE
            ) || "black";

            // The series is emphasised as a selected one is.
            styles.push(
                `.${props.guid}.${props.guid} .ren-series-${hoveredNum} .ren-data-series__bar `
                + `{ stroke: ${edgeColour}; stroke-width: ${SELECTED_BAR_EDGE_WIDTH_PX}px; `
                + "vector-effect: non-scaling-stroke }"
            );

            const lineStyles = buildLineStyles(
                `.${props.guid}.${props.guid} .ren-chart-group > .ren-series-${hoveredNum}`,
                props,
                hoveredNum - 1,
                true
            );

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            styles.push(
                `.${props.guid}.${props.guid} .ren-series-${hoveredNum} `
                + ".ren-data-series__point-ring { display: inline }"
            );

            // The hovered series is added to any selection, so it is unfaded where the selection
            // has faded it, and the selected series stay unfaded beside it.  The legend's own
            // entries are left as they are, as fading them would flicker as the pointer crosses it.
            const selectedSeriesNums = getSelectedSeriesNums(props);

            for (let i = 0; i < props.seriesCount; i++) {

                const seriesClass = `.ren-series-${i + 1}`;
                const isShownFully =
                    i + 1 === hoveredNum || selectedSeriesNums.indexOf(i + 1) !== -1;

                styles.push(
                    `.${props.guid}.${props.guid} .ren-chart-group > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .ren-value-labels-layer > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .${LINE_NAMES_LAYER_CLASS} > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .${SUBDIVISION_LABELS_LAYER_CLASS} `
                    + `> ${seriesClass} `
                    + (isShownFully
                        ? "{ opacity: 1; filter: none }"
                        : `{ opacity: ${UNSELECTED_SERIES_OPACITY}; `
                            + `filter: brightness(${UNSELECTED_SERIES_BRIGHTNESS}) }`)
                );

                // Pie labels are only faded, as a selection fades them: darkening them would turn
                // their white halos grey.
                styles.push(
                    `.${props.guid}.${props.guid} .${PIE_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${isShownFully ? 1 : UNSELECTED_PIE_LABEL_OPACITY} }`
                );
            }
        }

        const css = styles.join("\n");

        if (props.hoverStylesheet.textContent !== css) {
            props.hoverStylesheet.textContent = css;
        }

        updateHighlightedValueLabels(props);
        shareLegendHighlights(props);
    };

    return {
        updateSelectionStyles,
        updateHighlightedValueLabels,
        updateHoverStyles
    };
})();
