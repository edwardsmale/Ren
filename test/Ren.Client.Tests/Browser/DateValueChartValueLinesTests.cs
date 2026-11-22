using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a value axis' Add value line... and Remove value lines items.  A value line is
// drawn across the plot at the value typed in, labelled with the label typed in or else its value,
// and holds its axis open to its value, so that a target above every value plotted still shows.
[TestClass]
public class DateValueChartValueLinesTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task<double> HighestPlottedValueAsync() =>
        (await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)"))
            .Where(value => value.HasValue)
            .Max(value => value!.Value);

    private static string Round(double value) =>
        Math.Round(value, MidpointRounding.AwayFromZero).ToString(CultureInfo.InvariantCulture);

    // Answers the prompts for the line's value then its label, in turn.
    private void AnswerPrompts(params string[] answers)
    {
        var remaining = new Queue<string>(answers);

        Page.Dialog += async (_, dialog) => await dialog.AcceptAsync(remaining.TryDequeue(out var answer) ? answer : "");
    }

    private async Task AddValueLineAsync(string value, string label)
    {
        AnswerPrompts(value, label);

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-line-add-left");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("draws a labelled line at the value typed in")]
    public async Task DrawsALabelledLineAtTheValueTypedIn()
    {
        await CreateChartAsync();

        var value = Round(await HighestPlottedValueAsync() / 2);

        await AddValueLineAsync(value, "Target");

        await Expect(Ren.Root.Locator(".ren-value-line")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator(".ren-value-line-label")).ToHaveTextAsync("Target");
    }

    [TestMethod("labels a line without a label with its value")]
    public async Task LabelsALineWithoutALabelWithItsValue()
    {
        await CreateChartAsync();
        await AddValueLineAsync("12", "");

        await Expect(Ren.Root.Locator(".ren-value-line-label")).ToHaveTextAsync("12");
    }

    [TestMethod("holds the axis open to a line above every value plotted")]
    public async Task HoldsTheAxisOpenToALineAboveEveryValuePlotted()
    {
        await CreateChartAsync();

        var value = Round(await HighestPlottedValueAsync() * 10);

        await AddValueLineAsync(value, "Stretch");

        // A line beyond its axis' range isn't drawn, so drawn, the axis reaches it.
        await Expect(Ren.Root.Locator(".ren-value-line")).ToHaveCountAsync(1);

        var lineY = double.Parse((await Ren.Root.Locator(".ren-value-line").GetAttributeAsync("y1"))!, CultureInfo.InvariantCulture);

        Expect(lineY).ToBeGreaterThanOrEqual(0);
    }

    [TestMethod("removes the axis' value lines")]
    public async Task RemovesTheAxisValueLines()
    {
        await CreateChartAsync();
        await AddValueLineAsync("12", "");
        await Expect(Ren.Root.Locator(".ren-value-line")).ToHaveCountAsync(1);

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-lines-remove-left");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Ren.Root.Locator(".ren-value-line")).ToHaveCountAsync(0);
    }

    [TestMethod("draws nothing where the value typed in isn't a number")]
    public async Task DrawsNothingWhereTheValueTypedInIsntANumber()
    {
        await CreateChartAsync();
        await AddValueLineAsync("lots", "");

        await Expect(Ren.Root.Locator(".ren-value-line")).ToHaveCountAsync(0);
    }

    // The chart is drawn at one size and scaled to fit its container, so a line must be scaled with it.
    [TestMethod("spans the plot and meets its value's tick, at the size the chart is shown")]
    public async Task SpansThePlotAndMeetsItsValuesTickAtTheSizeTheChartIsShown()
    {
        await CreateChartAsync();

        var tick = Ren.Root.Locator($"{LeftAxis} .tick").Last;
        var tickValue = (await tick.Locator("text").TextContentAsync())!.Trim();

        await AddValueLineAsync(tickValue, "");

        var line = (await Ren.Root.Locator(".ren-value-line").BoundingBoxAsync())!;
        var dateAxis = (await Ren.Root.Locator(".ren-date-axis .domain").First.BoundingBoxAsync())!;
        var tickMark = (await tick.Locator("path").BoundingBoxAsync())!;

        Expect(Math.Abs(line.X - dateAxis.X)).ToBeLessThan(2);
        Expect(Math.Abs(line.Width - dateAxis.Width)).ToBeLessThan(2);
        Expect(Math.Abs((line.Y + line.Height / 2) - (tickMark.Y + tickMark.Height / 2))).ToBeLessThan(2);
    }
}
