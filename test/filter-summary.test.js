describe("Ren.FilterSummary", () => {

    const Summary = Ren.FilterSummary;

    const HEADINGS = ["Top-Level Category", "Sub Category", "Brand", "Sales", "Core"];

    const tabularData = {
        Title: "Data",
        columnResolver: {
            getColumnIndex: (column) => {

                const index = HEADINGS.indexOf(column);

                return index === -1 ? null : index;
            },
            getColumnHeading: (index) => HEADINGS[index]
        },
        ColumnModels: HEADINGS.map(heading => ({
            Heading: heading,
            ColumnFormat: heading === "Core"
                ? Ren.SpreadsheetColumnFormatEnum.Boolean
                : Ren.SpreadsheetColumnFormatEnum.General
        }))
    };

    const createColumnFilter = (values, isNegated) => ({
        valueMap: new Map(values.map(value => [String(value), value])),
        isNegated: isNegated === true
    });

    const createFilters = (columnFilters, predicates) => ({
        columnFilters: new Map(Object.entries(columnFilters ?? {})),
        predicates: predicates ?? []
    });

    test("getText_NoFilters_Empty", () => {

        expect(Summary.getText(createFilters(), tabularData)).toBe("");
        expect(Summary.getText(null, tabularData)).toBe("");
    });

    test("getText_ColumnFilter_NamesColumnAndValues", () => {

        const filters = createFilters({ Brand: createColumnFilter(["Acco", "Bic"]) });

        expect(Summary.getText(filters, tabularData)).toBe("Brand: Acco; Bic");
    });

    test("getText_NegatedColumnFilter_NamesValuesLeftOut", () => {

        const filters = createFilters({ Brand: createColumnFilter(["Acco"], true) });

        expect(Summary.getText(filters, tabularData)).toBe("Brand: not Acco");
    });

    test("getText_ColumnFilterLettingNothingThrough_None", () => {

        const filters = createFilters({ Brand: createColumnFilter([]) });

        expect(Summary.getText(filters, tabularData)).toBe("Brand: none");
    });

    test("getText_NullAndBlankValues_Captioned", () => {

        const filters = createFilters({ Brand: createColumnFilter([Ren.NullSentinel, ""]) });

        expect(Summary.getText(filters, tabularData)).toBe("Brand: NULL; (blank)");
    });

    test("getText_HierarchyAtMixedDepths_NamesEachBranchByItsOwnName", () => {

        const filters = createFilters({}, [{
            type: "includeCombinations",
            columns: ["Top-Level Category", "Sub Category"],
            tuples: [["Paper"], ["Pens", "Gel Pens"]]
        }]);

        expect(Summary.getText(filters, tabularData))
            .toBe("Top-Level Category: Paper; Gel Pens");
    });

    test("getText_ExcludedCombinations_NamesThoseLeftOut", () => {

        const filters = createFilters({}, [{
            type: "excludeCombinations",
            columns: ["Top-Level Category", "Sub Category"],
            tuples: [["Pens", "Gel Pens"]]
        }]);

        expect(Summary.getText(filters, tabularData))
            .toBe("Top-Level Category: not Gel Pens");
    });

    test("getText_MoreValuesThanMax_CountsTheRest", () => {

        const filters = createFilters({ Brand: createColumnFilter(["A", "B", "C", "D"]) });

        expect(Summary.getText(filters, tabularData, 2)).toBe("Brand: A; B and 2 more");
        expect(Summary.getText(filters, tabularData, Infinity)).toBe("Brand: A; B; C; D");
    });

    test("getText_ComparePredicatesInOneOrGroup_JoinedByOr", () => {

        const filters = createFilters({}, [
            { type: "compare", column: "Sales", operator: "greaterThan", value: 100, slot: 0 },
            {
                type: "compare",
                column: "Sales",
                operator: "lessThan",
                value: 10,
                slot: 1,
                orGroup: 0
            }
        ]);

        expect(Summary.getText(filters, tabularData)).toBe("Sales > 100 or < 10");
    });

    test("getText_SeveralFilters_SeparatedByBars", () => {

        const filters = createFilters({ Brand: createColumnFilter(["Acco"]) }, [{
            type: "includeCombinations",
            columns: ["Top-Level Category", "Sub Category"],
            tuples: [["Paper"]]
        }]);

        expect(Summary.getText(filters, tabularData))
            .toBe("Brand: Acco  |  Top-Level Category: Paper");
    });

    test("getText_HeadingGiven_HeadedByIt", () => {

        const filters = createFilters({ Brand: createColumnFilter(["Acco"]) });

        expect(Summary.getText(filters, tabularData, 6, { Brand: { heading: "Make" } }))
            .toBe("Make: Acco");
    });

    test("getText_BooleanColumnFilter_ValuesReadAsYesAndNo", () => {

        expect(Summary.getText(createFilters({ Core: createColumnFilter(["1"]) }), tabularData))
            .toBe("Core: Yes");
        expect(Summary.getText(createFilters({ Core: createColumnFilter([0]) }), tabularData))
            .toBe("Core: No");
    });

    test("getText_YesOrBothCheckboxTicked_HeadingAlone", () => {

        const filters = createFilters({ Core: createColumnFilter(["1"]) });
        const itemSettings = {
            Core: { heading: "Core Categories Only", showAsCheckbox: "YesOrBoth" }
        };

        expect(Summary.getText(filters, tabularData, 6, itemSettings))
            .toBe("Core Categories Only");
    });

    test("getText_YesOrNoCheckboxTicked_NamesValue", () => {

        const filters = createFilters({ Core: createColumnFilter(["1"]) });
        const itemSettings = { Core: { heading: "Core only", showAsCheckbox: "YesOrNo" } };

        expect(Summary.getText(filters, tabularData, 6, itemSettings)).toBe("Core only: Yes");
    });

    test("getText_NonBooleanColumnFilter_OneAndZeroKept", () => {

        const filters = createFilters({ Brand: createColumnFilter(["1", "0"]) });
        const itemSettings = { Brand: { showAsCheckbox: "YesOrBoth" } };

        expect(Summary.getText(filters, tabularData, 6, itemSettings)).toBe("Brand: 1; 0");
    });

    test("getParts_LeadingColumns_TheirEntriesFirstAndMarked", () => {

        const filters = createFilters({
            Brand: createColumnFilter(["Acco"]),
            Sales: createColumnFilter(["10"])
        });

        expect(Summary.getParts(filters, tabularData, 6, null, new Set(["Sales"]))).toEqual([
            { text: "Sales: ", isValue: false, column: "Sales" },
            { text: "10", isValue: true, column: "Sales" },
            { text: "  |  ", isValue: false },
            { text: "Brand: ", isValue: false },
            { text: "Acco", isValue: true }
        ]);
    });
});
