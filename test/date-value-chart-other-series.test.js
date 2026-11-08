describe("Ren.DateValueChart_OtherSeries", () => {

    const OtherSeries = Ren.DateValueChart_OtherSeries;
    const Applyer = Ren.DateValueChart_GroupingApplyer;

    const createMonthSettings = (columns, splitEntry) => {

        const dateEntry = {
            groupByColumnIndexes: [0],
            groupByCalcFunctions: [{ name: "date-month-start" }],
            columns: columns || {}
        };

        return {
            groupings: {
                entries: splitEntry ? [dateEntry, splitEntry] : [dateEntry]
            }
        };
    };

    const createRows = () => [
        { Date: "2024-01-03", Region: "North", A: 1, B: 10, C: 100 },
        { Date: "2024-01-20", Region: "South", A: 2, B: 20, C: 200 },
        { Date: "2024-02-15", Region: "East", A: 3, B: 30, C: 300 }
    ];

    test("extractSettings_OtherSettingsAmongSeries_TakenOutByColumn", () => {

        const otherSettings = { column: OtherSeries.HEADING, isEnabled: false };
        const visualisation = { series: [{ column: "A" }, otherSettings, { column: "B" }] };

        const settingsByHeading = OtherSeries.extractSettings(visualisation);

        expect(visualisation.series).toEqual([{ column: "A" }, { column: "B" }]);
        expect(settingsByHeading[OtherSeries.HEADING]).toBe(otherSettings);
    });

    test("keepSettings_ExtractedSettings_PutBackAfterTheRest", () => {

        const otherSettings = { column: OtherSeries.HEADING };
        const visualisation = { series: [{ column: "A" }, otherSettings] };
        const settingsByHeading = OtherSeries.extractSettings(visualisation);

        OtherSeries.keepSettings(visualisation, settingsByHeading);

        expect(visualisation.series).toEqual([{ column: "A" }, otherSettings]);
    });

    test("getOtherSeries_RemovedAndLimitedOutSeries_OneGatheringBothInDataOrder", () => {

        // C is removed and D is beyond the legend's limit.
        const props = {
            allValueHeadings: ["A", "B", "C", "D"],
            valueHeadings: ["A", "B"],
            series: [{}, {}],
            limitedOutHeadings: ["D"]
        };

        const otherSeries = OtherSeries.getOtherSeries(props);

        expect(otherSeries).toEqual([{
            heading: OtherSeries.HEADING,
            sourceHeading: null,
            label: "Other",
            gatheredHeadings: ["C", "D"]
        }]);
    });

    test("getOtherSeries_HiddenSeriesOnly_None", () => {

        const props = {
            allValueHeadings: ["A", "B"],
            valueHeadings: ["A", "B"],
            series: [{}, { isEnabled: false }]
        };

        expect(OtherSeries.getOtherSeries(props)).toEqual([]);
    });

    test("getOtherSeries_SplitFromSeveralColumns_OnePerColumnWithSeriesRemoved", () => {

        const props = {
            valueHeadings: ["North A", "North B", "South B"],
            series: [{}, {}, {}],
            seriesSplit: {},
            allValueHeadings: ["North A", "South A", "North B", "South B", "East B"],
            allSeriesSourceHeadings: ["A", "A", "B", "B", "B"]
        };

        const otherSeries = OtherSeries.getOtherSeries(props);

        expect(otherSeries.map(series => series.label)).toEqual(["A (Other)", "B (Other)"]);
        expect(otherSeries.map(series => series.gatheredHeadings))
            .toEqual([["South A"], ["East B"]]);
        expect(otherSeries.map(series => series.sourceHeading)).toEqual(["A", "B"]);
    });

    test("setShown_False_SettingsAndSeriesHidden", () => {

        const otherSettings = { column: OtherSeries.HEADING };
        const props = {
            visualisation: { series: [{ column: "A" }, otherSettings] },
            valueHeadings: ["A", OtherSeries.HEADING],
            series: [{ isEnabled: true }, { isEnabled: true }]
        };

        expect(OtherSeries.isShown(props)).toBe(true);

        OtherSeries.setShown(props, false);

        expect(otherSettings.isEnabled).toBe(false);
        expect(props.series[1].isEnabled).toBe(false);
        expect(props.series[0].isEnabled).toBe(true);
        expect(OtherSeries.isShown(props)).toBe(false);
    });

    test("addOtherSeriesColumns_NoGrouping_GatheredValuesSummed", () => {

        const rows = [{ A: 1, B: 2, C: 3 }, { A: 4, B: null, C: null }];
        const otherSeries = [{ heading: OtherSeries.HEADING, gatheredHeadings: ["B", "C"] }];

        const result = Applyer.addOtherSeriesColumns(rows, null, otherSeries);

        expect(result.map(row => row[OtherSeries.HEADING])).toEqual([5, 0]);
        expect(rows[0][OtherSeries.HEADING]).toBeUndefined();
    });

    test("addOtherSeriesColumns_SumGrouping_GatheredColumnsSummedPerBin", () => {

        const entry = Applyer.initGroupingEntry(
            createMonthSettings(),
            "Date",
            ["A", "B", "C"],
            null,
            null
        );
        const aggregatedRows = Applyer.applyGroupingWithinPointLimit(createRows(), entry);
        const otherSeries = [{ heading: OtherSeries.HEADING, gatheredHeadings: ["B", "C"] }];

        const result = Applyer.addOtherSeriesColumns(aggregatedRows, entry, otherSeries);

        expect(result.map(row => row[OtherSeries.HEADING])).toEqual([330, 330]);
    });

    test("addOtherSeriesColumns_MaxGrouping_MaximumOfEveryGatheredValue", () => {

        const max = { aggregationType: Ren.AggregationTypeEnum.Max };
        const entry = Applyer.initGroupingEntry(
            createMonthSettings({ A: max, B: max, C: max }),
            "Date",
            ["A", "B", "C"],
            null,
            null
        );
        const aggregatedRows = Applyer.applyGroupingWithinPointLimit(createRows(), entry);
        const otherSeries = [{ heading: OtherSeries.HEADING, gatheredHeadings: ["A", "B"] }];

        const result = Applyer.addOtherSeriesColumns(aggregatedRows, entry, otherSeries);

        expect(result.map(row => row[OtherSeries.HEADING])).toEqual([20, 30]);
    });

    test("addOtherSeriesColumns_SplitGrouping_GatheredSplitValuesAggregatedTogether", () => {

        const entry = Applyer.initGroupingEntry(
            createMonthSettings(null, { groupByColumns: ["Region"], groupByColumnIndexes: [1] }),
            "Date",
            ["B"],
            null,
            null
        );
        const aggregatedRows = Applyer.applyGroupingWithinPointLimit(createRows(), entry);
        const gatheredHeadings = entry.seriesColumns
            .filter(seriesColumn => seriesColumn.splitValue !== "North")
            .map(seriesColumn => seriesColumn.heading);
        const otherSeries = [{
            heading: OtherSeries.HEADING,
            sourceHeading: "B",
            gatheredHeadings
        }];

        const result = Applyer.addOtherSeriesColumns(aggregatedRows, entry, otherSeries);

        expect(result.map(row => row[OtherSeries.HEADING])).toEqual([20, 30]);
    });

    test("getSplitValues_OtherSeriesOfSplitChart_GatheredSeriesSplitValues", () => {

        const props = {
            valueHeadings: ["North", "South", OtherSeries.HEADING],
            otherSeries: [{ heading: OtherSeries.HEADING, gatheredHeadings: ["South", "East"] }],
            seriesSplit: {
                splitValueBySeriesHeading: { North: "North", South: "South", East: "East" }
            }
        };

        expect(OtherSeries.getSplitValues(props, 2)).toEqual(["South", "East"]);
        expect(OtherSeries.getSplitValues(props, 0)).toBeNull();
    });

    describe("tooltips", () => {

        const createProps = (gatheredHeadings) => ({
            visualisation: { series: [{ column: "A" }, { column: "B", label: "Bee" }] },
            valueHeadings: ["A", OtherSeries.HEADING],
            series: [{}, { label: "Other" }],
            otherSeries: [{ heading: OtherSeries.HEADING, label: "Other", gatheredHeadings }]
        });

        test("getTooltip_OtherSeries_GatheredSeriesListedByLabelOrHeading", () => {

            const props = createProps(["B", "C"]);

            expect(OtherSeries.getTooltip(props, 1)).toBe("\"Other\" represents 2 series:\nBee\nC");
        });

        test("getTooltip_NotOtherSeries_Null", () => {

            expect(OtherSeries.getTooltip(createProps(["B"]), 0)).toBeNull();
        });

        test("getTooltip_ManyGatheredSeries_ListCutShortWithCountOfTheRest", () => {

            const headings = [];

            for (let i = 0; i < 45; i++) headings.push("S" + i);

            const lines = OtherSeries.getTooltip(createProps(headings), 1).split("\n");

            expect(lines.length).toBe(42);
            expect(lines[40]).toBe("S39");
            expect(lines[41]).toBe("\u2026and 5 more");
        });

        test("addTooltip_HtmlElement_TitleAttributeSet", () => {

            const element = document.createElement("div");

            OtherSeries.addTooltip(element, createProps(["B"]), 1);

            expect(element.title).toBe("\"Other\" represents 1 series:\nBee");
        });

        test("addTooltip_SvgElementWithTitle_ListAddedToItsEnd", () => {

            const element = document.createElementNS("http://www.w3.org/2000/svg", "g");

            Ren.Svg.append(element, "title").textContent = "Jan 2024";

            OtherSeries.addTooltip(element, createProps(["B"]), 1);

            expect(element.querySelectorAll("title").length).toBe(1);
            expect(element.querySelector("title").textContent)
                .toBe("Jan 2024\n\n\"Other\" represents 1 series:\nBee");
        });

        test("addTooltip_NotOtherSeries_NothingAdded", () => {

            const element = document.createElementNS("http://www.w3.org/2000/svg", "g");

            OtherSeries.addTooltip(element, createProps(["B"]), 0);

            expect(element.querySelector("title")).toBeNull();
        });
    });

    describe("removal", () => {

        const SeriesRemoval = Ren.DateValueChart_SeriesRemoval;

        // Two series drawn, A and an "Other" series gathering the removed B.
        const createProps = () => {

            const otherSettings = { column: OtherSeries.HEADING };

            return {
                visualisation: {
                    series: [{ column: "A" }, otherSettings, { column: "B" }],
                    includedSeries: ["A"]
                },
                otherSettings,
                allValueHeadings: ["A", "B"],
                valueHeadings: ["A", OtherSeries.HEADING],
                series: [{}, {}],
                redrawVisualisation: jest.fn()
            };
        };

        beforeEach(() => {
            jest.spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
                .mockImplementation((visualisation, redraw) => redraw());
        });

        afterEach(() => jest.restoreAllMocks());

        test("setRemoved_NamedHeadings_OnlyTheirSettingsFlaggedThenCleared", () => {

            const props = createProps();
            const otherSettings = { column: OtherSeries.HEADING + "B" };

            props.visualisation.series.push(otherSettings);

            OtherSeries.setRemoved(props.visualisation, [OtherSeries.HEADING], true);

            expect(props.otherSettings.isRemoved).toBe(true);
            expect(otherSettings.isRemoved).toBeUndefined();

            OtherSeries.setRemoved(props.visualisation, null, false);

            expect("isRemoved" in props.otherSettings).toBe(false);
        });

        test("removeSeries_OtherSeries_RemovedLeavingIncludedSeries", () => {

            const props = createProps();

            SeriesRemoval.removeSeries(props, [2]);

            expect(props.otherSettings.isRemoved).toBe(true);
            expect(props.visualisation.includedSeries).toEqual(["A"]);
            expect(props.redrawVisualisation).toHaveBeenCalled();
        });

        test("removeSeries_OtherSeriesAndLastSeries_NothingRemoved", () => {

            const props = createProps();

            SeriesRemoval.removeSeries(props, [1, 2]);

            expect(props.otherSettings.isRemoved).toBeUndefined();
            expect(props.redrawVisualisation).not.toHaveBeenCalled();
        });

        test("reinstateSeries_Every_OtherSeriesReinstatedToo", () => {

            const props = createProps();

            props.otherSettings.isRemoved = true;

            SeriesRemoval.reinstateSeries(props, null);

            expect("isRemoved" in props.otherSettings).toBe(false);
            expect(props.visualisation.includedSeries).toBeNull();
        });

        test("reinstateOtherSeries_Removed_GatheredSeriesStayRemoved", () => {

            const props = createProps();

            props.otherSettings.isRemoved = true;

            SeriesRemoval.reinstateOtherSeries(props);

            expect("isRemoved" in props.otherSettings).toBe(false);
            expect(props.visualisation.includedSeries).toEqual(["A"]);
        });
    });
});
