namespace Ren.Client.Tests.Browser;

// The date selector and date range summary show the report's own dates without a data source, and
// a data source's where one is registered for every one of them or given on the element.
[TestClass]
public class DateComponentsTests : BrowserTest
{
    private Task<string> SelectorTextAsync() => Page.Locator(".ren-web-report-date-selector").First.InnerTextAsync();

    private Task<string> SummaryTextAsync(int index = 0) => Page.Locator(".ren-date-range-summary").Nth(index).InnerTextAsync();

    [TestMethod("Without a data source › the date selector shows the report's dates")]
    public async Task WithoutADataSource_DateSelectorShowsTheReportsDates()
    {
        await Ren.OpenAsync("date-components/without-data-sources.html");

        var text = await SelectorTextAsync();

        Expect(text).ToContain("Q2 2025");
        Expect(text).ToContain("Q2 2024");
    }

    [TestMethod("Without a data source › the date range summary shows the report's dates")]
    public async Task WithoutADataSource_DateRangeSummaryShowsTheReportsDates()
    {
        await Ren.OpenAsync("date-components/without-data-sources.html");

        Expect(await SummaryTextAsync()).ToBe("Q2 2025 compared with Q2 2024");
    }

    [TestMethod("With a registered data source › the date selector shows its dates")]
    public async Task WithARegisteredDataSource_DateSelectorShowsItsDates()
    {
        await Ren.OpenAsync("date-components/registered-defaults.html");

        Expect(await SelectorTextAsync()).ToContain("Q1 2025");
    }

    [TestMethod("With a registered data source › the date range summary shows its dates")]
    public async Task WithARegisteredDataSource_DateRangeSummaryShowsItsDates()
    {
        await Ren.OpenAsync("date-components/registered-defaults.html");

        Expect(await SummaryTextAsync()).ToBe("Q1 2025");
    }

    [TestMethod("With a registered data source › an element's own data source wins")]
    public async Task WithARegisteredDataSource_ElementsOwnDataSourceWins()
    {
        await Ren.OpenAsync("date-components/registered-defaults.html");

        Expect(await SummaryTextAsync(1)).ToBe("Q3 2025");
    }
}
