using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover how a date/value chart's bar value labels are laid out, as chosen from its
// "Bar value labels" submenu.  A label is written across, up or slanted along its bar, inside it
// where it fits and beyond its end where it doesn't, each placement marked by a class on the label.
// "Automatic" writes them across while most fit, and above the bars otherwise.  A single series
// has six wide bars, while splitting it by Search Terms draws sixteen narrow ones side by side.
[TestClass]
public class DateValueChartBarValueLabelsTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string Label = ".ren-bar-value-label";
    private const string Vertical = ".ren-bar-value-label--vertical";
    private const string Diagonal = ".ren-bar-value-label--diagonal";
    private const string Inside = ".ren-bar-value-label--inside";
    private const string Outside = ".ren-bar-value-label--outside";
    private const string Overflowing = ".ren-bar-value-label--overflowing";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Ren.Root.Locator(Label).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    private async Task CreateSplitChartAsync()
    {
        await CreateChartAsync();
        await DateValueChart.SplitDataAsync(Ren, "Search Terms");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBeGreaterThan(10);
    }

    private Task SelectLayoutAsync(string optionText) =>
        DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Bar value labels", optionText);

    // The label of a zero value is drawn at no size, and so is left uncoloured, so it isn't counted.
    private Task<int> CountLabelsAsync(string selector) => Page.EvaluateAsync<int>("""
        labelSelector => Array.from(document.querySelectorAll(labelSelector))
            .filter(label => {

                const rect = label.getBoundingClientRect();

                return rect.width > 0 && rect.height > 0;
            })
            .length
        """, selector);

    [TestMethod("automatic: wide bars have their labels written across them")]
    public async Task Automatic_WideBarsHaveTheirLabelsWrittenAcrossThem()
    {
        await CreateChartAsync();

        Expect(await CountLabelsAsync(Label)).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Vertical)).ToBe(0);
        Expect(await CountLabelsAsync(Diagonal)).ToBe(0);

        // The taller bars' labels.
        Expect(await CountLabelsAsync(Inside)).ToBeGreaterThan(0);
    }

    [TestMethod("automatic: narrow bars have their labels all put above them")]
    public async Task Automatic_NarrowBarsHaveTheirLabelsAllPutAboveThem()
    {
        await CreateSplitChartAsync();

        var labelCount = await CountLabelsAsync(Label);

        Expect(labelCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Outside)).ToBe(labelCount);
    }

    [TestMethod("choosing a layout: above bars puts every label above its bar")]
    public async Task ChoosingALayout_AboveBarsPutsEveryLabelAboveItsBar()
    {
        await CreateChartAsync();
        await SelectLayoutAsync("Above bars");

        var labelCount = await CountLabelsAsync(Label);

        Expect(labelCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Outside)).ToBe(labelCount);
        Expect(await CountLabelsAsync(Vertical)).ToBe(0);
    }

    [TestMethod("choosing a layout: vertical runs every label up its bar")]
    public async Task ChoosingALayout_VerticalRunsEveryLabelUpItsBar()
    {
        await CreateChartAsync();
        await SelectLayoutAsync("Vertical");

        var labelCount = await CountLabelsAsync(Label);

        Expect(labelCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Vertical)).ToBe(labelCount);
        Expect(await CountLabelsAsync(Diagonal)).ToBe(0);
    }

    [TestMethod("choosing a layout: diagonal slants every label")]
    public async Task ChoosingALayout_DiagonalSlantsEveryLabel()
    {
        await CreateChartAsync();
        await SelectLayoutAsync("Diagonal");

        var labelCount = await CountLabelsAsync(Label);

        Expect(labelCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Diagonal)).ToBe(labelCount);
        Expect(await CountLabelsAsync(Vertical)).ToBe(0);
    }

    [TestMethod("choosing a layout: the layout is kept when the chart's drawn again")]
    public async Task ChoosingALayout_TheLayoutIsKeptWhenTheChartsDrawnAgain()
    {
        await CreateChartAsync();
        await SelectLayoutAsync("Vertical");

        await DateValueChart.SelectAggregationTypeAsync(Ren, "average");

        var labelCount = await CountLabelsAsync(Label);

        Expect(labelCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Vertical)).ToBe(labelCount);
    }

    [TestMethod("choosing a layout: the layout is ticked in the submenu")]
    public async Task ChoosingALayout_TheLayoutIsTickedInTheSubmenu()
    {
        await CreateChartAsync();
        await SelectLayoutAsync("Diagonal");

        await DateValueChart.HoverMenuPathAsync(Ren, "Labels", "Bar value labels");

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Diagonal");
    }

    [TestMethod("choosing a layout: horizontal with narrow bars marks the labels overflowing, coloured to contrast")]
    public async Task ChoosingALayout_HorizontalWithNarrowBarsMarksTheLabelsOverflowing()
    {
        await CreateSplitChartAsync();
        await SelectLayoutAsync("Horizontal");

        var overflowingCount = await CountLabelsAsync(Overflowing);

        Expect(overflowingCount).ToBeGreaterThan(0);
        Expect(await CountLabelsAsync(Overflowing + "[style*='fill']")).ToBe(overflowingCount);
    }
}
