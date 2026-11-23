describe("Ren.DateValueChart_DataExport", () => {

    const DataExport = Ren.DateValueChart_DataExport;

    const createProps = () => ({
        seriesCount: 2,
        series: [{ label: "Net sales" }, {}],
        valueHeadings: ["NetSales", "Orders"],
        dateHeading: "Month"
    });

    const createRows = () => [
        { Month: new Date(2026, 0, 1), NetSales: 1.5, Orders: 3 },
        { Month: new Date(2026, 1, 1), NetSales: null, Orders: 4 }
    ];

    test("copyTsv_OneOfAMultiChartsCharts_EveryChartsRowsOverEverySeries", async () => {

        const writeText = jest.fn(() => Promise.resolve());
        const originalClipboard = navigator.clipboard;

        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true
        });

        const charts = [
            {
                dateHeading: "Year",
                seriesCount: 1,
                series: [{ label: "Partner" }],
                valueHeadings: ["Partner"],
                plottedData: [{ Year: new Date(2025, 0, 1), Partner: 1 }]
            },
            {
                dateHeading: "Year",
                seriesCount: 2,
                series: [{ label: "Other brands" }, { label: "Partner" }],
                valueHeadings: ["Other", "Partner"],
                plottedData: [{ Year: new Date(2026, 0, 1), Other: 2, Partner: 3 }]
            }
        ];

        const props = Object.assign(
            { sharedLegendProps: { sharedLegendCharts: charts } },
            charts[1]
        );

        await DataExport.copyTsv(props);

        Object.defineProperty(navigator, "clipboard", {
            value: originalClipboard,
            configurable: true
        });

        expect(writeText).toHaveBeenCalledWith(
            "Year\tPartner\tOther brands\r\n"
                + "2025-01-01\t1\t\r\n"
                + "2026-01-01\t3\t2\r\n"
        );
    });

    test("toField_Missing_Empty", () => {

        expect(DataExport.toField(null)).toBe("");
        expect(DataExport.toField(undefined)).toBe("");
        expect(DataExport.toField(NaN)).toBe("");
    });

    test("toField_TextWithCommaAndQuote_QuotedWithQuoteDoubled", () => {

        expect(DataExport.toField("A, \"B\"")).toBe("\"A, \"\"B\"\"\"");
    });

    test("toField_TextLikeFormula_MadePlainText", () => {

        expect(DataExport.toField("=SUM(A1)")).toBe("'=SUM(A1)");
    });

    test("toField_NegativeNumber_LeftAsNumber", () => {

        expect(DataExport.toField(-2.5)).toBe("-2.5");
    });

    test("formatDate_Midnight_DayOnly", () => {

        expect(DataExport.formatDate(new Date(2026, 10, 3))).toBe("2026-11-03");
    });

    test("formatDate_WithTime_DayAndTime", () => {

        expect(DataExport.formatDate(new Date(2026, 10, 3, 9, 5, 0))).toBe("2026-11-03 09:05:00");
    });

    test("buildCsv_TwoSeries_DateThenSeriesColumns", () => {

        expect(DataExport.buildCsv(createProps(), createRows())).toBe(
            "Month,Net sales,Orders\r\n2026-01-01,1.5,3\r\n2026-02-01,,4\r\n"
        );
    });

    test("buildCsv_HiddenSeries_LeftOut", () => {

        const props = createProps();

        props.series[1].isEnabled = false;

        expect(DataExport.buildCsv(props, createRows()).split("\r\n")[0]).toBe("Month,Net sales");
    });

    test("toTabField_TextWithCommaAndQuote_LeftAsItIs", () => {

        expect(DataExport.toTabField("Pens, \"blue\"")).toBe("Pens, \"blue\"");
    });

    test("toTabField_TextWithTabsAndLineBreaks_Spaced", () => {

        expect(DataExport.toTabField("Pens\tand\r\npencils")).toBe("Pens and pencils");
    });

    test("toTabField_TextLikeFormula_MadePlainText", () => {

        expect(DataExport.toTabField("=SUM(A1)")).toBe("'=SUM(A1)");
    });

    test("toTabField_DateAndNumber_AsInCsv", () => {

        expect(DataExport.toTabField(new Date(2026, 0, 1))).toBe("2026-01-01");
        expect(DataExport.toTabField(-2.5)).toBe("-2.5");
        expect(DataExport.toTabField(null)).toBe("");
    });

    test("buildTsv_TwoSeries_TabSeparated", () => {

        expect(DataExport.buildTsv(createProps(), createRows())).toBe(
            "Month\tNet sales\tOrders\r\n2026-01-01\t1.5\t3\r\n2026-02-01\t\t4\r\n"
        );
    });

    test("copyTsv_Plotted_TextPutOnClipboard", async () => {

        const writeText = jest.fn(() => Promise.resolve());

        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

        const props = createProps();

        props.plottedData = createRows();

        await DataExport.copyTsv(props);

        expect(writeText).toHaveBeenCalledWith(DataExport.buildTsv(props, props.plottedData));
        expect(DataExport.canCopyText()).toBe(true);

        delete navigator.clipboard;
    });

    const EXCEL_FORMATS = {
        currency: "\"£\"0.00",
        date: "dd/mm/yyyy",
        dateTime: "dd/mm/yyyy hh:mm"
    };

    test("buildExcelSheet_TwoSeries_DateThenSeriesColumns", () => {

        const sheet = DataExport.buildExcelSheet(createProps(), createRows(), EXCEL_FORMATS);

        expect(sheet.columns.map(column => column.heading)).toEqual(["Month", "Net sales", "Orders"]);
        expect(sheet.columns[0].format).toBe("dd/mm/yyyy");
        expect(sheet.rows.length).toBe(2);
        expect(sheet.rows[1]).toEqual([new Date(Date.UTC(2026, 1, 1)), null, 4]);
    });

    test("buildExcelSheet_SeriesFormats_ExcelFormats", () => {

        const props = createProps();
        const formats = Ren.SpreadsheetColumnFormatEnum;

        props.seriesCount = 3;
        props.series.push({});
        props.valueHeadings.push("Share");
        props.valueColumnFormats = [formats.Currency, formats.Integer, formats.Percentage];

        const sheet = DataExport.buildExcelSheet(props, createRows(), EXCEL_FORMATS);

        expect(sheet.columns.slice(1).map(column => column.format))
            .toEqual(["\"£\"0.00", "0", "0.00%"]);
    });

    test("buildExcelSheet_PlainNumberSeries_NoFormat", () => {

        const props = createProps();

        props.valueColumnFormats = [Ren.SpreadsheetColumnFormatEnum.Number];

        const sheet = DataExport.buildExcelSheet(props, createRows(), EXCEL_FORMATS);

        expect(sheet.columns[1].format).toBeNull();
        expect(sheet.columns[2].format).toBeNull();
    });

    test("buildExcelSheet_DateWithTime_DateTimeFormat", () => {

        const rows = createRows();

        rows[1].Month = new Date(2026, 1, 1, 9, 30);

        const sheet = DataExport.buildExcelSheet(createProps(), rows, EXCEL_FORMATS);

        expect(sheet.columns[0].format).toBe("dd/mm/yyyy hh:mm");
    });

    test("buildExcelSheet_HiddenSeries_LeftOut", () => {

        const props = createProps();

        props.series[0].isEnabled = false;

        const sheet = DataExport.buildExcelSheet(props, createRows(), EXCEL_FORMATS);

        expect(sheet.columns.map(column => column.heading)).toEqual(["Month", "Orders"]);
        expect(sheet.rows[0][1]).toBe(3);
    });

    test("buildExcelSheet_NotANumberOrBadDate_Empty", () => {

        const rows = createRows();

        rows[0].Month = new Date(NaN);
        rows[0].NetSales = Infinity;
        rows[0].Orders = "3";

        const sheet = DataExport.buildExcelSheet(createProps(), rows, EXCEL_FORMATS);

        expect(sheet.rows[0]).toEqual([null, null, null]);
    });

    test("buildExcelSheet_SeriesNamedAsDates_KeepsBothColumns", () => {

        const props = createProps();

        props.series[0].label = "Month";

        const sheet = DataExport.buildExcelSheet(props, createRows(), EXCEL_FORMATS);

        expect(sheet.columns.map(column => column.heading)).toEqual(["Month", "Month", "Orders"]);
        expect(sheet.rows[0][0]).toEqual(new Date(Date.UTC(2026, 0, 1)));
        expect(sheet.rows[0][1]).toBe(1.5);
    });

    test("downloadExcel_PlottedData_SheetNamedAsTheFile", async () => {

        const download = jest.spyOn(Ren.XlsxWriter, "download").mockResolvedValue(undefined);
        const props = createProps();

        props.plottedData = createRows();

        jest.spyOn(Ren.DateValueChart_ImageExport, "getFileName")
            .mockReturnValue("Sales: by month [2026].xlsx");

        await DataExport.downloadExcel(props);

        const [sheets, fileName] = download.mock.calls[0];

        expect(fileName).toBe("Sales: by month [2026].xlsx");
        expect(sheets.length).toBe(1);
        expect(sheets[0].name).toBe("Sales: by month [2026]");
        expect(sheets[0].columns.length).toBe(3);
        expect(sheets[0].rows.length).toBe(2);

        jest.restoreAllMocks();
    });

    test("downloadExcel_NoPlottedData_NothingSaved", async () => {

        const download = jest.spyOn(Ren.XlsxWriter, "download").mockResolvedValue(undefined);

        await DataExport.downloadExcel(createProps());

        expect(download).not.toHaveBeenCalled();

        jest.restoreAllMocks();
    });
});
