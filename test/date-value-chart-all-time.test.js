describe("Ren.DateValueChart_GroupingApplyer all time", () => {

    const Applyer = Ren.DateValueChart_GroupingApplyer;

    const createSettings = (dateEntry, splitEntry) => ({
        groupings: {
            entries: splitEntry
                ? [Object.assign({ groupByColumnIndexes: [0] }, dateEntry), splitEntry]
                : [Object.assign({ groupByColumnIndexes: [0] }, dateEntry)]
        }
    });

    const allTimeEntry = (dateRange) => ({
        groupByCalcFunctions: [{ name: "date-all-time" }],
        dateRange: dateRange ?? null
    });

    const createRows = () => [
        { Date: "2024-02-03", Region: "North", Sales: 10 },
        { Date: "2024-11-20", Region: "South", Sales: 20 },
        { Date: "2025-01-15", Region: "North", Sales: 30 },
        { Date: "2025-06-10", Region: "South", Sales: 40 }
    ];

    const apply = (settings, rows) => {

        const entry = Applyer.initGroupingEntry(settings, "Date", ["Sales"], null, null);
        const result = Applyer.applyGroupingWithinPointLimit(rows, entry);

        return { entry, result };
    };

    test("isAllTimeCalcFunction_DateAllTime_IsTrue", () => {

        expect(Applyer.isAllTimeCalcFunction("date-all-time")).toBe(true);
        expect(Applyer.isAllTimeCalcFunction("date-year-start")).toBe(false);
    });

    test("initGroupingEntry_AllTime_BinsByDay", () => {

        const entry = Applyer.initGroupingEntry(
            createSettings(allTimeEntry()),
            "Date",
            ["Sales"],
            null,
            null
        );

        expect(entry.isAllTime).toBe(true);
        expect(entry.binPeriod).toBe(Ren.DatePeriodEnum.Day);
        expect(entry.binFunctionName).toBe("date-day-start");
    });

    test("applyGroupingWithinPointLimit_AllTime_SumsEveryRowIntoOneRow", () => {

        const { entry, result } = apply(createSettings(allTimeEntry()), createRows());

        expect(result).toHaveLength(1);
        expect(result[0].Sales).toBe(100);
        expect(result[0].Date).toBe("2024-01-01");
        expect(entry.allTimeExtent).toEqual({ from: "2024-02-03", toExclusive: "2025-06-11" });
    });

    test("applyGroupingWithinPointLimit_AllTimeWithDateRange_SumsRowsInRangeOnly", () => {

        const settings = createSettings(allTimeEntry({ from: "2024-06-01", to: "2025-03-31" }));

        const { entry, result } = apply(settings, createRows());

        expect(result).toHaveLength(1);
        expect(result[0].Sales).toBe(50);
        expect(entry.allTimeExtent).toEqual({ from: "2024-11-20", toExclusive: "2025-01-16" });
    });

    test("applyGroupingWithinPointLimit_AllTimeRangeMissingEveryRow_DrawsEveryRow", () => {

        const settings = createSettings(allTimeEntry({ from: "2030-01-01", to: "2030-12-31" }));

        const { result } = apply(settings, createRows());

        expect(result).toHaveLength(1);
        expect(result[0].Sales).toBe(100);
    });

    test("applyGroupingWithinPointLimit_AllTimeSplit_SumsEachSplitValue", () => {

        const settings = createSettings(
            allTimeEntry(),
            { groupByColumns: ["Region"], groupByColumnIndexes: [1] }
        );

        const { entry, result } = apply(settings, createRows());

        expect(result).toHaveLength(1);

        const salesBySplitValue = {};

        for (let index = 0; index < entry.seriesColumns.length; index++) {

            const seriesColumn = entry.seriesColumns[index];
            salesBySplitValue[seriesColumn.splitValue] = result[0][seriesColumn.heading];
        }

        expect(salesBySplitValue).toEqual({ North: 40, South: 60 });
    });

    test("applyGroupingWithinPointLimit_AllTimeAppliedTwice_ReturnsSameRow", () => {

        const settings = createSettings(allTimeEntry());
        const rows = createRows();

        const first = apply(settings, rows).result[0];
        const second = apply(settings, rows).result[0];

        expect(second).toBe(first);
    });

    test("getAggregatedRows_AllTimeRow_GetsEveryRowMerged", () => {

        const rows = createRows();
        const { result } = apply(createSettings(allTimeEntry()), rows);

        const aggregated = Applyer.getAggregatedRows(result[0], "Sales");

        expect(aggregated.rows).toHaveLength(4);
        expect(aggregated.valueHeading).toBe("Sales");
    });

    test("getAllTimeLabel_NoDateRange_IsAllTime", () => {

        const label = Ren.DateValueChart_DateTickFormat.getAllTimeLabel({ chartDateRange: null });

        expect(label).toBe("All time");
    });

    test("getAllTimeLabel_YearRange_DescribesTheYear", () => {

        const label = Ren.DateValueChart_DateTickFormat.getAllTimeLabel({
            chartDateRange: { from: "2025-01-01", toExclusive: "2026-01-01" }
        });

        expect(label).toBe("2025");
    });

    test("getChartTickFormat_AllTime_LabelsEveryDateTheSame", () => {

        const format = Ren.DateValueChart_DateTickFormat.getChartTickFormat({
            isAllTime: true,
            datePeriod: Ren.DatePeriodEnum.Year,
            chartDateRange: null
        });

        expect(format(new Date(2024, 0, 1))).toBe("All time");
    });

    test("getAxisTickFormat_AllTime_LeavesTheTickUnlabelled", () => {

        const format = Ren.DateValueChart_DateTickFormat.getAxisTickFormat({
            isAllTime: true,
            datePeriod: Ren.DatePeriodEnum.Year,
            chartDateRange: null
        });

        expect(format(new Date(2024, 0, 1))).toBeNull();
    });

    test("getAxisTickFormat_NotAllTime_FormatsByPeriod", () => {

        const format = Ren.DateValueChart_DateTickFormat.getAxisTickFormat({
            isAllTime: false,
            datePeriod: Ren.DatePeriodEnum.Year
        });

        expect(format(new Date(2024, 0, 1))).toBe("2024");
    });

    test("getChartTickFormat_NotAllTime_FormatsByPeriod", () => {

        const format = Ren.DateValueChart_DateTickFormat.getChartTickFormat({
            isAllTime: false,
            datePeriod: Ren.DatePeriodEnum.Year
        });

        expect(format(new Date(2024, 0, 1))).toBe("2024");
    });
});
