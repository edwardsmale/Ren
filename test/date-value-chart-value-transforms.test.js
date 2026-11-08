describe("Ren.DateValueChart_ValueTransforms", () => {

    const Transforms = Ren.DateValueChart_ValueTransforms;

    const createProps = (series, showAsShareOfTotal) => ({
        seriesCount: series.length,
        valueHeadings: series.map((s, index) => "V" + index),
        series,
        showAsShareOfTotal
    });

    const createRows = (valuesBySeries) => valuesBySeries[0].map((v, rowIndex) => {

        const row = { Date: new Date(2026, rowIndex, 1) };

        for (let i = 0; i < valuesBySeries.length; i++) {
            row["V" + i] = valuesBySeries[i][rowIndex];
        }

        return row;
    });

    test("transform_NothingSet_SameRowsReturned", () => {

        const rows = createRows([[1, 2, 3]]);

        expect(Transforms.transform(createProps([{}]), rows)).toBe(rows);
    });

    test("transform_RunningTotal_ValuesAccumulated", () => {

        const rows = createRows([[1, 2, 3]]);

        const result = Transforms.transform(createProps([{ runningTotal: true }]), rows);

        expect(result.map(row => row.V0)).toEqual([1, 3, 6]);
    });

    test("transform_RunningTotal_PreparedRowsLeftAlone", () => {

        const rows = createRows([[1, 2, 3]]);

        Transforms.transform(createProps([{ runningTotal: true }]), rows);

        expect(rows.map(row => row.V0)).toEqual([1, 2, 3]);
    });

    test("transform_RunningTotalOnOneSeries_OtherSeriesUnchanged", () => {

        const rows = createRows([[1, 2, 3], [5, 5, 5]]);

        const result = Transforms.transform(createProps([{ runningTotal: true }, {}]), rows);

        expect(result.map(row => row.V1)).toEqual([5, 5, 5]);
    });

    test("applyRunningTotal_GapAfterFirstValue_TotalCarried", () => {

        const rows = createRows([[2, null, 3]]);

        Transforms.applyRunningTotal(rows, "V0");

        expect(rows.map(row => row.V0)).toEqual([2, 2, 5]);
    });

    test("applyRunningTotal_GapBeforeFirstValue_LeftNull", () => {

        const rows = createRows([[undefined, 4, 1]]);

        Transforms.applyRunningTotal(rows, "V0");

        expect(rows.map(row => row.V0)).toEqual([null, 4, 5]);
    });

    test("transform_ShareOfTotal_EachRowSharesOutToOne", () => {

        const rows = createRows([[1, 3], [3, 1]]);

        const result = Transforms.transform(createProps([{}, {}], true), rows);

        expect(result.map(row => row.V0)).toEqual([0.25, 0.75]);
        expect(result.map(row => row.V1)).toEqual([0.75, 0.25]);
    });

    test("transform_ShareOfTotalWithHiddenSeries_SharedAmongShownSeries", () => {

        const rows = createRows([[1], [3], [4]]);

        const result = Transforms.transform(
            createProps([{}, { isEnabled: false }, {}], true),
            rows
        );

        expect(result[0].V0).toBe(0.2);
        expect(result[0].V2).toBe(0.8);
    });

    test("transform_ShareOfTotalRowTotallingZero_NoShares", () => {

        const rows = createRows([[0], [0]]);

        const result = Transforms.transform(createProps([{}, {}], true), rows);

        expect(result[0].V0).toBeNull();
        expect(result[0].V1).toBeNull();
    });

    test("transform_RunningTotalAndShare_SharesOfTotalsToDate", () => {

        const rows = createRows([[1, 1], [1, 3]]);

        const result = Transforms.transform(
            createProps([{ runningTotal: true }, { runningTotal: true }], true),
            rows
        );

        // Totals to date are 1 and 1, then 2 and 4.
        expect(result.map(row => row.V0)).toEqual([0.5, 2 / 6]);
    });

    test("applyTransformFormats_ShareOfTotal_SeriesAndAxesShowPercentages", () => {

        const props = createProps([{}], true);

        props.valueColumnFormats = [Ren.SpreadsheetColumnFormatEnum.Currency];
        props.valueColumnFormatFunctions = [() => "x"];
        props.axes = { leftAxis: {}, rightAxis: {} };

        Transforms.applyTransformFormats(props);

        expect(props.valueColumnFormats[0]).toBe(Ren.SpreadsheetColumnFormatEnum.Percentage);
        expect(props.valueColumnFormatFunctions[0]).toBeNull();
        expect(props.axes.leftAxis.tickFormats.format)
            .toBe(Ren.SpreadsheetColumnFormatEnum.Percentage);
    });

    test("applyTransformFormats_NotShareOfTotal_FormatsLeftAlone", () => {

        const props = createProps([{}], false);

        props.valueColumnFormats = [Ren.SpreadsheetColumnFormatEnum.Currency];
        props.valueColumnFormatFunctions = [null];
        props.axes = { leftAxis: {} };

        Transforms.applyTransformFormats(props);

        expect(props.valueColumnFormats[0]).toBe(Ren.SpreadsheetColumnFormatEnum.Currency);
        expect(props.axes.leftAxis.tickFormats).toBeUndefined();
    });

    const createIndexedProps = (series) => {

        const props = createProps(series, false);

        props.showAsIndex = true;

        return props;
    };

    test("transform_Index_FirstValueIs100", () => {

        const rows = createRows([[50, 75, 100]]);

        const result = Transforms.transform(createIndexedProps([{}]), rows);

        expect(result.map(row => row.V0)).toEqual([100, 150, 200]);
        expect(rows[0].V0).toBe(50);
    });

    test("transform_IndexStartingWithNothing_FirstValueOtherThanNothingIs100", () => {

        const rows = createRows([[null, 0, 20, 10]]);

        const result = Transforms.transform(createIndexedProps([{}]), rows);

        expect(result.map(row => row.V0)).toEqual([null, 0, 100, 50]);
    });

    test("transform_IndexOfAllZeros_Nothing", () => {

        const rows = createRows([[0, 0]]);

        const result = Transforms.transform(createIndexedProps([{}]), rows);

        expect(result.map(row => row.V0)).toEqual([null, null]);
    });

    test("transform_IndexAndRunningTotal_IndexOfTotalsToDate", () => {

        const rows = createRows([[2, 2, 4]]);

        const result = Transforms.transform(createIndexedProps([{ runningTotal: true }]), rows);

        expect(result.map(row => row.V0)).toEqual([100, 200, 400]);
    });

    test("transform_IndexAndShare_SharesShown", () => {

        const props = createIndexedProps([{}, {}]);

        props.showAsShareOfTotal = true;

        const result = Transforms.transform(props, createRows([[1, 3], [3, 1]]));

        expect(result.map(row => row.V0)).toEqual([0.25, 0.75]);
        expect(Transforms.isIndexed(props)).toBe(false);
    });

    test("applyTransformFormats_Index_SeriesAndAxesShowNumbers", () => {

        const props = createIndexedProps([{}]);

        props.valueColumnFormats = [Ren.SpreadsheetColumnFormatEnum.Currency];
        props.valueColumnFormatFunctions = [() => "x"];
        props.axes = { leftAxis: {} };

        Transforms.applyTransformFormats(props);

        expect(props.valueColumnFormats[0]).toBe(Ren.SpreadsheetColumnFormatEnum.Number);
        expect(props.valueColumnFormatFunctions[0]).toBeNull();
        expect(props.axes.leftAxis.tickFormats.format)
            .toBe(Ren.SpreadsheetColumnFormatEnum.Number);
    });

    test("isPlottedAsPrepared_RunningTotal_False", () => {

        expect(Transforms.isPlottedAsPrepared(createProps([{ runningTotal: true }]), 0))
            .toBe(false);
    });

    const createPerDayProps = (series, aggregationTypes) => Object.assign(createProps(series), {
        dateHeading: "Date",
        datePeriod: Ren.DatePeriodEnum.Month,
        showPerDay: true,
        valueColumnFormats: series.map(() => Ren.SpreadsheetColumnFormatEnum.Integer),
        visualisation: {
            chartDataGroupingSettings: {
                groupings: {
                    entries: [{
                        columns: {
                            V0: { aggregationType: aggregationTypes?.[0] },
                            V1: { aggregationType: aggregationTypes?.[1] }
                        }
                    }]
                }
            }
        }
    });

    test("applyPerDay_Months_DividedByDaysInEach", () => {

        // January, February and March 2026: 31, 28 and 31 days.
        const rows = createRows([[310, 280, 31]]);

        Transforms.applyPerDay(rows, "V0", "Date", Ren.DatePeriodEnum.Month, null);

        expect(rows.map(row => row.V0)).toEqual([10, 10, 1]);
    });

    test("applyPerDay_PeriodStillRunning_DividedByDaysSoFar", () => {

        const rows = createRows([[310, 50]]);

        const now = new Date(2026, 1, 5, 9);

        Transforms.applyPerDay(rows, "V0", "Date", Ren.DatePeriodEnum.Month, now);

        expect(rows.map(row => row.V0)).toEqual([10, 10]);
    });

    test("applyPerDay_Weeks_DividedBySeven", () => {

        const rows = [
            { Date: new Date(2026, 0, 5), V0: 70 },
            { Date: new Date(2026, 0, 12), V0: null }
        ];

        Transforms.applyPerDay(rows, "V0", "Date", Ren.DatePeriodEnum.Week, null);

        expect(rows.map(row => row.V0)).toEqual([10, null]);
    });

    test("transform_PerDayOnAverage_LeftAsItIs", () => {

        const props = createPerDayProps([{}, {}], [undefined, Ren.AggregationTypeEnum.Average]);
        const rows = createRows([[310, 280], [5, 6]]);

        const result = Transforms.transform(props, rows, true);

        expect(result.map(row => row.V0)).toEqual([10, 10]);
        expect(result.map(row => row.V1)).toEqual([5, 6]);
    });

    test("transform_PerDayAndRunningTotal_TotalOfDailyAverages", () => {

        const props = createPerDayProps([{ runningTotal: true }]);
        const rows = createRows([[310, 280]]);

        expect(Transforms.transform(props, rows, true).map(row => row.V0)).toEqual([10, 20]);
    });

    test("transform_PerDayByDay_NotTransformed", () => {

        const props = createPerDayProps([{}]);
        const rows = createRows([[310, 280]]);

        props.datePeriod = Ren.DatePeriodEnum.Day;

        expect(Transforms.transform(props, rows, true)).toBe(rows);
        expect(Transforms.canShowPerDay(props)).toBe(false);
    });

    test("transform_PerDayOverAllTime_NotTransformed", () => {

        const props = createPerDayProps([{}]);

        props.isAllTime = true;

        expect(Transforms.isPerDay(props, 0)).toBe(false);
    });

    test("applyTransformFormats_PerDayIntegers_PlainNumbers", () => {

        const props = createPerDayProps([{}, {}], [undefined, Ren.AggregationTypeEnum.Max]);

        props.axes = {};

        Transforms.applyTransformFormats(props);

        expect(props.valueColumnFormats).toEqual([
            Ren.SpreadsheetColumnFormatEnum.Number,
            Ren.SpreadsheetColumnFormatEnum.Integer
        ]);
    });

    test("isPlottedAsPrepared_PerDay_False", () => {

        expect(Transforms.isPlottedAsPrepared(createPerDayProps([{}]), 0)).toBe(false);
    });
    const createChangeProps = (series) => {

        const props = createProps(series);

        props.showAsChange = true;

        return props;
    };

    test("transform_Change_FractionOfPeriodBefore", () => {

        const rows = createRows([[100, 150, 120]]);

        const result = Transforms.transform(createChangeProps([{}]), rows);

        expect(result.map(row => row.V0)).toEqual([null, 0.5, -0.2]);
    });

    test("applyChange_GapOrZeroBefore_Nothing", () => {

        const rows = createRows([[100, null, 50, 0, 10]]);

        Transforms.applyChange(rows, "V0");

        expect(rows.map(row => row.V0)).toEqual([null, null, null, -1, null]);
    });

    test("applyChange_FromBelowNothing_RiseIsPositive", () => {

        const rows = createRows([[-100, -50]]);

        Transforms.applyChange(rows, "V0");

        expect(rows.map(row => row.V0)).toEqual([null, 0.5]);
    });

    test("transform_ChangeAndIndex_IndexShown", () => {

        const props = createChangeProps([{}]);

        props.showAsIndex = true;

        const result = Transforms.transform(props, createRows([[50, 100]]));

        expect(result.map(row => row.V0)).toEqual([100, 200]);
        expect(Transforms.isChange(props)).toBe(false);
    });

    test("applyTransformFormats_Change_SeriesAndAxesShowPercentages", () => {

        const props = createChangeProps([{}]);

        props.valueColumnFormats = [Ren.SpreadsheetColumnFormatEnum.Currency];
        props.valueColumnFormatFunctions = ["f"];
        props.axes = { left: {} };

        Transforms.applyTransformFormats(props);

        expect(props.valueColumnFormats).toEqual([Ren.SpreadsheetColumnFormatEnum.Percentage]);
        expect(props.valueColumnFormatFunctions).toEqual([null]);
        expect(props.axes.left.tickFormats.format)
            .toBe(Ren.SpreadsheetColumnFormatEnum.Percentage);
    });

    test("isPlottedAsPrepared_Change_False", () => {

        expect(Transforms.isPlottedAsPrepared(createChangeProps([{}]), 0)).toBe(false);
    });
    const createYearToDateRows = (values) => values.map((value, index) => ({
        Date: new Date(2025, 10 + index, 1),
        V0: value
    }));

    const createYearToDateProps = (series) => {

        const props = createProps(series);

        props.dateHeading = "Date";
        props.datePeriod = Ren.DatePeriodEnum.Month;

        return props;
    };

    test("transform_YearToDate_TotalStartsAgainEachYear", () => {

        const rows = createYearToDateRows([1, 2, 3, 4]);

        const result = Transforms.transform(createYearToDateProps([{ yearToDate: true }]), rows);

        expect(result.map(row => row.V0)).toEqual([1, 3, 3, 7]);
    });

    test("applyYearToDate_GapAtYearStart_NothingUntilFirstValue", () => {

        const rows = createYearToDateRows([1, 2, null, 4]);

        Transforms.applyYearToDate(rows, "V0", "Date");

        expect(rows.map(row => row.V0)).toEqual([1, 3, null, 4]);
    });

    test("transform_YearToDateAndRunningTotal_YearToDateShown", () => {

        const rows = createYearToDateRows([1, 2, 3]);
        const props = createYearToDateProps([{ yearToDate: true, runningTotal: true }]);

        expect(Transforms.transform(props, rows).map(row => row.V0)).toEqual([1, 3, 3]);
    });

    test("transform_YearToDateByYear_NotTransformed", () => {

        const rows = createYearToDateRows([1, 2, 3]);
        const props = createYearToDateProps([{ yearToDate: true }]);

        props.datePeriod = Ren.DatePeriodEnum.Year;

        expect(Transforms.transform(props, rows)).toBe(rows);
        expect(Transforms.canShowYearToDate(props)).toBe(false);
    });

    test("isPlottedAsPrepared_YearToDate_False", () => {

        const props = createYearToDateProps([{ yearToDate: true }]);

        expect(Transforms.isPlottedAsPrepared(props, 0)).toBe(false);
    });

    test("applyYearOnYearChange_EarlierRowAtSameDate_FractionOfYearBefore", () => {

        const rows = [{ D: "2025-01-01", V0: 150 }, { D: "2025-02-01", V0: 90 }];
        const earlier = [{ D: "2025-01-01", V0: 100 }, { D: "2025-02-01", V0: -60 }];

        Transforms.applyYearOnYearChange(rows, "V0", "D", earlier);

        expect(rows.map(row => row.V0)).toEqual([0.5, 2.5]);
    });

    test("applyYearOnYearChange_NoneOrNothingYearBefore_Nothing", () => {

        const rows = [{ D: "2025-01-01", V0: 150 }, { D: "2025-02-01", V0: 90 },
            { D: "2025-03-01", V0: null }];
        const earlier = [{ D: "2025-02-01", V0: 0 }, { D: "2025-03-01", V0: 10 }];

        Transforms.applyYearOnYearChange(rows, "V0", "D", earlier);

        expect(rows.map(row => row.V0)).toEqual([null, null, null]);
    });

    test("isYearOnYearChange_ChangeOnPeriodBeforeAlsoSet_False", () => {

        const props = {
            showAsYearOnYearChange: true,
            previousYearGroupingEntry: { binPeriod: Ren.DatePeriodEnum.Month },
            previousYearInputData: {}
        };

        expect(Transforms.isYearOnYearChange(props)).toBe(true);
        expect(Transforms.isYearOnYearChange(Object.assign({}, props, { showAsChange: true })))
            .toBe(false);
        expect(Transforms.isAnyChange(Object.assign({}, props, { showAsChange: true })))
            .toBe(true);
    });

    test("isYearOnYearChange_AllTime_False", () => {

        const props = {
            showAsYearOnYearChange: true,
            isAllTime: true,
            previousYearGroupingEntry: { binPeriod: Ren.DatePeriodEnum.Month },
            previousYearInputData: {}
        };

        expect(Transforms.isYearOnYearChange(props)).toBe(false);
    });

    test("persistedProperties_YearOnYearChange_SavedOnlyWhenSet", () => {

        const transform = Ren.VisualisationTypes_DateValueChart.persistedProperties
            .find(property => property.name === "showAsYearOnYearChange").transform;

        expect(transform(true)).toBe(true);
        expect(transform(false)).toBeUndefined();
    });

    const createMonthRows = (values) => values.map((value, index) =>
        ({ D: new Date(2024, index, 1), V0: value }));

    test("applyRollingYearTotal_Monthly_TotalOfYearToEachMonthsEnd", () => {

        const values = [];

        for (let i = 0; i < 14; i++) values.push(i + 1);

        const rows = createMonthRows(values);

        Transforms.applyRollingYearTotal(rows, "V0", "D", Ren.DatePeriodEnum.Month);

        // December 2024 totals January to December, then each month drops the year before's.
        expect(rows.map(row => row.V0)).toEqual([
            null, null, null, null, null, null, null, null, null, null, null,
            78, 90, 102
        ]);
    });

    test("applyRollingYearTotal_GapInValues_GapCountsAsNothing", () => {

        const values = [1, 1, 1, 1, null, 1, 1, 1, 1, 1, 1, 1, 1];
        const rows = createMonthRows(values);

        Transforms.applyRollingYearTotal(rows, "V0", "D", Ren.DatePeriodEnum.Month);

        expect(rows[11].V0).toBe(11);
        expect(rows[12].V0).toBe(11);
    });

    test("transform_RollingYearTotalAndYearToDate_YearToDateShown", () => {

        const rows = createMonthRows([5, 5, 5]);
        const props = {
            seriesCount: 1,
            valueHeadings: ["V0"],
            dateHeading: "D",
            datePeriod: Ren.DatePeriodEnum.Month,
            series: [{ yearToDate: true, rollingYearTotal: true }]
        };

        expect(Transforms.isRollingYearTotal(props, 0)).toBe(false);
        expect(Transforms.transform(props, rows).map(row => row.V0)).toEqual([5, 10, 15]);
    });

    test("isPlottedAsPrepared_RollingYearTotal_False", () => {

        const props = {
            seriesCount: 1,
            valueHeadings: ["V0"],
            datePeriod: Ren.DatePeriodEnum.Month,
            series: [{ rollingYearTotal: true }]
        };

        expect(Transforms.isPlottedAsPrepared(props, 0)).toBe(false);
    });

    test("canShowRollingYearTotal_ByHour_False", () => {

        expect(Transforms.canShowRollingYearTotal({ datePeriod: Ren.DatePeriodEnum.Hour }))
            .toBe(false);
        expect(Transforms.canShowRollingYearTotal({ datePeriod: Ren.DatePeriodEnum.Week }))
            .toBe(true);
    });
});
