using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's "Mark highest and lowest" option, which labels each series' highest
// and lowest values in the series' colour: a line's or dots' with a ring and a label beside it, and
// a bar's with a label beyond its own bar's end.  A label gives the value only while the series'
// own value labels are hidden, and keeps clear of them.
[TestClass]
public class DateValueChartExtremesTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string Label = ".ren-extreme-label";
    private const string Marker = ".ren-extreme-marker";

    private const string MarkHighestAndLowest = "Mark highest and lowest";

    private sealed record Box(double Left, double Right, double Top, double Bottom);

    private sealed record BarMark(string Kind, Box Label, Box? Bar, Box? ValueLabel);

    private sealed record StackBoxes(Box[] Marks, Box[] Bars, Box[] ValueLabels);

    private sealed record LabelBox(Box Label, Box? ValueLabel);

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CreateSingleSeriesChartAsync() => CreateChartAsync("CreatedOn", "Unique Searches Per Day");

    private async Task CreateTwoSeriesChartAsync()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    private async Task<double[]> PlottedValuesAsync() =>
        (await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)"))
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToArray();

    private async Task<double> LabelValueAsync(string kind)
    {
        var text = await Ren.Root.Locator($"{Label}[data-extreme='{kind}']").TextContentAsync() ?? "";

        return double.Parse(Regex.Replace(text, "^(High|Low) ", "").Replace(",", ""),
            System.Globalization.CultureInfo.InvariantCulture);
    }

    private static bool Overlaps(Box a, Box b) =>
        a.Left < b.Right && b.Left < a.Right && a.Top < b.Bottom && b.Top < a.Bottom;

    // Gets each bar mark's label box, with the box of the bar it marks: the one of its series whose
    // middle is nearest the label's, and the box of that bar's value label where it is shown.
    private Task<BarMark[]> BarMarkBoxesAsync() => Ren.Root.Locator(".ren-extremes").EvaluateAsAsync<BarMark[]>("""
        group => {

            const svg = group.ownerSVGElement;
            const toBox = rect => ({
                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom
            });
            const centre = rect => rect.left + rect.width / 2;
            const nearest = (nodes, x) => nodes.reduce((best, node) => {

                const distance = Math.abs(centre(node.getBoundingClientRect()) - x);

                return !best || distance < best.distance ? { node, distance } : best;
            }, null);

            return Array.from(group.querySelectorAll(".ren-extreme-label")).map(label => {

                const seriesNumber = label.getAttribute("data-extreme-series");
                const box = label.getBoundingClientRect();
                const bars = Array.from(svg.querySelectorAll(
                    `.ren-data-series__bar[data-series='${seriesNumber}'], `
                    + `.ren-series-${seriesNumber} .ren-data-series__bar`
                ));
                const valueLabels = Array.from(svg.querySelectorAll(
                    `.ren-value-labels-layer .ren-series-${seriesNumber} .ren-bar-value-label`
                )).filter(node => node.getBoundingClientRect().width > 0);
                const bar = nearest(bars, centre(box));
                const valueLabel = nearest(valueLabels, centre(box));

                return {
                    kind: label.getAttribute("data-extreme"),
                    label: toBox(box),
                    bar: bar && toBox(bar.node.getBoundingClientRect()),
                    valueLabel: valueLabel && valueLabel.distance < 2
                        ? toBox(valueLabel.node.getBoundingClientRect())
                        : null
                };
            });
        }
        """);

    // Gets each ring's label box and the box of the value label nearest the ring across the chart,
    // which is its own point's.
    private Task<LabelBox[]> LabelBoxesBesideValueLabelsAsync() => Ren.Root.Locator(".ren-extremes").EvaluateAsAsync<LabelBox[]>("""
        group => {

            const toBox = rect => ({
                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom
            });
            const valueLabels = Array.from(group.ownerSVGElement.querySelectorAll(
                ".ren-line-value-label, .ren-bar-value-label, .ren-point-value-label"
            )).filter(label => label.getBoundingClientRect().width > 0);

            return Array.from(group.querySelectorAll(".ren-text-wrapper")).map(wrapper => {

                const ring = wrapper.querySelector(".ren-extreme-marker").getBoundingClientRect();
                const ringX = ring.left + ring.width / 2;
                const nearest = valueLabels.reduce((best, label) => {

                    const box = label.getBoundingClientRect();
                    const distance = Math.abs(box.left + box.width / 2 - ringX);

                    return !best || distance < best.distance ? { box, distance } : best;
                }, null);

                return {
                    label: toBox(wrapper.querySelector(".ren-extreme-label").getBoundingClientRect()),
                    valueLabel: nearest && toBox(nearest.box)
                };
            });
        }
        """);

    [TestMethod("marks nothing by default")]
    public async Task MarksNothingByDefault()
    {
        await CreateSingleSeriesChartAsync();

        await Expect(Ren.Root.Locator(Label)).ToHaveCountAsync(0);
    }

    [TestMethod("labels the highest and lowest values")]
    public async Task LabelsTheHighestAndLowestValues()
    {
        await CreateSingleSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        await Expect(Ren.Root.Locator(Label)).ToHaveCountAsync(2);
        await Expect(Ren.Root.Locator($"{Label}[data-extreme='highest']")).ToHaveTextAsync(new Regex("^High "));
        await Expect(Ren.Root.Locator($"{Label}[data-extreme='lowest']")).ToHaveTextAsync(new Regex("^Low "));

        var values = await PlottedValuesAsync();

        // The labels are in the axis' format, so are compared loosely.
        Expect(await LabelValueAsync("highest")).ToBeCloseTo(values.Max(), 0);
        Expect(await LabelValueAsync("lowest")).ToBeCloseTo(values.Min(), 0);
    }

    [TestMethod("ticks the option, and takes the marks off again")]
    public async Task TicksTheOptionAndTakesTheMarksOffAgain()
    {
        await CreateSingleSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);
        await DateValueChart.HoverMenuPathAsync(Ren, MarkHighestAndLowest);

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain(MarkHighestAndLowest);

        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        await Expect(Ren.Root.Locator(Label)).ToHaveCountAsync(0);
    }

    [TestMethod("marks the series whose menu sets it")]
    public async Task MarksTheSeriesWhoseMenuSetsIt()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, MarkHighestAndLowest);

        await Expect(Ren.Root.Locator($"{Label}[data-extreme-series='2']").First).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator($"{Label}[data-extreme-series='1']")).ToHaveCountAsync(0);
    }

    // The chart is drawn at one size and scaled to fit its container, so the ring must be kept round
    // rather than stretched with it.
    [TestMethod("rings a line's points round at the size the chart is shown")]
    public async Task RingsALinesPointsRoundAtTheSizeTheChartIsShown()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Lines");
        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        var ring = (await Ren.Root.Locator(Marker).First.BoundingBoxAsync())!;

        Expect(Math.Abs(ring.Width - ring.Height)).ToBeLessThan(1);
    }

    [TestMethod("labels a bar above its own bar, not its period's middle, when bars are side by side")]
    public async Task LabelsABarAboveItsOwnBarWhenBarsAreSideBySide()
    {
        await CreateTwoSeriesChartAsync();
        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, MarkHighestAndLowest);

        await Expect(Ren.Root.Locator(Marker)).ToHaveCountAsync(0);

        var marks = await BarMarkBoxesAsync();

        Expect(marks.Length).ToBe(2);

        foreach (var mark in marks)
        {
            var middle = (mark.Label.Left + mark.Label.Right) / 2;

            Expect(middle).ToBeGreaterThan(mark.Bar!.Left);
            Expect(middle).ToBeLessThan(mark.Bar.Right);
            Expect(mark.Label.Bottom).ToBeLessThanOrEqual(mark.Bar.Top + 1);
        }
    }

    [TestMethod("labels a bar beyond its value label where that is above the bar")]
    public async Task LabelsABarBeyondItsValueLabelWhereThatIsAboveTheBar()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Bar value labels", "Above bars");
        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        var marks = await BarMarkBoxesAsync();

        Expect(marks.Length).ToBe(2);

        foreach (var mark in marks)
        {
            Expect(mark.ValueLabel).Not.ToBeNull();
            Expect(mark.Label.Bottom).ToBeLessThanOrEqual(mark.ValueLabel!.Top + 1);
        }
    }

    [TestMethod("labels stacked bars beyond their whole stack, clear of each other and the value labels")]
    public async Task LabelsStackedBarsBeyondTheirWholeStack()
    {
        await CreateTwoSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Bar layout", "Stacked");
        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, MarkHighestAndLowest);
        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, MarkHighestAndLowest);

        var boxes = await Ren.Root.Locator(".ren-extremes").EvaluateAsAsync<StackBoxes>("""
            group => {

                const toBox = rect => ({
                    left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom
                });
                const svg = group.ownerSVGElement;
                const all = selector => Array.from(svg.querySelectorAll(selector))
                    .map(node => node.getBoundingClientRect())
                    .filter(rect => rect.width > 0)
                    .map(toBox);

                return {
                    marks: all(".ren-extreme-label"),
                    bars: all(".ren-data-series__bar"),
                    valueLabels: all(".ren-bar-value-label")
                };
            }
            """);

        Expect(boxes.Marks.Length).ToBe(4);

        foreach (var mark in boxes.Marks)
        {
            var middle = (mark.Left + mark.Right) / 2;
            var stack = boxes.Bars.Where(bar => bar.Left < middle && middle < bar.Right).ToArray();

            Expect(stack.Length).ToBeGreaterThan(0);
            Expect(mark.Bottom).ToBeLessThanOrEqual(stack.Min(bar => bar.Top) + 1);

            foreach (var other in boxes.Marks)
            {
                if (!ReferenceEquals(other, mark)) Expect(Overlaps(mark, other)).ToBe(false);
            }

            foreach (var valueLabel in boxes.ValueLabels)
            {
                Expect(Overlaps(mark, valueLabel)).ToBe(false);
            }
        }
    }

    [TestMethod("labels a line's rings beside them, clear of its value labels")]
    public async Task LabelsALinesRingsBesideThemClearOfItsValueLabels()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Lines");
        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        var boxes = await LabelBoxesBesideValueLabelsAsync();

        Expect(boxes.Length).ToBe(2);

        foreach (var box in boxes)
        {
            Expect(box.ValueLabel).Not.ToBeNull();
            Expect(Overlaps(box.Label, box.ValueLabel!)).ToBe(false);
        }
    }

    [TestMethod("gives the value only while the series' value labels are hidden")]
    public async Task GivesTheValueOnlyWhileTheSeriesValueLabelsAreHidden()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, MarkHighestAndLowest);

        var highest = Ren.Root.Locator($"{Label}[data-extreme='highest']");
        var value = highest.Locator(".ren-extreme-value");

        await Expect(value).ToBeHiddenAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Labels", "Value labels");

        await Expect(value).ToBeVisibleAsync();
        Expect(await highest.EvaluateAsync<double>("label => label.getBoundingClientRect().width")).ToBeGreaterThan(0);
    }
}
