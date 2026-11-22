using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the value axes a date/value chart draws reading the values its bars are drawn
// at, including once a bar has been dragged to rescale the chart.  Searches peak at 19 and
// Published is 1.
[TestClass]
public class DateValueChartValueAxisTests : BrowserTest
{
    // Searches and Published, both on the right axis.
    private const string BothOnRightAxisFixture = "ported/DateValueChartTest19.html";

    // Searches on the left axis and Published on the right.
    private const string DualAxesFixture = "ported/DateValueChartTest20.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";
    private const string RightAxis = ".ren-y-axis-2";

    private const string SearchesPeakHandle = ".ren-value-resize-handle--bar[data-value='19']";
    private const string PublishedHandle = ".ren-value-resize-handle--bar[data-value='1']";

    private async Task DragHandleDownAsync(string handleSelector, double deltaY)
    {
        await DateValueChart.ShowDragHandlesAsync(Ren);

        var handle = Ren.Root.Locator(handleSelector).First;

        await handle.ScrollIntoViewIfNeededAsync();

        var box = (await handle.BoundingBoxAsync())!;
        var x = box.X + box.Width / 2;
        var y = box.Y + box.Height / 2;

        await Page.Mouse.MoveAsync(x, y);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(x, y + (float)deltaY, new() { Steps = 5 });
        await Page.Mouse.UpAsync();
        await Ren.WaitUntilLoadedAsync();
    }

    // The value an axis reads at the height of a value handle's centre, which stands at the top of
    // its bar, interpolated between the axis' lowest and highest ticks.
    private async Task<double> AxisValueAtHandleAsync(string axisSelector, string handleSelector)
    {
        await Ren.Root.Locator(axisSelector).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
        await DateValueChart.ShowDragHandlesAsync(Ren);
        await Ren.Root.Locator(handleSelector).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        return await Page.EvaluateAsync<double>("""
            ([axisSelector, handleSelector]) => {

                const centreY = element => {

                    const rect = element.getBoundingClientRect();

                    return rect.top + rect.height / 2;
                };

                const ticks = Array.prototype.filter.call(
                    document.querySelectorAll(axisSelector + " g.tick"),
                    tick => typeof tick.renDatum === "number"
                );

                const first = ticks[0];
                const last = ticks[ticks.length - 1];
                const firstY = centreY(first.querySelector("path"));
                const lastY = centreY(last.querySelector("path"));
                const handleY = centreY(document.querySelector(handleSelector));

                return first.renDatum +
                    (last.renDatum - first.renDatum) * (handleY - firstY) / (lastY - firstY);
            }
            """, new[] { axisSelector, handleSelector });
    }

    private Task ExpectAxisReadsAsync(string axisSelector, string handleSelector, double value, double tolerance) =>
        Poll(async () => Math.Abs(await AxisValueAtHandleAsync(axisSelector, handleSelector) - value))
            .ToBeLessThanOrEqual(tolerance);

    [TestMethod("with every series on the right axis, only the left axis is drawn")]
    public async Task WithEverySeriesOnTheRightAxis_OnlyTheLeftAxisIsDrawn()
    {
        await Ren.OpenAsync(BothOnRightAxisFixture);

        await Expect(Ren.Root.Locator(LeftAxis).First).ToBeAttachedAsync();
        await Expect(Ren.Root.Locator(RightAxis)).ToHaveCountAsync(0);
    }

    [TestMethod("with every series on the right axis, the axis drawn reads a dragged bar's value")]
    public async Task WithEverySeriesOnTheRightAxis_TheAxisDrawnReadsADraggedBarsValue()
    {
        await Ren.OpenAsync(BothOnRightAxisFixture);

        await DragHandleDownAsync(SearchesPeakHandle, 100);

        await ExpectAxisReadsAsync(LeftAxis, SearchesPeakHandle, 19, 1);
    }

    [TestMethod("with dual axes, each axis reads its series' values")]
    public async Task WithDualAxes_EachAxisReadsItsSeriesValues()
    {
        await Ren.OpenAsync(DualAxesFixture);

        await ExpectAxisReadsAsync(LeftAxis, SearchesPeakHandle, 19, 1);
        await ExpectAxisReadsAsync(RightAxis, PublishedHandle, 1, 0.1);
    }

    [TestMethod("with dual axes, each axis reads its series' values after a bar's dragged")]
    public async Task WithDualAxes_EachAxisReadsItsSeriesValuesAfterABarsDragged()
    {
        await Ren.OpenAsync(DualAxesFixture);

        await DragHandleDownAsync(SearchesPeakHandle, 100);

        await ExpectAxisReadsAsync(LeftAxis, SearchesPeakHandle, 19, 1);
        await ExpectAxisReadsAsync(RightAxis, PublishedHandle, 1, 0.1);
    }

    [TestMethod("a chart's drag handles are drawn once the pointer comes over it")]
    public async Task AChartsDragHandlesAreDrawnOnceThePointerComesOverIt()
    {
        await Page.Mouse.MoveAsync(0, 0);
        await Ren.OpenAsync(BothOnRightAxisFixture);
        await Ren.Root.Locator(LeftAxis).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        var valueHandles = Ren.Root.Locator(".ren-value-resize-handle");
        var widthHandles = Ren.Root.Locator(".ren-bar-resize-handle");

        await Expect(valueHandles).ToHaveCountAsync(0);
        await Expect(widthHandles).ToHaveCountAsync(0);

        await DateValueChart.ShowDragHandlesAsync(Ren);

        await Expect(valueHandles.First).ToBeAttachedAsync();
        await Expect(widthHandles.First).ToBeAttachedAsync();
    }
}
