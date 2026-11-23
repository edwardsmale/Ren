describe("Ren.XlsxColumnWidths", () => {

    const Widths = Ren.XlsxColumnWidths;

    const shown = (value, format) => Widths.getShownText(value, format, "yyyy-mm-dd");

    test("getShownText_Text_AsItIs", () => {

        expect(shown("North", null)).toBe("North");
        expect(shown({ formula: "HYPERLINK(\"a\", \"Link\")", value: "Link" }, null)).toBe("Link");
        expect(shown(null, null)).toBe("");
        expect(shown(NaN, "0")).toBe("");
    });

    test("getShownText_NumberWithoutFormat_AsGeneralShowsIt", () => {

        expect(shown(1.5, null)).toBe("1.5");
        expect(shown(1 / 3, "General")).toBe("0.333333333");
        expect(shown(123456789012345, null)).toBe("1.23457e+14");
    });

    test("getShownText_NumberFormats_DigitsSeparatorsAndSymbols", () => {

        expect(shown(1234567.891, "#,##0.00")).toBe("1,234,567.89");
        expect(shown(-1234.5, "#,##0")).toBe("-1,235");
        expect(shown(-1234.5, "#,##0;(#,##0)")).toBe("(1,235)");
        expect(shown(0.256, "0.0%")).toBe("25.6%");
        expect(shown(3, "000")).toBe("003");
        expect(shown(0.5, "#.00")).toBe(".50");
        expect(shown(12.5, "[$£-809]#,##0.00")).toBe("£12.50");
        expect(shown(12.5, "\"£\"0.00")).toBe("£12.50");
        expect(shown(12.5, "[Red]0.0")).toBe("12.5");
        expect(shown(2.5, "0.00 \"kg\"")).toBe("2.50 kg");
        expect(shown(12345, "0.00E+00")).toBe("1.23E+04");
    });

    test("getShownText_Dates_AsWideAsTheFormatGets", () => {

        const date = new Date(Date.UTC(2026, 0, 1));

        expect(shown(date, null)).toBe("2026-12-28");
        expect(shown(date, "dd/mm/yyyy")).toBe("28/12/2026");
        expect(shown(date, "d mmmm yyyy")).toBe("28 September 2026");
        expect(shown(date, "ddd dd mmm yy hh:mm")).toBe("Wed 28 Sep 26 23:12");
    });

    test("getColumnWidth_ShortValues_FitsTheHeadingAndItsFilterButton", () => {

        const units = Widths.getColumnWidth("Qty", "0", [1, 2, 3], "yyyy-mm-dd");

        expect(units).toBeGreaterThan(Widths.getTextWidth("Qty") + 2);
        expect(units).toBeLessThan(10);
    });

    test("getColumnWidth_DateTime_AtLeastAsWideAsExcelsAutoFit", () => {

        // Excel's AutoFit makes this column 17.57 wide; any narrower and it may show ####.
        const units = Widths.getColumnWidth("CreatedOn", "dd/mm/yyyy hh:mm:ss", [new Date()], "yyyy-mm-dd");

        expect(units).toBeGreaterThanOrEqual(17.57);
    });

    test("getColumnWidth_LongValues_FitsTheWidest", () => {

        const units = Widths.getColumnWidth("Name", null, ["Al", "Bartholomew Smith-Jones", null], "yyyy-mm-dd");

        expect(units).toBeGreaterThan(Widths.getTextWidth("Bartholomew Smith-Jones"));
        expect(units).toBeLessThan(Widths.getTextWidth("Bartholomew Smith-Jones") + 2);
    });

    test("getColumnWidth_VeryLongText_NoWiderThan60", () => {

        expect(Widths.getColumnWidth("Notes", null, ["x".repeat(500)], "yyyy-mm-dd")).toBe(60);
    });

    test("getTextWidth_WideAndNarrowCharacters_MeasuredApart", () => {

        expect(Widths.getTextWidth("WWWW")).toBeGreaterThan(Widths.getTextWidth("0000"));
        expect(Widths.getTextWidth("0000")).toBeGreaterThan(Widths.getTextWidth("iiii"));
        expect(Widths.getTextWidth("ab\nabcd")).toBe(Widths.getTextWidth("abcd"));
    });
});
