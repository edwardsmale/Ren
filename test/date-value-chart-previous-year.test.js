describe("Ren.DateValueChart_GroupingApplyer previous year", () => {

    const Applyer = Ren.DateValueChart_GroupingApplyer;

    const createSettings = (binFunction, dateRange) => ({
        groupings: {
            entries: [{
                groupByColumnIndexes: [0],
                groupByCalcFunctions: [{ name: binFunction }],
                dateRange: dateRange ?? null
            }]
        }
    });

    const apply = (settings, rows) => {

        const entry = Applyer.initGroupingEntry(settings, "Date", ["Sales"], null, null);

        Applyer.applyGroupingWithinPointLimit(rows, entry);

        return entry;
    };

    const createMonthlyRows = () => [
        { Date: "2024-01-10", Sales: 10 },
        { Date: "2024-01-20", Sales: 5 },
        { Date: "2024-02-10", Sales: 20 },
        { Date: "2025-01-10", Sales: 30 },
        { Date: "2025-02-10", Sales: 40 },
        { Date: "2025-03-10", Sales: 50 }
    ];

    test("getPreviousYearRows_Months_YearBeforeDatedToPeriodCompared", () => {

        const rows = createMonthlyRows();
        const entry = apply(
            createSettings("date-month-start", { from: "2025-01-01", to: "2025-03-31" }),
            rows
        );

        const result = Applyer.getPreviousYearRows(rows, entry);

        expect(result.map(row => [row.Date, row.Sales])).toEqual([
            ["2025-01-01", 15],
            ["2025-02-01", 20]
        ]);
    });

    test("getPreviousYearRows_Months_RowsHeldForEarlierPeriodsLeftAlone", () => {

        const rows = createMonthlyRows();
        const entry = apply(createSettings("date-month-start"), rows);

        Applyer.getPreviousYearRows(rows, entry);

        // The whole range is drawn, so January 2024's own row is drawn with its own date.
        const drawn = Applyer.applyGroupingWithinPointLimit(rows, entry);

        expect(drawn[0].Date).toBe("2024-01-01");
    });

    test("getPreviousYearRows_Days_ComparedWith52WeeksBefore", () => {

        // 2025-06-09 is a Monday, as is 2024-06-10, 52 weeks before.
        const rows = [
            { Date: "2024-06-09", Sales: 1 },
            { Date: "2024-06-10", Sales: 2 },
            { Date: "2025-06-09", Sales: 3 }
        ];
        const entry = apply(
            createSettings("date-day-start", { from: "2025-06-09", to: "2025-06-09" }),
            rows
        );

        const result = Applyer.getPreviousYearRows(rows, entry);

        expect(result.map(row => [row.Date, row.Sales])).toEqual([["2025-06-09", 2]]);
    });

    test("getPreviousYearRows_NothingYearBefore_NoRows", () => {

        const rows = [{ Date: "2025-01-10", Sales: 30 }, { Date: "2025-02-10", Sales: 40 }];
        const entry = apply(createSettings("date-month-start"), rows);

        expect(Applyer.getPreviousYearRows(rows, entry)).toEqual([]);
    });

    test("getPreviousYearRows_AllTime_NoRows", () => {

        const rows = createMonthlyRows();
        const entry = apply(createSettings("date-all-time"), rows);

        expect(Applyer.getPreviousYearRows(rows, entry)).toEqual([]);
    });
});
