namespace Ren.Client.Tests.Browser;

// These tests cover the ways a third party's page might load ren.js other than with a plain script
// element in its head: after the page has loaded, as a (strict mode) module, and as ren.esm.js,
// imported.  And a page with top-level names of its own, which ren.js mustn't declare again.
[TestClass]
public class LoadingTests : BrowserTest
{
    private static readonly string[] Headings = ["Count", "Date", "Product", "Category", "Quantity", "Revenue"];

    private async Task<string[]> RenderedHeadingsAsync()
    {
        var headings = Page.Locator(".ren-data-grid__column-heading");

        await Expect(headings.First).ToBeAttachedAsync();

        return await headings.EvaluateAllAsync<string[]>("elements => elements.map(element => element.title)");
    }

    [TestMethod("ren.js added after the page has loaded still renders the page")]
    public async Task AddedAfterThePageHasLoadedStillRendersThePage()
    {
        await Page.GotoAsync("/test/browser/fixtures/late-load.html");

        Expect(await RenderedHeadingsAsync()).ToEqual(Headings);
    }

    [TestMethod("ren.js loaded as a module runs in strict mode and renders the page")]
    public async Task LoadedAsAModuleRunsInStrictModeAndRendersThePage()
    {
        await Page.GotoAsync("/test/browser/fixtures/module-load.html");

        Expect(await RenderedHeadingsAsync()).ToEqual(Headings);
    }

    [TestMethod("ren.esm.js imported exports Ren and renders the page")]
    public async Task EsmImportedExportsRenAndRendersThePage()
    {
        await Page.GotoAsync("/test/browser/fixtures/esm-import.html");

        Expect(await RenderedHeadingsAsync()).ToEqual(Headings);
        Expect(await EvaluateJsonAsync("() => window.importedRen"))
            .ToEqual(new { isWindowRen = true, isNamedRen = true });
    }

    [TestMethod("ren.js renders a page that has top-level names of its own")]
    public async Task RendersAPageThatHasTopLevelNamesOfItsOwn()
    {
        await Page.GotoAsync("/test/browser/fixtures/host-globals.html");

        Expect(await RenderedHeadingsAsync()).ToEqual(Headings);
        Expect(await Page.EvaluateAsync<string[]>("() => [getColumnValueFormats, isNumericCalcFunction]"))
            .ToEqual(new[] { "the page's", "the page's" });
    }
}
