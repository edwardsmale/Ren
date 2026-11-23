namespace Ren.Client.Tests.Browser;

// These tests cover a grid's Export Data link, which saves the grid's rows as an Excel file with
// Ren.XlsxWriter.  The file is caught as it's saved, and read back (see Xlsx).
[TestClass]
public class GridExcelExportTests : BrowserTest
{
    private async Task<Xlsx.Workbook> ExportAsync()
    {
        await Xlsx.CatchDownloadsAsync(Page);
        await Ren.Root.Locator(".qa-ren-export-data-link").First.ClickAsync(new() { Force = true });

        return await Xlsx.CaughtWorkbookAsync(Page);
    }

    [TestMethod("writes the grid's columns and rows, each in its column's format")]
    public async Task WritesTheGridsColumnsAndRowsEachInItsColumnsFormat()
    {
        await Ren.OpenAsync("grid.html");

        var workbook = await ExportAsync();
        var sheet = workbook.Sheets.Single();
        var dataRowCount = File.ReadAllLines(Path.Combine(RepoFiles.Root, "examples", "data", "sales.tsv"))
            .Skip(1)
            .Count(line => line != "");

        Expect(workbook.FileName).ToBe("Sales.xlsx");
        Expect(sheet.Name).ToBe("Sales");
        Expect(sheet.Headings).ToEqual(new[] { "Date", "Product", "Category", "Quantity", "Revenue" });
        Expect(sheet.Rows.Length - 1).ToBe(dataRowCount);

        Expect(sheet["A2"]!.Date).ToEqual(new DateTime(2026, 7, 1));
        Expect(sheet["A2"]!.NumberFormat).ToBe("dd/mm/yyyy");
        Expect(sheet["B2"]!.Value).ToBe("Stapler");
        Expect(sheet["D2"]!.Number).ToBe(4.0);
        Expect(sheet["D2"]!.NumberFormat).ToBe("0");
        Expect(sheet["E2"]!.Number).ToBe(14.0);
        Expect(sheet["E2"]!.NumberFormat).ToMatch(@"0\.00");
    }
}
