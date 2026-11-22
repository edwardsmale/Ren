// The expected values here are the outputs the chart helpers have always given for the same
// inputs.
const toIsoStrings = dates => dates.map(date => date.toISOString());

describe("Ren.ChartScales.createLinearScale", () => {

    test.each([
        [[0, 0.6], [0, 0.6]],
        [[0, 1234567], [0, 1300000]],
        [[-3, 7], [-3, 7]],
        [[10, 0], [10, 0]],
        [[5, 5], [5, 5]],
        [[0, 0.000123], [0, 0.00013]],
        [[0.1, 0.3], [0.1, 0.3]],
        [[0, 0], [0, 0]]
    ])("niceDomain_%j_IsWidenedTo%j", (domain, expected) => {

        const scale = Ren.ChartScales.createLinearScale(domain, [500, 0], { nice: true });

        expect(scale.getDomain()).toEqual(expected);
    });

    test.each([
        [[0, 1], 10, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]],
        [[0, 1234567], 10, [0, 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000,
            900000, 1000000, 1100000, 1200000]],
        [[-3, 7], 5, [-2, 0, 2, 4, 6]],
        [[10, 0], 10, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]],
        [[5, 5], 10, [5]],
        [[0, 0.000123], 10, [0, 0.00001, 0.00002, 0.00003, 0.00004, 0.00005, 0.00006, 0.00007,
            0.00008, 0.00009, 0.0001, 0.00011, 0.00012]],
        [[0, 1], 0, []]
    ])("getTicks_%j_Count%d_AreRoundValues", (domain, count, expected) => {

        const scale = Ren.ChartScales.createLinearScale(domain, [500, 0]);

        expect(scale.getTicks(count)).toEqual(expected);
    });

    test("getTicks_NoCount_DefaultsToTen", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 1], [500, 0]);

        expect(scale.getTicks()).toHaveLength(11);
    });

    test("getPixel_ValuesInAndOutsideDomain_MapLinearly", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 200], [500, 0]);

        expect([0, 50, 200, 250, -40].map(scale.getPixel)).toEqual([500, 375, 0, -125, 600]);
    });

    test("getPixel_NotANumber_IsUndefined", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 200], [500, 0]);

        expect([null, undefined, NaN, "x"].map(scale.getPixel)).toEqual([undefined, undefined,
            undefined, undefined]);
    });

    test("getPixel_EmptyDomain_MapsToMiddleOfRange", () => {

        const scale = Ren.ChartScales.createLinearScale([5, 5], [500, 0]);

        expect(scale.getPixel(5)).toBe(250);
        expect(scale.getPixel(99)).toBe(250);
    });

    test("getValue_Pixels_MapBackToValues", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 200], [500, 0]);

        expect([500, 0, 125, 600].map(scale.getValue)).toEqual([0, 200, 150, -39.99999999999999]);
    });

    test("setDomainAndSetRange_NewValues_ChangeTheSameScale", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 200], [500, 0]);

        scale.setDomain([0, 100]);
        scale.setRange([0, 50]);

        expect(scale.getPixel(50)).toBe(25);
        expect(scale.getDomain()).toEqual([0, 100]);
        expect(scale.getRange()).toEqual([0, 50]);
    });

    test("getDomain_Read_IsACopy", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 200], [500, 0]);

        scale.getDomain()[1] = 1000;

        expect(scale.getDomain()).toEqual([0, 200]);
    });
});

describe("Ren.ChartScales.createTimeScale", () => {

    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-11T00:00:00.000Z");

    test("getPixel_Date_MapsByTime", () => {

        const scale = Ren.ChartScales.createTimeScale([start, end], [0, 1000]);

        expect(scale.getPixel(new Date("2024-01-03T12:00:00.000Z"))).toBe(250);
    });

    test("getDomainAndGetValue_Read_AreDates", () => {

        const scale = Ren.ChartScales.createTimeScale([start, end], [0, 1000]);

        expect(scale.getDomain()).toEqual([start, end]);
        expect(scale.getValue(250)).toEqual(new Date("2024-01-03T12:00:00.000Z"));
    });
});

