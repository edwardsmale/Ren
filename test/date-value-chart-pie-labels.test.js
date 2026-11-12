describe("Ren.DateValueChart_PieLabels", () => {

    const PieLabels = Ren.DateValueChart_PieLabels;

    const props = {
        series: [{ label: "North" }, {}],
        valueHeadings: ["North", "South"],
        valueColumnFormats: [undefined, undefined]
    };

    const slice = { seriesIndex: 1, value: 250, share: 0.25, startAngle: 0, endAngle: Math.PI };

    test("getPlacement_Unknown_Outside", () => {

        expect(PieLabels.getPlacement({ pieLabels: "sideways" }))
            .toBe(PieLabels.PLACEMENTS.Outside);
    });

    test("getContent_Unset_NamesAndPercentages", () => {

        expect(PieLabels.getContent({}))
            .toEqual({ names: true, values: false, percentages: true });
    });

    test("areLabelsShown_NothingToSay_False", () => {

        const labelProps = { showAsPies: true, pieLabelNames: false, pieLabelPercentages: false };

        expect(PieLabels.areLabelsShown(labelProps)).toBe(false);
    });

    test("areTotalsShown_NoHole_False", () => {

        expect(PieLabels.areTotalsShown({ showAsPies: true })).toBe(false);
    });

    test("areTotalsShown_Hole_True", () => {

        expect(PieLabels.areTotalsShown({ showAsPies: true, pieHoleRadius: 0.5 })).toBe(true);
    });

    test("areSharesInside_Unset_True", () => {

        expect(PieLabels.areSharesInside({ showAsPies: true })).toBe(true);
    });

    test("areSharesInside_Around_True", () => {

        const shareProps = { showAsPies: true, pieLabels: "around", pieSharesInside: true };

        expect(PieLabels.areSharesInside(shareProps)).toBe(true);
    });

    test("areSharesInside_TurnedOff_False", () => {

        const shareProps = { showAsPies: true, pieSharesInside: false };

        expect(PieLabels.areSharesInside(shareProps)).toBe(false);
    });

    test("areSharesInside_Auto_False", () => {

        const shareProps = { showAsPies: true, pieLabels: "auto", pieSharesInside: true };

        expect(PieLabels.areSharesInside(shareProps)).toBe(false);
    });

    test("areSharesInside_PercentagesOff_False", () => {

        const shareProps = {
            showAsPies: true,
            pieLabels: "outside",
            pieLabelNames: true,
            pieLabelPercentages: false,
            pieSharesInside: true
        };

        expect(PieLabels.areSharesInside(shareProps)).toBe(false);
    });

    test("formatShare_UnderTenPercent_OneDecimalPlace", () => {

        expect(PieLabels.formatShare(0.0456)).toBe("4.6%");
    });

    test("formatShare_TenPercentOrMore_Whole", () => {

        expect(PieLabels.formatShare(0.374)).toBe("37%");
    });

    test("formatShare_Tiny_LessThanOneTenth", () => {

        expect(PieLabels.formatShare(0.0001)).toBe("<0.1%");
    });

    test("getShareCandidates_Decimal_SmallerThenRounded", () => {

        const share = { slice: { share: 0.047 }, size: { width: 40, height: 10 } };
        const candidates = PieLabels.getShareCandidates(share);

        expect(candidates.map(c => c.lines.join("/") + "@" + c.fontScale))
            .toEqual(["4.7%@1", "4.7%@0.85", "4.7%@0.72", "5%@1", "5%@0.85", "5%@0.72"]);
        expect(candidates[3].size).toEqual({ width: 20, height: 10 });
    });

    test("getShareCandidates_Whole_NotRoundedAgain", () => {

        const share = { slice: { share: 0.37 }, size: { width: 30, height: 10 } };

        expect(PieLabels.getShareCandidates(share).length).toBe(3);
    });

    test("getLabelText_PercentageOnly_Share", () => {

        const content = { names: false, values: false, percentages: true };

        expect(PieLabels.getLabelText(props, content, slice)).toBe("25%");
    });

    test("getLabelText_Everything_NameValueAndBracketedShare", () => {

        const content = { names: true, values: true, percentages: true };

        expect(PieLabels.getLabelText(props, content, slice)).toMatch(/^South: .*250.* \(25%\)$/);
    });

    test("getLabelText_SeriesFormatFunction_ValueFormattedByIt", () => {

        const content = { names: false, values: true, percentages: false };
        const formattedProps = Object.assign({}, props, {
            valueColumnFormatFunctions: [null, [value => `£${value / 1000}k`]]
        });

        expect(PieLabels.getLabelText(formattedProps, content, slice)).toBe("£0.25k");
    });

    test("getLabelText_FormatFunctionGivesHtml_PlainText", () => {

        const content = { names: false, values: true, percentages: false };
        const formattedProps = Object.assign({}, props, {
            valueColumnFormatFunctions: [null, [value => `<b>${value}</b> &amp; more`]]
        });

        expect(PieLabels.getLabelText(formattedProps, content, slice)).toBe("250 & more");
    });

    test("getLabelText_NameOnly_SeriesLabel", () => {

        const content = { names: true, values: false, percentages: false };
        const firstSlice = Object.assign({}, slice, { seriesIndex: 0 });

        expect(PieLabels.getLabelText(props, content, firstSlice)).toBe("North");
    });

    test("getValuePosition_Unset_Inline", () => {

        expect(PieLabels.getValuePosition({})).toBe(PieLabels.VALUE_POSITIONS.Inline);
    });

    test("getValuePosition_InsideWithLabelsInside_Inline", () => {

        const positionProps = { pieLabels: "inside", pieValuePosition: "inside" };

        expect(PieLabels.getValuePosition(positionProps)).toBe(PieLabels.VALUE_POSITIONS.Inline);
    });

    test("getValuePosition_InsideWithLabelsAround_Inside", () => {

        const positionProps = { pieLabels: "around", pieValuePosition: "inside" };

        expect(PieLabels.getValuePosition(positionProps)).toBe(PieLabels.VALUE_POSITIONS.Inside);
    });

    test("areValuesInside_ValuesOff_False", () => {

        const insideProps = { showAsPies: true, pieValuePosition: "inside" };

        expect(PieLabels.areValuesInside(insideProps)).toBe(false);
    });

    test("areValuesInside_ValuesOnInside_True", () => {

        const insideProps = { showAsPies: true, pieLabelValues: true, pieValuePosition: "inside" };

        expect(PieLabels.areValuesInside(insideProps)).toBe(true);
    });

    test("getLabelLines_Below_NameThenValueAndShare", () => {

        const content = { names: true, values: true, percentages: true };
        const lines = PieLabels.getLabelLines(
            Object.assign({ pieValuePosition: "below" }, props),
            content,
            slice
        );

        expect(lines.length).toBe(2);
        expect(lines[0]).toBe("South");
        expect(lines[1]).toMatch(/^.*250.* \(25%\)$/);
    });

    test("getLabelLines_BelowWithNothingAfterName_NameOnly", () => {

        const content = { names: true, values: false, percentages: false };
        const lines = PieLabels.getLabelLines(
            Object.assign({ pieValuePosition: "below" }, props),
            content,
            slice
        );

        expect(lines).toEqual(["South"]);
    });

    test("getLabelLines_Inline_OneLine", () => {

        const content = { names: true, values: true, percentages: true };

        expect(PieLabels.getLabelLines(props, content, slice).length).toBe(1);
    });

    test("getShareCandidates_ValueAboveShare_ValueLineKept", () => {

        const share = {
            slice: { share: 0.047 },
            valueText: "1,234",
            hasShare: true,
            size: { width: 50, height: 20, lineWidths: [50, 40] }
        };
        const candidates = PieLabels.getShareCandidates(share);

        expect(candidates[0].lines).toEqual(["1,234", "4.7%"]);
        expect(candidates[3].lines).toEqual(["1,234", "5%"]);
        expect(candidates[3].size).toEqual({ width: 50, height: 20 });
    });

    test("getShareCandidates_ValueOnly_SmallerOnly", () => {

        const share = {
            slice: { share: 0.047 },
            valueText: "1,234",
            hasShare: false,
            size: { width: 50, height: 10, lineWidths: [50] }
        };
        const candidates = PieLabels.getShareCandidates(share);

        expect(candidates.map(c => c.lines.join("/") + "@" + c.fontScale))
            .toEqual(["1,234@1", "1,234@0.85", "1,234@0.72"]);
        expect(candidates[0].size).toEqual({ width: 50, height: 10 });
    });

    // A right half-pie of radius 100, centred on the origin.
    const halfSlice = { startAngle: 0, endAngle: Math.PI };
    const centre = { x: 0, y: 0 };

    test("isBoxInSlice_WithinHalf_True", () => {

        const box = { left: 40, right: 70, top: -5, bottom: 5 };

        expect(PieLabels.isBoxInSlice(box, centre, halfSlice, 0, 100)).toBe(true);
    });

    test("isBoxInSlice_AcrossStraightEdge_False", () => {

        const box = { left: -10, right: 30, top: 40, bottom: 50 };

        expect(PieLabels.isBoxInSlice(box, centre, halfSlice, 0, 100)).toBe(false);
    });

    test("isBoxInSlice_BeyondRim_False", () => {

        const box = { left: 80, right: 110, top: -5, bottom: 5 };

        expect(PieLabels.isBoxInSlice(box, centre, halfSlice, 0, 100)).toBe(false);
    });

    test("isBoxInSlice_IntoHole_False", () => {

        const box = { left: 40, right: 70, top: -5, bottom: 5 };

        expect(PieLabels.isBoxInSlice(box, centre, halfSlice, 50, 100)).toBe(false);
    });

    // Each character 10px long, and the ellipsis 5px.
    const prefixLengths = [undefined, 15, 25, 35, 40];

    test("fitText_Fits_Whole", () => {

        expect(PieLabels.fitText("East", prefixLengths, 40)).toBe("East");
    });

    test("fitText_TooLong_ShortenedWithEllipsis", () => {

        expect(PieLabels.fitText("East", prefixLengths, 30)).toBe("Ea…");
    });

    test("fitText_NoRoomForOneCharacter_Null", () => {

        expect(PieLabels.fitText("East", prefixLengths, 10)).toBeNull();
    });

    test("getRadiusPx_NotAround_Widest", () => {

        expect(PieLabels.getRadiusPx({}, 90, 200)).toBe(90);
    });

    test("getRadiusPx_Around_NarrowedForColumns", () => {

        // Half the period, less a 60px column and 2px padding.
        expect(PieLabels.getRadiusPx({ pieCalloutWidthPx: 60 }, 90, 300)).toBe(88);
    });

    test("getRadiusPx_AroundWithoutRoom_ShrunkNoFurtherThanMinimumShare", () => {

        expect(PieLabels.getRadiusPx({ pieCalloutWidthPx: 60 }, 100, 100)).toBe(85);
    });

    test("getRadiusPx_ValuesNotFittingAtMinimumShare_ShrunkToFitThem", () => {

        // Half the period, less the 80px the values need and 2px padding.
        const props = { pieCalloutWidthPx: 160, pieCalloutMinWidthEstimatePx: 80, pieLabelNodes: [] };

        expect(PieLabels.getRadiusPx(props, 100, 300)).toBe(68);
    });

    test("getRadiusPx_ValuesNotFittingAtAll_ShrunkToHalf", () => {

        const props = { pieCalloutWidthPx: 160, pieCalloutMinWidthEstimatePx: 80, pieLabelNodes: [] };

        expect(PieLabels.getRadiusPx(props, 100, 200)).toBe(50);
    });

    test("getRadiusPx_ValuesFittingAtMinimumShare_ShrunkNoFurther", () => {

        const props = { pieCalloutWidthPx: 160, pieCalloutMinWidthEstimatePx: 80, pieLabelNodes: [] };

        expect(PieLabels.getRadiusPx(props, 100, 400)).toBe(85);
    });

    test("isBoxInSlice_WholePieWithoutHole_CentreAllowed", () => {

        const box = { left: -20, right: 20, top: -5, bottom: 5 };
        const wholeSlice = { startAngle: 0, endAngle: Math.PI * 2 };

        expect(PieLabels.isBoxInSlice(box, centre, wholeSlice, 0, 100)).toBe(true);
    });

    describe("getHuggingEdgeX", () => {

        // Two pies of radius 100, 300px apart, in a 600px-wide plot with 20px margins.
        const leftPie = { screenCentre: { x: 150, y: 150 } };
        const rightPie = { screenCentre: { x: 450, y: 150 } };
        const edgeProps = {
            innerWidth: 600,
            scaleX: 1,
            margin: { left: 20, right: 20 },
            pieLayout: [leftPie, rightPie]
        };

        const label = (pie, centreY) => ({ pie, centreY, size: { height: 20 } });

        test("getHuggingEdgeX_LevelWithNeighbour_StopsShortOfItsRimNotHalfway", () => {

            // 90px above the neighbour's centre, so kept 112px from it: 150 + √(112² - 90²).
            const edgeX = PieLabels.getHuggingEdgeX(
                edgeProps, label(rightPie, 50), 340, -1, 100, []);

            expect(edgeX).toBeCloseTo(150 + Math.sqrt(112 * 112 - 90 * 90), 6);
        });

        test("getHuggingEdgeX_ClearOfNeighbour_StopsAtItsCentre", () => {

            expect(PieLabels.getHuggingEdgeX(edgeProps, label(rightPie, 20), 340, -1, 100, []))
                .toBe(150);
        });

        test("getHuggingEdgeX_OutermostPie_RunsIntoMargin", () => {

            expect(PieLabels.getHuggingEdgeX(edgeProps, label(rightPie, 50), 560, 1, 100, []))
                .toBe(620);
        });

        test("getHuggingEdgeX_LabelPlacedInTheWay_StopsAtIt", () => {

            const placed = [{ left: 250, right: 300, top: 45, bottom: 55 }];

            expect(PieLabels.getHuggingEdgeX(edgeProps, label(rightPie, 50), 340, -1, 100, placed))
                .toBe(300);
        });

        test("getHuggingEdgeX_LabelPlacedAboveIt_Ignored", () => {

            const placed = [{ left: 250, right: 300, top: 0, bottom: 30 }];

            expect(PieLabels.getHuggingEdgeX(edgeProps, label(rightPie, 50), 340, -1, 100, placed))
                .toBe(150 + Math.sqrt(112 * 112 - 90 * 90));
        });
    });
});
