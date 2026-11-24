describe("Ren.DateValueChart calculated columns", () => {

    const Applyer = Ren.DateValueChart_GroupingApplyer;
    const InputColumns = Ren.DateValueChart_InputColumns;

    const columnModel = (heading, columnId) => ({
        Heading: heading,
        ColumnId: columnId ?? null,
        ColumnIdOrHeading: columnId ?? heading
    });

    // The hidden row-count column has an ID differing from its heading, as a grid's calculated
    // column made of it does.
    const tabularData = {
        ColumnModels: [
            columnModel("Count", "__Count"),
            columnModel("Date"),
            columnModel("Visits"),
            columnModel("Visits From Search")
        ]
    };

    const columnResolver = Ren.DataGridColumnResolver(tabularData);

    const ratio = () => ({
        calcFunction: ["rowVals[\"Visits From Search\"] / rowVals[\"Visits\"]"],
        valueFormatFunction: [{ name: "percentage-1-dp" }]
    });

    const createSettings = (countKey) => ({
        groupings: {
            entries: [{
                groupByColumnIndexes: [1],
                groupByCalcFunctions: [{ name: "date-all-time" }],
                columns: {
                    Visits: { aggregationType: Ren.AggregationTypeEnum.Sum },
                    "Visits From Search": { aggregationType: Ren.AggregationTypeEnum.Sum },
                    [countKey]: ratio()
                }
            }]
        }
    });

    const createRows = () => [
        { __Count: 1, Date: "2024-02-03", Visits: 10, "Visits From Search": 2 },
        { __Count: 1, Date: "2024-05-20", Visits: 30, "Visits From Search": 8 },
        { __Count: 1, Date: "2024-09-15", Visits: 60, "Visits From Search": 20 }
    ];

    const apply = (settings) => {

        const entry = Applyer.initGroupingEntry(
            settings,
            "Date",
            ["__Count"],
            columnResolver,
            null
        );

        return Applyer.applyGroupingWithinPointLimit(createRows(), entry);
    };

    test("initGroupingEntry_CalcColumnKeyedById_CalculatesValue", () => {

        const result = apply(createSettings("__Count"));

        expect(result).toHaveLength(1);
        expect(result[0].__Count).toBeCloseTo(0.3);
    });

    test("initGroupingEntry_CalcColumnKeyedByHeading_RekeyedByIdAndCalculated", () => {

        const settings = createSettings("Count");
        const result = apply(settings);

        expect(result[0].__Count).toBeCloseTo(0.3);
        expect(settings.groupings.entries[0].columns.__Count.calcFunction).toEqual(
            ratio().calcFunction
        );
        expect(settings.groupings.entries[0].columns.Count).toBeUndefined();
    });

    test("isOfferedColumn_InternalColumnWithCalcFunction_IsOffered", () => {

        const visualisation = { chartDataGroupingSettings: createSettings("__Count") };

        expect(InputColumns.isOfferedColumn(visualisation, "__Count")).toBe(true);
        expect(InputColumns.isOfferedColumn(visualisation, tabularData.ColumnModels[0])).toBe(true);
    });

    test("isOfferedColumn_InternalColumnWithoutCalcFunction_IsNotOffered", () => {

        const visualisation = { chartDataGroupingSettings: createSettings("Visits") };

        expect(InputColumns.isOfferedColumn(visualisation, "__Count")).toBe(false);
        expect(InputColumns.isOfferedColumn(visualisation, "Visits")).toBe(true);
    });

    test("getColumnLabel_GridRenamedColumn_IsGridName", () => {

        const visualisation = { initialChartColumnLabels: { __Count: "% from search" } };

        expect(InputColumns.getColumnLabel(visualisation, columnResolver, "__Count"))
            .toBe("% from search");
    });

    test("getColumnLabel_SourceGridRenamesColumn_IsGridName", () => {

        const gridState = {
            visualisationGuid: "source-grid",
            columns: [{ column: "__Count", displayHeadingOverride: "% from search" }]
        };

        Ren.GridStateCollection.entries.push(gridState);

        try {

            const visualisation = { sourceVisualisation: { visualisationGuid: "source-grid" } };

            expect(InputColumns.getColumnLabel(visualisation, columnResolver, "__Count"))
                .toBe("% from search");
            expect(InputColumns.getColumnLabel(visualisation, columnResolver, "Visits"))
                .toBe("Visits");
        }
        finally {

            Ren.GridStateCollection.entries.splice(
                Ren.GridStateCollection.entries.indexOf(gridState),
                1
            );
        }
    });

    test("getColumnLabel_SavedChartSharesGridStateGroup_IsGridName", () => {

        const gridState = {
            gridStateGroup: "visits-grid",
            visualisationGuid: "other-grid",
            columns: [{ column: "__Count", displayHeadingOverride: "% from search" }]
        };

        Ren.GridStateCollection.entries.push(gridState);

        try {

            const visualisation = { gridStateGroup: "visits-grid" };

            expect(InputColumns.getColumnLabel(visualisation, columnResolver, "__Count"))
                .toBe("% from search");
            expect(InputColumns.getColumnLabel({ gridStateGroup: "x" }, columnResolver, "__Count"))
                .toBe("Count");
        }
        finally {

            Ren.GridStateCollection.entries.splice(
                Ren.GridStateCollection.entries.indexOf(gridState),
                1
            );
        }
    });

    test("getColumnLabel_ColumnNotRenamed_IsHeading", () => {

        expect(InputColumns.getColumnLabel({}, columnResolver, "__Count")).toBe("Count");
        expect(InputColumns.getColumnLabel({}, columnResolver, "Visits")).toBe("Visits");
        expect(InputColumns.getColumnLabel({}, columnResolver, "Unknown")).toBe("Unknown");
    });
});
