// Ren.configure() adds to the config for the rest of the file, so these all share one.
beforeAll(() => {

    Ren.configure({
        formatting: {
            currencyPrefix: "",
            currencySuffix: "€",
            decimalSeparator: ",",
            thousandsSeparator: ".",
            dateFormat: "MM/dd/yyyy",
            dateTimeFormat: "yyyy-MM-dd HH:mm"
        }
    });
});

describe("ValueFormatter with configured formatting", () => {

    const ValueFormatter = Ren.ValueFormatter;
    const Format = Ren.SpreadsheetColumnFormatEnum;

    test("formatCurrency_ConfiguredFormatting_UsesItsSuffixAndSeparators", () => {

        expect(ValueFormatter.formatCurrency(1234.5)).toBe("1.234,50€");
    });

    test("formatPercentage1DP_ConfiguredFormatting_UsesItsDecimalSeparator", () => {

        expect(ValueFormatter.formatPercentage1DP(0.1234)).toBe("12,3%");
    });

    test("localeFormat_D3StyleSpecifier_UsesTheConfiguredFormatting", () => {

        expect(ValueFormatter.locale.format(".1%")(0.05)).toBe("5,0%");
    });

    test("formatValue_DateColumns_UsesTheConfiguredFormats", () => {

        expect(ValueFormatter.formatValue("2024-03-05", 0, Format.Date)).toBe("03/05/2024");
        expect(ValueFormatter.formatValue("2024-03-05 13:04:05", 0, Format.DateTime))
            .toBe("2024-03-05 13:04");
    });

    test("formatValue_NumberColumn_UsesTheConfiguredDecimalSeparator", () => {

        expect(ValueFormatter.formatValue(1234.5678, 0, Format.Number)).toBe("1234,57");
    });

    test("formatDateAndDateTime_SortableDates_UseTheConfiguredFormats", () => {

        expect(ValueFormatter.formatDate("2024-03-05 13:04:05")).toBe("03/05/2024");
        expect(ValueFormatter.formatDateTime("2024-03-05 13:04:05")).toBe("2024-03-05 13:04");
    });

    test("getExcelFormats_ConfiguredFormatting_MatchesIt", () => {

        expect(ValueFormatter.getExcelFormats()).toEqual({
            currency: "0.00\"€\"",
            date: "mm/dd/yyyy",
            dateTime: "yyyy-mm-dd hh:mm"
        });
    });
});

describe("Format labels with configured formatting", () => {

    const findById = (items, id) => {

        for (let i = 0; i < items.length; i++) {

            if (items[i].id === id) return items[i];

            const found = items[i].submenu ? findById(items[i].submenu, id) : null;

            if (found) return found;
        }

        return null;
    };

    test("getMenuItems_AbbreviatedCurrency_LabelsUseTheConfiguredSymbol", () => {

        const items = Ren.ContextMenuItems_Formatting(() => {}, {}).getMenuItems(0, 0);

        expect(findById(items, "format-as-currency-abbreviated-auto-dp").text)
            .toBe("Abbreviated, auto DP (1.5m€, 32k€)");
    });

    test("getMenuItems_CurrencyThousands_LabelUsesTheConfiguredSymbol", () => {

        const items = Ren.ContextMenuItems_Formatting(() => {}, {}).getMenuItems(0, 0);

        expect(findById(items, "format-as-currency-thousands").text).toBe("Thousands (32k€)");
    });

    test("getFormatOptions_AbbreviatedCurrency_LabelsUseTheConfiguredSymbol", () => {

        const options = Ren.DataGroupingSettingsEditorFunctionSpecs.getFormatOptions();
        const option = options.find(
            (candidate) => candidate.value === "name:currency-abbreviated-no-dp"
        );

        expect(option.label).toBe("Currency abbreviated (32k€)");
    });
});
