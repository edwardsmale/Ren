describe("Ren.DateValueChart_SeriesOrder", () => {

    const SeriesOrder = Ren.DateValueChart_SeriesOrder;

    const createSettings = () => [
        { column: "Sales", colour: "#111111" },
        { column: "Orders", colour: "#222222" },
        { column: "Returns", colour: "#333333" }
    ];

    const HEADINGS = ["Sales", "Orders", "Returns"];

    test("moveSeries_Later_SettingsMovedWithColours", () => {

        const result = SeriesOrder.moveSeries(createSettings(), HEADINGS, 0, 1);

        expect(result.map(series => [series.column, series.colour])).toEqual([
            ["Orders", "#222222"],
            ["Sales", "#111111"],
            ["Returns", "#333333"]
        ]);
    });

    test("moveSeries_Earlier_SettingsMoved", () => {

        const result = SeriesOrder.moveSeries(createSettings(), HEADINGS, 2, 1);

        expect(result.map(series => series.column)).toEqual(["Sales", "Returns", "Orders"]);
    });

    test("moveSeries_Moved_OriginalLeftAsItWas", () => {

        const settings = createSettings();

        SeriesOrder.moveSeries(settings, HEADINGS, 0, 2);

        expect(settings.map(series => series.column)).toEqual(HEADINGS);
    });

    test("moveSeries_BeyondSeriesDrawn_Unmoved", () => {

        const result = SeriesOrder.moveSeries(createSettings(), HEADINGS, 2, 3);

        expect(result.map(series => series.column)).toEqual(HEADINGS);
    });

    test("moveSeries_SettingsKeptForSeriesNotDrawn_LeftAfterThose", () => {

        const settings = createSettings();

        const result = SeriesOrder.moveSeries(settings, ["Sales", "Orders"], 1, 0);

        expect(result.map(series => series.column)).toEqual(["Orders", "Sales", "Returns"]);
        expect(result[2]).toBe(settings[2]);
    });

    test("moveSeries_SettingsWithoutColumns_NamedByTheirColumns", () => {

        const settings = [{ colour: "#111111" }, {}];

        const result = SeriesOrder.moveSeries(settings, ["Sales", "Orders"], 0, 1);

        expect(result.map(series => series.column)).toEqual(["Orders", "Sales"]);
        expect(result[1].colour).toBe("#111111");
    });
});
