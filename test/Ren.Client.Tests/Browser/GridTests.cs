namespace Ren.Client.Tests.Browser;

[TestClass]
public class GridTests : BrowserTest
{
    [TestMethod("a renpack data source renders a grid")]
    public async Task RenpackDataSourceRendersAGrid()
    {
        await Ren.OpenAsync("grid.html");

        // The heading text is drawn from its title, and the first column is the hidden count.
        var headings = await Ren.Grid(0).Locator(".ren-data-grid__column-heading")
            .EvaluateAllAsync<string[]>("elements => elements.map(element => element.title)");

        Expect(headings).ToEqual(new[] { "Count", "Date", "Product", "Category", "Quantity", "Revenue" });
    }

    [TestMethod("an embedded data source renders without a request")]
    public async Task EmbeddedDataSourceRendersWithoutARequest()
    {
        var requestedUrls = new List<string>();

        Page.Request += (_, request) => { lock (requestedUrls) requestedUrls.Add(request.Url); };

        await Ren.OpenAsync("inline-data.html");

        Expect(requestedUrls.Where(url => url.Contains("/inline/")).ToArray()).ToEqual(Array.Empty<string>());
        // Three data rows, then the totals row.
        await Expect(Ren.Grid(0).Locator(".ren-data-grid__cell.ren-c-1:not(.ren-h):not(.ren-data-grid__cell--group)"))
            .ToHaveCountAsync(3);
        Expect(await Ren.Grid(0).RowTextAsync(1))
            .ToEqual(new[] { "01/07/2026", "Stapler", "Desk accessories", "4", "£14.00" });
    }

    [TestMethod("each grid on a page has its own index")]
    public async Task EachGridOnAPageHasItsOwnIndex()
    {
        await Ren.OpenAsync("two-grids.html");

        Expect(await Ren.Grid(0).DataGridIndexAsync()).ToBe(0);
        Expect(await Ren.Grid(1).DataGridIndexAsync()).ToBe(1);

        var firstProducts = await Ren.Grid(0).ColumnTextAsync("Product");
        var secondProducts = await Ren.Grid(1).ColumnTextAsync("Product");

        Expect(firstProducts).ToContain("Stapler");
        Expect(secondProducts).ToEqual(firstProducts);
    }
}
