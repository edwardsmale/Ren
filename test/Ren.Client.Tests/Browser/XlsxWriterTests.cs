namespace Ren.Client.Tests.Browser;

// These tests cover Ren.XlsxWriter, which writes the Excel files the grids and charts save.  Each
// makes a workbook in the page and reads it back with .NET's ZIP and XML readers (see Xlsx).
[TestClass]
public class XlsxWriterTests : BrowserTest
{
    private async Task<Xlsx.Workbook> CreateAsync(object sheets)
    {
        await Ren.OpenAsync("grid.html");

        return await Xlsx.CreateAsync(Page, sheets);
    }

    private static long Utc(int year, int month, int day, int hour = 0, int minute = 0) =>
        new DateTimeOffset(year, month, day, hour, minute, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();

    [TestMethod("writes the headings in bold, in a first row kept in view")]
    public async Task WritesTheHeadingsInBoldInAFirstRowKeptInView()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Sales",
                columns = new object[] { new { heading = "Region", width = 20 }, new { heading = "Units" } },
                rows = new[] { new object[] { "North", 3 } }
            }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet.Name).ToBe("Sales");
        Expect(sheet.Headings).ToEqual(new[] { "Region", "Units" });
        Expect(sheet.Rows[0].Values.All(cell => cell.Bold)).ToBe(true);
        Expect(sheet.Rows[1].Values.Any(cell => cell.Bold)).ToBe(false);
        Expect(sheet.FrozenRows).ToBe(1);
        Expect(sheet.ColumnWidths["A"]).ToBe(20);
    }

    [TestMethod("fits a column without a width to its heading and cells")]
    public async Task FitsAColumnWithoutAWidthToItsHeadingAndCells()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Sales",
                columns = new object[]
                {
                    new { heading = "Qty" },
                    new { heading = "Customer" },
                    new { heading = "Revenue", format = "#,##0.00" }
                },
                rows = new[]
                {
                    new object[] { 1, "Ann", 12.5 },
                    new object[] { 22, "Bartholomew Smith-Jones", 1234567.5 }
                }
            }
        });

        var widths = workbook.Sheets.Single().ColumnWidths;

        // Qty fits its heading and filter button, Customer its longest name, Revenue "1,234,567.50".
        Expect(widths["A"]).ToBeGreaterThan(5);
        Expect(widths["A"]).ToBeLessThan(10);
        Expect(widths["B"]).ToBeGreaterThan(20);
        Expect(widths["B"]).ToBeLessThan(25);
        Expect(widths["C"]).ToBeGreaterThan(10);
        Expect(widths["C"]).ToBeLessThan(13);
    }

    [TestMethod("turns filters on, over the headings and every row, as Data > Filter does")]
    public async Task TurnsFiltersOnOverTheHeadingsAndEveryRow()
    {
        var workbook = await CreateAsync(new object[]
        {
            new
            {
                name = "Bob's sales",
                columns = new object[] { new { heading = "Region" }, new { heading = "Units" }, new { heading = "Price" } },
                rows = new[] { new object[] { "North", 3, 1.5 }, new object[] { "South", 4, 2 } }
            },
            new
            {
                name = "No rows",
                columns = new object[] { new { heading = "Region" } },
                rows = Array.Empty<object[]>()
            },
            new { name = "No columns" }
        });

        Expect(workbook.Sheets.Select(sheet => sheet.Filter).ToArray())
            .ToEqual(new[] { "A1:C3", "A1:A1", null });
        Expect(workbook.Sheets.Select(sheet => sheet.FilterName).ToArray())
            .ToEqual(new[] { "'Bob''s sales'!$A$1:$C$3", "'No rows'!$A$1:$A$1", null });
    }

    [TestMethod("writes text and numbers, leaving out an empty cell and one not a number")]
    public async Task WritesTextAndNumbersLeavingOutEmptyCells()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Values",
                columns = new object[] { new { heading = "A" }, new { heading = "B" }, new { heading = "C" } },
                rows = new[]
                {
                    new object?[] { "Text", 1.25, -3 },
                    new object?[] { null, "", 0 },
                    new object?[] { "x", double.NaN, null }
                }
            }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet["A2"]!.Value).ToBe("Text");
        Expect(sheet["B2"]!.Number).ToBe(1.25);
        Expect(sheet["C2"]!.Number).ToBe(-3.0);
        Expect(sheet["A3"]).ToBeNull();
        Expect(sheet["B3"]).ToBeNull();
        Expect(sheet["C3"]!.Number).ToBe(0.0);
        Expect(sheet["B4"]).ToBeNull();
    }

    [TestMethod("keeps the characters XML and spaces mean something to")]
    public async Task KeepsTheCharactersXmlAndSpacesMeanSomethingTo()
    {
        const string text = "  <b>Fish & \"chips\"</b> 'n' ünïcödé €  ";

        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Text",
                columns = new object[] { new { heading = "A & <B>" } },
                rows = new[] { new object[] { text }, new object[] { "bell\u0007 and tab\t" } }
            }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet.Headings).ToEqual(new[] { "A & <B>" });
        Expect(sheet["A2"]!.Value).ToBe(text);
        Expect(sheet["A3"]!.Value).ToBe("bell and tab\t");
    }

    [TestMethod("writes a date as Excel's number for it, in its column's format")]
    public async Task WritesADateAsExcelsNumberForItInItsColumnsFormat()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Dates",
                columns = new object[] { new { heading = "When", format = "dd/mm/yyyy hh:mm" }, new { heading = "Plain" } },
                rows = new[]
                {
                    new object[] { new { utc = Utc(2026, 4, 1, 9, 30) }, new { utc = Utc(1999, 12, 31) } }
                }
            }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet["A2"]!.Date).ToEqual(new DateTime(2026, 4, 1, 9, 30, 0));
        Expect(sheet["A2"]!.NumberFormat).ToBe("dd/mm/yyyy hh:mm");
        Expect(sheet["B2"]!.Date).ToEqual(new DateTime(1999, 12, 31));
        Expect(sheet["B2"]!.NumberFormat).ToBe("yyyy-mm-dd");
    }

    [TestMethod("shows a number in its column's format")]
    public async Task ShowsANumberInItsColumnsFormat()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Formats",
                columns = new object[]
                {
                    new { heading = "Price", format = "\"$\"0.00" },
                    new { heading = "Share", format = "0.00%" },
                    new { heading = "Count" }
                },
                rows = new[] { new object[] { 9.5, 0.25, 7 } }
            }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet["A2"]!.NumberFormat).ToBe("\"$\"0.00");
        Expect(sheet["B2"]!.NumberFormat).ToBe("0.00%");
        Expect(sheet["C2"]!.NumberFormat).ToBeNull();
    }

    [TestMethod("writes a formula, with the text to show until Excel works it out")]
    public async Task WritesAFormulaWithTheTextToShow()
    {
        var workbook = await CreateAsync(new[]
        {
            new
            {
                name = "Links",
                columns = new object[] { new { heading = "Link" } },
                rows = new[]
                {
                    new object[] { new { formula = "HYPERLINK(\"https://example.com/?a=1&b=2\", \"Example\")", value = "Example" } }
                }
            }
        });

        var cell = workbook.Sheets.Single()["A2"]!;

        Expect(cell.Formula).ToBe("HYPERLINK(\"https://example.com/?a=1&b=2\", \"Example\")");
        Expect(cell.Value).ToBe("Example");
    }

    [TestMethod("names each sheet as Excel allows, numbering any that would repeat")]
    public async Task NamesEachSheetAsExcelAllows()
    {
        var workbook = await CreateAsync(new object[]
        {
            new { name = "Sales: by month [2026]" },
            new { name = "sales: BY month [2026]" },
            new { name = "A name far longer than the thirty-one characters Excel allows" },
            new { name = "A name far longer than the thirty-one characters Excel allows" },
            new { name = "'Quoted'" },
            new { name = "" }
        });

        Expect(workbook.Sheets.Select(sheet => sheet.Name).ToArray()).ToEqual(new[]
        {
            "Sales  by month  2026 ",
            "sales  BY month  2026  (2)",
            "A name far longer than the thir",
            "A name far longer than the  (2)",
            "Quoted",
            "Sheet"
        });
    }

    [TestMethod("writes a sheet with no columns or rows, and a sheet when given none")]
    public async Task WritesEmptySheets()
    {
        await Ren.OpenAsync("grid.html");

        var empty = await Xlsx.CreateAsync(Page, new[] { new { name = "Empty" } });
        var none = await Xlsx.CreateAsync(Page, Array.Empty<object>());

        Expect(empty.Sheets.Single().Rows.Length).ToBe(1);
        Expect(none.Sheets.Single().Name).ToBe("Sheet");
    }

    [TestMethod("writes every row of a large sheet")]
    public async Task WritesEveryRowOfALargeSheet()
    {
        var rows = Enumerable.Range(0, 2500).Select(i => new object[] { "Row " + i, i }).ToArray();

        var workbook = await CreateAsync(new[]
        {
            new { name = "Large", columns = new object[] { new { heading = "Name" }, new { heading = "Index" } }, rows }
        });

        var sheet = workbook.Sheets.Single();

        Expect(sheet.Rows.Length).ToBe(2501);
        Expect(sheet["A2501"]!.Value).ToBe("Row 2499");
        Expect(sheet["B2501"]!.Number).ToBe(2499.0);
    }

    [TestMethod("writes a workbook where the browser can't compress")]
    public async Task WritesAWorkbookWhereTheBrowserCantCompress()
    {
        await Ren.OpenAsync("grid.html");
        await Page.EvaluateAsync("() => { window.CompressionStream = undefined; }");

        var workbook = await Xlsx.CreateAsync(Page, new[]
        {
            new { name = "Stored", columns = new object[] { new { heading = "A" } }, rows = new[] { new object[] { "Kept" } } }
        });

        Expect(workbook.Sheets.Single()["A2"]!.Value).ToBe("Kept");
    }

    [TestMethod("names columns as Excel does")]
    public async Task NamesColumnsAsExcelDoes()
    {
        await Ren.OpenAsync("grid.html");

        var letters = await Page.EvaluateAsync<string[]>(
            "() => [0, 1, 25, 26, 27, 51, 52, 701, 702, 16383].map(Ren.XlsxWriter.getColumnLetters)");

        Expect(letters).ToEqual(new[] { "A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA", "XFD" });
    }

    [TestMethod("saves the workbook as the given file name")]
    public async Task SavesTheWorkbookAsTheGivenFileName()
    {
        await Ren.OpenAsync("grid.html");
        await Xlsx.CatchDownloadsAsync(Page);

        await Page.EvaluateAsync("""
            () => Ren.XlsxWriter.download([{ name: "One", columns: [{ heading: "A" }], rows: [[1]] }], "Saved.xlsx")
            """);

        var workbook = await Xlsx.CaughtWorkbookAsync(Page);

        Expect(workbook.FileName).ToBe("Saved.xlsx");
        Expect(workbook.MimeType).ToBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        Expect(workbook.Sheets.Single()["A2"]!.Number).ToBe(1.0);
    }
}
