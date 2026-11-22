const BRITISH = {
    currencyPrefix: "£",
    currencySuffix: "",
    decimalSeparator: ".",
    thousandsSeparator: ",",
    minusSign: "-"
};

const GERMAN = {
    currencyPrefix: "",
    currencySuffix: " €",
    decimalSeparator: ",",
    thousandsSeparator: ".",
    minusSign: "−"
};

describe("NumberFormat", () => {

    const format = (settings, specifier, value) =>
        Ren.NumberFormat.create(settings, specifier)(value);

    test("create_CurrencySpecifier_GroupsAndPrefixes", () => {

        expect(format(BRITISH, "$,.2f", 1234567.891)).toBe("£1,234,567.89");
        expect(format(BRITISH, "$,.2f", -1234.5)).toBe("-£1,234.50");
    });

    test("create_OtherSettings_UsesTheirSeparatorsAndSuffix", () => {

        expect(format(GERMAN, "$,.2f", -1234567.891)).toBe("−1.234.567,89 €");
    });

    test("create_PercentageSpecifier_MultipliesBy100", () => {

        expect(format(BRITISH, ".1%", 0.1234)).toBe("12.3%");
        expect(format(BRITISH, ".1%", 0.05)).toBe("5.0%");
        // The 0 is the zero-fill flag and the .0 the precision.
        expect(format(BRITISH, "0.0%", 0.05)).toBe("5%");
    });

    test("create_Width_PadsWithSpacesOrZeros", () => {

        expect(format(BRITISH, "5.0%", 0.05)).toBe("   5%");
        expect(format(BRITISH, "08.2f", -1.5)).toBe("-0001.50");
        expect(format(BRITISH, "2.2f", 123.4)).toBe("123.40");
    });

    test("create_TrimFlag_DropsTrailingZeros", () => {

        expect(format(BRITISH, ".2~f", 1.5)).toBe("1.5");
        expect(format(BRITISH, ".2~f", 2)).toBe("2");
    });

    test("create_PlusFlag_ShowsEitherSign", () => {

        expect(format(BRITISH, "+.0f", 5)).toBe("+5");
        expect(format(BRITISH, "+.0f", -5)).toBe("-5");
    });

    test("create_NegativeRoundingToZero_DropsTheMinusSign", () => {

        expect(format(BRITISH, ".0f", -0.2)).toBe("0");
    });

    test("create_NoPrecision_DefaultsToSixPlaces", () => {

        expect(format(BRITISH, "f", 1.5)).toBe("1.500000");
    });

    test("create_NotANumber_ReturnsNaN", () => {

        expect(format(BRITISH, ".2f", "x")).toBe("NaN");
    });

    test("create_UnsupportedSpecifier_Throws", () => {

        expect(() => Ren.NumberFormat.create(BRITISH, ".2s")).toThrow();
    });
});

describe("DatePattern", () => {

    const PARTS = { year: 2024, month: 3, day: 5, hour: 9, minute: 4, second: 7 };

    test("compile_PaddedTokens_PadsToTwoDigits", () => {

        expect(Ren.DatePattern.compile("dd/MM/yyyy HH:mm:ss")(PARTS)).toBe("05/03/2024 09:04:07");
    });

    test("compile_UnpaddedAndNamedTokens_WritesThem", () => {

        expect(Ren.DatePattern.compile("d MMM yy, H:mm")(PARTS)).toBe("5 Mar 24, 9:04");
        expect(Ren.DatePattern.compile("MMMM d")(PARTS)).toBe("March 5");
    });

    test("compile_DigitStringParts_FormatsThem", () => {

        const parts = { year: "2024", month: "03", day: "05" };

        expect(Ren.DatePattern.compile("M/d/yyyy")(parts)).toBe("3/5/2024");
    });

    test("compile_QuotedText_WritesItAsItIs", () => {

        expect(Ren.DatePattern.compile("dd 'of' MMM")(PARTS)).toBe("05 of Mar");
        expect(Ren.DatePattern.compile("HH'h'mm''")(PARTS)).toBe("09h04'");
    });

    test("toExcelFormat_APattern_UsesExcelLetters", () => {

        expect(Ren.DatePattern.toExcelFormat("dd/MM/yyyy HH:mm:ss")).toBe("dd/mm/yyyy hh:mm:ss");
    });

    test("toExcelFormat_TextLiteral_QuotesIt", () => {

        expect(Ren.DatePattern.toExcelFormat("dd 'de' MMMM")).toBe("dd\" de \"mmmm");
    });
});
