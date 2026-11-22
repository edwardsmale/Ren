describe("DateUtils", () => {

    const DateUtils = Ren.DateUtils;

    test("isSortableDate_ALeapDay_ReturnsTrueOnlyInALeapYear", () => {

        expect(DateUtils.isSortableDate("2024-02-29")).toBe(true);
        expect(DateUtils.isSortableDate("2023-02-29")).toBe(false);
        expect(DateUtils.isSortableDate("2024-02-30")).toBe(false);
    });

    test("toSortableDate_ADate_ReturnsItsLocalDate", () => {

        expect(DateUtils.toSortableDate(new Date(2024, 1, 9))).toBe("2024-02-09");
    });

    test("sortableDateToddMMyyyy_ADate_ReturnsItInBritishOrder", () => {

        expect(DateUtils.sortableDateToddMMyyyy("2024-02-29")).toBe("29/02/2024");
        expect(DateUtils.ddMMyyyyToSortableDate("29/02/2024")).toBe("2024-02-29");
    });

    test("daysBetweenSortableDates_AcrossALeapDay_CountsIt", () => {

        expect(DateUtils.daysBetweenSortableDates("2024-01-01", "2024-03-01")).toBe(60);
    });

    test("addDaysToSortableDate_PastTheEndOfFebruary_RollsIntoMarch", () => {

        expect(DateUtils.addDaysToSortableDate("2024-02-28", 2)).toBe("2024-03-01");
    });

    test("getQuarterNameFromSortableDate_May_ReturnsQ2", () => {

        expect(DateUtils.getQuarterNameFromSortableDate("2024-05-01")).toBe("Q2 2024");
    });

    test("toSortableStartOfPeriods_AFriday_ReturnTheirStarts", () => {

        // 17 May 2024 was a Friday; weeks start on a Monday.
        expect(DateUtils.toSortableStartOfWeek("2024-05-17")).toBe("2024-05-13");
        expect(DateUtils.toSortableStartOfMonth("2024-05-17")).toBe("2024-05-01");
        expect(DateUtils.toSortableStartOfQuarter("2024-05-17")).toBe("2024-04-01");
        expect(DateUtils.toSortableStartOfYear("2024-05-17")).toBe("2024-01-01");
    });

    test("isLeapYear_CenturyYears_FollowTheGregorianRule", () => {

        expect(DateUtils.isLeapYear(1900)).toBe(false);
        expect(DateUtils.isLeapYear(2000)).toBe(true);
        expect(DateUtils.isLeapYear(2024)).toBe(true);
    });

    test("easterSunday_SomeYears_ReturnsTheRightSundays", () => {

        expect(DateUtils.easterSunday(2024).toISOString().substring(0, 10)).toBe("2024-03-31");
        expect(DateUtils.easterSunday(2025).toISOString().substring(0, 10)).toBe("2025-04-20");
    });

    test("sortableDateToMMMyyyy_ADate_ReturnsTheMonthAndYear", () => {

        expect(DateUtils.sortableDateToMMMyyyy("2024-05-17")).toBe("May 2024");
    });
});

describe("ValueFormatter", () => {

    const ValueFormatter = Ren.ValueFormatter;
    const Format = Ren.SpreadsheetColumnFormatEnum;

    test("formatCurrency_ANumber_ShowsPoundsAndPence", () => {

        expect(ValueFormatter.formatCurrency(1234.5)).toBe("£1,234.50");
    });

    test("formatNumbers_ANumber_RoundsToTheirPlaces", () => {

        expect(ValueFormatter.formatNumberNoDP(1234.5)).toBe("1235");
        expect(ValueFormatter.formatNumber2DP("3.14159")).toBe("3.14");
    });

    test("formatPercentages_AFraction_ShowsAPercentage", () => {

        expect(ValueFormatter.formatPercentage1DP(0.1234)).toBe("12.3%");
        expect(ValueFormatter.formatPercentageDiv100NoDP(12.6)).toBe("13%");
    });

    test("formatAbbreviated_ALargeNumber_UsesASuffix", () => {

        expect(ValueFormatter.formatNumberAbbreviated1DP(1234567)).toBe("1.2m");
        expect(ValueFormatter.formatCurrencyAbbreviatedNoDP(2500)).toBe("£3k");
    });

    test("formatNumberPlusNoDP_EitherSign_ShowsTheSign", () => {

        expect(ValueFormatter.formatNumberPlusNoDP(5)).toBe("+5");
        expect(ValueFormatter.formatNumberPlusNoDP(-5)).toBe("-5");
    });

    test("formatNumber2DP_NotANumber_ReturnsItUnchanged", () => {

        expect(ValueFormatter.formatNumber2DP("x")).toBe("x");
    });

    test("formatDates_ASortableDate_ShowsItInTheirFormats", () => {

        expect(ValueFormatter.formatDate_dd_MMM_yyyy("2024-03-05")).toBe("05 Mar 2024");
        expect(ValueFormatter.formatDate_ddMMyyyy("2024-03-05")).toBe("05/03/2024");
        expect(ValueFormatter.formatDate_MMM_yyyy("2024-03-05")).toBe("Mar 2024");
        expect(ValueFormatter.formatDate_ddMMyyyy_HHmmss("2024-03-05 13:04:05"))
            .toBe("05/03/2024 13:04:05");
    });

    test("formatValue_EachColumnFormat_FormatsByIt", () => {

        expect(ValueFormatter.formatValue(1234.5, 0, Format.Currency)).toBe("£1,234.50");
        expect(ValueFormatter.formatValue(0.5, 0, Format.Percentage)).toBe("50.00%");
        expect(ValueFormatter.formatValue("2024-03-05", 0, Format.Date)).toBe("05/03/2024");
        expect(ValueFormatter.formatValue(1234.5678, 0, Format.Number)).toBe("1234.57");
        expect(ValueFormatter.formatValue(1234, 0, Format.Integer)).toBe("1234");
        expect(ValueFormatter.formatValue("abc", 0, Format.General)).toBe("abc");
    });

    test("formatValue_Null_ReturnsAnEmptyString", () => {

        expect(ValueFormatter.formatValue(null, 0, Format.Number)).toBe("");
    });
});
