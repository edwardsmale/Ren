using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover adding a marker line at a period from the chart's menu, labelled as the
// reader asks, and removing it again from the marker's own menu.  The markers are kept in the
// chart's markerLines, alongside any its report declares.
[TestClass]
public class DateValueChartAddedMarkersTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";
    private const string FirstTick = ".ren-x-axis.ren-date-axis g.tick >> nth=0";
    private const string Marker = ".ren-marker-line";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");

        // The chart's window may still be finding its place, and a right-click that lands beside
        // the tick offers no period to mark, so the tick has to have stopped moving first.
        var last = "";

        await Poll(async () =>
        {
            var box = await Ren.Root.Locator(FirstTick).BoundingBoxAsync();
            var current = box is null ? "" : $"{box.X},{box.Y},{box.Width},{box.Height}";
            var settled = current != "" && current == last;

            last = current;

            return settled;

        }).ToBe(true);
    }

    // Clicks the menu item whose text starts as given, in the newest menu.
    private Task ClickItemStartingAsync(string start) => Poll(() => Page.EvaluateAsync<bool>("""
        text => {

            const menus = document.querySelectorAll(".ren-context-menu");
            const menu = menus[menus.length - 1];
            const item = menu && Array.from(menu.querySelectorAll(".ren-context-menu__item--clickable"))
                .find(node => node.offsetParent !== null && node.textContent.trim().startsWith(text));

            if (!item) return false;

            item.click();

            return true;
        }
        """, start)).ToBe(true);

    private ILocator EditorButton(string name) =>
        Page.GetByRole(AriaRole.Button, new() { Name = name, Exact = true }).Last;

    private async Task AddMarkerAsync(string label)
    {
        await DateValueChart.OpenMenuAsync(Ren, FirstTick);
        await ClickItemStartingAsync("Add marker at ");

        var editor = Page.Locator("textarea").Last;

        await Expect(editor).ToBeVisibleAsync();
        await editor.FillAsync(label);
        await EditorButton("OK").ClickAsync();
        await Ren.WaitUntilLoadedAsync();
    }

    private Task<string> FirstTickDateAsync() => Ren.Root.Locator(FirstTick)
        .EvaluateAsync<string>("tick => Ren.DateUtils.toSortableDate(Ren.Svg.getDatum(tick))");

    private ILocator MarkerLabelled(string label) => Ren.Root.Locator($"{Marker}[data-qa-marker-line='{label}']");

    [TestMethod("offers to add a marker at the period right-clicked, naming it")]
    public async Task OffersToAddAMarkerAtThePeriodRightClickedNamingIt()
    {
        await CreateChartAsync();

        await DateValueChart.OpenMenuAsync(Ren, FirstTick);

        var texts = await Page.EvaluateAsync<string[]>("""
            () => Array.from(document.querySelectorAll(".ren-context-menu .ren-context-menu__item--clickable"))
                .map(item => item.textContent.trim())
            """);

        Expect(texts.Any(text => Regex.IsMatch(text, @"^Add marker at .+\.\.\.$"))).ToBe(true);
    }

    [TestMethod("adds a labelled marker at the start of the period")]
    public async Task AddsALabelledMarkerAtTheStartOfThePeriod()
    {
        await CreateChartAsync();
        await AddMarkerAsync("Launch");

        var marker = MarkerLabelled("Launch");

        await Expect(marker).ToHaveCountAsync(1);
        await Expect(marker).ToHaveAttributeAsync("data-marker-date", await FirstTickDateAsync());
        await Expect(marker.Locator(".ren-marker-line-label")).ToContainTextAsync("Launch");
    }

    [TestMethod("labels a marker given no label with its date")]
    public async Task LabelsAMarkerGivenNoLabelWithItsDate()
    {
        await CreateChartAsync();
        await AddMarkerAsync("  ");

        var marker = Ren.Root.Locator(Marker);

        await Expect(marker).ToHaveCountAsync(1);
        await Expect(marker).ToHaveAttributeAsync("data-qa-marker-line", new Regex(@"^\d\d/\d\d/\d{4}$"));
    }

    [TestMethod("relabels rather than adds again when Apply is pressed before OK")]
    public async Task RelabelsRatherThanAddsAgainWhenApplyIsPressedBeforeOk()
    {
        await CreateChartAsync();

        await DateValueChart.OpenMenuAsync(Ren, FirstTick);
        await ClickItemStartingAsync("Add marker at ");

        var editor = Page.Locator("textarea").Last;

        await editor.FillAsync("Launch");
        await EditorButton("Apply").ClickAsync();
        await Expect(MarkerLabelled("Launch")).ToHaveCountAsync(1);

        await editor.FillAsync("Relaunch");
        await EditorButton("OK").ClickAsync();

        await Expect(Ren.Root.Locator(Marker)).ToHaveCountAsync(1);
        await Expect(MarkerLabelled("Relaunch")).ToHaveCountAsync(1);
    }

    [TestMethod("removes an added marker from its own menu")]
    public async Task RemovesAnAddedMarkerFromItsOwnMenu()
    {
        await CreateChartAsync();
        await AddMarkerAsync("Launch");
        await AddMarkerAsync("Relaunch");

        await Expect(Ren.Root.Locator(Marker)).ToHaveCountAsync(2);

        await DateValueChart.ClickMenuPathOnAsync(
            Ren,
            $"{Marker}[data-qa-marker-line='Launch'] .ren-marker-line__line--hit",
            "Remove this marker");

        await Expect(Ren.Root.Locator(Marker)).ToHaveCountAsync(1);
        await Expect(MarkerLabelled("Relaunch")).ToHaveCountAsync(1);
    }

    [TestMethod("does not offer to remove a marker away from one")]
    public async Task DoesNotOfferToRemoveAMarkerAwayFromOne()
    {
        await CreateChartAsync();
        await AddMarkerAsync("Launch");

        await DateValueChart.OpenMenuAsync(Ren, FirstTick);

        var texts = await Page.EvaluateAsync<string[]>("""
            () => Array.from(document.querySelectorAll(".ren-context-menu .ren-context-menu__item--clickable"))
                .filter(item => item.offsetParent !== null)
                .map(item => item.textContent.trim())
            """);

        Expect(texts).Not.ToContain("Remove this marker");
    }
}
