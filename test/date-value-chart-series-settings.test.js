describe("Ren.DateValueChart_SeriesSettings", () => {

    const SeriesSettings = Ren.DateValueChart_SeriesSettings;
    const { Currency, Integer, Percentage } = Ren.SpreadsheetColumnFormatEnum;
    const { Bar, Line, Pie } = Ren.SeriesChartTypeEnum;

    const createProps = (valueHeadings, valueColumnFormats, seriesSourceHeadings) => ({
        valueHeadings,
        valueColumnFormats,
        seriesCount: valueHeadings.length,
        seriesSourceHeadings: seriesSourceHeadings || valueHeadings
    });

    // As the grouping entry gives a chart split by Region.
    const SPLIT_COLUMNS = ["Region"];

    const ensure = (props, visualisation, seriesColumns) =>
        SeriesSettings.ensureSeriesSettings(props, visualisation, seriesColumns || null, null);

    describe("ensureSeriesSettings", () => {

        test("ensureSeriesSettings_NewChart_DefaultsForEachSeries", () => {

            const props = createProps(["Sales", "Margin"], [Currency, Percentage]);
            const visualisation = {};

            const isNewChart = ensure(props, visualisation);

            expect(isNewChart).toBe(true);
            expect(visualisation.series.map(series =>
                [series.column, series.chartType, series.valueAxis, series.isEnabled]
            )).toEqual([
                ["Sales", Bar, "leftAxis", true],
                ["Margin", Line, "rightAxis", true]
            ]);
        });

        test("ensureSeriesSettings_GridRenamedTheColumn_LabelledAsTheGridNamedIt", () => {

            const props = createProps(["Sales"], [Currency]);
            const visualisation = { initialChartColumnLabels: { Sales: "Takings" } };

            ensure(props, visualisation);

            expect(visualisation.series[0].label).toBe("Takings");
        });

        test("ensureSeriesSettings_SavedSeries_KeptAndNotNew", () => {

            const props = createProps(["Sales"], [Currency]);
            const saved = { column: "Sales", chartType: Line, colour: "#123456" };
            const visualisation = { series: [saved] };

            const isNewChart = ensure(props, visualisation);

            expect(isNewChart).toBe(false);
            expect(visualisation.series).toEqual([saved]);
        });

        test("ensureSeriesSettings_FewerSavedThanDrawn_DefaultsForTheRest", () => {

            const props = createProps(["Sales", "Units"], [Currency, Integer]);
            const visualisation = { series: [{ column: "Sales", chartType: Line }] };

            ensure(props, visualisation);

            expect(visualisation.series.map(series => [series.column, series.chartType]))
                .toEqual([["Sales", Line], ["Units", Bar]]);
        });

        test("ensureSeriesSettings_ShowAsPies_EverySeriesAPieAndTheFlagRemoved", () => {

            const props = createProps(["Sales", "Units"], [Currency, Integer]);
            const visualisation = { showAsPies: true };

            ensure(props, visualisation);

            expect(visualisation.series.map(series => series.chartType)).toEqual([Pie, Pie]);
            expect("showAsPies" in visualisation).toBe(false);
        });

        test("ensureSeriesSettings_SettingsASplitDropped_TakenUpThenCleared", () => {

            const props = createProps(["Sales"], [Currency]);
            props.inheritedSeriesSettings = { chartType: Line, lineStyle: "dashed" };
            const visualisation = {};

            ensure(props, visualisation);

            expect([visualisation.series[0].chartType, visualisation.series[0].lineStyle])
                .toEqual([Line, "dashed"]);
            expect(props.inheritedSeriesSettings).toBeNull();
        });

        test("ensureSeriesSettings_SplitValuesInADifferentOrder_MatchedByColumn", () => {

            const props = createProps(["South", "North"], [Currency, Currency], ["Sales", "Sales"]);
            const north = { column: "North", colour: "#111111" };
            const south = { column: "South", colour: "#222222" };
            const visualisation = { series: [north, south] };

            ensure(props, visualisation, SPLIT_COLUMNS);

            expect(visualisation.series).toEqual([south, north]);
        });

        test("ensureSeriesSettings_SplitValueNoLongerInTheData_KeptAfterThoseDrawn", () => {

            const props = createProps(["North"], [Currency], ["Sales"]);
            const north = { column: "North" };
            const east = { column: "East", isEnabled: false };
            const visualisation = { series: [east, north] };

            ensure(props, visualisation, SPLIT_COLUMNS);

            expect(visualisation.series).toEqual([north, east]);
        });

        test("ensureSeriesSettings_NewSplitValue_TakesHowItsColumnIsDrawn", () => {

            const props = createProps(["North", "West"], [Currency, Currency], ["Sales", "Sales"]);
            const north = { column: "North", chartType: Line, colour: "#111111" };
            const visualisation = { series: [north] };

            ensure(props, visualisation, SPLIT_COLUMNS);

            const west = visualisation.series[1];

            expect([west.column, west.chartType, west.colour === north.colour])
                .toEqual(["West", Line, false]);
        });

        test("ensureSeriesSettings_SplitSeriesDefaults_OutrankTheUsualDefaults", () => {

            const props = createProps(["North"], [Currency], ["Sales"]);
            const visualisation = { splitSeriesDefaults: { chartType: Line } };

            ensure(props, visualisation, SPLIT_COLUMNS);

            expect(visualisation.series[0].chartType).toBe(Line);
        });
    });

    describe("buildSeriesProps", () => {

        const build = (props, visualisation, seriesColumns, getDefaultSeriesLabel) =>
            SeriesSettings.buildSeriesProps(
                props,
                visualisation,
                seriesColumns || null,
                getDefaultSeriesLabel || (() => null)
            );

        test("buildSeriesProps_UnsetSettings_Defaults", () => {

            const props = createProps(["Sales", "Margin"], [Currency, Percentage]);

            build(props, { series: [{}, {}] }, null, index => index === 0 ? "Takings" : null);

            expect(props.series.map(series => [
                series.valueAxis,
                series.chartType,
                series.label,
                series.showValueLabels,
                series.isEnabled,
                series.lineStyle,
                series.estimateLastPeriod
            ])).toEqual([
                ["leftAxis", Bar, "Takings", true, true, "solid", Ren.EstimateLastPeriodEnum.None],
                ["rightAxis", Line, null, true, true, "solid", Ren.EstimateLastPeriodEnum.None]
            ]);
        });

        test("buildSeriesProps_SavedSettings_Kept", () => {

            const props = createProps(["Sales"], [Currency]);
            const saved = {
                valueAxis: "rightAxis",
                chartType: Line,
                colour: "#123456",
                label: "Takings",
                showValueLabels: false,
                isEnabled: false,
                runningTotal: true
            };

            build(props, { series: [saved] });

            const series = props.series[0];

            expect([
                series.valueAxis,
                series.chartType,
                series.colour,
                series.label,
                series.showValueLabels,
                series.isEnabled,
                series.runningTotal
            ]).toEqual(["rightAxis", Line, "#123456", "Takings", false, false, true]);
        });

        test("buildSeriesProps_UnsplitWithMoreSavedThanDrawn_PropsForEach", () => {

            const props = createProps(["Sales"], [Currency]);

            build(props, { series: [{}, { chartType: Line }] });

            expect(props.series.map(series => series.chartType)).toEqual([Bar, Line]);
        });

        test("buildSeriesProps_SplitWithMoreSavedThanDrawn_PropsForThoseDrawn", () => {

            const props = createProps(["North"], [Currency], ["Sales"]);

            build(props, { series: [{ column: "North" }, { column: "East" }] }, SPLIT_COLUMNS);

            expect(props.series.length).toBe(1);
        });
    });
});
