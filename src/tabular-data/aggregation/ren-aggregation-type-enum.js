/**
 * Copy of AggregationTypeEnum in the C# code.
 */
Ren.AggregationTypeEnum = Ren.DefineEnum({
    Sum: 0,
    Average: 1,
    Count: 2,
    CountDistinct: 3,
    Min: 4,
    Max: 5,
    Concatenate: 6,
    MostCommon: 7,
    DistinctValues: 8,
    DistinctValuesWithCounts: 9,
    NoTotal: 10,
    SingleValuesOnly: 11,
    SingleValueOrPlaceholder: 12,
    ExpandIcon: 13,
    ExpandIconAlways: 14,
    DistinctValuesIncludingEmpty: 15,
    DistinctValuesIncludingEmptyWithCounts: 16,
    ConcatenateIncludingEmpty: 17,
    First: 18,
    Last: 19,
    Median: 20
});
