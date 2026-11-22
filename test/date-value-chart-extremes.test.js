describe("Ren.DateValueChart_Extremes", () => {

    const Extremes = Ren.DateValueChart_Extremes;

    test("getExtremeIndexes_Values_HighestAndLowest", () => {

        expect(Extremes.getExtremeIndexes([3, 9, 1, 5])).toEqual({ highest: 1, lowest: 2 });
    });

    test("getExtremeIndexes_Ties_FirstOfEach", () => {

        expect(Extremes.getExtremeIndexes([2, 7, 2, 7])).toEqual({ highest: 1, lowest: 0 });
    });

    test("getExtremeIndexes_MissingValues_Skipped", () => {

        expect(Extremes.getExtremeIndexes([null, 4, undefined, NaN, 6]))
            .toEqual({ highest: 4, lowest: 1 });
    });

    test("getExtremeIndexes_AllTheSame_NoLowest", () => {

        expect(Extremes.getExtremeIndexes([4, 4, 4])).toEqual({ highest: 0, lowest: null });
    });

    test("getExtremeIndexes_NoValues_Neither", () => {

        expect(Extremes.getExtremeIndexes([null, "x"])).toEqual({ highest: null, lowest: null });
    });

    test("getMarkedValues_LastPeriodEstimated_EstimateInPlaceOfValueSoFar", () => {

        const rows = [{ v: 10 }, { v: 8 }, { v: 3 }];
        const props = {
            valueHeadings: ["v"],
            lastPeriodEstimates: [{ row: rows[2], estimatedValue: 12 }]
        };

        expect(Extremes.getMarkedValues(props, rows, 0)).toEqual([10, 8, 12]);
    });

    test("getMarkedValues_NoEstimate_ValuesAsTheyAre", () => {

        const rows = [{ v: 10 }, { v: 3 }];

        expect(Extremes.getMarkedValues({ valueHeadings: ["v"] }, rows, 0)).toEqual([10, 3]);
    });
});