describe("Ren.ChartDateTime periods", () => {

    // [date, period start at or before, period start at or after] around the BST changes, a leap
    // day and month and year ends.
    const PERIOD_STARTS = {
        utcSecond: [
            ["2024-02-29T23:59:59.999Z", "2024-02-29T23:59:59.000Z", "2024-03-01T00:00:00.000Z"],
            ["2024-05-15T00:00:00.000Z", "2024-05-15T00:00:00.000Z", "2024-05-15T00:00:00.000Z"]
        ],
        utcMinute: [
            ["2024-02-29T23:59:59.999Z", "2024-02-29T23:59:00.000Z", "2024-03-01T00:00:00.000Z"],
            ["2024-03-31T01:30:00.000Z", "2024-03-31T01:30:00.000Z", "2024-03-31T01:30:00.000Z"]
        ],
        utcQuarterHour: [
            ["2024-02-29T23:59:59.999Z", "2024-02-29T23:45:00.000Z", "2024-03-01T00:00:00.000Z"],
            ["2023-12-31T23:59:59.999Z", "2023-12-31T23:45:00.000Z", "2024-01-01T00:00:00.000Z"],
            ["2024-03-31T01:30:00.000Z", "2024-03-31T01:30:00.000Z", "2024-03-31T01:30:00.000Z"]
        ],
        utcHour: [
            ["2024-03-31T00:30:00.000Z", "2024-03-31T00:00:00.000Z", "2024-03-31T01:00:00.000Z"],
            ["2024-10-27T01:30:00.000Z", "2024-10-27T01:00:00.000Z", "2024-10-27T02:00:00.000Z"]
        ],
        utcDay: [
            ["2024-03-31T01:30:00.000Z", "2024-03-31T00:00:00.000Z", "2024-04-01T00:00:00.000Z"],
            ["2024-10-27T01:30:00.000Z", "2024-10-27T00:00:00.000Z", "2024-10-28T00:00:00.000Z"],
            ["2024-02-29T23:59:59.999Z", "2024-02-29T00:00:00.000Z", "2024-03-01T00:00:00.000Z"]
        ],
        utcWeek: [
            ["2024-03-31T00:30:00.000Z", "2024-03-25T00:00:00.000Z", "2024-04-01T00:00:00.000Z"],
            ["2023-12-31T23:59:59.999Z", "2023-12-25T00:00:00.000Z", "2024-01-01T00:00:00.000Z"],
            ["2024-05-15T00:00:00.000Z", "2024-05-13T00:00:00.000Z", "2024-05-20T00:00:00.000Z"]
        ],
        utcMonth: [
            ["2024-02-29T23:59:59.999Z", "2024-02-01T00:00:00.000Z", "2024-03-01T00:00:00.000Z"],
            ["2024-01-31T12:00:00.000Z", "2024-01-01T00:00:00.000Z", "2024-02-01T00:00:00.000Z"],
            ["2024-05-01T00:00:00.000Z", "2024-05-01T00:00:00.000Z", "2024-05-01T00:00:00.000Z"]
        ],
        utcQuarter: [
            ["2024-03-31T00:30:00.000Z", "2024-01-01T00:00:00.000Z", "2024-04-01T00:00:00.000Z"],
            ["2024-10-27T01:30:00.000Z", "2024-10-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z"],
            ["2023-12-31T23:59:59.999Z", "2023-10-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z"]
        ],
        utcYear: [
            ["2023-12-31T23:59:59.999Z", "2023-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z"],
            ["2024-05-15T00:00:00.000Z", "2024-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z"]
        ]
    };

    const periodStartCases = [];

    Object.keys(PERIOD_STARTS).forEach(name => {
        PERIOD_STARTS[name].forEach(row => periodStartCases.push([name].concat(row)));
    });

    test.each(periodStartCases)("getPeriodStartAt_%s_%s", (name, date, before, after) => {

        const period = Ren.ChartDateTime[name];

        expect(period.getPeriodStartAtOrBefore(new Date(date)).toISOString()).toBe(before);
        expect(period.getPeriodStartAtOrAfter(new Date(date)).toISOString()).toBe(after);
    });

    test.each([
        ["utcQuarterHour", "2024-03-31T00:50:00.000Z", "2024-03-31T02:00:00.000Z", [
            "2024-03-31T01:00:00.000Z", "2024-03-31T01:15:00.000Z", "2024-03-31T01:30:00.000Z",
            "2024-03-31T01:45:00.000Z"
        ]],
        ["utcHour", "2024-10-27T00:10:00.000Z", "2024-10-27T03:00:00.000Z", [
            "2024-10-27T01:00:00.000Z", "2024-10-27T02:00:00.000Z"
        ]],
        ["utcDay", "2024-02-27T12:00:00.000Z", "2024-03-02T00:00:00.000Z", [
            "2024-02-28T00:00:00.000Z", "2024-02-29T00:00:00.000Z", "2024-03-01T00:00:00.000Z"
        ]],
        ["utcWeek", "2024-03-20T00:00:00.000Z", "2024-04-10T00:00:00.000Z", [
            "2024-03-25T00:00:00.000Z", "2024-04-01T00:00:00.000Z", "2024-04-08T00:00:00.000Z"
        ]],
        ["utcMonth", "2024-01-31T00:00:00.000Z", "2024-05-01T00:00:00.000Z", [
            "2024-02-01T00:00:00.000Z", "2024-03-01T00:00:00.000Z", "2024-04-01T00:00:00.000Z"
        ]],
        ["utcQuarter", "2023-11-15T00:00:00.000Z", "2024-11-01T00:00:00.000Z", [
            "2024-01-01T00:00:00.000Z", "2024-04-01T00:00:00.000Z", "2024-07-01T00:00:00.000Z",
            "2024-10-01T00:00:00.000Z"
        ]],
        ["utcYear", "2020-06-01T00:00:00.000Z", "2023-01-01T00:00:00.000Z", [
            "2021-01-01T00:00:00.000Z", "2022-01-01T00:00:00.000Z"
        ]],
        ["utcDay", "2024-03-05T00:00:00.000Z", "2024-03-01T00:00:00.000Z", []]
    ])("getPeriodStarts_%s_%s_To%s", (name, start, stop, expected) => {

        const dates = Ren.ChartDateTime[name].getPeriodStarts(new Date(start), new Date(stop));

        expect(toIsoStrings(dates)).toEqual(expected);
    });

    test("addPeriods_MonthEnd_RollsOverAsDateDoes", () => {

        const date = Ren.ChartDateTime.utcMonth.addPeriods(new Date("2024-01-31T00:00:00.000Z"), 1);

        expect(date.toISOString()).toBe("2024-03-02T00:00:00.000Z");
    });

    test("addPeriods_Date_IsNotChanged", () => {

        const date = new Date("2024-01-31T00:00:00.000Z");

        Ren.ChartDateTime.utcDay.addPeriods(date, 3);

        expect(date.toISOString()).toBe("2024-01-31T00:00:00.000Z");
    });
});

