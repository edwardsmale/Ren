using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Hover > Show change on period before item, which follows each value
// in the hovered values box with its change on the period before, as a signed percentage.  It is
// offered only once the hovered values are shown, and the first period has nothing to change from.
[TestClass]
public class DateValueChartHoverChangeTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task ShowChangesAsync()
    {
        await DateValueChart.ClickMenuPathAsync(Ren, "Hover", "Show hovered values");
        await DateValueChart.ClickMenuPathAsync(Ren, "Hover", "Show change on period before");
    }

    private Task<double[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    // Hovers the bar of a period, by its place among the bars, and gets the change the box shows
    // against each value, null where it shows none.
    private async Task<string?[]> HoverBarAsync(int barIndex)
    {
        await Page.Mouse.MoveAsync(0, 0);
        await Ren.Root.Locator(".ren-bar.ren-vertical[data-series='1']").Nth(barIndex).HoverAsync();

        await Poll(() => Page.EvaluateAsync<bool>("() => Ren.QA.DateValueChart.getHoverDateLine().shown")).ToBe(true);

        return await Page.EvaluateAsync<string?[]>(
            "() => Ren.QA.DateValueChart.getHoverDateLine().values.map(value => value.change ?? null)");
    }

    private static string ExpectedChange(double value, double previousValue)
    {
        var percent = (value - previousValue) / Math.Abs(previousValue) * 100;
        var text = Math.Abs(percent).ToString(Math.Abs(percent) < 10 ? "F1" : "F0", CultureInfo.InvariantCulture);

        return double.Parse(text, CultureInfo.InvariantCulture) == 0 ? "0%" : (percent > 0 ? "+" : "−") + text + "%";
    }

    [TestMethod("follows a value with its change on the period before")]
    public async Task FollowsAValueWithItsChangeOnThePeriodBefore()
    {
        await CreateChartAsync();
        await ShowChangesAsync();

        var values = await PlottedValuesAsync();
        var last = values.Length - 1;

        var hovered = await HoverBarAsync(last);

        Expect(hovered[0]).ToBe(ExpectedChange(values[last], values[last - 1]));
        await Expect(Ren.Root.Locator(".ren-hover-values-change")).ToHaveTextAsync(" " + hovered[0]);
    }

    [TestMethod("shows no change for the first period")]
    public async Task ShowsNoChangeForTheFirstPeriod()
    {
        await CreateChartAsync();
        await ShowChangesAsync();

        var hovered = await HoverBarAsync(0);

        Expect(hovered[0]).ToBeNull();
        await Expect(Ren.Root.Locator(".ren-hover-values-change")).ToHaveCountAsync(0);
    }

    [TestMethod("shows no change until turned on")]
    public async Task ShowsNoChangeUntilTurnedOn()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Hover", "Show hovered values");

        var hovered = await HoverBarAsync(1);

        Expect(hovered[0]).ToBeNull();
    }

    [TestMethod("is offered only once the hovered values are shown")]
    public async Task IsOfferedOnlyOnceTheHoveredValuesAreShown()
    {
        await CreateChartAsync();
        await DateValueChart.HoverMenuPathAsync(Ren, "Hover");

        await Expect(Ren.Root.Locator("#show-hover-values")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#show-hover-change")).ToHaveCountAsync(0);
    }
}
