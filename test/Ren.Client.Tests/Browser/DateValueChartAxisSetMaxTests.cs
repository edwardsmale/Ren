using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a value axis' Set max... item, which shows the axis up to the value typed in,
// rounded up to a tick as the axis' top always is, and leaves it as it was for anything but a
// number above nothing.  The axis' Reset item fits it to the values again.
[TestClass]
public class DateValueChartAxisSetMaxTests : BrowserTest
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

    private async Task<string> TopTickTextAsync() =>
        (await Ren.Root.Locator($"{LeftAxis} .tick text").Last.TextContentAsync())!.Trim();

    private static string Format(double value) => value.ToString(CultureInfo.InvariantCulture);

    private static double Number(string? text) => double.Parse(text!, CultureInfo.InvariantCulture);

    // Answers each prompt in turn, keeping the text each offered.
    private List<string> AnswerPrompts(params string[] answers)
    {
        var remaining = new Queue<string>(answers);
        var offered = new List<string>();

        Page.Dialog += async (_, dialog) =>
        {
            offered.Add(dialog.DefaultValue);
            await dialog.AcceptAsync(remaining.TryDequeue(out var answer) ? answer : "");
        };

        return offered;
    }

    private async Task SetMaxAsync()
    {
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#set-max-left");
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task AddValueLineAsync()
    {
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-line-add-left");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("shows the axis up to the value typed in, at the top of the plot")]
    public async Task ShowsTheAxisUpToTheValueTypedInAtTheTopOfThePlot()
    {
        await CreateChartAsync();

        // A round value, well above every value plotted, which is a tick of its own.
        var max = Math.Pow(10, Math.Ceiling(Math.Log10(await HighestPlottedValueAsync() * 3)));

        // A line at the maximum, drawn first, is along the top of the axis once it is set.
        AnswerPrompts(Format(max), "", Format(max));

        await AddValueLineAsync();
        await SetMaxAsync();

        var lineY = Number(await Ren.Root.Locator(".ren-value-line").GetAttributeAsync("y1"));

        Expect(Math.Abs(lineY)).ToBeLessThan(0.5);
        Expect(Number((await TopTickTextAsync()).Replace(",", ""))).ToBe(max);
    }

    [TestMethod("offers the value the axis shows up to now")]
    public async Task OffersTheValueTheAxisShowsUpToNow()
    {
        await CreateChartAsync();

        var offered = AnswerPrompts("500", "");

        await SetMaxAsync();

        Expect(Number(offered[0])).ToBeGreaterThanOrEqual(await HighestPlottedValueAsync());

        await SetMaxAsync();

        Expect(offered[1]).ToBe("500");
    }

    [TestMethod("rounds a value between ticks up to the next")]
    public async Task RoundsAValueBetweenTicksUpToTheNext()
    {
        await CreateChartAsync();

        var max = Math.Round(await HighestPlottedValueAsync() * 3, MidpointRounding.AwayFromZero) + 7;

        // A line at the value typed in is drawn, so is on the axis, and near its top.
        AnswerPrompts(Format(max), "", Format(max));

        await AddValueLineAsync();
        await SetMaxAsync();

        var lineY = Number(await Ren.Root.Locator(".ren-value-line").GetAttributeAsync("y1"));
        var zeroY = await Ren.Root.Locator($"{LeftAxis} .tick").First.EvaluateAsync<double>(
            """tick => Number(/,\s*([\d.]+)\)/.exec(tick.getAttribute("transform"))[1])""");

        Expect(lineY).ToBeGreaterThanOrEqual(0);
        Expect(lineY / zeroY).ToBeLessThan(0.1);
    }

    [TestMethod("leaves the axis as it was where the value typed in isn't a number")]
    public async Task LeavesTheAxisAsItWasWhereTheValueTypedInIsntANumber()
    {
        await CreateChartAsync();

        var before = await TopTickTextAsync();

        AnswerPrompts("lots");

        await SetMaxAsync();

        Expect(await TopTickTextAsync()).ToBe(before);
    }

    [TestMethod("fits the axis to the values again once reset")]
    public async Task FitsTheAxisToTheValuesAgainOnceReset()
    {
        await CreateChartAsync();

        var before = await TopTickTextAsync();
        var max = Math.Round(await HighestPlottedValueAsync() * 10, MidpointRounding.AwayFromZero);

        AnswerPrompts(Format(max));

        await SetMaxAsync();
        await Poll(TopTickTextAsync).Not.ToBe(before);

        await DateValueChart.ClickMenuPathOnAsync(Ren, LeftAxis, "Reset");

        await Poll(TopTickTextAsync).ToBe(before);
    }
}