describe("Ren.ChartDateTime formats", () => {

    test.each([
        ["yyyy-MM-dd HH:mm:ss", "2024-07-04 23:05:09"],
        ["d MMM yyyy", "4 Jul 2024"],
        ["dd MMM", "04 Jul"],
        ["HH:mm\nd MMM yyyy", "23:05\n4 Jul 2024"],
        ["HH:00", "23:00"],
        ["MMM yyyy", "Jul 2024"]
    ])("createUtcFormat_%j_WritesUtcParts", (pattern, expected) => {

        const format = Ren.ChartDateTime.createUtcFormat(pattern);

        expect(format(new Date("2024-07-04T23:05:09.000Z"))).toBe(expected);
    });

    test.each([
        ["yyyy-MM-dd HH:mm:ss", "2024-07-04 23:05:09"],
        ["d MMM yyyy", "4 Jul 2024"],
        ["dd MMM", "04 Jul"],
        ["HH:mm\nd MMM yyyy", "23:05\n4 Jul 2024"]
    ])("createLocalFormat_%j_WritesLocalParts", (pattern, expected) => {

        const format = Ren.ChartDateTime.createLocalFormat(pattern);

        expect(format(new Date(2024, 6, 4, 23, 5, 9))).toBe(expected);
    });

    test("createUtcFormat_EarlyYear_IsPaddedToFourDigits", () => {

        const format = Ren.ChartDateTime.createUtcFormat("d MMM yyyy");

        expect(format(new Date("0005-01-01T00:00:00.000Z"))).toBe("1 Jan 0005");
    });

    test("createUtcFormat_Timestamp_IsReadAsADate", () => {

        const format = Ren.ChartDateTime.createUtcFormat("yyyy-MM-dd");

        expect(format(Date.UTC(2024, 1, 29))).toBe("2024-02-29");
    });

    test("getWeekdayName_LocalDate_IsItsDayOfTheWeek", () => {

        expect(Ren.ChartDateTime.getWeekdayName(new Date(2024, 6, 4, 23, 5, 9))).toBe("Thursday");
    });
});

