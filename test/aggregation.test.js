const Format = Ren.SpreadsheetColumnFormatEnum;
const Aggregation = Ren.AggregationTypeEnum;

describe("AggregationFns", () => {

    const aggregationFns = Ren.AggregationFns(null);

    const aggregate = (aggregationType, values, orderKeys) => aggregationFns.aggFunc(
        Format.General,
        aggregationType
    )(values, 0, 0, values.length, 0, true, orderKeys === undefined ? null : orderKeys);

    test("aggFunc_Sum_ReturnsTheTotalAsAString", () => {

        expect(aggregate(Aggregation.Sum, [1, 2.5, null, 3])).toBe("6.5");
    });

    test("aggFunc_SumOfNoValues_ReturnsTheNullSentinel", () => {

        expect(aggregate(Aggregation.Sum, [null, null])).toBe(Ren.NullSentinel);
    });

    test("aggFunc_Average_IgnoresBlanks", () => {

        expect(aggregate(Aggregation.Average, [2, null, "", 4])).toBe("3");
    });

    test("aggFunc_AverageOfNoValues_ReturnsNull", () => {

        expect(aggregate(Aggregation.Average, [null, ""])).toBeNull();
    });

    test("aggFunc_MinAndMax_SkipBlanks", () => {

        const values = [5, null, -2, "", 9];

        expect(aggregate(Aggregation.Min, values)).toBe(-2);
        expect(aggregate(Aggregation.Max, values)).toBe(9);
    });

    test("aggFunc_MinOfNoValues_ReturnsTheNullSentinel", () => {

        expect(aggregate(Aggregation.Min, [null])).toBe(Ren.NullSentinel);
    });

    test("aggFunc_Concatenate_ReturnsTheNonBlankValues", () => {

        expect(aggregate(Aggregation.Concatenate, ["a", null, "", "b", "a"]))
            .toEqual(["a", "b", "a"]);
    });

    test("aggFunc_FirstAndLastWithOrderKeys_FollowTheKeys", () => {

        const values = ["b", "c", "a"];
        const orderKeys = [2, 3, 1];

        expect(aggregate(Aggregation.First, values, orderKeys)).toBe("a");
        expect(aggregate(Aggregation.Last, values, orderKeys)).toBe("c");
    });

    test("aggFunc_FirstWithoutOrderKeys_FollowsRowOrder", () => {

        expect(aggregate(Aggregation.First, [null, "x", "y"])).toBe("x");
    });

    test("aggFunc_MedianOfAnEvenCount_AveragesTheMiddlePair", () => {

        expect(Number(aggregate(Aggregation.Median, [4, 1, 3, 2]))).toBe(2.5);
    });

    test("aggFunc_NullTypeForANumber_Sums", () => {

        const sum = aggregationFns.aggFunc(Format.Number, null);

        expect(sum([1, 2], 0, 0, 2, 0, true, null)).toBe("3");
    });

    test("aggFunc_NullTypeForText_Concatenates", () => {

        const concatenate = aggregationFns.aggFunc(Format.General, null);

        expect(concatenate(["a", "b"], 0, 0, 2, 0, true, null)).toEqual(["a", "b"]);
    });

    test("aggFunc_ARange_OnlyAggregatesThatRange", () => {

        const sum = aggregationFns.aggFunc(Format.Number, Aggregation.Sum);

        expect(sum([100, 1, 2, 100], 0, 1, 3, 0, true, null)).toBe("3");
    });
});

describe("AggregationFns over compressed values", () => {

    // Index 0 is the null sentinel, as in a real dictionary that holds one.
    const dictionary = [Ren.NullSentinel, "Ink", "Paper", "Pens"];
    const decompressValue = (value) => dictionary[value];

    const aggregationFns = Ren.AggregationFns(decompressValue, dictionary.length);

    const aggregate = (aggregationType, values) => aggregationFns.aggFunc(
        Format.General,
        aggregationType
    )(values, 0, 0, values.length, 0, true, null);

    test("aggFunc_MinAndMax_SkipTheNullIndexAndDecompress", () => {

        const values = [3, 0, 2, 3];

        expect(aggregate(Aggregation.Min, values)).toBe("Paper");
        expect(aggregate(Aggregation.Max, values)).toBe("Pens");
    });

    test("aggFunc_CountDistinct_CountsEachValueOnce", () => {

        expect(aggregate(Aggregation.CountDistinct, [3, 2, 3, 1, 2])).toBe("3");
    });

    test("aggFunc_MostCommon_ReturnsTheCommonestValues", () => {

        expect(aggregate(Aggregation.MostCommon, [3, 2, 3, 1])).toEqual(["Pens"]);
    });
});
