namespace Ren.Client.Tests.Browser;

// These tests cover a date/value chart's label sizes, set in the number editor window.  The window
// reports its number as it changes and has no OK button, so a size is typed and the window closed.
// A size is a rule in the chart's own stylesheet, so these check the size a label is given.
[TestClass]
public class ChartLabelFontSizeTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string AxisTickLabel = ".ren-x-axis text";
    private const string BarValueLabel = ".ren-bar-value-label";

    private const string NumberEditorInput = ".qa-ren-number-editor-input";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task<string> FontSizeAsync(string selector) =>
        Ren.Root.Locator(selector).First.EvaluateAsync<string>("element => window.getComputedStyle(element).fontSize");

    // Sets a label size through a submenu of the chart's menu, such as the "Axes" item's.
    private async Task SetLabelFontSizeAsync(string submenuId, string menuItemId, int size)
    {
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");
        await Ren.Root.MouseOverAsync("#" + submenuId);
        await Ren.Root.ClickAsync("#" + menuItemId);

        var input = Ren.Root.Locator(NumberEditorInput);

        await input.FillAsync("");
        await input.PressSequentiallyAsync(size.ToString());
        await input.PressAsync("Escape");

        await Expect(input).ToHaveCountAsync(0);
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("the axis label size is the size the tick labels are given")]
    public async Task AxisLabelSizeIsTheSizeTheTickLabelsAreGiven()
    {
        await CreateChartAsync();

        Expect(await FontSizeAsync(AxisTickLabel)).Not.ToBe("20px");

        await SetLabelFontSizeAsync("axis-visibility", "axis-label-font-size", 20);

        Expect(await FontSizeAsync(AxisTickLabel)).ToBe("20px");
    }

    [TestMethod("the value label size survives the redraw on closing the window")]
    public async Task ValueLabelSizeSurvivesTheRedrawOnClosingTheWindow()
    {
        await CreateChartAsync();

        Expect(await FontSizeAsync(BarValueLabel)).Not.ToBe("18px");

        await SetLabelFontSizeAsync("chart-labels", "value-label-font-size", 18);

        Expect(await FontSizeAsync(BarValueLabel)).ToBe("18px");
    }

    [TestMethod("a size outside the range the window accepts is ignored")]
    public async Task SizeOutsideTheRangeTheWindowAcceptsIsIgnored()
    {
        await CreateChartAsync();

        var sizeBefore = await FontSizeAsync(AxisTickLabel);

        // The window accepts 4px to 40px.  Each keystroke is reported, so a size above the range
        // would be set digit by digit on the way, whereas a single digit below it never is.
        await SetLabelFontSizeAsync("axis-visibility", "axis-label-font-size", 2);

        Expect(await FontSizeAsync(AxisTickLabel)).ToBe(sizeBefore);
    }
}
