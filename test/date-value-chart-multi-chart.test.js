describe("Ren.DateValueChart_MultiChart", () => {

    const MultiChart = Ren.DateValueChart_MultiChart;

    const createRows = () => [
        { Date: "2023-05-01", Sales: 5 },
        { Date: "2024-02-03", Sales: 10 },
        { Date: "2024-11-20", Sales: 30 },
        { Date: "2025-01-15", Sales: 40 },
        { Date: "2025-08-15", Sales: 50 }
    ];

    const getFroms = (ranges) => ranges.map(range => range.from);

    afterEach(() => {

        document.body.innerHTML = "";
    });

    test("getRanges_MoreYearsThanCharts_LatestOldestFirst", () => {

        const ranges = MultiChart.getRanges(createRows(), "Date", Ren.DatePeriodEnum.Year, 2, null);

        expect(ranges).toEqual([
            { from: "2024-01-01", to: "2024-12-31" },
            { from: "2025-01-01", to: "2025-12-31" }
        ]);
    });

    test("getRanges_FewerQuartersThanCharts_EveryQuarter", () => {

        const ranges = MultiChart.getRanges(
            createRows(),
            "Date",
            Ren.DatePeriodEnum.Quarter,
            12,
            null
        );

        expect(getFroms(ranges))
            .toEqual(["2023-04-01", "2024-01-01", "2024-10-01", "2025-01-01", "2025-07-01"]);
    });

    test("getRanges_ChartDateRange_OnlyPeriodsStartingWithinIt", () => {

        const ranges = MultiChart.getRanges(
            createRows(),
            "Date",
            Ren.DatePeriodEnum.Year,
            4,
            { from: "2023-01-01", toExclusive: "2025-01-01" }
        );

        expect(getFroms(ranges)).toEqual(["2023-01-01", "2024-01-01"]);
    });

    test("getMaxChartCount_NoneSet_DefaultsToFour", () => {

        expect(MultiChart.getMaxChartCount({})).toBe(4);
        expect(MultiChart.getMaxChartCount({ multiChartMaxCount: 6 })).toBe(6);
    });

    test("getColumnCount_ChartCounts_NearSquare", () => {

        expect(MultiChart.getColumnCount(1)).toBe(1);
        expect(MultiChart.getColumnCount(2)).toBe(2);
        expect(MultiChart.getColumnCount(4)).toBe(2);
        expect(MultiChart.getColumnCount(6)).toBe(3);
    });

    test("getColumnCount_PieCounts_UpToFourInARowThenEvenRows", () => {

        const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24];

        expect(counts.map(count => MultiChart.getColumnCount(count, true)))
            .toEqual([1, 2, 3, 4, 3, 3, 4, 4, 3, 4, 4]);
    });

    test("isMultiChart_PeriodSet_IsTrueButNotForItsCharts", () => {

        expect(MultiChart.isMultiChart({ multiChartPeriod: "quarter" })).toBe(true);
        expect(MultiChart.isMultiChart({ multiChartPeriod: null })).toBe(false);
        expect(MultiChart.isMultiChart({
            multiChartPeriod: "quarter",
            multiChartRange: { from: "2025-01-01", to: "2025-03-31" }
        })).toBe(false);
    });

    test("applyChartRange_ChartOfMultiChart_ReplacesStoredRange", () => {

        const range = { from: "2025-01-01", to: "2025-12-31" };
        const groupingEntry = { dateRange: { lastPeriodCount: 3, lastPeriodUnit: "month" } };

        MultiChart.applyChartRange({ multiChartRange: range }, groupingEntry);

        expect(groupingEntry.dateRange).toBe(range);
    });

    test("applyChartRange_NotMultiChart_KeepsStoredRange", () => {

        const dateRange = { lastPeriodCount: 3, lastPeriodUnit: "month" };
        const groupingEntry = { dateRange };

        MultiChart.applyChartRange({}, groupingEntry);

        expect(groupingEntry.dateRange).toBe(dateRange);
    });

    /**
     * Gets a multi-chart's props, drawn into a container on the page.
     */
    const createProps = (overrides) => {

        const container = document.createElement("div");
        container.className = "chart-guid";
        document.body.appendChild(container);

        return Object.assign({
            guid: "chart-guid",
            dateHeading: "Date",
            rawInputData: createRows(),
            multiChartPeriod: "year",
            multiChartMaxCount: 2,
            chartDateRange: null
        }, overrides);
    };

    const getItems = () => document.querySelectorAll(".ren-date-value-chart-multi-chart-item");

    test("render_TwoCharts_DrawsEachInItsOwnContainerOverItsRange", () => {

        const props = createProps();
        const drawn = [];

        MultiChart.render(props, (chartProps) => {

            drawn.push(chartProps);
            expect(document.querySelector("." + chartProps.guid)).not.toBeNull();
            return null;
        });

        expect(getItems()).toHaveLength(2);
        expect(drawn.map(chartProps => chartProps.multiChartRange.from))
            .toEqual(["2024-01-01", "2025-01-01"]);
        expect(drawn[0].guid).not.toBe(drawn[1].guid);
        expect(props.multiChartProps).toEqual(drawn);
        expect(document.querySelector(".ren-date-value-chart-multi-chart-grid").style.flexWrap)
            .toBe("wrap");
    });

    test("render_ChartHasDrawnBefore_ChartsStartFromNothingItDrew", () => {

        const props = createProps({
            visualisation: {},
            axes: { leftAxis: { maxY: 1800 } },
            xExtent: [new Date(2024, 3, 1), new Date(2024, 3, 1)]
        });

        MultiChart.render(props, () => null);

        const chartProps = props.multiChartProps[0];

        expect(chartProps.visualisation).toBe(props.visualisation);
        expect(chartProps.axes).toBeUndefined();
        expect(chartProps.xExtent).toBeUndefined();
    });

    test("render_ChartHidPartsWhenDrawnAsOne_NoneHiddenOnItsCharts", () => {

        const props = createProps();

        Ren.DateValueChart_Visibility.setShown(props, ".ren-crosshairs", false);

        const stylesheet = props.visibility.stylesheet;

        MultiChart.render(props, () => null);

        expect(stylesheet.textContent).toBe("");
        expect(props.visibility).toBeNull();
    });

    test("render_Pies_ChartsNoTallerThanTheyAreWide", () => {

        MultiChart.render(createProps({ showAsPies: true }), () => null);

        const grid = document.querySelector(".ren-date-value-chart-multi-chart-grid");

        expect(grid.classList.contains("ren-date-value-chart-multi-chart-grid--pies")).toBe(true);
        expect(getItems()[0].style.getPropertyValue("--ren-multi-chart-columns")).toBe("2");
    });

    test("render_Bars_ChartsFillTheirRows", () => {

        MultiChart.render(createProps(), () => null);

        const grid = document.querySelector(".ren-date-value-chart-multi-chart-grid");

        expect(grid.classList.contains("ren-date-value-chart-multi-chart-grid--pies")).toBe(false);
    });

    test("render_TwoCharts_ShareCrosshairsDrawnOverThemAll", () => {

        const props = createProps();

        MultiChart.render(props, () => null);

        const grid = document.querySelector(".ren-date-value-chart-multi-chart-grid");
        const crosshairs = props.multiChartProps[0].sharedCrosshairs;

        expect(crosshairs).toBe(props.multiChartProps[1].sharedCrosshairs);
        expect(grid.lastChild).toBe(crosshairs.element);
        expect(grid.style.position).toBe("relative");
    });

    test("render_SeriesLimited_ChartsDrawTheMultiChartsSeries", () => {

        const props = createProps({ valueHeadings: ["A", "C"], limitedOutHeadings: ["B"] });

        MultiChart.render(props, () => null);

        expect(props.multiChartProps[0].multiChartLimitedHeadings).toEqual(["A", "C"]);
    });

    test("render_SeriesNotLimited_ChartsDrawTheirOwnSeries", () => {

        const props = createProps({ valueHeadings: ["A", "C"], limitedOutHeadings: [] });

        MultiChart.render(props, () => null);

        expect(props.multiChartProps[0].multiChartLimitedHeadings).toBeNull();
    });

    test("render_ChartsDrawn_ThoseBeforeTheLastRedrawnWithEveryMaximum", () => {

        const props = createProps({ multiChartMaxCount: 3 });
        const redrawn = [];

        MultiChart.render(props, (chartProps) => {

            chartProps.redrawChart = () => redrawn.push(chartProps.multiChartIndex);
            return null;
        });

        expect(redrawn).toEqual([0, 1]);
    });

    test("render_AxisKeepsItsMaximum_RedrawnFromTheMaximumItWasFirstDrawnWith", () => {

        const props = createProps({ visualisation: { leftAxis: { maxY: 3000 } } });
        const maxYsRedrawnFrom = [];

        MultiChart.render(props, (chartProps) => {

            chartProps.axes = {
                leftAxis: { maxY: 1800, fromSettings: false },
                rightAxis: { maxY: 1800, fromSettings: true }
            };
            chartProps.redrawChart = () => maxYsRedrawnFrom.push(
                chartProps.axes.leftAxis.maxY,
                chartProps.axes.rightAxis.maxY
            );
            return null;
        });

        expect(maxYsRedrawnFrom).toEqual([3000, 1800]);
    });

    test("render_ChartAsksToRedraw_RedrawsMultiChartOnceAFrame", () => {

        const redrawVisualisation = jest.fn();
        const props = createProps({ redrawVisualisation });

        jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {

            callback();
            return 0;
        });

        MultiChart.render(props, (chartProps) => {

            chartProps.redrawChart = () => {};
            return null;
        });

        props.multiChartProps[1].redrawChart();

        expect(redrawVisualisation).toHaveBeenCalledTimes(1);

        window.requestAnimationFrame.mockRestore();
    });

    test("render_ShortLastRow_ChartsAsWideAsTheRest", () => {

        MultiChart.render(createProps({ multiChartMaxCount: 3 }), () => null);

        const items = getItems();

        expect(items).toHaveLength(3);
        expect(items[2].style.flex).toBe(items[0].style.flex);
        expect(items[2].style.flexGrow).toBe("0");
    });

    test("shareAxisMaxes_SeveralCharts_EachReachesTheHighest", () => {

        const sharedAxisMaxes = [];
        const first = { leftAxis: 1100, rightAxis: 0, hiddenAxis: 5 };
        const second = { leftAxis: 2100, rightAxis: 0, hiddenAxis: 2 };

        MultiChart.shareAxisMaxes(
            { multiChartIndex: 0, multiChartAxisMaxes: sharedAxisMaxes },
            first
        );
        MultiChart.shareAxisMaxes(
            { multiChartIndex: 1, multiChartAxisMaxes: sharedAxisMaxes },
            second
        );

        expect(first).toEqual({ leftAxis: 1100, rightAxis: 0, hiddenAxis: 5 });
        expect(second).toEqual({ leftAxis: 2100, rightAxis: 0, hiddenAxis: 5 });
        expect(sharedAxisMaxes[0]).toEqual({ leftAxis: 1100, rightAxis: 0, hiddenAxis: 5 });
    });

    test("shareAxisMaxes_NotMultiChart_LeavesMaximums", () => {

        const axisMaxes = { leftAxis: 10, rightAxis: 0, hiddenAxis: 0 };

        MultiChart.shareAxisMaxes({}, axisMaxes);

        expect(axisMaxes.leftAxis).toBe(10);
    });

    test("getXDomain_YearChartOfQuarters_RunsAcrossTheWholeYear", () => {

        const domain = MultiChart.getXDomain({
            binPeriod: Ren.DatePeriodEnum.Quarter,
            multiChartRange: { from: "2024-01-01", to: "2024-12-31" }
        });

        expect(domain).toEqual([
            Ren.DateValueChart_DateRange.toDate("2024-01-01"),
            Ren.DateValueChart_DateRange.toDate("2025-01-01")
        ]);
    });

    test("render_ShowDateRange_NamesEachChartsPeriod", () => {

        MultiChart.render(createProps(), () => null);

        const labels = document.querySelectorAll(".ren-date-value-chart-multi-chart-date-range");

        expect(Array.prototype.map.call(labels, label => label.textContent))
            .toEqual(["2024", "2025"]);
    });

    test("render_ShowDateRangeAsPies_LabelsCentred", () => {

        MultiChart.render(createProps(), (chartProps) => {

            chartProps.showAsPies = true;

            return null;
        });

        const label = document.querySelector(".ren-date-value-chart-multi-chart-date-range");

        expect(label.style.textAlign).toBe("center");
        expect(label.style.left).toBe("0px");
        expect(label.style.right).toBe("0px");
    });

    test("render_ShowDateRangeNotPies_LabelsNotCentred", () => {

        MultiChart.render(createProps(), () => null);

        const label = document.querySelector(".ren-date-value-chart-multi-chart-date-range");

        expect(label.style.textAlign).toBe("");
    });

    test("render_ShowDateRange_LabelsSolidBlack", () => {

        MultiChart.render(createProps(), () => null);

        const label = document.querySelector(".ren-date-value-chart-multi-chart-date-range");

        expect(label.style.color).toBe("black");
        expect(label.style.opacity).toBe("");
    });

    test("render_ShowDateRangeOff_NamesNoChart", () => {

        MultiChart.render(createProps({ multiChartShowDateRange: false }), () => null);

        expect(document.querySelector(".ren-date-value-chart-multi-chart-date-range")).toBeNull();
    });

    test("render_ChartCannotBeDrawn_ShowsItsMessage", () => {

        const props = createProps();

        MultiChart.render(props, (chartProps) =>
            chartProps.multiChartRange.from === "2024-01-01" ? "No data to show." : null);

        expect(getItems()[0].textContent).toBe("No data to show.");
        expect(props.multiChartProps).toHaveLength(1);
    });

    test("render_DrawnAgain_ReplacesCharts", () => {

        const props = createProps();

        MultiChart.render(props, () => null);
        MultiChart.render(props, () => null);

        expect(getItems()).toHaveLength(2);
    });

    test("render_ChartHasTitle_TitledOnceAboveItsCharts", () => {

        const props = createProps({ chartTitle: "Revenue" });

        MultiChart.render(props, () => null);
        MultiChart.render(props, () => null);

        const titles = document.querySelectorAll(".ren-chart-title");

        expect(titles).toHaveLength(1);
        expect(titles[0].textContent).toBe("Revenue");
        expect(titles[0].nextElementSibling.className)
            .toBe("ren-date-value-chart-multi-chart-grid");
    });

    /**
     * Gets the props of a chart split into series A, B and C, B hidden, whose saved settings are
     * in the order its last chart drew them in.  Each of its charts draws only C and A.
     */
    const createSplitProps = () => createProps({
        valueHeadings: ["A", "B", "C"],
        series: [{ isEnabled: true }, { isEnabled: false }, { isEnabled: true }],
        seriesCount: 3,
        redrawVisualisation: jest.fn(),
        visualisation: {
            series: [{ column: "C" }, { column: "A" }, { column: "B", isEnabled: false }]
        }
    });

    const drawSplitChart = (chartProps) => {

        chartProps.valueHeadings = ["C", "A"];
        chartProps.series = [{ isEnabled: true }, { isEnabled: true }];
        chartProps.seriesCount = 2;
        chartProps.showLegend = true;
        return null;
    };

    const clickLegendEntry = (seriesNum) => document
        .querySelector(`.ren-legend-item[data-series='${seriesNum}'] .ren-legend-text`)
        .dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));

    test("render_SeriesSplitAcrossCharts_OneLegendForEverySeriesBeneathThem", () => {

        MultiChart.render(createSplitProps(), drawSplitChart);

        const legends = document.querySelectorAll(".ren-date-value-chart-legend-html");
        const container = document.querySelector(".chart-guid");

        expect(legends).toHaveLength(1);
        expect(legends[0].querySelectorAll(".ren-legend-item")).toHaveLength(3);
        expect(container.lastChild.contains(legends[0])).toBe(true);
    });

    test("render_HiddenSeriesShownInLegend_ShownByItsColumnOnEveryChart", () => {

        jest.spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation((visualisation, redraw) => redraw());
        jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {

            callback();
            return 0;
        });

        const props = createSplitProps();

        MultiChart.render(props, drawSplitChart);
        clickLegendEntry(2);

        expect(props.visualisation.series.map(settings => settings.isEnabled))
            .toEqual([undefined, undefined, true]);
        expect(props.redrawVisualisation).toHaveBeenCalledTimes(1);

        jest.restoreAllMocks();
    });

    test("render_SeriesSelectedInLegend_SelectedOnEachChartByColumn", () => {

        const props = createSplitProps();

        MultiChart.render(props, drawSplitChart);
        clickLegendEntry(3);

        const chartProps = props.multiChartProps[1];

        expect(Ren.DateValueChart_Legend.getSelectedSeriesIndexes(chartProps)).toEqual([1]);
    });

    test("render_SeriesClickedOnAChart_SelectedInTheSharedLegend", () => {

        const props = createSplitProps();

        MultiChart.render(props, drawSplitChart);

        const chartProps = props.multiChartProps[0];
        const bar = document.createElementNS(Ren.Svg.NAMESPACE, "g");

        chartProps.svg = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        bar.setAttribute("data-series", "2");
        chartProps.svg.appendChild(bar);

        Ren.DateValueChart_Legend.attachChartClicks(chartProps);
        bar.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

        expect(Ren.DateValueChart_Legend.getSelectedSeriesIndexes(props.multiChartLegendProps))
            .toEqual([1]);
    });

    test("getChartSeriesNum_ChartsHoldDifferentSeries_MatchedByColumn", () => {

        const from = { valueHeadings: ["A", "B", "C"] };
        const to = { valueHeadings: ["C", "A"] };

        expect(MultiChart.getChartSeriesNum(from, to, 1)).toBe(2);
        expect(MultiChart.getChartSeriesNum(from, to, 2)).toBeNull();
        expect(MultiChart.getChartSeriesNum(from, to, 3)).toBe(1);
        expect(MultiChart.getChartSeriesNum(from, to, null)).toBeNull();
    });

    test("updateSelectionStyles_ChartDrawnAgain_FadedFromSharedLegendSelection", () => {

        const legendProps = { guid: "legend-guid", valueHeadings: ["A", "B"], series: [{}, {}] };

        Ren.DateValueChart_Legend.showSelection(legendProps, [2]);

        // A chart's props are made anew for each draw, so hold no selection of their own.
        const chart = {
            guid: "chart-guid",
            valueHeadings: ["B", "A"],
            series: [{}, {}],
            seriesCount: 2,
            sharedLegendProps: legendProps
        };

        Ren.DateValueChart_StyleUpdater.updateSelectionStyles(chart);

        const css = chart.selectionStylesheet.textContent;

        expect(css).toContain(".chart-guid .ren-chart-group > .ren-series-2,");
        expect(css).not.toContain(".chart-guid .ren-chart-group > .ren-series-1,");
    });

    test("scaleAxes_ValueDraggedOnAChart_EveryChartRedrawnToTheMaximum", () => {

        const createChart = () => ({
            axes: {
                leftAxis: { maxY: 100, yScale: { setDomain: jest.fn() } },
                rightAxis: { maxY: 50 }
            }
        });
        const charts = [createChart(), createChart()];
        const props = { multiChartProps: charts, redrawChart: jest.fn() };

        MultiChart.scaleAxes(props, ["leftAxis"], 250);

        for (let index = 0; index < charts.length; index++) {

            const axis = charts[index].axes.leftAxis;

            expect(axis.maxY).toBe(250);
            expect(axis.fromSettings).toBe(true);
            expect(axis.yScale.setDomain).toHaveBeenCalledWith([0, 250]);
            expect(charts[index].axes.rightAxis.maxY).toBe(50);
            expect(charts[index].skipExtentRecalculation).toBe(true);
        }

        expect(props.redrawChart).toHaveBeenCalledTimes(1);
    });

    test("clear_AfterRender_RemovesChartsAndLayout", () => {

        const props = createProps();

        MultiChart.render(props, () => null);
        MultiChart.clear(props);

        expect(getItems()).toHaveLength(0);
        expect(document.querySelector(".ren-date-value-chart-legend-html")).toBeNull();
        expect(props.multiChartProps).toBeNull();
        expect(document.querySelector(".chart-guid").style.flexDirection).toBe("column");
    });
});
