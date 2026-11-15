describe("Ren.DateValueChart_SeriesSplit", () => {

    const SeriesSplit = Ren.DateValueChart_SeriesSplit;

    test("buildSeriesColumns_NullAndBlankSplitValues_NamedAsFiltersCaptionThem", () => {

        const seriesColumns = SeriesSplit.buildSeriesColumns(
            ["Sales"],
            ["Desks", Ren.NullSentinel, ""],
            null
        );

        expect(seriesColumns.map(column => column.heading)).toEqual(["Desks", "NULL", "(blank)"]);
        expect(seriesColumns[1].splitValue).toBe(Ren.NullSentinel);
    });

    test("buildSeriesColumns_NullSplitValueOfSeveralColumns_ColumnAndNullNamed", () => {

        const seriesColumns = SeriesSplit.buildSeriesColumns(
            ["Sales", "Margin"],
            [Ren.NullSentinel],
            null
        );

        expect(seriesColumns.map(column => column.heading))
            .toEqual(["Sales – NULL", "Margin – NULL"]);
    });

    test("buildSeriesColumns_BooleanSplitColumn_NamedByColumnAndTrueOrFalse", () => {

        const seriesColumns = SeriesSplit.buildSeriesColumns(
            ["Sales"],
            ["0", "1", Ren.NullSentinel],
            null,
            { heading: "IsBusiness", format: Ren.SpreadsheetColumnFormatEnum.Boolean }
        );

        expect(seriesColumns.map(column => column.heading))
            .toEqual(["IsBusiness = False", "IsBusiness = True", "IsBusiness = NULL"]);
        expect(seriesColumns[1].splitValue).toBe("1");
    });

    test("buildSeriesColumns_NumericSplitColumnOfSeveralColumns_ValueColumnAndSplitNamed", () => {

        const seriesColumns = SeriesSplit.buildSeriesColumns(
            ["Sales", "Margin"],
            ["3"],
            null,
            { heading: "Quantity", format: Ren.SpreadsheetColumnFormatEnum.Integer }
        );

        expect(seriesColumns.map(column => column.heading))
            .toEqual(["Sales – Quantity = 3", "Margin – Quantity = 3"]);
    });

    test("buildSeriesColumns_TextSplitColumn_NamedByValueAlone", () => {

        const seriesColumns = SeriesSplit.buildSeriesColumns(
            ["Sales"],
            ["Desks"],
            null,
            { heading: "Category", format: Ren.SpreadsheetColumnFormatEnum.General }
        );

        expect(seriesColumns.map(column => column.heading)).toEqual(["Desks"]);
    });

    test("getSplitValueLabel_OtherValueOfNumericColumn_NamedOther", () => {

        const label = SeriesSplit.getSplitValueLabel(
            SeriesSplit.OTHER_VALUE,
            { heading: "Quantity", format: Ren.SpreadsheetColumnFormatEnum.Integer }
        );

        expect(label).toBe("(other)");
    });

    test("getInitialSplitColumn_TextColumnSelected_SplitByIt", () => {

        const rows = [
            { Category: "Desks", Date: "2026-01-01", Sales: 5 },
            { Category: "Chairs", Date: "2026-02-01", Sales: 6 }
        ];

        const column = SeriesSplit.getInitialSplitColumn(
            rows,
            ["Category", "Date", "Sales"],
            "Date",
            () => undefined
        );

        expect(column).toBe("Category");
    });

    test("getInitialSplitColumn_OnlyDateAndValues_NoSplit", () => {

        const rows = [{ Date: "2026-01-01", Sales: 5, Margin: "1,200" }];

        expect(SeriesSplit.getInitialSplitColumn(rows, ["Date", "Sales", "Margin"], "Date",
            () => undefined)).toBeNull();
    });

    test("getInitialSplitColumn_TextColumnAggregated_NotSplitByIt", () => {

        const rows = [{ Date: "2026-01-01", Order: "A1", Category: "Desks" }];
        const settings = { Order: { aggregationType: "Count" } };

        const column = SeriesSplit.getInitialSplitColumn(
            rows,
            ["Date", "Order", "Category"],
            "Date",
            heading => settings[heading]
        );

        expect(column).toBe("Category");
    });

    test("detectColumns_TextColumnBeforeDate_DateDetected", () => {

        const rows = [{ Category: "Desks", Date: "2026-01-01", Sales: 5 }];

        const detected = Ren.AdHocDataSource_ColumnDetector.detectColumns(rows, null);

        expect(detected.dateHeading).toBe("Date");
        expect(detected.valueHeadings).toEqual(["Sales"]);
    });
    describe("saved column indexes", () => {

        const GroupingEntries = Ren.DateValueChart_GroupingEntries;

        // Resolves columns by name to where they sit in the given query columns.
        const createColumnResolver = (columns) => ({
            getColumnIndex: (column) => {
                const columnIndex = columns.indexOf(column);
                return columnIndex === -1 ? null : columnIndex;
            },
            getColumnIdOrHeading: (columnIndex) => columns[columnIndex] ?? null
        });

        const createSettings = () => ({
            groupings: {
                entries: [
                    {
                        groupByColumnIndexes: [1],
                        groupByColumns: ["Date"],
                        groupByCalcFunctions: [{ name: "date-month-start" }],
                        columns: { Sales: { aggregationType: "Sum" } }
                    },
                    { groupByColumnIndexes: [3], groupByColumns: ["Region"] },
                    { groupByColumnIndexes: [] }
                ]
            }
        });

        test("getSettingsToSave_NamedColumns_IndexesLeftOut", () => {

            const entries = GroupingEntries.getSettingsToSave(createSettings()).groupings.entries;

            expect(entries[0].groupByColumnIndexes).toBeUndefined();
            expect(entries[0].groupByColumns).toEqual(["Date"]);
            expect(entries[1].groupByColumnIndexes).toBeUndefined();
            expect(entries[1].groupByColumns).toEqual(["Region"]);
            expect(entries[2]).toEqual({ groupByColumns: [] });
        });

        test("getSettingsToSave_ChartSettings_LeftWithTheirIndexes", () => {

            const settings = createSettings();

            GroupingEntries.getSettingsToSave(settings);

            expect(settings.groupings.entries[1].groupByColumnIndexes).toEqual([3]);
        });

        test("getSettingsToSave_IndexWithoutName_Kept", () => {

            const settings = { groupings: { entries: [{ groupByColumnIndexes: [3] }] } };

            const entries = GroupingEntries.getSettingsToSave(settings).groupings.entries;

            expect(entries[0].groupByColumnIndexes).toEqual([3]);
        });

        test("persistedProperties_ChartDataGroupingSettings_SavedWithoutIndexes", () => {

            const transform = Ren.VisualisationTypes_DateValueChart.persistedProperties
                .find(property => property.name === "chartDataGroupingSettings").transform;

            const entries = transform(createSettings()).groupings.entries;

            expect(entries[1].groupByColumnIndexes).toBeUndefined();
        });

        test("resolveColumnIndexes_ColumnAddedToQuery_IndexesFollowTheNames", () => {

            const settings = GroupingEntries.getSettingsToSave(createSettings());

            GroupingEntries.resolveColumnIndexes(
                settings,
                createColumnResolver(["Id", "Date", "Sales", "Added", "Region"])
            );

            const entries = settings.groupings.entries;

            expect(entries[0].groupByColumnIndexes).toEqual([1]);
            expect(entries[1].groupByColumnIndexes).toEqual([4]);
            expect(entries[2].groupByColumnIndexes).toEqual([]);
        });

        test("splitColumn_SavedByNameAlone_FoundByName", () => {

            const settings = GroupingEntries.getSettingsToSave(createSettings());
            const columnResolver = createColumnResolver(["Id", "Date", "Sales", "Added", "Region"]);

            expect(SeriesSplit.getSplitColumnKey(settings, columnResolver)).toBe("Region");
            expect(SeriesSplit.getSplitColumnIndex(settings, columnResolver)).toBe(4);
        });

        test("splitColumn_NamedColumnGone_NotSplit", () => {

            const settings = GroupingEntries.getSettingsToSave(createSettings());
            const columnResolver = createColumnResolver(["Id", "Date", "Sales"]);

            GroupingEntries.resolveColumnIndexes(settings, columnResolver);

            expect(SeriesSplit.getSplitColumnKey(settings, columnResolver)).toBeNull();
        });

        test("resolveColumnIndexes_IndexesAlone_ColumnsNamedSoSavedWithoutIndexes", () => {

            const settings = {
                groupings: {
                    entries: [
                        {
                            groupByColumnIndexes: [1],
                            groupByCalcFunctions: [{ name: "date-month-start" }],
                            columns: { Sales: { aggregationType: "Sum" } }
                        },
                        { groupByColumnIndexes: [4] },
                        { groupByColumnIndexes: [] }
                    ]
                }
            };

            GroupingEntries.resolveColumnIndexes(
                settings,
                createColumnResolver(["Id", "Date", "Sales", "Added", "Amazon / Non-Amazon"]),
                "Date"
            );

            const entries = settings.groupings.entries;

            expect(entries[0].groupByColumns).toEqual(["Date"]);
            expect(entries[1].groupByColumns).toEqual(["Amazon / Non-Amazon"]);
            expect(entries[1].groupByColumnIndexes).toEqual([4]);
            expect(entries[2].groupByColumns).toEqual([]);

            const savedEntries = GroupingEntries.getSettingsToSave(settings).groupings.entries;

            for (let i = 0; i < savedEntries.length; i++) {
                expect(savedEntries[i].groupByColumnIndexes).toBeUndefined();
            }
        });

        test("resolveColumnIndexes_DateIndexStale_NamedAfterTheDateColumnDrawn", () => {

            const settings = {
                groupings: {
                    entries: [
                        { groupByColumnIndexes: [0], groupByCalcFunctions: [{ name: "date-day-start" }] },
                        { groupByColumnIndexes: [] }
                    ]
                }
            };

            GroupingEntries.resolveColumnIndexes(
                settings,
                createColumnResolver(["__Count", "Date", "Searches"]),
                "Date"
            );

            expect(settings.groupings.entries[0].groupByColumns).toEqual(["Date"]);
            expect(settings.groupings.entries[0].groupByColumnIndexes).toEqual([1]);
        });

        test("resolveColumnIndexes_IndexOutsideData_LeftUnnamed", () => {

            const settings = { groupings: { entries: [{ groupByColumnIndexes: [9] }] } };

            GroupingEntries.resolveColumnIndexes(settings, createColumnResolver(["Id", "Date"]));

            expect(settings.groupings.entries[0].groupByColumns).toBeUndefined();
            expect(settings.groupings.entries[0].groupByColumnIndexes).toEqual([9]);
        });
    });
});
