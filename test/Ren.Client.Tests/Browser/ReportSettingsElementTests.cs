namespace Ren.Client.Tests.Browser;

// These tests cover <ren-report-settings src="...">, which a page uses to name the endpoint that
// gives its settings, in place of writing them into a settings script itself.
[TestClass]
public class ReportSettingsElementTests : BrowserTest
{
    private const string Folder = "report-settings-element/";

    [TestMethod("the settings the endpoint returns are applied")]
    public async Task TheSettingsTheEndpointReturnsAreApplied()
    {
        await Ren.OpenAsync(Folder + "loaded.html");

        await Expect(Page.Locator(".ren-tile-group__title")).ToHaveTextAsync("Garden");
        await Expect(Page.Locator(".ren-link-tile__title")).ToHaveTextAsync("Seed Trays");

        await Expect(Page.Locator("ren-report-settings")).ToHaveCountAsync(0);
    }

    // HTML5 has no self-closing custom tags, so what follows the element is parsed as inside it.
    [TestMethod("what follows a self-closing element is left after it")]
    public async Task WhatFollowsASelfClosingElementIsLeftAfterIt()
    {
        await Ren.OpenAsync(Folder + "loaded.html");

        var after = Page.Locator(".js-after-report-settings");

        await Expect(after).ToBeVisibleAsync();

        Expect(await after.EvaluateAsync<string>("p => p.parentElement.tagName")).Not.ToBe("REN-REPORT-SETTINGS");
    }

    // Gets the errors the loader logs, from the console, as Ren logs its errors there too.
    private List<string> CatchLoaderErrors()
    {
        var errors = new List<string>();

        Page.Console += (_, message) =>
        {
            if (message.Type == "error" && message.Text.Contains("[ReportSettingsElement]"))
            {
                errors.Add(message.Text);
            }
        };

        return errors;
    }

    // Not found is an endpoint with no settings to give, so it isn't an error.
    [TestMethod("an endpoint that isn't found adds no settings, and logs no error")]
    public async Task AnEndpointThatIsNotFoundAddsNoSettingsAndLogsNoError()
    {
        var errors = CatchLoaderErrors();

        await Ren.OpenAsync(Folder + "not-found.html");

        await Expect(Page.Locator(".qa-ren-visualisation--grid-set")).ToBeVisibleAsync();
        await Expect(Page.Locator("ren-report-settings")).ToHaveCountAsync(0);

        Expect(errors).ToEqual(new List<string>());
    }

    [TestMethod("an endpoint that returns null adds no settings, and logs no error")]
    public async Task AnEndpointThatReturnsNullAddsNoSettingsAndLogsNoError()
    {
        var errors = CatchLoaderErrors();

        await Ren.OpenAsync(Folder + "null-settings.html");

        await Expect(Page.Locator(".qa-ren-visualisation--grid-set")).ToBeVisibleAsync();
        await Expect(Page.Locator("ren-report-settings")).ToHaveCountAsync(0);

        Expect(errors).ToEqual(new List<string>());
    }

    [TestMethod("an element without a src logs an error, and the rest of the page renders")]
    public async Task AnElementWithoutASrcLogsAnErrorAndTheRestOfThePageRenders()
    {
        var errors = CatchLoaderErrors();

        await Ren.OpenAsync(Folder + "no-src.html");

        await Expect(Page.Locator(".qa-ren-visualisation--grid-set")).ToBeVisibleAsync();
        await Expect(Page.Locator("ren-report-settings")).ToHaveCountAsync(0);

        Expect(errors.Count).ToBe(1);
        Expect(errors[0]).ToContain("it has no src attribute");
    }
}
