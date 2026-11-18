namespace Ren.Client.Tests.Browser;

// These tests cover the settings window a date/value chart's cog opens.  Its Individual Series
// tab offers what a series' own menu does, as well as the chart's menu items that act on series.
// The last period estimate is the chart's, so it's with the dates on the Chart tab.
[TestClass]
public class DateValueChartSettingsWindowTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task OpenIndividualSeriesTabAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);

        await Ren.Root.ClickAsync(".ren-date-value-chart-column-pickers__settings");
        await Page.Locator(".ren-menu-settings-window").GetByText("Individual Series", new() { Exact = true }).ClickAsync();
    }

    [TestMethod("the Individual Series tab: offers the series' own items under Series")]
    public async Task OffersTheSeriesOwnItemsUnderSeries()
    {
        await OpenIndividualSeriesTabAsync();

        var window = Page.Locator(".ren-menu-settings-window");

        await Expect(window.Locator(".ren-menu-settings-form__subtab--selected:visible")).ToHaveTextAsync("Series");

        foreach (var text in new[] { "Assign axis", "Colour", "Draw as", "Labels" })
        {
            await Expect(window.Locator($":visible:text-is('{text}')").First).ToBeVisibleAsync();
        }
    }

    [TestMethod("the Chart tab: offers the last period estimate with the dates")]
    public async Task OffersTheLastPeriodEstimateWithTheDates()
    {
        await OpenIndividualSeriesTabAsync();

        var window = Page.Locator(".ren-menu-settings-window");

        await window.GetByText("All Series", new() { Exact = true }).ClickAsync();
        await Expect(window.Locator(":visible:text-is('Estimate last period')")).ToHaveCountAsync(0);

        await window.GetByText("Chart", new() { Exact = true }).ClickAsync();
        await window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Dates" }).First.ClickAsync();
        await Expect(window.Locator(":visible:text-is('Estimate last period')").First).ToBeVisibleAsync();
    }

    [TestMethod("the All Series tab: offers every kind Draw as has as one choice")]
    public async Task OffersEveryDrawAsKindAsOneChoice()
    {
        await OpenIndividualSeriesTabAsync();

        var window = Page.Locator(".ren-menu-settings-window");

        await window.GetByText("All Series", new() { Exact = true }).ClickAsync();
        await window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Appearance" }).First.ClickAsync();

        var kinds = window.Locator(".ren-menu-settings-form__radios:visible", new() { Has = Page.Locator(".ren-menu-settings-form__radio-text:text-is('Bars')") });

        await Expect(kinds).ToHaveCountAsync(1);
        await Expect(kinds.Locator(".ren-menu-settings-form__radio-text")).ToHaveTextAsync(new[] { "Bars", "Lines", "Dots", "Pies" });
    }

    // A new series has no aggregation of its own, so the one it's grouped by by default shows.
    [TestMethod("the All Series tab: shows the aggregation a new series is grouped by")]
    public async Task ShowsTheAggregationANewSeriesIsGroupedBy()
    {
        await OpenIndividualSeriesTabAsync();

        var window = Page.Locator(".ren-menu-settings-window");

        await window.GetByText("All Series", new() { Exact = true }).ClickAsync();

        var aggregation = window.Locator(".ren-menu-settings-form__row:visible", new() { Has = Page.Locator(":text-is('Aggregation')") }).Locator("select");
        var shown = await aggregation.EvaluateAsync<string>("select => select.selectedOptions[0]?.textContent ?? ''");

        Assert.AreNotEqual("", shown.Trim());
    }
}
