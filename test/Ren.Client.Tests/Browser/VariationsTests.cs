using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a grid's variations: named sets of its settings, applied from the links
// above the grid or from the variations window, where they're also created, updated and removed.
[TestClass]
public class VariationsTests : BrowserTest
{
    // Five variations: Combo, Full, Grouped, Simple and Ungrouped.  It starts grouped by Id.
    private const string VariationLinksFixture = "ported/VariationsTest01.html";

    private static readonly string[] GroupedById =
    {
        "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37"
    };

    private static readonly string[] NotGrouped =
    {
        "22", "22", "23", "23", "24", "24", "25", "25", "26", "26", "27", "27", "28", "29", "30", "30",
        "31", "31", "32", "32", "33", "33", "34", "35", "36", "36", "37", "37"
    };

    private static string KebabCase(string text) => Regex.Replace(text.Trim(), @"\s+", "-").ToLowerInvariant();

    private async Task ClickVariationLinkAsync(string variationName)
    {
        await Ren.Root.ClickAsync(".qa-ren-data-grid-variation-link-" + KebabCase(variationName));
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task OpenVariationsWindowAsync()
    {
        await Ren.Root.ClickAsync(".qa-ren-data-grid-variations-menu-button");
        await Ren.Root.Locator(".qa-ren-data-grid-variations-window-create-input").First.WaitForAsync();
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task CreateVariationAsync(string variationName)
    {
        await Ren.Root.Locator(".qa-ren-data-grid-variations-window-create-input").First.FillAsync(variationName);
        await Ren.Root.ClickAsync(".qa-ren-data-grid-variations-window-create-button");
        await Ren.WaitUntilLoadedAsync();
    }

    private Microsoft.Playwright.ILocator VariationButton(string action, string variationLabel) =>
        Ren.Root.Locator("[data-qa-" + action + "-variation-name=\""
            + variationLabel.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"]");

    private async Task ClickVariationButtonAsync(string action, string variationLabel)
    {
        await VariationButton(action, variationLabel).ClickAsync();
        await Ren.WaitUntilLoadedAsync();
    }

    private Task ExpectVariationLinksAsync(params string[] labels) => Poll(async () =>
        (await Ren.Root.Locator(".qa-ren-data-grid-variation-link").AllInnerTextsAsync()).ToArray()).ToEqual(labels);

    private Task ExpectColumnAsync(string columnHeading, string[] values) => Poll(async () =>
    {
        await Ren.Report.SelectColumnsAsync(columnHeading);

        return await Ren.Report.SelectedTextAsync();

    }).ToBe(columnHeading + "\n" + string.Join("\n", values));

    private Task ExpectColumnsVisibleAsync(string[] columnHeadings, bool visible) => Poll(async () =>
    {
        // A hidden column keeps its header cell, but at no width.  The sort arrow follows the
        // heading on a line of its own.
        var shown = await Ren.Root.Locator(".ren-data-grid__cell.ren-r-0").EvaluateAllAsync<string[]>("""
            cells => cells
                .filter(cell => cell.offsetWidth > 0)
                .map(cell => cell.innerText.split("\n")[0].trim())
            """);

        return columnHeadings.All(heading => shown.Contains(heading) == visible);

    }).ToBe(true);

    private async Task<int> ColumnIndexAsync(string columnHeading) =>
        (await Ren.Report.CellIndexesAsync(columnHeading, 2)).ColumnIndex;

    private async Task<double> ColumnWidthAsync(string columnHeading)
    {
        var index = await ColumnIndexAsync(columnHeading);

        return await Ren.Root.Locator(".ren-data-grid--active .ren-data-grid__column-heading.ren-c-" + index).First
            .EvaluateAsync<double>("element => element.getBoundingClientRect().width");
    }

    private async Task SetColumnWidthAsync(string columnHeading, int width)
    {
        var index = await ColumnIndexAsync(columnHeading);

        await Page.EvaluateAsync(
            "([columnIndexToResize, newWidth]) => window.Ren.Messages.Requests.qaColumnWidthChange.notify(columnIndexToResize, newWidth)",
            new[] { index, width });

        await ExpectColumnWidthAsync(columnHeading, width);
    }

    // Less the border.
    private Task ExpectColumnWidthAsync(string columnHeading, int width) =>
        Poll(async () => Math.Abs(await ColumnWidthAsync(columnHeading) - width)).ToBeLessThan(3);

    [TestMethod("variation links, clicked, apply their settings")]
    public async Task VariationLinksClickedApplyTheirSettings()
    {
        await Ren.OpenAsync(VariationLinksFixture);
        await ExpectColumnAsync("Id", GroupedById);

        var simpleColumns = new[] { "Days Active", "Discontinued", "Product Name" };

        await ClickVariationLinkAsync("simple");
        await ExpectColumnsVisibleAsync(simpleColumns, false);

        await ClickVariationLinkAsync("full");
        await ExpectColumnsVisibleAsync(simpleColumns, true);

        await ClickVariationLinkAsync("ungrouped");
        await ExpectColumnAsync("Id", NotGrouped);

        await ClickVariationLinkAsync("grouped");
        await ExpectColumnAsync("Id", GroupedById);

        await ClickVariationLinkAsync("combo");
        await ExpectColumnAsync("CreatedOn", new[] { "12/01/2024", "15/01/2024", "18/01/2024" });
        await ExpectColumnsVisibleAsync(new[]
        {
            "Id", "Active", "Days Active", "Unique Searches Per Day", "Product Code", "Discontinued", "Product Name"
        }, false);
    }

    // A leading "!" puts a variation first, and isn't shown.
    [TestMethod("variations created, updated and removed show in the links")]
    public async Task VariationsCreatedUpdatedAndRemovedShowInTheLinks()
    {
        await Ren.OpenAsync("ported/VariationsTest02.html");

        await SetColumnWidthAsync("Id", 100);
        await OpenVariationsWindowAsync();
        await CreateVariationAsync("!My Variation");

        await SetColumnWidthAsync("Id", 400);
        await CreateVariationAsync("Another");

        await ExpectVariationLinksAsync("My Variation", "Another");

        await ClickVariationButtonAsync("apply", "My Variation");
        await ExpectColumnWidthAsync("Id", 100);

        await ClickVariationButtonAsync("apply", "Another");
        await ExpectColumnWidthAsync("Id", 400);

        await SetColumnWidthAsync("Id", 600);
        await ClickVariationButtonAsync("update", "Another");
        await ClickVariationButtonAsync("apply", "My Variation");
        await ExpectColumnWidthAsync("Id", 100);
        await ClickVariationButtonAsync("apply", "Another");
        await ExpectColumnWidthAsync("Id", 600);

        await ClickVariationButtonAsync("remove", "My Variation");
        await ExpectVariationLinksAsync("Another");
    }

    // A name's quotes once ended the buttons' onclick early, breaking them or running what followed.
    [TestMethod("variations named with quotes are applied, updated and removed")]
    public async Task VariationsNamedWithQuotesAreAppliedUpdatedAndRemoved()
    {
        const string apostrophe = "Bob's view";
        const string quotes = "x\" onmouseover=\"window.renInjected = true";

        await Ren.OpenAsync("ported/VariationsTest02.html");

        await SetColumnWidthAsync("Id", 100);
        await OpenVariationsWindowAsync();
        await CreateVariationAsync(apostrophe);

        await SetColumnWidthAsync("Id", 400);
        await CreateVariationAsync(quotes);

        await ClickVariationButtonAsync("apply", apostrophe);
        await ExpectColumnWidthAsync("Id", 100);

        await SetColumnWidthAsync("Id", 600);
        await ClickVariationButtonAsync("update", quotes);
        await ClickVariationButtonAsync("apply", apostrophe);
        await ClickVariationButtonAsync("apply", quotes);
        await ExpectColumnWidthAsync("Id", 600);

        await VariationButton("remove", quotes).HoverAsync();
        Expect(await Page.EvaluateAsync<bool>("() => window.renInjected === true")).ToBe(false);

        await ClickVariationButtonAsync("remove", apostrophe);
        await ExpectVariationLinksAsync(quotes);
    }

    [TestMethod("cells selected after a variation is applied are its cells")]
    public async Task CellsSelectedAfterAVariationIsAppliedAreItsCells()
    {
        await Ren.OpenAsync("ported/VariationsTest04.html");

        await ClickVariationLinkAsync("Account");
        await Ren.Report.SelectCellsAsync("Enum Name", 2, "Enum Name", 4);

        Expect(await Ren.Report.SelectedTextAsync()).ToBe("CarrierEnum\nColourEnum\nContactPreferenceEnum");
    }

    // The removed variation was once put back into the settings the next time the page was read.
    [TestMethod("a variation removed stays removed when the window is reopened")]
    public async Task AVariationRemovedStaysRemovedWhenTheWindowIsReopened()
    {
        await Ren.OpenAsync("ported/VariationsTest06.html");

        Microsoft.Playwright.ILocator RemoveButton(string label) =>
            Ren.Root.Locator("[data-qa-remove-variation-name=\"" + label + "\"]");

        await OpenVariationsWindowAsync();
        await Expect(RemoveButton("Simple")).ToHaveCountAsync(1);
        await ClickVariationButtonAsync("remove", "Simple");

        await Ren.Root.ClickAsync(".ren-report-popup-window__close-button");
        await OpenVariationsWindowAsync();

        await Expect(RemoveButton("Full")).ToHaveCountAsync(1);
        await Expect(RemoveButton("Simple")).ToHaveCountAsync(0);
    }
}
