namespace Ren.Client.Tests.Browser;

// These tests cover a grid state's scrollToBottom, which scrolls a data grid to its last row when
// it is first shown.  Both fixtures show the same couple of hundred rows, far more than fit.
[TestClass]
public class GridScrollToBottomTests : BrowserTest
{
    // How far the grid set's viewport is from being scrolled to the bottom, in pixels.
    private Task<double> DistanceFromBottomAsync() =>
        Ren.Report.Locator(".ren-grid-set__viewport").First.EvaluateAsync<double>(
            "viewport => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop");

    [TestMethod("scrollToBottom: a grid whose grid state sets it opens scrolled to the bottom")]
    public async Task AGridWhoseGridStateSetsItOpensScrolledToTheBottom()
    {
        await Ren.OpenAsync("scroll-to-bottom/ScrollToBottom.html");

        // As the End key leaves it, a couple of pixels short, as the grid stops at its last row.
        await Poll(DistanceFromBottomAsync).ToBeLessThan(10);
    }

    [TestMethod("scrollToBottom: a grid without it opens at the top")]
    public async Task AGridWithoutItOpensAtTheTop()
    {
        await Ren.OpenAsync("ported/LotsOfRowsTest01.html");

        await Poll(DistanceFromBottomAsync).ToBeGreaterThan(100);
        await Poll(() => Ren.Report.Locator(".ren-grid-set__viewport").First
            .EvaluateAsync<double>("viewport => viewport.scrollTop")).ToBe(0);
    }

    [TestMethod("scrollToBottom: the Layout menu's item turns it on, and it is saved and applied")]
    public async Task TheLayoutMenusItemTurnsItOnAndItIsSavedAndApplied()
    {
        await Ren.OpenAsync("ported/LotsOfRowsTest01.html");

        await Ren.Report.ChooseFromCellMenuAsync(
            "Category",
            2,
            "#layout-menu",
            "#layout-scroll-to-bottom");

        var settings = await Ren.SavedSettingsAsync();

        Assert.AreEqual(true, settings?["gridState"]?["LotsOfRowsTest 1"]?["scrollToBottom"]?.GetValue<bool>());

        await Ren.OpenWithSettingsAsync("ported/LotsOfRowsTest01.html", settings);

        await Poll(DistanceFromBottomAsync).ToBeLessThan(10);
    }
}
