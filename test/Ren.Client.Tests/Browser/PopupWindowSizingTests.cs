namespace Ren.Client.Tests.Browser;

// These tests cover the room a popup sized to its own content leaves for a vertical scroll bar,
// which appears once the popup's made shorter than its content and takes its width out of it.
// The filter module sizes itself this way, and its compare strip can't be squeezed narrower than
// the controls across it, so any width taken from the content shows up as clipping.
[TestClass]
public class PopupWindowSizingTests : BrowserTest
{
    private const string Popup = ".ren-report-popup-window";
    private const string Content = Popup + "__content-container";

    private sealed record Overflow(bool Horizontal, bool Vertical);

    private Task<Overflow> ContentOverflowAsync() => Ren.Root.Locator(Content).First.EvaluateAsAsync<Overflow>("""
        container => ({
            horizontal: container.scrollWidth > container.clientWidth,
            vertical: container.scrollHeight > container.clientHeight
        })
        """);

    [TestMethod("a popup fitted to its content clips none of it once it scrolls")]
    public async Task PopupFittedToItsContentClipsNoneOfItOnceItScrolls()
    {
        await Ren.OpenAsync("ported/FilterModuleTest01.html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
        await FilterModule.ShowCompareStripAsync(Ren, "Category");

        Expect((await ContentOverflowAsync()).Horizontal).ToBe(false);

        // The width is the reader's own from here on, so nothing re-fits it around the scroll bar.
        var handle = (await Ren.Root.Locator(Popup + "__resize-handle--bottom").First.BoundingBoxAsync())!;
        var height = await Ren.Root.Locator(Popup).First.EvaluateAsync<float>("popup => popup.offsetHeight");
        var x = handle.X + handle.Width / 2;
        var y = handle.Y + handle.Height / 2;

        await Page.Mouse.MoveAsync(x, y);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(x, y - height / 2, new() { Steps = 5 });
        await Page.Mouse.UpAsync();

        await Poll(async () => (await ContentOverflowAsync()).Vertical).ToBe(true);
        Expect((await ContentOverflowAsync()).Horizontal).ToBe(false);
    }
}
