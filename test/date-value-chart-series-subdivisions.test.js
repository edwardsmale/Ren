describe("Ren.DateValueChart_SeriesSubdivisions", () => {

    const PIE_SERIES = [{ chartType: Ren.SeriesChartTypeEnum.Pie }];

    const Subdivisions = Ren.DateValueChart_SeriesSubdivisions;
    const GroupingApplyer = Ren.DateValueChart_GroupingApplyer;

    const VALUE_HEADING = "Revenue";
    const COLUMN = "Category";

    // A prepared row and the props to look up its subdivisions with, the rows passed being what
    // the row was aggregated from.
    const buildChart = (rows) => {

        const chartGroupingEntry = {
            dateHeading: "Date",
            aggregationHeadings: [VALUE_HEADING],
            columns: { [VALUE_HEADING]: { aggregationType: Ren.AggregationTypeEnum.Sum } },
            groupingSignature: "signature"
        };

        const aggregatedRow = { Date: "2026-01-01" };
        const row = { Date: "2026-01-01" };

        jest.spyOn(Ren.CreateDateValueChart_PrepareData, "getUnpreparedRow")
            .mockReturnValue(aggregatedRow);

        jest.spyOn(GroupingApplyer, "getAggregatedRows")
            .mockReturnValue({ rows: rows, valueHeading: VALUE_HEADING });

        return {
            row,
            props: {
                subdivideColumn: COLUMN,
                dateHeading: "Date",
                seriesCount: 0,
                valueHeadings: [VALUE_HEADING],
                chartGroupingEntry
            }
        };
    };

    const buildRow = (category, revenue) => ({ [COLUMN]: category, [VALUE_HEADING]: revenue });

    afterEach(() => {

        jest.restoreAllMocks();
    });

    test("isActive_NoColumn_False", () => {

        expect(Subdivisions.isActive({ seriesCount: 0 })).toBe(false);
    });

    test("isActive_ColumnChosen_True", () => {

        expect(Subdivisions.isActive({ subdivideColumn: COLUMN, seriesCount: 0 })).toBe(true);
    });

    test("isActive_ColumnIsDateColumn_False", () => {

        const props = { subdivideColumn: "Date", dateHeading: "Date", seriesCount: 0 };

        expect(Subdivisions.isActive(props)).toBe(false);
    });

    test("isActive_ColumnIsSplitColumn_False", () => {

        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 0,
            chartGroupingEntry: { splitColumnKey: COLUMN }
        };

        expect(Subdivisions.isActive(props)).toBe(false);
    });

    test("isActive_ValuesTransformed_False", () => {

        const hasTransforms =
            jest.spyOn(Ren.DateValueChart_ValueTransforms, "hasTransforms");

        hasTransforms.mockReturnValue(true);

        expect(Subdivisions.isActive({ subdivideColumn: COLUMN, seriesCount: 0 })).toBe(false);
    });

    test("getLabelContent_Unset_Names", () => {

        expect(Subdivisions.getLabelContent({})).toBe(Subdivisions.LABEL_CONTENTS.Names);
    });

    test("getLabelContent_Unknown_Names", () => {

        expect(Subdivisions.getLabelContent({ subdivisionLabels: "x" }))
            .toBe(Subdivisions.LABEL_CONTENTS.Names);
    });

    test("getLabelContent_None_None", () => {

        expect(Subdivisions.getLabelContent({ subdivisionLabels: "none" }))
            .toBe(Subdivisions.LABEL_CONTENTS.None);
    });

    test("getLabelPlacement_Unknown_Inside", () => {

        expect(Subdivisions.getLabelPlacement({ subdivisionLabelPlacement: "x" }))
            .toBe(Subdivisions.LABEL_PLACEMENTS.Inside);
    });

    test("getLabelPlacement_Around_Around", () => {

        expect(Subdivisions.getLabelPlacement({ subdivisionLabelPlacement: "around" }))
            .toBe(Subdivisions.LABEL_PLACEMENTS.Around);
    });

    test("areLabelsAround_PiesAround_True", () => {

        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 1,
            series: PIE_SERIES,
            subdivisionLabelPlacement: "around"
        };

        expect(Subdivisions.areLabelsAround(props)).toBe(true);
    });

    test("areLabelsAround_BarsAround_False", () => {

        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 0,
            subdivisionLabelPlacement: "around"
        };

        expect(Subdivisions.areLabelsAround(props)).toBe(false);
    });

    test("areLabelsAround_NoLabels_False", () => {

        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 1,
            series: PIE_SERIES,
            subdivisionLabels: "none",
            subdivisionLabelPlacement: "around"
        };

        expect(Subdivisions.areLabelsAround(props)).toBe(false);
    });

    test("takeAroundLabels_Around_TakesPendingLabels", () => {

        const pendingLabels = [{ fullText: "A", pie: {} }];
        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 1,
            series: PIE_SERIES,
            subdivisionLabelPlacement: "around",
            subdivisionPendingLabels: pendingLabels
        };

        const taken = Subdivisions.takeAroundLabels(props);

        expect(taken).toEqual(pendingLabels);
        expect(props.subdivisionPendingLabels).toBeNull();
    });

    test("takeAroundLabels_PiesBesideBars_LeavesBarsLabels", () => {

        const pieLabel = { fullText: "A", pie: {} };
        const barLabel = { fullText: "B", barNode: {} };
        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 1,
            series: PIE_SERIES,
            subdivisionLabelPlacement: "around",
            subdivisionPendingLabels: [pieLabel, barLabel]
        };

        expect(Subdivisions.takeAroundLabels(props)).toEqual([pieLabel]);
        expect(props.subdivisionPendingLabels).toEqual([barLabel]);
    });

    test("takeAroundLabels_Inside_LeavesPendingLabels", () => {

        const pendingLabels = [{ fullText: "A" }];
        const props = {
            subdivideColumn: COLUMN,
            seriesCount: 1,
            series: PIE_SERIES,
            subdivisionPendingLabels: pendingLabels
        };

        const taken = Subdivisions.takeAroundLabels(props);

        expect(taken).toEqual([]);
        expect(props.subdivisionPendingLabels).toBe(pendingLabels);
    });

    test("getSubdivisions_RowsOfSeveralValues_AggregatedLargestFirstWithShares", () => {

        const { props, row } = buildChart([
            buildRow("A", 10),
            buildRow("B", 50),
            buildRow("A", 20),
            buildRow("C", 20)
        ]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions.map(s => s.label)).toEqual(["B", "A", "C"]);
        expect(subdivisions.map(s => s.value)).toEqual([50, 30, 20]);
        expect(subdivisions.map(s => s.share)).toEqual([0.5, 0.3, 0.2]);
    });

    test("getSubdivisions_EachValue_NamesTheColumnValueItCovers", () => {

        const { props, row } = buildChart([buildRow("A", 10), buildRow("B", 50)]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions.map(s => s.columnValues)).toEqual([["B"], ["A"]]);
    });

    test("getSubdivisions_NumericColumnsNull_FiltersAndReadsAsNull", () => {

        const { props, row } = buildChart([buildRow(null, 10), buildRow(5, 50)]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions[0].columnValues).toEqual(["5"]);
        expect(subdivisions[1].columnValues).toEqual([Ren.NullSentinel]);
        expect(subdivisions[1].label).toBe(Ren.NullSentinelDisplayLabel);
    });

    test("getSubdivisions_EmptyString_StaysAnEmptyStringValue", () => {

        const { props, row } = buildChart([buildRow("", 10)]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions[0].columnValues).toEqual([""]);
        expect(subdivisions[0].label).toBe(Ren.EmptyStringDisplayLabel);
    });

    test("getSubdivisions_MoreThanAreDrawn_OtherNamesEveryValueGathered", () => {

        const count = Subdivisions.MAX_SUBDIVISIONS + 2;
        const rows = [];

        for (let index = 0; index < count; index++) {
            rows.push(buildRow("V" + index, count - index));
        }

        const { props, row } = buildChart(rows);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);
        const other = subdivisions[subdivisions.length - 1];

        expect(subdivisions.length).toBe(Subdivisions.MAX_SUBDIVISIONS);
        expect(other.label).toBe(Ren.DateValueChart_SeriesSplit.OTHER_LABEL);
        expect(other.columnValues).toEqual(
            ["V" + (count - 3), "V" + (count - 2), "V" + (count - 1)]
        );
    });

    test("getMarkSubdivision_ElementIsNoBand_Null", () => {

        expect(Subdivisions.getMarkSubdivision(document.createElement("div"))).toBeNull();
    });

    test("getMarkSubdivision_ElementIsBandLabel_LabelsSubdivision", () => {

        const subdivision = { label: "Paper", columnValues: ["Paper"] };

        const props = {
            chartGroup: document.createElementNS("http://www.w3.org/2000/svg", "g"),
            subdivisionPendingLabels: [{ seriesIndex: 0, subdivision, fullText: "40%" }]
        };

        Subdivisions.renderLabels(props);

        const textNode = props.subdivisionLabelNodes[0].textNode;

        expect(Subdivisions.getMarkSubdivision(textNode)).toBe(subdivision);
    });

    test("getSubdivisions_NegativeTotal_KeepsOnlyNegativeValues", () => {

        const { props, row } = buildChart([
            buildRow("A", -30),
            buildRow("B", 10),
            buildRow("C", -10)
        ]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions.map(s => s.label)).toEqual(["A", "C"]);
        expect(subdivisions.map(s => s.share)).toEqual([0.75, 0.25]);
    });

    test("getSubdivisions_PositiveTotal_LeavesOutZeroAndNegativeValues", () => {

        const { props, row } = buildChart([
            buildRow("A", 30),
            buildRow("B", 0),
            buildRow("C", -10)
        ]);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);

        expect(subdivisions.map(s => s.label)).toEqual(["A"]);
        expect(subdivisions[0].share).toBe(1);
    });

    test("getSubdivisions_MoreValuesThanDrawn_SmallestGathered", () => {

        const rows = [];

        for (let i = 0; i < Subdivisions.MAX_SUBDIVISIONS + 5; i++) {

            rows.push(buildRow("Value " + i, 100 - i));
        }

        const { props, row } = buildChart(rows);

        const subdivisions = Subdivisions.getSubdivisions(props, row, 0);
        const last = subdivisions[subdivisions.length - 1];

        expect(subdivisions.length).toBe(Subdivisions.MAX_SUBDIVISIONS);
        expect(last.label).toBe(Ren.DateValueChart_SeriesSplit.OTHER_LABEL);

        // The 19 largest are 100 down to 82, leaving 81 down to 76 to gather.
        expect(last.value).toBe(81 + 80 + 79 + 78 + 77 + 76);
    });

    test("getSubdivisions_RowsLackColumn_None", () => {

        const { props, row } = buildChart([{ [VALUE_HEADING]: 10 }]);

        expect(Subdivisions.getSubdivisions(props, row, 0)).toEqual([]);
    });

    test("getSubdivisions_NoAggregatedRows_None", () => {

        const { props, row } = buildChart([]);

        GroupingApplyer.getAggregatedRows.mockReturnValue(null);

        expect(Subdivisions.getSubdivisions(props, row, 0)).toEqual([]);
    });

    test("getSubdivisions_ColumnIsValueColumn_None", () => {

        const { props, row } = buildChart([buildRow("A", 10)]);

        props.subdivideColumn = VALUE_HEADING;

        expect(Subdivisions.getSubdivisions(props, row, 0)).toEqual([]);
    });

    test("getSubdivisions_SameRowsAgain_SameSubdivisions", () => {

        const { props, row } = buildChart([buildRow("A", 10)]);

        expect(Subdivisions.getSubdivisions(props, row, 0))
            .toBe(Subdivisions.getSubdivisions(props, row, 0));
    });

    test("parseBarPath_PlainBar_XYWidthAndHeight", () => {

        expect(Subdivisions.parseBarPath("M-5,0h10v40h-10Z"))
            .toEqual({ x: -5, y: 0, width: 10, height: 40 });
    });

    test("parseBarPath_StackedBar_XYWidthAndHeight", () => {

        expect(Subdivisions.parseBarPath("M 0,0 h 10 v -40 h -10 Z"))
            .toEqual({ x: 0, y: 0, width: 10, height: -40 });
    });

    test("parseBarPath_SomethingElse_Null", () => {

        expect(Subdivisions.parseBarPath("M0,-1A1,1 0 0 1 1,0L0,0Z")).toBeNull();
    });

    test("getBarMarkPath_FirstQuarter_NextToBaseline", () => {

        const bar = { x: -5, y: 0, width: 10, height: 40 };

        expect(Subdivisions.getBarMarkPath(bar, 0, 0.25)).toBe("M-5,30h10V40h-10Z");
    });

    test("getBarMarkPath_LastQuarter_AtFarEnd", () => {

        const bar = { x: -5, y: 0, width: 10, height: 40 };

        expect(Subdivisions.getBarMarkPath(bar, 0.75, 1)).toBe("M-5,0h10V10h-10Z");
    });

    test("getBarMarkPath_BarHangingDown_NextToBaselineAboveIt", () => {

        const bar = { x: -5, y: 0, width: 10, height: -40 };

        expect(Subdivisions.getBarMarkPath(bar, 0, 0.25)).toBe("M-5,-30h10V-40h-10Z");
    });

    test("getBarGroovePath_TwoShares_LineAcrossBarAtEach", () => {

        const bar = { x: -5, y: 0, width: 10, height: 40 };

        expect(Subdivisions.getBarGroovePath(bar, [0.25, 0.75])).toBe("M-5,30h10M-5,10h10");
    });

    test("getBarGroovePath_NoShares_Empty", () => {

        const bar = { x: -5, y: 0, width: 10, height: 40 };

        expect(Subdivisions.getBarGroovePath(bar, [])).toBe("");
    });

    test("getPieGroove_WithHole_FromHoleToRim", () => {

        expect(Subdivisions.getPieGroove(Math.PI / 2, 0.5).path).toBe("M500,0L1000,0");
    });

    test("getPieGroove_NoHole_FromCentreToRim", () => {

        expect(Subdivisions.getPieGroove(Math.PI, 0).path).toBe("M0,0L0,1000");
    });

    test("getPieGroove_LevelGroove_HighlightBelow", () => {

        const groove = Subdivisions.getPieGroove(Math.PI / 2, 0);

        expect([groove.normalX + 0, groove.normalY]).toEqual([0, 1]);
    });

    test("getPieGroove_UprightGroove_HighlightRight", () => {

        const groove = Subdivisions.getPieGroove(Math.PI, 0);

        expect([groove.normalX, groove.normalY + 0]).toEqual([1, 0]);
    });

    test("buildScaleStyles_UnevenScale_HighlightMovedOneScreenPixel", () => {

        const rules = Subdivisions.buildScaleStyles(2, 0.5);

        expect(rules[0]).toContain("var(--ren-groove-x, 0) * 0.5px");
        expect(rules[0]).toContain("var(--ren-groove-y, 1) * 2px");
    });

    test("buildScaleStyles_NoScale_None", () => {

        expect(Subdivisions.buildScaleStyles(0, 1)).toEqual([]);
    });

    describe("getLabelText", () => {

        const props = (content) => ({ subdivisionLabels: content, valueColumnFormats: [null] });
        const subdivision = { label: "A", value: 12, share: 1 };

        test("getLabelText_None_Null", () => {

            expect(Subdivisions.getLabelText(props("none"), 0, subdivision)).toBeNull();
        });

        test("getLabelText_Names_Label", () => {

            expect(Subdivisions.getLabelText(props("names"), 0, subdivision)).toBe("A");
        });

        test("getLabelText_Values_FormattedValue", () => {

            expect(Subdivisions.getLabelText(props("values"), 0, subdivision)).toBe("12");
        });

        test("getLabelText_Both_LabelThenValue", () => {

            expect(Subdivisions.getLabelText(props("both"), 0, subdivision)).toBe("A 12");
        });
    });

    describe("chooseBarLabelFit", () => {

        // "Name" is 40px whole; prefixLengths[n] is its first n characters and an ellipsis.
        const fit = (bandWidthPx, bandHeightPx) => Subdivisions.chooseBarLabelFit({
            fullText: "Name",
            prefixLengths: [undefined, 14, 24, 34, 40],
            thickness: 10,
            bandWidthPx,
            bandHeightPx
        });

        test("chooseBarLabelFit_RoomBothWays_WholeAndLevel", () => {

            expect(fit(100, 100)).toEqual({ text: "Name", isVertical: false });
        });

        test("chooseBarLabelFit_NarrowTallBand_WholeAndUpright", () => {

            expect(fit(20, 100)).toEqual({ text: "Name", isVertical: true });
        });

        test("chooseBarLabelFit_WideShortBand_WholeAndLevel", () => {

            expect(fit(100, 12)).toEqual({ text: "Name", isVertical: false });
        });

        test("chooseBarLabelFit_ShortBothWays_ShortenedToShowMost", () => {

            expect(fit(32, 22)).toEqual({ text: "Na…", isVertical: false });
        });

        test("chooseBarLabelFit_MoreRoomUpright_ShortenedUpright", () => {

            expect(fit(22, 32)).toEqual({ text: "Na…", isVertical: true });
        });

        test("chooseBarLabelFit_TooThinBothWays_Null", () => {

            expect(fit(8, 8)).toBeNull();
        });

        test("chooseBarLabelFit_NoRoomForAnyCharacter_Null", () => {

            expect(fit(12, 12)).toBeNull();
        });
    });

    test("getPieTextOptions_LongText_WholeThenShorter", () => {

        const prefixLengths = [undefined];

        for (let i = 1; i <= 8; i++) prefixLengths[i] = i * 10;

        const options = Subdivisions.getPieTextOptions("Abcdefgh", prefixLengths);

        expect(options.map(o => o.text)).toEqual(["Abcdefgh", "Abcdef…", "Abcd…", "Abc…"]);
        expect(options[0].width).toBe(80);
        expect(options[3].width).toBe(30);
    });

    test("getPieTextOptions_SingleCharacter_WholeOnly", () => {

        const options = Subdivisions.getPieTextOptions("A", [undefined, 10]);

        expect(options).toEqual([{ text: "A", width: 10 }]);
    });

    describe("choosePieLabelFit", () => {

        const fit = (slice, width, boxes) => Subdivisions.choosePieLabelFit({
            textOptions: [{ text: "Name", width: width }],
            thickness: 10,
            centre: { x: 0, y: 0 },
            slice: slice,
            holePx: 0,
            radiusPx: 100,
            boxes: boxes || []
        });

        const halfPie = { startAngle: 0, endAngle: Math.PI };

        test("choosePieLabelFit_RoomInBand_AtMiddleAngle", () => {

            const placed = fit(halfPie, 20);

            expect(placed.text).toBe("Name");
            expect(placed.x).toBeCloseTo(70);
            expect(placed.y).toBeCloseTo(0);
        });

        test("choosePieLabelFit_TooWideForBand_Null", () => {

            expect(fit({ startAngle: 0, endAngle: 0.05 }, 40)).toBeNull();
        });

        test("choosePieLabelFit_FirstSpotTaken_NextDistance", () => {

            const taken = [{ left: 61, right: 90, top: -10, bottom: 10 }];

            expect(fit(halfPie, 10, taken).x).toBeCloseTo(55);
        });

        test("choosePieLabelFit_EverySpotTaken_Null", () => {

            const taken = [{ left: -100, right: 100, top: -100, bottom: 100 }];

            expect(fit(halfPie, 10, taken)).toBeNull();
        });
    });

    test("buildColourStyles_DarkSeries_WhiteLabels", () => {

        const rules = Subdivisions.buildColourStyles(".ren-series-1", "#000080");

        expect(rules[0]).toContain("fill: white");
    });

    test("buildColourStyles_LightSeries_DarkLabels", () => {

        const rules = Subdivisions.buildColourStyles(".ren-series-1", "#ffff99");

        expect(rules[0]).toContain("fill: #222");
    });

    test("buildColourStyles_ReadableColour_GroovesShadesOfIt", () => {

        const rules = Subdivisions.buildColourStyles(".ren-series-1", "#0288D1").join("\n");
        const crease = Ren.Colours.shiftLightness("#0288D1", -16);
        const highlight = Ren.Colours.shiftLightness("#0288D1", 16);

        expect(rules).toContain(
            `.ren-series-1 .${Subdivisions.GROOVE_CLASS} { stroke: ${crease} }`
        );
        expect(rules).toContain(
            `.ren-series-1 .${Subdivisions.GROOVE_HIGHLIGHT_CLASS} { stroke: ${highlight} }`
        );
    });

    test("buildColourStyles_Filtered_GroovesShadesOfColourDrawn", () => {

        const rules = Subdivisions.buildColourStyles(".ren-series-1", "#0288D1", "brightness(0.5)")
            .join("\n");
        const drawn = Ren.Colours.applyFilter("#0288D1", "brightness(0.5)");

        expect(rules).toContain(`stroke: ${Ren.Colours.shiftLightness(drawn, -16)}`);
    });

    test("buildColourStyles_UnreadableColour_NoGrooveRules", () => {

        const rules = Subdivisions.buildColourStyles(".ren-series-1", "url(#gradient)");

        expect(rules.length).toBe(1);
    });

    test("buildStyles_BarChart_BandsUnborderedOverTheirBars", () => {

        const rules = Subdivisions.buildStyles({});
        const markRule = rules.find(rule => rule.startsWith("." + Subdivisions.BAR_MARK_CLASS));

        expect(markRule).toContain("fill: var(--ren-subdivision-shade, transparent)");
        expect(markRule).toContain("stroke: none");
    });

    test("getBandShade_OneBand_LeftInTheSeriesColour", () => {

        expect(Subdivisions.getBandShade(0, 1)).toBeNull();
    });

    test("getBandShade_TwoBands_DarkestThenLightest", () => {

        expect(Subdivisions.getBandShade(0, 2)).toBe("rgba(0, 0, 0, 0.2)");
        expect(Subdivisions.getBandShade(1, 2)).toBe("rgba(255, 255, 255, 0.26)");
    });

    test("getBandShade_ThreeBands_DarkestLightestThenTheColourItself", () => {

        expect(Subdivisions.getBandShade(0, 3)).toBe("rgba(0, 0, 0, 0.2)");
        expect(Subdivisions.getBandShade(1, 3)).toBe("rgba(255, 255, 255, 0.26)");
        expect(Subdivisions.getBandShade(2, 3)).toBeNull();
    });

    test("getBandShade_ManyBands_NeighboursAlternateDarkerAndLighter", () => {

        const count = Subdivisions.MAX_SUBDIVISIONS;
        const shades = [];

        for (let i = 0; i < count; i++) shades.push(Subdivisions.getBandShade(i, count));

        for (let i = 0; i < count; i++) {
            expect(shades[i].startsWith(i % 2 === 0 ? "rgba(0," : "rgba(255,")).toBe(true);
        }

        expect(shades[0]).toBe("rgba(0, 0, 0, 0.2)");
        expect(shades[count - 1]).toBe("rgba(255, 255, 255, 0.26)");
        expect(new Set(shades).size).toBe(count);
    });

    test("buildStyles_BarChart_GroovesDarkCreaseAndLightHighlight", () => {

        const rules = Subdivisions.buildStyles({});
        const findRule = (className) => rules.find(rule => rule.startsWith(`.${className} `));
        const creaseRule = findRule(Subdivisions.GROOVE_CLASS);
        const highlightRule = findRule(Subdivisions.GROOVE_HIGHLIGHT_CLASS);

        expect(creaseRule).toContain("stroke: rgba(0, 0, 0,");
        expect(creaseRule).toContain("pointer-events: none");
        expect(highlightRule).toContain("stroke: rgba(255, 255, 255,");
        expect(highlightRule).toContain("pointer-events: none");
    });

    test("buildStyles_Pies_PieLabelFontSize", () => {

        const rules = Subdivisions.buildStyles({ series: PIE_SERIES, pieLabelFontSize: 15 }).join("");

        expect(rules).toContain("font-size: 15px");
    });

    test("buildStyles_Bars_NamesInBarsFontSize", () => {

        const rules = Subdivisions.buildStyles({ seriesNamesInBarsFontSize: 17 }).join("");

        expect(rules).toContain("font-size: 17px");
    });
});

describe("Ren.DateValueChart_InputColumns subdivisions", () => {

    test("getRequiredColumnIndexes_SubdivideColumnChosen_Included", () => {

        const columnResolver = {
            getColumnIndex: (column) => ({ Date: 0, Revenue: 1, Category: 2 })[column]
        };

        const indexes = Ren.DateValueChart_InputColumns.getRequiredColumnIndexes(
            {
                selectedColumns: [0, 1],
                subdivideColumn: "Category",
                series: []
            },
            { columnResolver, ColumnModels: [{}, {}, {}] }
        );

        // Null means every column is read, which includes it too.
        expect(indexes === null || indexes.indexOf(2) !== -1).toBe(true);
    });
});
