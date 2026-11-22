using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the change chart, which draws each label's before and after values on one row
// with an arrow between them.
[TestClass]
public class ChangeChartTests : BrowserTest
{
    private sealed record OpenedReport(string Url, string Title);

    private ILocator GetChart(string containerClass) => Page.Locator($".{containerClass} .ren-change-chart");

    // Replaces Ren.ShowPopupReport with a stub recording what it's asked to open.
    private Task StubPopupReportsAsync() => Page.EvaluateAsync("""
        () => {
            window.openedPopupReports = [];
            window.Ren.ShowPopupReport = (url, title) => window.openedPopupReports.push({ url, title });
        }
        """);

    private Task<OpenedReport[]> GetOpenedPopupReportsAsync() =>
        EvaluateAsync<OpenedReport[]>("() => window.openedPopupReports");

    [TestMethod("a change chart detects its label and value columns")]
    public async Task AChangeChartDetectsItsLabelAndValueColumns()
    {
        await Ren.OpenAsync("change-chart/change-chart.html");

        var chart = GetChart("detected");

        await Expect(chart).ToHaveAttributeAsync("data-qa-change-chart-label-column", "Term");
        await Expect(chart).ToHaveAttributeAsync("data-qa-change-chart-before-column", "SearchesBefore");
        await Expect(chart).ToHaveAttributeAsync("data-qa-change-chart-after-column", "SearchesAfter");
        await Expect(chart).ToHaveAttributeAsync("data-qa-change-chart-row-count", "4");
    }

    [TestMethod("a change chart draws a row for each label with both values")]
    public async Task AChangeChartDrawsARowForEachLabelWithBothValues()
    {
        await Ren.OpenAsync("change-chart/change-chart.html");

        var chart = GetChart("detected");

        await Expect(chart.Locator(".ren-change-chart__label"))
            .ToHaveTextAsync(new[] { "envelopes", "printer paper", "stapler" });

        var rows = chart.Locator(".ren-change-chart__row");

        await Expect(rows.Nth(0).Locator(".ren-change-chart__change--increase")).ToHaveCountAsync(1);
        await Expect(rows.Nth(1).Locator(".ren-change-chart__change--decrease")).ToHaveCountAsync(1);
        await Expect(rows.Nth(2).Locator(".ren-change-chart__arrow")).ToHaveCountAsync(0);

        var before = (await rows.Nth(0).Locator(".ren-change-chart__before").BoundingBoxAsync())!;
        var after = (await rows.Nth(0).Locator(".ren-change-chart__after").BoundingBoxAsync())!;

        Expect(after.X).ToBeGreaterThan(before.X);
    }

    [TestMethod("a change chart shows its values in its format function")]
    public async Task AChangeChartShowsItsValuesInItsFormatFunction()
    {
        await Ren.OpenAsync("change-chart/change-chart.html");

        var chart = GetChart("configured");

        await Expect(chart.Locator(".ren-change-chart__tick-label").First).ToHaveTextAsync("0%");
        await Expect(chart.Locator(".ren-change-chart__hit-area title").First)
            .ToHaveTextAsync("envelopes\nBefore: 25%\nAfter: 40%");
    }

    [TestMethod("a change chart's legend shows its labels, or else its headings")]
    public async Task AChangeChartsLegendShowsItsLabelsOrElseItsHeadings()
    {
        await Ren.OpenAsync("change-chart/change-chart.html");

        await Expect(GetChart("detected").Locator(".ren-change-chart__legend-text"))
            .ToHaveTextAsync(new[] { "SearchesBefore", "SearchesAfter" });
        await Expect(GetChart("configured").Locator(".ren-change-chart__legend-text"))
            .ToHaveTextAsync(new[] { "Before", "After" });
    }

    [TestMethod("a change chart's labels and arrows open their popup reports")]
    public async Task AChangeChartsLabelsAndArrowsOpenTheirPopupReports()
    {
        await Ren.OpenAsync("change-chart/change-chart.html");

        var chart = GetChart("configured");

        await Expect(chart.Locator(".ren-change-chart__row")).ToHaveCountAsync(4);
        await StubPopupReportsAsync();

        await chart.Locator(".ren-change-chart__label", new() { HasText = "printer paper" }).ClickAsync();
        await chart.Locator(".ren-change-chart__hit-area").First.ClickAsync();

        var opened = await GetOpenedPopupReportsAsync();

        Expect(opened[0].Url).ToMatch(new Regex("^/SearchLog\\?Term=printer%20paper&StartDate=2026-10-01"));
        Expect(opened[0].Title).ToBe("Searches for printer paper");
        Expect(opened[1].Url).ToBe("/TermDetail?Term=envelopes");
        Expect(opened[1].Title).ToBe("Before and after");
    }

    // Text measures nothing in a hidden tab, so a chart drawn there would have no room for its labels.
    [TestMethod("a change chart drawn in a hidden tab is drawn again when shown")]
    public async Task AChangeChartDrawnInAHiddenTabIsDrawnAgainWhenShown()
    {
        await Ren.OpenAsync("change-chart/change-chart-in-tab.html");

        var chart = GetChart("hidden-at-first");

        await chart.Locator(".ren-change-chart__label").First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        await Ren.Root.ClickAsync(
            ".ren-tabbed-module__tab:not(.ren-tabbed-module__tab--selected) .ren-tabbed-module__tab-header");

        await Expect(chart.Locator(".ren-change-chart__label"))
            .ToHaveTextAsync(new[] { "envelopes", "printer paper", "stapler" });

        await Poll(() => chart.Locator(".ren-change-chart__legend > g").Nth(1).EvaluateAsync<double>("""
            element => element.getBoundingClientRect().left
                - element.previousElementSibling.getBoundingClientRect().right
            """)).ToBeGreaterThan(10);
    }
}
