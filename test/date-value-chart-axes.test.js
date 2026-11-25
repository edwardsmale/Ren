describe("Ren.DateValueChart_Axes", () => {

    const Axes = Ren.DateValueChart_Axes;

    test("getValueTickCount_ShortPlot_FewerTicks", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 0.5 })).toBe(6);
    });

    test("getValueTickCount_TallPlot_AtMostTen", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 2 })).toBe(10);
    });

    test("getValueTickCount_TinyPlot_AtLeastTwo", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 0.05 })).toBe(2);
    });

    test("getValueTickCount_ScaleNotYetKnown_Ten", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500 })).toBe(10);
    });

    test("getValueTickCount_ChartOf250Px_TicksEvery500Of2600", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 2600], [250, 0], { nice: true });
        const tickCount = Axes.getValueTickCount({ innerHeight: 250, scaleY: 1 });

        expect(scale.getTicks(tickCount)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    });

    test("buildValueAxis_NoSavedAxis_Defaults", () => {

        expect(Axes.buildValueAxis(undefined)).toStrictEqual({
            maxY: undefined,
            label: undefined,
            yExtent: [0, 0],
            format: undefined,
            formatFunction: undefined,
            showValueLabels: true,
            fromSettings: false,
            updateYScaleBehaviour: undefined,
            startAtZero: true,
            logScale: false
        });
    });

    test("buildValueAxis_SavedAxis_Applied", () => {

        const formatFunction = value => value + " units";

        expect(Axes.buildValueAxis({
            maxY: 40,
            label: "Widgets",
            format: "#,##0",
            formatFunction,
            showValueLabels: false,
            fromSettings: true,
            updateYScaleBehaviour: "Ratchet",
            startAtZero: false,
            logScale: true
        })).toStrictEqual({
            maxY: 40,
            label: "Widgets",
            yExtent: [0, 40],
            format: "#,##0",
            formatFunction,
            showValueLabels: false,
            fromSettings: true,
            updateYScaleBehaviour: "Ratchet",
            startAtZero: false,
            logScale: true
        });
    });

    test("buildValueAxis_SavedExtent_Kept", () => {

        expect(Axes.buildValueAxis({ maxY: 40, yExtent: [5, 30] }).yExtent).toEqual([5, 30]);
    });

    test("buildValueAxis_SameSavedAxis_ExtentNotShared", () => {

        const savedAxis = {};

        expect(Axes.buildValueAxis(savedAxis).yExtent)
            .not.toBe(Axes.buildValueAxis(savedAxis).yExtent);
    });

    const { Currency, Integer, Percentage } = Ren.SpreadsheetColumnFormatEnum;

    test.each([
        ["PercentageAlongsideCurrency_RightAxis", Percentage, [Currency, Percentage], "rightAxis"],
        ["PercentageAlongsideNumbers_RightAxis", Percentage, [Integer, Percentage], "rightAxis"],
        ["PercentageOnly_LeftAxis", Percentage, [Percentage, Percentage], "leftAxis"],
        ["CurrencyAlongsidePercentage_LeftAxis", Currency, [Percentage, Currency], "leftAxis"],
        ["CurrencyAfterNumbers_LeftAxis", Currency, [Integer, Currency], "leftAxis"],
        ["CurrencyBeforeNumbers_LeftAxis", Currency, [Currency, Integer], "leftAxis"],
        ["NumbersAfterCurrency_LeftAxis", Integer, [Currency, Integer], "leftAxis"],
        ["NoFormat_LeftAxis", undefined, [Currency, Percentage], "leftAxis"]
    ])("getDefaultValueAxis_%s", (_name, format, valueColumnFormats, expected) => {

        expect(Axes.getDefaultValueAxis(format, valueColumnFormats)).toBe(expected);
    });
});
