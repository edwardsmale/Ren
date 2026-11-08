using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the paging bar and the stat bar beneath a data grid: where each is placed once
// the grid is paged, and the stat bar's row count.
[TestClass]
public class DataGridBarsTests : BrowserTest
{
    private const string Fixture = "ported/DataGroupingSettingsTest04.html";

    private static readonly Regex PlacedByLeftAndTop = new(@"^left:\d+px top:-?\d+(\.\d+)?px right: bottom:$");

    private async Task EnablePagingAsync()
    {
        await Ren.Report.ChooseFromCellMenuAsync("CreatedOn", 2, "#layout-menu", "#layout-paging");
        await Ren.WaitUntilLoadedAsync();
    }

    // Gets the left, top, right and bottom set inline on the absolutely positioned element that the
    // element matching a selector is in.
    private async Task<string> InlinePositionAsync(string selector)
    {
        var element = Ren.Report.Locator(selector).First;

        await element.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        return await element.EvaluateAsync<string>("""
            (element) => {

                while (element.style.position !== "absolute") {
                    element = element.parentElement;
                }

                const style = element.style;

                return ["left", "top", "right", "bottom"]
                    .map(name => name + ":" + style[name])
                    .join(" ");
            }
            """);
    }

    [TestMethod("the paging bar is placed at the grid's left edge")]
    public async Task ThePagingBarIsPlacedAtTheGridsLeftEdge()
    {
        await Ren.OpenAsync(Fixture);
        await EnablePagingAsync();

        var position = await InlinePositionAsync(".ren-paging-bar");

        Expect(position).ToMatch(PlacedByLeftAndTop);
        Expect(position.StartsWith("left:0px ", StringComparison.Ordinal)).ToBe(true);
    }

    [TestMethod("the stat bar is placed by its left and top")]
    public async Task TheStatBarIsPlacedByItsLeftAndTop()
    {
        await Ren.OpenAsync(Fixture);
        await EnablePagingAsync();

        Expect(await InlinePositionAsync(".ren-stat-bar")).ToMatch(PlacedByLeftAndTop);
    }

    [TestMethod("the grid set's element takes in its stat bar")]
    public async Task TheGridSetsElementTakesInItsStatBar()
    {
        await Ren.OpenAsync(Fixture);

        var statBar = Ren.Report.Locator(".ren-visualisation--stat-bar").First;
        await statBar.WaitForAsync(new() { State = WaitForSelectorState.Visible });

        // Placing the bars and reserving room for them are deferred.
        await Poll(() => statBar.EvaluateAsync<bool>("""
            (element) => {

                const gridSetElement = element.parentElement;

                return gridSetElement.getBoundingClientRect().bottom >=
                    element.getBoundingClientRect().bottom;
            }
            """)).ToBe(true);
    }

    [TestMethod("the stat bar counts the grid's rows")]
    public async Task TheStatBarCountsTheGridsRows()
    {
        await Ren.OpenAsync(Fixture);

        // Read before selecting, which changes what the stat bar shows.
        var statBar = Ren.Report.Locator(".ren-stat-bar__value").First;
        await Expect(statBar).ToHaveTextAsync(new Regex(@"^Rows: [\d,]+$"));
        var rowCount = int.Parse((await statBar.TextContentAsync())!.Split(":")[1].Replace(",", "").Trim());

        await Ren.Report.SelectAllAsync();

        // Less the headings and totals rows.
        var lines = Tsv(await Ren.Report.SelectedTextAsync()).Split("\n");
        Expect(rowCount).ToBe(lines.Length - 2);
    }
}
