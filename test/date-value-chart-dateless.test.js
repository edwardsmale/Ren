const { createTabularData } = require("./helpers/tabular-data");

describe("Ren.DateValueChart_GroupingEntries", () => {

    const GroupingEntries = Ren.DateValueChart_GroupingEntries;
    const Applyer = Ren.DateValueChart_GroupingApplyer;
    const SeriesSplit = Ren.DateValueChart_SeriesSplit;

    const HEADINGS = ["Date", "Region", "Sales", "Shipped"];

    const maxSales = () => ({ Sales: { aggregationType: Ren.AggregationTypeEnum.Max } });

    const columnResolver = {
        getColumnIndex: (heading) => {

            const index = HEADINGS.indexOf(heading);

            return index === -1 ? null : index;
        },
        getColumnIdOrHeading: (index) => HEADINGS[index] ?? null,
        getColumnHeading: (index) => HEADINGS[index] ?? null
    };

    const dateEntry = () => ({
        groupByColumnIndexes: [0],
        groupByColumns: ["Date"],
        groupByCalcFunctions: [{ name: "date-month-start" }],
        columns: maxSales()
    });

    const createRows = () => [
        { Date: "2024-02-03", Region: "North", Sales: 10 },
        { Date: "2024-11-20", Region: "South", Sales: 20 },
        { Date: "2025-01-15", Region: "North", Sales: 30 },
        { Date: "2025-06-10", Region: "South", Sales: 40 }
    ];

    const apply = (settings, rows) => {

        const entry = Applyer.initGroupingEntry(
            settings,
            GroupingEntries.NO_DATE_HEADING,
            ["Sales"],
            null,
            null
        );

        const result = Applyer.applyGroupingWithinPointLimit(rows, entry);

        return { entry, result };
    };

    test("getDateEntry_SplitEntryInnermost_FindsDateEntryOutsideIt", () => {

        const settings = {
            groupings: {
                entries: [{ groupByColumnIndexes: [1] }, dateEntry(), { groupByColumnIndexes: [] }]
            }
        };

        expect(GroupingEntries.getDateEntry(settings)).toBe(settings.groupings.entries[1]);
    });

    test("getDateEntry_SplitEntryOnly_IsNull", () => {

        const settings = {
            groupings: { entries: [{ groupByColumnIndexes: [1] }, { groupByColumnIndexes: [] }] }
        };

        expect(GroupingEntries.getDateEntry(settings)).toBeNull();
        expect(SeriesSplit.getSplitColumnIndex(settings, null)).toBe(1);
    });

    test("getDateColumnKey_NamedColumnMoved_IndexFollowsName", () => {

        const entry = Object.assign(dateEntry(), { groupByColumnIndexes: [3] });
        const settings = { groupings: { entries: [entry, { groupByColumnIndexes: [] }] } };

        expect(GroupingEntries.getDateColumnKey(settings, columnResolver)).toBe("Date");
        expect(entry.groupByColumnIndexes).toEqual([0]);
    });

    test("getDateColumnKey_IndexOnly_IsNull", () => {

        const entry = dateEntry();
        delete entry.groupByColumns;

        const settings = { groupings: { entries: [entry, { groupByColumnIndexes: [] }] } };

        expect(GroupingEntries.getDateColumnKey(settings, columnResolver)).toBeNull();
    });

    test("setDateColumn_None_AggregationSettingsMoveToSplitEntry", () => {

        const settings = {
            groupings: {
                entries: [dateEntry(), { groupByColumnIndexes: [1] }, { groupByColumnIndexes: [] }]
            }
        };

        GroupingEntries.setDateColumn(settings, null, columnResolver, "date-day-start");

        expect(settings.groupings.entries).toEqual([
            { groupByColumnIndexes: [1], columns: maxSales() },
            { groupByColumnIndexes: [] }
        ]);
    });

    test("setDateColumn_NoneWithoutSplit_AggregationSettingsMoveToOutermostEntry", () => {

        const settings = { groupings: { entries: [dateEntry(), { groupByColumnIndexes: [] }] } };

        GroupingEntries.setDateColumn(settings, null, columnResolver, "date-day-start");

        expect(settings.groupings.entries).toEqual([
            { groupByColumnIndexes: [], columns: maxSales() }
        ]);
    });

    test("setDateColumn_DatelessChart_DateEntryInnermostWithAggregationSettings", () => {

        const settings = {
            groupings: {
                entries: [
                    { groupByColumnIndexes: [1], columns: maxSales() },
                    { groupByColumnIndexes: [] }
                ]
            }
        };

        GroupingEntries.setDateColumn(settings, 3, columnResolver, "date-day-start");

        expect(settings.groupings.entries).toEqual([
            {
                groupByColumnIndexes: [3],
                groupByCalcFunctions: [{ name: "date-day-start" }],
                groupByColumns: ["Shipped"],
                columns: maxSales()
            },
            { groupByColumnIndexes: [1] },
            { groupByColumnIndexes: [] }
        ]);
    });

    test("setDateColumn_OtherColumn_KeepsPeriodAndRelativeRange", () => {

        const entry = Object.assign(dateEntry(), { dateRange: { lastPeriodCount: 6 } });
        const settings = { groupings: { entries: [entry, { groupByColumnIndexes: [] }] } };

        GroupingEntries.setDateColumn(settings, 3, columnResolver, "date-day-start");

        expect(entry.groupByColumnIndexes).toEqual([3]);
        expect(entry.groupByColumns).toEqual(["Shipped"]);
        expect(entry.groupByCalcFunctions).toEqual([{ name: "date-month-start" }]);
        expect(entry.dateRange).toEqual({ lastPeriodCount: 6 });
    });

    test("setDateColumn_OtherColumn_DropsAbsoluteRange", () => {

        const entry = Object.assign(dateEntry(), { dateRange: { from: "2024-01-01" } });
        const settings = { groupings: { entries: [entry, { groupByColumnIndexes: [] }] } };

        GroupingEntries.setDateColumn(settings, 3, columnResolver, "date-day-start");

        expect(entry.dateRange).toBeUndefined();
    });

    test("setSplitColumn_ValueOnlyChart_AggregationSettingsMoveToSplitEntry", () => {

        const settings = {
            groupings: {
                entries: [
                    { groupByColumnIndexes: [], columns: maxSales() }
                ]
            }
        };

        SeriesSplit.setSplitColumn(settings, 1, columnResolver);

        expect(settings.groupings.entries).toEqual([
            {
                groupByColumnIndexes: [1],
                groupByColumns: ["Region"],
                columns: maxSales()
            },
            { groupByColumnIndexes: [] }
        ]);

        SeriesSplit.setSplitColumn(settings, null, columnResolver);

        expect(settings.groupings.entries).toEqual([
            { groupByColumnIndexes: [], columns: maxSales() }
        ]);
    });

    test("applyGroupingWithinPointLimit_ValueOnly_AggregatesEveryRowIntoOneRow", () => {

        const settings = {
            groupings: { entries: [{ groupByColumnIndexes: [], columns: {} }] }
        };

        const { entry, result } = apply(settings, createRows());

        expect(entry.hasDateColumn).toBe(false);
        expect(entry.isAllTime).toBe(true);
        expect(entry.allTimeExtent).toBeNull();
        expect(result).toHaveLength(1);
        expect(result[0].Sales).toBe(100);
    });

    test("applyGroupingWithinPointLimit_SplitWithoutDate_RowPerChartWithSeriesPerValue", () => {

        const settings = {
            groupings: {
                entries: [
                    { groupByColumnIndexes: [1], groupByColumns: ["Region"], columns: {} },
                    { groupByColumnIndexes: [] }
                ]
            }
        };

        const { entry, result } = apply(settings, createRows());

        expect(entry.seriesColumns.map(column => column.heading)).toEqual(["North", "South"]);
        expect(result).toHaveLength(1);
        expect(result[0].North).toBe(40);
        expect(result[0].South).toBe(60);
    });

    test("applyGroupingWithinPointLimit_DatelessWithAggregation_AggregatesBySettings", () => {

        const settings = {
            groupings: {
                entries: [{ groupByColumnIndexes: [], columns: maxSales() }]
            }
        };

        const { result } = apply(settings, createRows());

        expect(result[0].Sales).toBe(40);
    });

    test("getDateColumns_DatesYearsAndText_FindsDateColumnsOnly", () => {

        const tabularData = createTabularData(
            ["Region", "Year", "OrderDate", "Quarter", "Sales"],
            [
                ["North", 2024, null, "Q1 2024", 10],
                ["South", 2025, "2025-02-01", "Q2 2025", 20]
            ]
        );

        const dateColumns = Ren.DateValueChart_InputColumns.getDateColumns(tabularData);
        const headings = dateColumns.map(
            dateColumn => tabularData.columnResolver.getColumnHeading(dateColumn.columnIndex)
        );

        expect(headings).toEqual(["OrderDate", "Quarter"]);
    });
});
