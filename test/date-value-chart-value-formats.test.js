describe("Ren.DateValueChart_ValueFormats", () => {

    const ValueFormats = Ren.DateValueChart_ValueFormats;

    test("getPieTotalFormats_Unset_Null", () => {

        const props = { visualisation: {} };

        expect(ValueFormats.getPieTotalFormats(props, Ren.SpreadsheetColumnFormatEnum.Number))
            .toBeNull();
    });

    test("getPieTotalFormats_Currency_CurrencyFormatWithFunction", () => {

        const props = { visualisation: { pieTotalFormatFunction: [{ name: "currency" }] } };
        const formats =
            ValueFormats.getPieTotalFormats(props, Ren.SpreadsheetColumnFormatEnum.Number);

        expect(formats.format).toBe(Ren.SpreadsheetColumnFormatEnum.Currency);
        expect(formats.formatFunction.length).toBe(1);
    });

    test("getSubdivisionValueFormats_Unset_Null", () => {

        const props = { visualisation: {} };

        expect(ValueFormats.getSubdivisionValueFormats(props, Ren.SpreadsheetColumnFormatEnum.Number))
            .toBeNull();
    });

    test("getSubdivisionNameFormats_Currency_CurrencyFormatWithFunction", () => {

        const props = { visualisation: { subdivisionNameFormatFunction: [{ name: "currency" }] } };
        const formats =
            ValueFormats.getSubdivisionNameFormats(props, Ren.SpreadsheetColumnFormatEnum.Number);

        expect(formats.format).toBe(Ren.SpreadsheetColumnFormatEnum.Currency);
        expect(formats.formatFunction.length).toBe(1);
    });
});
