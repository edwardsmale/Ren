describe("Ren.DateValueChart_TrendLines", () => {

    const TrendLines = Ren.DateValueChart_TrendLines;

    const DAY = 24 * 60 * 60 * 1000;

    const createRows = (values) => values.map((value, index) => ({
        Date: new Date(Date.UTC(2026, 0, 1) + index * DAY),
        Value: value
    }));

    const getDate = row => row.Date;

    test("getLinearFit_PointsOnALine_ThatLine", () => {

        const fit = TrendLines.getLinearFit([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);

        expect(fit.slope).toBeCloseTo(2);
        expect(fit.intercept).toBeCloseTo(1);
    });

    test("getLinearFit_ScatteredPoints_LeastSquaresLine", () => {

        const fit = TrendLines.getLinearFit([
            { x: 0, y: 0 },
            { x: 1, y: 2 },
            { x: 2, y: 1 },
            { x: 3, y: 3 }
        ]);

        // Slope = sum(dx * dy) / sum(dx * dx) = 4 / 5.
        expect(fit.slope).toBeCloseTo(0.8);
        expect(fit.intercept).toBeCloseTo(0.3);
    });

    test("getLinearFit_OnePoint_Null", () => {

        expect(TrendLines.getLinearFit([{ x: 0, y: 1 }])).toBeNull();
    });

    test("getLinearFit_PointsAtOneX_Null", () => {

        expect(TrendLines.getLinearFit([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
    });

    test("getMovingAverages_ThreePeriods_NullUntilWindowFills", () => {

        expect(TrendLines.getMovingAverages([3, 6, 9, 12], 3)).toEqual([null, null, 6, 9]);
    });

    test("getMovingAverages_GapInWindow_AveragedOverValuesPresent", () => {

        expect(TrendLines.getMovingAverages([2, null, 4], 3)).toEqual([null, null, 3]);
    });

    test("getMovingAverages_WindowWithoutValues_Null", () => {

        expect(TrendLines.getMovingAverages([null, null], 2)).toEqual([null, null]);
    });

    test("getTrendPoints_Linear_EndsOfTheFittedLine", () => {

        const rows = createRows([1, 2, 3]);

        const points = TrendLines.getTrendPoints(rows, "Value", getDate, "linear");

        expect(points.length).toBe(2);
        expect(points[0].date).toEqual(rows[0].Date);
        expect(points[0].value).toBeCloseTo(1);
        expect(points[1].date).toEqual(rows[2].Date);
        expect(points[1].value).toBeCloseTo(3);
    });

    test("getTrendPoints_LinearWithLeadingGap_StartsAtFirstValue", () => {

        const rows = createRows([null, 2, 4]);

        const points = TrendLines.getTrendPoints(rows, "Value", getDate, "linear");

        expect(points[0].date).toEqual(rows[1].Date);
    });

    test("getTrendPoints_MovingAverage_PointPerFilledWindow", () => {

        const rows = createRows([1, 2, 3, 4]);

        const points = TrendLines.getTrendPoints(rows, "Value", getDate, "movingAverage", 2);

        expect(points.map(point => point.value)).toEqual([1.5, 2.5, 3.5]);
    });

    test("getTrendPoints_MovingAverageWithoutPeriods_ThreePeriods", () => {

        const rows = createRows([1, 2, 3, 4]);

        const points = TrendLines.getTrendPoints(rows, "Value", getDate, "movingAverage");

        expect(points.map(point => point.value)).toEqual([2, 3]);
    });

    test("getTrendPoints_UnknownTrend_NoPoints", () => {

        expect(TrendLines.getTrendPoints(createRows([1, 2]), "Value", getDate, "cubic"))
            .toEqual([]);
    });

    test("getAverage_SomeWithoutValues_AverageOfThoseWith", () => {

        expect(TrendLines.getAverage([2, null, 4, undefined, 9])).toBe(5);
    });

    test("getAverage_NoValues_Null", () => {

        expect(TrendLines.getAverage([null, undefined])).toBeNull();
    });

    test("getTrendPoints_Average_LevelFromFirstValueToLast", () => {

        const rows = createRows([null, 2, 4, 6, null]);

        const points = TrendLines.getTrendPoints(rows, "Value", getDate, "average");

        expect(points).toEqual([
            { date: rows[1].Date, value: 4 },
            { date: rows[3].Date, value: 4 }
        ]);
    });

    test("getTrendPoints_AverageWithoutValues_NoPoints", () => {

        const rows = createRows([null, null]);

        expect(TrendLines.getTrendPoints(rows, "Value", getDate, "average")).toEqual([]);
    });
});