describe("Ren.ChartPaths", () => {

    const LINE_RUNS = [
        [[0, 10], [10.12345, 20]],
        [[30, 5]],
        [[50, 40], [60, 35.5], [70, 1 / 3]]
    ];

    const AREA_RUNS = [
        [[0, 10, 100], [10.12345, 20, 100]],
        [[30, 5, 90]],
        [[50, 40, 100], [60, 35.5, 100], [70, 1 / 3, 100]]
    ];

    const BASIS_TOP = "M50,40L51.667,39.25C53.333,38.5,56.667,37,60,30.389" +
        "C63.333,23.778,66.667,12.056,68.333,6.194L70,0.333";

    test("getLinePath_Linear_JoinsPointsAndClosesSinglePoints", () => {

        expect(Ren.ChartPaths.getLinePath(LINE_RUNS, Ren.ChartPaths.LINEAR))
            .toBe("M0,10L10.123,20M30,5ZM50,40L60,35.5L70,0.333");
    });

    test("getLinePath_Basis_CurvesRunsOfThreeOrMore", () => {

        expect(Ren.ChartPaths.getLinePath(LINE_RUNS, Ren.ChartPaths.BASIS))
            .toBe("M0,10L10.123,20M30,5Z" + BASIS_TOP);
    });

    test("getAreaPath_Linear_ReturnsAlongTheBase", () => {

        expect(Ren.ChartPaths.getAreaPath(AREA_RUNS, Ren.ChartPaths.LINEAR)).toBe(
            "M0,10L10.123,20L10.123,100L0,100ZM30,5L30,90Z" +
            "M50,40L60,35.5L70,0.333L70,100L60,100L50,100Z"
        );
    });

    test("getAreaPath_Basis_CurvesTheBaseToo", () => {

        expect(Ren.ChartPaths.getAreaPath(AREA_RUNS, Ren.ChartPaths.BASIS)).toBe(
            "M0,10L10.123,20L10.123,100L0,100ZM30,5L30,90Z" + BASIS_TOP +
            "L70,100L68.333,100C66.667,100,63.333,100,60,100" +
            "C56.667,100,53.333,100,51.667,100L50,100Z"
        );
    });

    test("getLinePathAndGetAreaPath_NoRuns_AreNull", () => {

        expect(Ren.ChartPaths.getLinePath([], Ren.ChartPaths.LINEAR)).toBeNull();
        expect(Ren.ChartPaths.getAreaPath([], Ren.ChartPaths.BASIS)).toBeNull();
    });
});

describe("Ren.ArrayUtils max and extent", () => {

    test.each([
        [[], undefined, [undefined, undefined]],
        [[null, undefined, NaN], undefined, [undefined, undefined]],
        [[3, null, 7, -2], 7, [-2, 7]],
        [["7", 10, "9"], 10, ["7", 10]]
    ])("maxAndExtent_%j", (values, max, extent) => {

        expect(Ren.ArrayUtils.max(values, value => value)).toBe(max);
        expect(Ren.ArrayUtils.extent(values, value => value)).toEqual(extent);
    });

    test("maxAndExtent_Dates_KeepTheDates", () => {

        const values = [{ date: new Date(5) }, { date: new Date(2) }];

        expect(Ren.ArrayUtils.max(values, value => value.date)).toEqual(new Date(5));
        expect(Ren.ArrayUtils.extent(values, value => value.date))
            .toEqual([new Date(2), new Date(5)]);
    });
});

describe("Ren.ChartScales.createLogScale", () => {

    test("createLogScale_Nice_WidenedToOneTwoOrFive", () => {

        const scale = Ren.ChartScales.createLogScale([130, 4200], [400, 0], { nice: true });

        expect(scale.getDomain()).toEqual([100, 5000]);
    });

    test("getPixel_EachPowerOfTen_SameHeight", () => {

        const scale = Ren.ChartScales.createLogScale([1, 1000], [300, 0]);

        expect(scale.getPixel(1)).toBeCloseTo(300);
        expect(scale.getPixel(10)).toBeCloseTo(200);
        expect(scale.getPixel(100)).toBeCloseTo(100);
        expect(scale.getValue(200)).toBeCloseTo(10);
    });

    test("getPixel_ZeroOrNothing_BottomOrUndefined", () => {

        const scale = Ren.ChartScales.createLogScale([10, 1000], [200, 0]);

        expect(scale.getPixel(0)).toBeCloseTo(200);
        expect(scale.getPixel(null)).toBeUndefined();
    });

    test("setDomain_StartAtZero_StartKept", () => {

        const scale = Ren.ChartScales.createLogScale([10, 1000], [200, 0]);

        scale.setDomain([0, 5000]);

        expect(scale.getDomain()).toEqual([10, 5000]);
    });

    test("getTicks_FewPowersOfTen_OneTwoAndFive", () => {

        const scale = Ren.ChartScales.createLogScale([1, 100], [200, 0]);

        expect(scale.getTicks(10)).toEqual([1, 2, 5, 10, 20, 50, 100]);
    });

    test("getTicks_ManyPowersOfTen_PowersOnly", () => {

        const scale = Ren.ChartScales.createLogScale([1, 1e8], [200, 0]);

        expect(scale.getTicks(10)).toEqual([1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8]);
    });

    test("getTicks_TooManyPowersOfTen_EverySoMany", () => {

        const scale = Ren.ChartScales.createLogScale([1, 1e12], [200, 0]);

        expect(scale.getTicks(5)).toEqual([1, 1e3, 1e6, 1e9, 1e12]);
    });

    test("getTicks_WithinOnePowerOfTen_LinearTicks", () => {

        const scale = Ren.ChartScales.createLogScale([120, 180], [200, 0]);

        expect(scale.getTicks(10)).toEqual([120, 130, 140, 150, 160, 170, 180]);
    });
});
