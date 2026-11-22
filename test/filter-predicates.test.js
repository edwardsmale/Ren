const { createSalesTabularData } = require("./helpers/tabular-data");

describe("FilterPredicates", () => {

    const FilterPredicates = Ren.FilterPredicates;

    let tabularData;

    beforeEach(() => {

        tabularData = createSalesTabularData();
    });

    /**
     * Gets whether each of the sales rows is excluded by the given predicates.
     */
    const readExclusions = (predicates) => {

        const isExcluded = FilterPredicates.compilePredicates(predicates, tabularData);
        const exclusions = [];

        for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {
            exclusions.push(isExcluded(rowIndex));
        }

        return exclusions;
    };

    test("compilePredicates_ExcludeCombinations_ExcludesTheListedTuples", () => {

        expect(readExclusions([{
            type: "excludeCombinations",
            columns: ["Region", "Product"],
            tuples: [["North", "Pens"], ["East", "Paper"]]
        }])).toEqual([true, false, false, true, false]);
    });

    test("compilePredicates_AShortTuple_MatchesEverythingBeneathIt", () => {

        expect(readExclusions([{
            type: "excludeCombinations",
            columns: ["Region", "Product"],
            tuples: [["South"]]
        }])).toEqual([false, true, false, false, true]);
    });

    test("compilePredicates_IncludeCombinations_KeepsOnlyTheListedTuples", () => {

        expect(readExclusions([{
            type: "includeCombinations",
            columns: ["Product"],
            tuples: [["Paper"]]
        }])).toEqual([true, true, false, false, true]);
    });

    test("compilePredicates_NoTuples_KeepsEveryRow", () => {

        expect(readExclusions([{ type: "excludeCombinations", columns: ["Region"], tuples: [] }]))
            .toEqual([false, false, false, false, false]);
    });

    test("compilePredicates_Compare_KeepsTheRowsThatPass", () => {

        // The missing figure doesn't pass a numeric comparison.
        expect(readExclusions([{
            type: "compare",
            column: "Sales",
            operator: "greaterThan",
            value: 6
        }])).toEqual([false, true, false, true, false]);
    });

    test("compilePredicates_CompareBetween_IncludesBothEnds", () => {

        expect(readExclusions([{
            type: "compare",
            column: "Sales",
            operator: "between",
            value: 5,
            value2: 10
        }])).toEqual([false, false, false, true, true]);
    });

    test("compilePredicates_TwoPredicates_AreAnded", () => {

        expect(readExclusions([
            { type: "includeCombinations", columns: ["Product"], tuples: [["Pens"]] },
            { type: "compare", column: "Sales", operator: "lessThan", value: 8 }
        ])).toEqual([true, false, true, true, true]);
    });

    test("compilePredicates_AFunction_KeepsTheRowsItReturnsTruthyFor", () => {

        expect(readExclusions([{
            type: "function",
            spec: "rowVals.Region === \"North\""
        }])).toEqual([false, true, false, true, true]);
    });

    test("compileRowObjectPredicates_ACombination_ReadsColumnsByName", () => {

        const isExcluded = FilterPredicates.compileRowObjectPredicates([{
            type: "excludeCombinations",
            columns: ["Region"],
            tuples: [["North"]]
        }]);

        expect(isExcluded({ Region: "North", Sales: 1 })).toBe(true);
        expect(isExcluded({ Region: "South", Sales: 1 })).toBe(false);
    });

    test("hasPredicates_AnEmptyList_ReturnsFalse", () => {

        expect(FilterPredicates.hasPredicates([])).toBe(false);
    });
});
