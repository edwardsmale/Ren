describe("Ren.DateValueChart_DateRange_Following", () => {

    const DateRange = Ren.DateValueChart_DateRange;
    const Following = Ren.DateValueChart_DateRange_Following;

    const RANGE = { from: "2024-01-01", to: "2025-12-31" };

    let reportCount = 0;
    let containingReportGuid = null;
    let visualisations = [];

    const createVisualisation = (calcFunctionName, multiChartPeriod, multiChartMaxCount) => {

        const visualisation = {
            visualisationGuid: "chart-" + visualisations.length,
            containingReportGuid,
            filterGroup: "SalesMix",
            chartDataGroupingSettings: {
                groupings: {
                    entries: [
                        {
                            groupByColumnIndexes: [0],
                            groupByCalcFunctions: [{ name: calcFunctionName }]
                        },
                        { groupByColumnIndexes: [] }
                    ]
                }
            }
        };

        if (multiChartPeriod) visualisation.multiChartPeriod = multiChartPeriod;

        if (multiChartMaxCount) visualisation.multiChartMaxCount = multiChartMaxCount;

        visualisations.push(visualisation);

        return visualisation;
    };

    const createYearlyPies = (multiChartMaxCount) =>
        createVisualisation("date-year-start", "year", multiChartMaxCount);

    const follow = (visualisation) => Following.followDateRangeGroup(visualisation, {});

    beforeEach(() => {

        reportCount++;
        containingReportGuid = "report-" + reportCount;
    });

    afterEach(() => {

        // A destroyed visualisation's binding unsubscribes on the next message.
        for (let index = 0; index < visualisations.length; index++) {

            visualisations[index].isDestroyed = true;
        }

        visualisations = [];
        jest.restoreAllMocks();
    });

    test("getRangeSignature_SameGroupByAndMultiChart_Same", () => {

        expect(DateRange.getRangeSignature(createYearlyPies(2)))
            .toBe(DateRange.getRangeSignature(createYearlyPies(2)));
    });

    test("getRangeSignature_DifferentGroupBy_Different", () => {

        const yearly = createVisualisation("date-year-start");
        const monthly = createVisualisation("date-month-start");

        expect(DateRange.getRangeSignature(yearly)).not.toBe(DateRange.getRangeSignature(monthly));
    });

    test("getRangeSignature_DifferentMultiChartPeriod_Different", () => {

        const years = createVisualisation("date-month-start", "year");
        const quarters = createVisualisation("date-month-start", "quarter");

        expect(DateRange.getRangeSignature(years)).not.toBe(DateRange.getRangeSignature(quarters));
    });

    test("getRangeSignature_DifferentMultiChartCount_Different", () => {

        expect(DateRange.getRangeSignature(createYearlyPies(2)))
            .not.toBe(DateRange.getRangeSignature(createYearlyPies(3)));
    });

    test("getRangeSignature_DefaultMultiChartCount_SameAsExplicitDefault", () => {

        const count = Ren.DateValueChart_MultiChart.DEFAULT_MAX_CHART_COUNT;

        expect(DateRange.getRangeSignature(createYearlyPies()))
            .toBe(DateRange.getRangeSignature(createYearlyPies(count)));
    });

    test("getRangeSignature_MultiChartAndSingle_Different", () => {

        const single = createVisualisation("date-year-start");

        expect(DateRange.getRangeSignature(createYearlyPies(2)))
            .not.toBe(DateRange.getRangeSignature(single));
    });

    test("followDateRangeGroup_SameSignature_AppliesRange", () => {

        const applyToChart = jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(2);
        const follower = createYearlyPies(2);

        follow(follower);
        DateRange.notifyRangeChanged(source, RANGE);

        expect(applyToChart).toHaveBeenCalledWith(follower, expect.anything(), RANGE);
    });

    test("followDateRangeGroup_DifferentGroupBy_PassesOver", () => {

        const applyToChart = jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(2);
        const follower = createVisualisation("date-quarter-start", "year", 2);

        follow(follower);
        DateRange.notifyRangeChanged(source, RANGE);

        expect(applyToChart).not.toHaveBeenCalled();
    });

    test("followDateRangeGroup_DifferentMultiChartCount_PassesOver", () => {

        const applyToChart = jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(2);
        const follower = createYearlyPies(3);

        follow(follower);
        DateRange.notifyRangeChanged(source, RANGE);

        expect(applyToChart).not.toHaveBeenCalled();
    });

    test("catchUpWithDateRangeGroup_SameSignature_TakesAnnouncedRange", () => {

        const source = createYearlyPies(2);
        const lateChart = createYearlyPies(2);

        DateRange.notifyRangeChanged(source, RANGE);
        DateRange.catchUpWithDateRangeGroup(lateChart);

        expect(DateRange.getRange(lateChart.chartDataGroupingSettings)).toEqual(RANGE);
    });

    test("catchUpWithDateRangeGroup_DifferentSignature_KeepsOwnRange", () => {

        const source = createYearlyPies(2);
        const lateChart = createVisualisation("date-month-start");

        DateRange.notifyRangeChanged(source, RANGE);
        DateRange.catchUpWithDateRangeGroup(lateChart);

        expect(DateRange.getRange(lateChart.chartDataGroupingSettings)).toBeNull();
    });

    const zoom = (visualisation, multiChartMaxCount, range) => {

        const previousSignature = DateRange.getRangeSignature(visualisation);

        visualisation.multiChartMaxCount = multiChartMaxCount;
        DateRange.notifyRangeChanged(visualisation, range, previousSignature);
    };

    test("followDateRangeGroup_SourceCountChanged_TakesCountAndRange", () => {

        const applyToChart = jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(2);
        const follower = createYearlyPies(2);
        const props = {};

        Following.followDateRangeGroup(follower, props);
        zoom(source, 3, RANGE);

        expect(follower.multiChartMaxCount).toBe(3);
        expect(props.multiChartMaxCount).toBe(3);
        expect(applyToChart).toHaveBeenCalledWith(follower, props, RANGE);
    });

    test("followDateRangeGroup_SourceCountChangedToDefault_CountLeftUnstated", () => {

        jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(3);
        const follower = createYearlyPies(3);

        follow(follower);
        zoom(source, undefined, null);

        expect(follower.multiChartMaxCount).toBeUndefined();
        expect(DateRange.getRangeSignature(follower)).toBe(DateRange.getRangeSignature(source));
    });

    test("followDateRangeGroup_SourceCountChangedFromOtherCount_PassesOver", () => {

        const applyToChart = jest.spyOn(DateRange, "applyToChart").mockImplementation(() => {});
        const source = createYearlyPies(2);
        const follower = createYearlyPies(3);

        follow(follower);
        zoom(source, 5, RANGE);

        expect(follower.multiChartMaxCount).toBe(3);
        expect(applyToChart).not.toHaveBeenCalled();
    });

    test("catchUpWithDateRangeGroup_SourceCountChanged_TakesCountAndRange", () => {

        const source = createYearlyPies(2);
        const lateChart = createYearlyPies(2);
        const props = {};

        zoom(source, 3, RANGE);
        DateRange.catchUpWithDateRangeGroup(lateChart, props);

        expect(lateChart.multiChartMaxCount).toBe(3);
        expect(props.multiChartMaxCount).toBe(3);
        expect(DateRange.getRange(lateChart.chartDataGroupingSettings)).toEqual(RANGE);
    });

    test("catchUpWithDateRangeGroup_SourceZoomedTwice_TakesLatestCount", () => {

        const source = createYearlyPies(2);
        const lateChart = createYearlyPies(2);

        zoom(source, 3, null);
        zoom(source, 5, RANGE);
        DateRange.catchUpWithDateRangeGroup(lateChart, {});

        expect(lateChart.multiChartMaxCount).toBe(5);
        expect(DateRange.getRange(lateChart.chartDataGroupingSettings)).toEqual(RANGE);
    });

    test("catchUpWithDateRangeGroup_OtherCountWhenSourceZoomed_KeepsOwnCountAndRange", () => {

        const source = createYearlyPies(2);
        const lateChart = createYearlyPies(4);

        zoom(source, 3, RANGE);
        DateRange.catchUpWithDateRangeGroup(lateChart, {});

        expect(lateChart.multiChartMaxCount).toBe(4);
        expect(DateRange.getRange(lateChart.chartDataGroupingSettings)).toBeNull();
    });
});
