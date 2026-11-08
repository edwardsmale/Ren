namespace Ren.Client.Tests.Browser;

[TestClass]
public class PopupTests : BrowserTest
{
    // Opens popup-report.html in a popup, as a report link would, laid out as an embedded report.
    private Task ShowPopupReportAsync(string title) => Page.EvaluateAsync("""
        (popupTitle) => window.Ren.ShowPopupReport(
            "/test/browser/fixtures/popup-report.html?layout=embedded", popupTitle
        )
        """, title);

    [TestMethod("a popup report renders its grid")]
    public async Task PopupReportRendersItsGrid()
    {
        await Ren.OpenAsync("popup-host.html");
        await ShowPopupReportAsync("First");

        var popup = await Ren.PopupAsync();

        Expect(await popup.ColumnTextAsync("Product")).ToContain("Stapler");
        Expect(await popup.DataGridIndexAsync()).Not.ToBe(await Ren.DataGridIndexAsync());
    }

    [TestMethod("each popup is scoped to its own report context")]
    public async Task EachPopupIsScopedToItsOwnReportContext()
    {
        await Ren.OpenAsync("popup-host.html");
        await ShowPopupReportAsync("First");
        var firstPopup = await Ren.PopupAsync(1);

        await ShowPopupReportAsync("Second");
        var secondPopup = await Ren.PopupAsync(2);

        Expect(secondPopup.ScopeSelector).Not.ToEqual(firstPopup.ScopeSelector);
        await Expect(firstPopup.Locator("data-grid")).ToHaveCountAsync(1);
        await Expect(secondPopup.Locator("data-grid")).ToHaveCountAsync(1);
        Expect(await secondPopup.DataGridIndexAsync()).Not.ToBe(await firstPopup.DataGridIndexAsync());
    }
}
