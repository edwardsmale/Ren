describe("Ren.DateValueChart_MultiChartWheel", () => {

    const Wheel = Ren.DateValueChart_MultiChartWheel;

    const createRows = () => [
        { Date: "2021-03-01", Sales: 1 },
        { Date: "2022-03-01", Sales: 2 },
        { Date: "2023-03-01", Sales: 3 },
        { Date: "2024-03-01", Sales: 4 },
        { Date: "2025-03-01", Sales: 5 }
    ];

    // "All", then 2021 to 2025.
    const getStops = () => Ren.DateValueChart_PeriodSlider.getStops(
        createRows(),
        "Date",
        Ren.DatePeriodEnum.Year,
        true
    );

    const createProps = (multiChartMaxCount, dateRange, chartDateRange) => {

        const dateEntry = {
            groupByColumnIndexes: [0],
            groupByCalcFunctions: [{ name: "date-year-start" }]
        };

        if (dateRange) dateEntry.dateRange = dateRange;

        return {
            guid: "chart-guid",
            dateHeading: "Date",
            rawInputData: createRows(),
            multiChartPeriod: "year",
            multiChartMaxCount,
            chartDateRange: chartDateRange || null,
            redrawVisualisation: jest.fn(),
            visualisation: {
                multiChartMaxCount,
                chartDataGroupingSettings: { groupings: { entries: [dateEntry] } }
            }
        };
    };

    const stubChanges = () => ({
        applyToChart: jest.spyOn(Ren.DateValueChart_DateRange, "applyToChart")
            .mockImplementation(() => {}),
        notifyRangeChanged: jest.spyOn(Ren.DateValueChart_DateRange, "notifyRangeChanged")
            .mockImplementation(() => {}),
        commitChange: jest.spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {})
    });

    const wheel = (grid, options) => {

        const event = new WheelEvent("wheel", Object.assign({ cancelable: true }, options));

        grid.dispatchEvent(event);

        return event;
    };

    const attachToGrid = (props) => {

        const grid = document.createElement("div");

        document.body.appendChild(grid);
        Wheel.attach(props, grid);

        return grid;
    };

    beforeEach(() => {

        jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {

            callback();
            return 0;
        });
    });

    afterEach(() => {

        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    test("getEndIndex_NoRange_LastStop", () => {

        expect(Wheel.getEndIndex(getStops(), null)).toBe(5);
    });

    test("getEndIndex_RangeEndingIn2023_StopFor2023", () => {

        const range = { from: "2022-01-01", toExclusive: "2024-01-01" };

        expect(Wheel.getEndIndex(getStops(), range)).toBe(3);
    });

    test("zoom_StepIn_OneChartFewerEndKept", () => {

        expect(Wheel.zoom(getStops(), 4, 2, -1)).toEqual({ count: 1, endIndex: 4 });
    });

    test("zoom_StepInAtOneChart_StaysAtOne", () => {

        expect(Wheel.zoom(getStops(), 4, 1, -1)).toEqual({ count: 1, endIndex: 4 });
    });

    test("zoom_StepOutPastFirstPeriod_TakesInLaterPeriods", () => {

        expect(Wheel.zoom(getStops(), 2, 2, 1)).toEqual({ count: 3, endIndex: 3 });
    });

    test("zoom_StepOutPastEveryPeriod_KeptToPeriodCount", () => {

        expect(Wheel.zoom(getStops(), 5, 4, 3)).toEqual({ count: 5, endIndex: 5 });
    });

    test("pan_StepBack_PeriodEarlier", () => {

        expect(Wheel.pan(getStops(), 5, 2, -1)).toEqual({ count: 2, endIndex: 4 });
    });

    test("pan_StepBackPastFirstPeriod_KeptToFirst", () => {

        expect(Wheel.pan(getStops(), 3, 2, -5)).toEqual({ count: 2, endIndex: 2 });
    });

    test("pan_StepForwardPastLastPeriod_KeptToLast", () => {

        expect(Wheel.pan(getStops(), 4, 2, 3)).toEqual({ count: 2, endIndex: 5 });
    });

    test("toStoredRange_LatestPeriods_Null", () => {

        expect(Wheel.toStoredRange(getStops(), 5, 2)).toBeNull();
    });

    test("toStoredRange_EarlierPeriods_TheirDates", () => {

        expect(Wheel.toStoredRange(getStops(), 3, 2))
            .toEqual({ from: "2022-01-01", to: "2023-12-31" });
    });

    test("attach_CtrlWheelUp_OneChartFewer", () => {

        const changes = stubChanges();
        const props = createProps(2);
        const grid = attachToGrid(props);
        const previousSignature =
            Ren.DateValueChart_DateRange.getRangeSignature(props.visualisation);

        const event = wheel(grid, { ctrlKey: true, deltaY: -100 });

        expect(event.defaultPrevented).toBe(true);
        expect(props.multiChartMaxCount).toBe(1);
        expect(props.visualisation.multiChartMaxCount).toBe(1);
        expect(changes.commitChange).toHaveBeenCalledTimes(1);
        expect(changes.applyToChart).not.toHaveBeenCalled();
        expect(changes.notifyRangeChanged)
            .toHaveBeenCalledWith(props.visualisation, null, previousSignature);
    });

    test("attach_CtrlWheelDownToDefault_CountNotSaved", () => {

        stubChanges();
        const props = createProps(3);
        const grid = attachToGrid(props);

        wheel(grid, { ctrlKey: true, deltaY: 100 });

        expect(props.multiChartMaxCount)
            .toBe(Ren.DateValueChart_MultiChart.DEFAULT_MAX_CHART_COUNT);
        expect(props.visualisation.multiChartMaxCount).toBeUndefined();
    });

    test("attach_CtrlWheelOverEarlierPeriods_RangeKeptEndingWhereItDid", () => {

        const changes = stubChanges();
        const props = createProps(
            2,
            { from: "2022-01-01", to: "2023-12-31" },
            { from: "2022-01-01", toExclusive: "2024-01-01" }
        );
        const grid = attachToGrid(props);

        wheel(grid, { ctrlKey: true, deltaY: 100 });

        expect(props.multiChartMaxCount).toBe(3);
        expect(changes.applyToChart).toHaveBeenCalledWith(
            props.visualisation,
            props,
            { from: "2021-01-01", to: "2023-12-31" }
        );
    });

    test("attach_ShiftWheelUp_PeriodEarlier", () => {

        const changes = stubChanges();
        const props = createProps(2);
        const grid = attachToGrid(props);

        wheel(grid, { shiftKey: true, deltaY: -100 });

        expect(changes.applyToChart).toHaveBeenCalledWith(
            props.visualisation,
            props,
            { from: "2023-01-01", to: "2024-12-31" }
        );
        expect(changes.notifyRangeChanged).toHaveBeenCalledTimes(1);
    });

    test("attach_ShiftWheelDownAtLatest_NothingChanged", () => {

        const changes = stubChanges();
        const props = createProps(2);
        const grid = attachToGrid(props);

        wheel(grid, { shiftKey: true, deltaY: 100 });

        expect(changes.applyToChart).not.toHaveBeenCalled();
        expect(changes.commitChange).not.toHaveBeenCalled();
    });

    test("attach_PlainWheel_LeftToScrollThePage", () => {

        const changes = stubChanges();
        const props = createProps(2);
        const grid = attachToGrid(props);

        const event = wheel(grid, { deltaY: 100 });

        expect(event.defaultPrevented).toBe(false);
        expect(changes.commitChange).not.toHaveBeenCalled();
    });

    test("attach_SmallTrackpadSteps_GatheredIntoOneNotch", () => {

        const changes = stubChanges();
        const props = createProps(4);
        const grid = attachToGrid(props);

        wheel(grid, { ctrlKey: true, deltaY: -20 });
        wheel(grid, { ctrlKey: true, deltaY: -20 });

        expect(changes.commitChange).not.toHaveBeenCalled();

        wheel(grid, { ctrlKey: true, deltaY: -20 });

        expect(props.multiChartMaxCount).toBe(3);
        expect(changes.commitChange).toHaveBeenCalledTimes(1);
    });
});
