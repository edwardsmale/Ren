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
});
