namespace Ren.Client.Tests.Browser;

[TestClass]
public class ConfigTests : BrowserTest
{
    [TestMethod("variation links show by default")]
    public async Task VariationLinksShowByDefault()
    {
        await Ren.OpenAsync("variation-links-on.html");

        await Expect(Ren.Grid(0).Locator(".qa-ren-data-grid-variation-links")).ToBeVisibleAsync();
    }

    [TestMethod("ren.config's featureFlags can hide variation links")]
    public async Task FeatureFlagsCanHideVariationLinks()
    {
        await Ren.OpenAsync("variation-links-off.html");

        await Expect(Ren.Grid(0).Locator(".qa-ren-data-grid-variation-links")).ToBeHiddenAsync();
    }
}
