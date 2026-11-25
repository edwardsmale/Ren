describe("DataGroupingSettingsTransformer", () => {

    // Ren 1.2.3 saved the set of columns a grouping skipped calc functions for, as {}.
    test("transform_EntrySavedWithColumnsSkippingCalcFunctions_LeftOut", () => {

        const tabularData = {
            ColumnModels: [{ Heading: "Total", ColumnIdOrHeading: "Total" }]
        };
        const settings = {
            groupings: { entries: [{ groupByColumns: [], columnsSkippingCalcFunctions: {} }] }
        };

        const transformed = Ren.DataGroupingSettingsTransformer.transform(tabularData, settings);

        expect("columnsSkippingCalcFunctions" in transformed.groupings.entries[0]).toBe(false);
    });
});
