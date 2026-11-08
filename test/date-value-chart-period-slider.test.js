describe("Ren.DateValueChart_PeriodSlider", () => {

    const Slider = Ren.DateValueChart_PeriodSlider;

    const createRows = () => [
        { Date: "2024-02-03", Sales: 10 },
        { Date: "2024-02-20", Sales: 20 },
        { Date: "2024-11-20", Sales: 30 },
        { Date: "2025-01-15 09:30:00", Sales: 40 },
        { Date: null, Sales: 50 }
    ];

    const getLabels = (stops) => stops.map(stop => stop.label);

    afterEach(() => {

        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    test("getPeriod_StoredUnits_MapToPeriods", () => {

        expect(Slider.getPeriod("month")).toBe(Ren.DatePeriodEnum.Month);
        expect(Slider.getPeriod("quarter")).toBe(Ren.DatePeriodEnum.Quarter);
        expect(Slider.getPeriod("year")).toBe(Ren.DatePeriodEnum.Year);
        expect(Slider.getPeriod(null)).toBeNull();
    });

    test("getStops_Quarters_OnePerQuarterHeldAfterAll", () => {

        const stops = Slider.getStops(createRows(), "Date", Ren.DatePeriodEnum.Quarter);

        expect(getLabels(stops)).toEqual(["All", "Q1 2024", "Q4 2024", "Q1 2025"]);
        expect(stops[0].range).toBeNull();
        expect(stops[1].range).toEqual({ from: "2024-01-01", to: "2024-03-31" });
    });

    test("getStops_Years_OnePerYearOldestFirst", () => {

        const rows = createRows().reverse();

        const stops = Slider.getStops(rows, "Date", Ren.DatePeriodEnum.Year);

        expect(stops.map(stop => stop.range && stop.range.from))
            .toEqual([null, "2024-01-01", "2025-01-01"]);
    });

    test("getStops_NoRows_OnlyAll", () => {

        expect(getLabels(Slider.getStops([], "Date", Ren.DatePeriodEnum.Month))).toEqual(["All"]);
    });

    test("getStops_Contiguous_TakesInPeriodsWithoutDates", () => {

        const stops = Slider.getStops(createRows(), "Date", Ren.DatePeriodEnum.Quarter, true);

        expect(getLabels(stops))
            .toEqual(["All", "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024", "Q1 2025"]);
    });

    test("canStepBy_PeriodAgainstBars_OnlyCoarserPeriods", () => {

        const props = { binPeriod: Ren.DatePeriodEnum.Quarter };

        expect(Slider.canStepBy(props, "month")).toBe(false);
        expect(Slider.canStepBy(props, "quarter")).toBe(false);
        expect(Slider.canStepBy(props, "year")).toBe(true);
        expect(Slider.canStepBy(props, null)).toBe(false);
    });

    test("findStopIndex_StoredRange_FindsItsStop", () => {

        const stops = Slider.getStops(createRows(), "Date", Ren.DatePeriodEnum.Year);

        expect(Slider.findStopIndex(stops, { from: "2025-01-01", to: "2025-12-31" })).toBe(2);
        expect(Slider.findStopIndex(stops, null)).toBe(0);
        expect(Slider.findStopIndex(stops, { lastPeriodCount: 3, lastPeriodUnit: "month" }))
            .toBe(-1);
    });

    /**
     * Gets a chart's props drawn into a container on the page, its range stored on a date entry.
     */
    const createProps = (periodSlider, dateRange) => {

        const container = document.createElement("div");
        container.className = "chart-guid";
        document.body.appendChild(container);

        const svg = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        container.appendChild(svg);

        const dateEntry = {
            groupByColumnIndexes: [0],
            groupByCalcFunctions: [{ name: "date-month-start" }]
        };

        if (dateRange) dateEntry.dateRange = dateRange;

        return {
            guid: "chart-guid",
            svg,
            margin: { top: 20, right: 30, bottom: 40, left: 50 },
            binPeriod: Ren.DatePeriodEnum.Month,
            periodSlider,
            dateHeading: "Date",
            rawInputData: createRows(),
            visualisation: {
                chartDataGroupingSettings: { groupings: { entries: [dateEntry] } }
            }
        };
    };

    const getSlider = () => document.querySelector(".ren-date-value-chart-period-slider");

    const getTrack = () => getSlider().querySelector(".ren-date-value-chart-period-slider__track");

    const getWindow = () =>
        getSlider().querySelector(".ren-date-value-chart-period-slider__window");

    /**
     * Gets the chart's range calls stubbed out, as they would redraw it.
     */
    const stubRangeChanges = () => ({
        applyToChart: jest.spyOn(Ren.DateValueChart_DateRange, "applyToChart")
            .mockImplementation(() => {}),
        notifyRangeChanged: jest.spyOn(Ren.DateValueChart_DateRange, "notifyRangeChanged")
            .mockImplementation(() => {})
    });

    /**
     * Gives the track a width, and pointer capture, which the test page does not lay out or have.
     */
    const layOutTrack = (track) => {

        track.getBoundingClientRect = () => ({ left: 100, width: 731, top: 0, height: 16 });
        track.setPointerCapture = () => {};
        track.releasePointerCapture = () => {};
        track.hasPointerCapture = () => true;
    };

    test("render_NoPeriodSlider_DrawsNone", () => {

        Slider.render(createProps(null));

        expect(getSlider()).toBeNull();
    });

    test("render_PeriodNotCoarserThanBars_DrawsNone", () => {

        Slider.render(createProps("month"));

        expect(getSlider()).toBeNull();
    });

    test("render_RangeIsAStop_WindowOverThatPeriod", () => {

        Slider.render(createProps("year", { from: "2024-01-01", to: "2024-12-31" }));

        const slider = getSlider();

        expect(slider.previousSibling.nodeName.toLowerCase()).toBe("svg");
        expect(getTrack().getAttribute("aria-valuenow")).toBe("1");
        expect(getTrack().getAttribute("aria-valuemax")).toBe("2");
        expect(getTrack().getAttribute("aria-valuetext")).toBe("2024");
        expect(getWindow().style.left).toBe("0%");
        expect(parseFloat(getWindow().style.width)).toBeCloseTo(366 / 731 * 100, 5);
        expect(getWindow().style.borderStyle).toBe("solid");
    });

    test("render_NoRange_WindowOverWholeTimelineAndAllPressed", () => {

        Slider.render(createProps("year"));

        const allButton = getSlider().querySelector(".ren-date-value-chart-period-slider__all");

        expect(getWindow().style.left).toBe("0%");
        expect(getWindow().style.width).toBe("100%");
        expect(allButton.getAttribute("aria-pressed")).toBe("true");
    });

    test("render_RangeIsNoStop_DashedWindowWhereRangeFalls", () => {

        Slider.render(createProps("year", { from: "2025-01-01", to: "2025-01-31" }));

        expect(parseFloat(getWindow().style.left)).toBeCloseTo(366 / 731 * 100, 5);
        expect(parseFloat(getWindow().style.width)).toBeCloseTo(31 / 731 * 100, 5);
        expect(getWindow().style.borderStyle).toBe("dashed");
    });

    test("render_Quarters_TimelineHasEveryQuarterAndYearRow", () => {

        const props = createProps("quarter");

        props.binPeriod = Ren.DatePeriodEnum.Month;

        Slider.render(props);

        const periods = getSlider().querySelectorAll(".ren-date-value-chart-period-slider__period");
        const years = getSlider().querySelectorAll(".ren-date-value-chart-period-slider__year");

        expect(periods).toHaveLength(5);
        expect(Array.from(years).map(year => year.textContent)).toEqual(["2024", "2025"]);
    });

    test("render_Margins_TimelineLinedUpWithPlot", () => {

        Slider.render(createProps("year"));

        expect(getSlider().style.gridTemplateColumns)
            .toBe("minmax(50px, max-content) 1fr 30px");
    });

    test("render_RenderedAgain_KeepsSliderAtNewRange", () => {

        const props = createProps("year");

        Slider.render(props);

        const slider = getSlider();

        props.visualisation.chartDataGroupingSettings.groupings.entries[0].dateRange =
            { from: "2025-01-01", to: "2025-12-31" };

        Slider.render(props);

        expect(document.querySelectorAll(".ren-date-value-chart-period-slider")).toHaveLength(1);
        expect(getSlider()).toBe(slider);
        expect(getTrack().getAttribute("aria-valuenow")).toBe("2");
        expect(getTrack().getAttribute("aria-valuetext")).toBe("2025");
    });

    test("render_SvgReplaced_ReplacesSlider", () => {

        const props = createProps("year");

        Slider.render(props);

        const slider = getSlider();

        props.svg = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        slider.parentNode.appendChild(props.svg);

        Slider.render(props);

        expect(document.querySelectorAll(".ren-date-value-chart-period-slider")).toHaveLength(1);
        expect(getSlider()).not.toBe(slider);
        expect(getSlider().previousSibling).toBe(props.svg);
    });

    test("render_SliderTurnedOff_RemovesSlider", () => {

        const props = createProps("year");

        Slider.render(props);

        props.periodSlider = null;

        Slider.render(props);

        expect(getSlider()).toBeNull();
    });

    test("render_TrackDragged_AppliesEachPeriodReached", () => {

        const { applyToChart, notifyRangeChanged } = stubRangeChanges();
        const props = createProps("year");

        Slider.render(props);

        const track = getTrack();

        layOutTrack(track);

        track.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 150 }));
        track.dispatchEvent(new MouseEvent("pointermove", { clientX: 200 }));
        track.dispatchEvent(new MouseEvent("pointermove", { clientX: 700 }));

        const firstYear = { from: "2024-01-01", to: "2024-12-31" };
        const secondYear = { from: "2025-01-01", to: "2025-12-31" };

        expect(applyToChart.mock.calls.map(call => call[2])).toEqual([firstYear, secondYear]);
        expect(notifyRangeChanged).toHaveBeenLastCalledWith(props.visualisation, secondYear);
    });

    test("render_ArrowKeys_StepFromAllThroughPeriods", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("year");

        Slider.render(props);

        getTrack().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-01-01", to: "2024-12-31" }
        );
    });

    test("render_AllClicked_ClearsRange", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("year", { from: "2024-01-01", to: "2024-12-31" });

        Slider.render(props);

        getSlider().querySelector(".ren-date-value-chart-period-slider__all").click();

        expect(applyToChart).toHaveBeenCalledWith(props.visualisation, props, null);
    });

    const getHandle = (edge) =>
        getSlider().querySelector(".ren-date-value-chart-period-slider__handle--" + edge);

    test("render_RangeOverSeveralPeriods_WindowOverThemWithHandles", () => {

        Slider.render(createProps("quarter", { from: "2024-04-01", to: "2024-12-31" }));

        // Q1 2024 is 91 of the 456 days the five quarters take, and Q2 to Q4 a further 275.
        expect(getTrack().getAttribute("aria-valuenow")).toBe("4");
        expect(getTrack().getAttribute("aria-valuetext")).toBe("Q2 2024 to Q4 2024");
        // A browser keeps six significant figures of a style's percentage.
        expect(parseFloat(getWindow().style.left)).toBeCloseTo(91 / 456 * 100, 3);
        expect(parseFloat(getWindow().style.width)).toBeCloseTo(275 / 456 * 100, 3);
        expect(getWindow().style.borderStyle).toBe("solid");
        expect(getHandle("start").style.display).toBe("");
        expect(getHandle("end").style.display).toBe("");
    });

    test("render_RangeIsNoStop_HandlesHidden", () => {

        Slider.render(createProps("year", { from: "2025-01-01", to: "2025-01-31" }));

        expect(getHandle("start").style.display).toBe("none");
        expect(getHandle("end").style.display).toBe("none");
    });

    test("render_EndHandleDragged_WidensRangeToNearestPeriodEnd", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("year", { from: "2024-01-01", to: "2024-12-31" });

        Slider.render(props);
        layOutTrack(getTrack());

        // 2024 ends 366px into the 731px track from 100px, and 2025 at its end.
        getHandle("end").dispatchEvent(
            new MouseEvent("pointerdown", { button: 0, clientX: 466, bubbles: true })
        );
        getTrack().dispatchEvent(new MouseEvent("pointermove", { clientX: 820 }));

        expect(applyToChart).toHaveBeenCalledTimes(1);
        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-01-01", to: "2025-12-31" }
        );
    });

    test("render_StartHandleDragged_NarrowsRangeToNearestPeriodStart", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("quarter", { from: "2024-04-01", to: "2024-12-31" });

        Slider.render(props);
        layOutTrack(getTrack());

        getWindow().getBoundingClientRect = () => ({ left: 246, width: 441, top: 0, height: 16 });

        // Q4 2024 starts 274 of the 456 days in, about 539px across.
        getHandle("start").dispatchEvent(
            new MouseEvent("pointerdown", { button: 0, clientX: 246, bubbles: true })
        );
        getTrack().dispatchEvent(new MouseEvent("pointermove", { clientX: 545 }));

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-10-01", to: "2024-12-31" }
        );
    });

    test("render_ShiftArrowKeys_MoveWindowEnd", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("year", { from: "2024-01-01", to: "2024-12-31" });

        Slider.render(props);

        const press = (key) => getTrack().dispatchEvent(
            new KeyboardEvent("keydown", { key, shiftKey: true })
        );

        press("ArrowRight");

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-01-01", to: "2025-12-31" }
        );

        press("ArrowLeft");

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-01-01", to: "2024-12-31" }
        );

        press("ArrowLeft");

        expect(applyToChart).toHaveBeenCalledTimes(2);
    });

    test("render_WideWindowArrowKeys_StepWholeWindowThenToAll", () => {

        const { applyToChart } = stubRangeChanges();
        const props = createProps("quarter", { from: "2024-07-01", to: "2025-03-31" });

        Slider.render(props);

        const press = (key) => getTrack().dispatchEvent(new KeyboardEvent("keydown", { key }));

        press("ArrowLeft");

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2024-04-01", to: "2024-12-31" }
        );

        press("ArrowLeft");
        press("ArrowLeft");

        expect(applyToChart).toHaveBeenLastCalledWith(props.visualisation, props, null);
    });

    /**
     * Gets the props of a multi-chart of two yearly charts over four years of data, drawn with
     * its grid of charts in a container on the page.
     */
    const createMultiChartProps = (dateRange) => {

        const props = createProps(null, dateRange);
        const grid = document.createElement("div");

        props.svg.replaceWith(grid);
        props.svg = null;
        props.multiChartPeriod = "year";
        props.multiChartMaxCount = 2;
        props.multiChartSlider = true;
        props.rawInputData = [
            { Date: "2020-05-01", Sales: 10 },
            { Date: "2021-05-01", Sales: 20 },
            { Date: "2022-05-01", Sales: 30 },
            { Date: "2023-05-01", Sales: 40 }
        ];

        return { props, grid };
    };

    test("renderMultiChart_NoRange_WindowOverLatestPeriodsWithoutAll", () => {

        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getSlider().previousSibling).toBe(grid);
        expect(getSlider().querySelector(".ren-date-value-chart-period-slider__all")).toBeNull();
        expect(getTrack().getAttribute("aria-valuetext")).toBe("2022 to 2023");
        expect(parseFloat(getWindow().style.left)).toBeCloseTo(50, 0);
        expect(parseFloat(getWindow().style.width)).toBeCloseTo(50, 0);
    });

    test("renderMultiChart_RangeOverEarlierPeriods_WindowOverThem", () => {

        const { props, grid } = createMultiChartProps({ from: "2021-01-01", to: "2022-12-31" });

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getTrack().getAttribute("aria-valuetext")).toBe("2021 to 2022");
        expect(parseFloat(getWindow().style.left)).toBeCloseTo(25, 0);
        expect(getWindow().style.borderStyle).toBe("solid");
    });

    test("renderMultiChart_ArrowKeys_StepWindowBackAndToTheLatestAgain", () => {

        const { applyToChart } = stubRangeChanges();
        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        getTrack().dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2020-01-01", to: "2021-12-31" }
        );

        getTrack().dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));

        expect(applyToChart).toHaveBeenLastCalledWith(props.visualisation, props, null);
    });

    test("renderMultiChart_TrackDragged_WindowCentredOnPointer", () => {

        const { applyToChart } = stubRangeChanges();
        const { props, grid } = createMultiChartProps({ from: "2021-01-01", to: "2022-12-31" });

        Slider.renderMultiChart(props, grid.parentNode, grid);
        layOutTrack(getTrack());

        // Each year is about a quarter of the 731px track from 100px, so 250px falls near the
        // end of 2020, centring the window on 2020 and 2021.
        getTrack().dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 250 }));

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2020-01-01", to: "2021-12-31" }
        );
    });

    test("renderMultiChart_OneChartNoRange_WindowOverLatestPeriodWithoutAll", () => {

        const { props, grid } = createMultiChartProps();

        props.multiChartMaxCount = 1;

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getSlider().querySelector(".ren-date-value-chart-period-slider__all")).toBeNull();
        expect(getTrack().getAttribute("aria-valuetext")).toBe("2023");
        expect(parseFloat(getWindow().style.left)).toBeCloseTo(75, 0);
        expect(getWindow().style.borderStyle).toBe("solid");
    });

    test("renderMultiChart_OneChartArrowKeys_StepBackAndToTheLatestAgain", () => {

        const { applyToChart } = stubRangeChanges();
        const { props, grid } = createMultiChartProps();

        props.multiChartMaxCount = 1;

        Slider.renderMultiChart(props, grid.parentNode, grid);

        getTrack().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));

        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2022-01-01", to: "2022-12-31" }
        );

        getTrack().dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));

        expect(applyToChart).toHaveBeenLastCalledWith(props.visualisation, props, null);
    });

    test("renderMultiChart_NoMorePeriodsThanCharts_DrawsNone", () => {

        const { props, grid } = createMultiChartProps();

        props.multiChartMaxCount = 4;

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getSlider()).toBeNull();
    });

    test("renderMultiChart_DrawnAgainBeneathSameGrid_KeepsSlider", () => {

        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        const slider = getSlider();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getSlider()).toBe(slider);
    });

    /**
     * Gets the redraw a multi-chart's count of charts changing alone commits stubbed out.
     */
    const stubCommitChange = () =>
        jest.spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});

    test("renderMultiChart_StartHandleDragged_DrawsMoreChartsOverLatestPeriods", () => {

        const { applyToChart, notifyRangeChanged } = stubRangeChanges();
        const commitChange = stubCommitChange();
        const { props, grid } = createMultiChartProps();
        const previousSignature =
            Ren.DateValueChart_DateRange.getRangeSignature(props.visualisation);

        Slider.renderMultiChart(props, grid.parentNode, grid);
        layOutTrack(getTrack());

        getWindow().getBoundingClientRect = () => ({ left: 466, width: 365, top: 0, height: 16 });

        // 2021 starts 366 of the 1461 days in, about 283px across.
        getHandle("start").dispatchEvent(
            new MouseEvent("pointerdown", { button: 0, clientX: 466, bubbles: true })
        );
        getTrack().dispatchEvent(new MouseEvent("pointermove", { clientX: 283 }));

        expect(props.multiChartMaxCount).toBe(3);
        expect(props.visualisation.multiChartMaxCount).toBe(3);
        expect(applyToChart).not.toHaveBeenCalled();
        expect(commitChange).toHaveBeenCalledWith(props.visualisation, props.redrawVisualisation);
        expect(notifyRangeChanged)
            .toHaveBeenCalledWith(props.visualisation, null, previousSignature);
    });

    test("renderMultiChart_StartHandleDraggedToFirstPeriod_KeepsOnePeriodOut", () => {

        stubRangeChanges();
        stubCommitChange();

        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);
        layOutTrack(getTrack());

        getWindow().getBoundingClientRect = () => ({ left: 466, width: 365, top: 0, height: 16 });

        getHandle("start").dispatchEvent(
            new MouseEvent("pointerdown", { button: 0, clientX: 466, bubbles: true })
        );
        getTrack().dispatchEvent(new MouseEvent("pointermove", { clientX: 100 }));

        expect(props.multiChartMaxCount).toBe(3);
    });

    test("renderMultiChart_ShiftArrowLeft_DrawsFewerChartsOverEarlierPeriods", () => {

        const { applyToChart } = stubRangeChanges();
        const { props, grid } = createMultiChartProps({ from: "2021-01-01", to: "2022-12-31" });

        Slider.renderMultiChart(props, grid.parentNode, grid);

        getTrack().dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true })
        );

        expect(props.multiChartMaxCount).toBe(1);
        expect(applyToChart).toHaveBeenLastCalledWith(
            props.visualisation,
            props,
            { from: "2021-01-01", to: "2021-12-31" }
        );
    });

    test("renderMultiChart_CountChanged_KeepsSliderWithWindowOverNewCount", () => {

        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        const slider = getSlider();

        props.multiChartMaxCount = 3;

        Slider.renderMultiChart(props, grid.parentNode, grid);

        expect(getSlider()).toBe(slider);
        expect(getTrack().getAttribute("aria-valuetext")).toBe("2021 to 2023");
    });

    test("render_MultiChartSliderLeftForOneChart_ReplacesIt", () => {

        const { props, grid } = createMultiChartProps();

        Slider.renderMultiChart(props, grid.parentNode, grid);

        const slider = getSlider();

        props.svg = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        grid.replaceWith(props.svg);
        props.periodSlider = "year";

        Slider.render(props);

        expect(getSlider()).not.toBe(slider);
        expect(getSlider().querySelector(".ren-date-value-chart-period-slider__all"))
            .not.toBeNull();
    });
});
