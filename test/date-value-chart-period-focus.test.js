describe("Ren.DateValueChart_PeriodFocus", () => {

    const PeriodFocus = Ren.DateValueChart_PeriodFocus;

    test("getTargetIndex_NoneHighlightedRightArrow_First", () => {

        expect(PeriodFocus.getTargetIndex(null, 5, "ArrowRight")).toBe(0);
    });

    test("getTargetIndex_NoneHighlightedLeftArrow_Last", () => {

        expect(PeriodFocus.getTargetIndex(null, 5, "ArrowLeft")).toBe(4);
    });

    test("getTargetIndex_ArrowsAtEnds_StayPut", () => {

        expect(PeriodFocus.getTargetIndex(4, 5, "ArrowRight")).toBe(4);
        expect(PeriodFocus.getTargetIndex(0, 5, "ArrowLeft")).toBe(0);
    });

    test("getTargetIndex_HomeAndEnd_Ends", () => {

        expect(PeriodFocus.getTargetIndex(2, 5, "Home")).toBe(0);
        expect(PeriodFocus.getTargetIndex(2, 5, "End")).toBe(4);
    });

    test("getTargetIndex_Escape_None", () => {

        expect(PeriodFocus.getTargetIndex(2, 5, "Escape")).toBeNull();
    });

    test("getTargetIndex_NoPeriods_None", () => {

        expect(PeriodFocus.getTargetIndex(null, 0, "ArrowRight")).toBeNull();
    });

    test("getRows_RowsWithoutDates_LeftOut", () => {

        const dated = { Date: new Date(2024, 0, 1), Value: 1 };
        const props = {
            dateHeading: "Date",
            plottedData: [dated, { Date: null }, null, { Date: new Date(NaN) }]
        };

        expect(PeriodFocus.getRows(props)).toEqual([dated]);
    });

    test("describePeriod_SeriesShownAndHidden_DateThenShownSeriesValues", () => {

        const props = {
            dateHeading: "Date",
            datePeriod: Ren.DatePeriodEnum.Month,
            seriesCount: 3,
            series: [{ label: "Sales" }, { isEnabled: false }, {}],
            valueHeadings: ["SalesValue", "Hidden", "Orders"],
            valueColumnFormats: [null, null, null],
            valueColumnFormatFunctions: [null, null, null]
        };
        const row = { Date: new Date(Date.UTC(2024, 2, 1)), SalesValue: 12, Orders: 3 };

        const text = PeriodFocus.describePeriod(props, row);

        expect(text).toMatch(/^[^:]*2024: Sales 12, Orders 3$/);
    });
});
