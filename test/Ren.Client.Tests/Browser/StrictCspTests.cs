namespace Ren.Client.Tests.Browser;

// A page whose content security policy doesn't allow eval: the library's own templates are compiled
// by the build, so a report needing none of the page's own code still renders.
[TestClass]
public class StrictCspTests : BrowserTest
{
    private static readonly string[] Headings = ["Count", "Date", "Product", "Category", "Quantity", "Revenue"];

    [TestMethod("a grid renders where the page's policy doesn't allow eval")]
    public async Task GridRendersWherePolicyDoesNotAllowEval()
    {
        var violations = new List<string>();

        Page.Console += (_, message) =>
        {
            if (message.Text.Contains("Content Security Policy")) lock (violations) violations.Add(message.Text);
        };

        await Page.GotoAsync("/test/browser/fixtures/strict-csp.html");

        // The policy is in force: a template the page gives as source can't be compiled.  (Playwright's
        // evaluate isn't held to the policy, so the template is compiled from a timer, as the page's.)
        Expect(await Page.EvaluateAsync<string>("""
            () => new Promise((resolve) => setTimeout(() => {

                Ren.Extensions.registerHtmlTemplate("StrictCspTest", "<b>@parameters.text</b>");

                try {

                    resolve(Ren.HtmlTemplateFunctions.renderHtmlTemplate("StrictCspTest", { text: "Hi" }));
                }
                catch (e) {

                    resolve(e.message);
                }
            }))
            """)).Not.ToBe("<b>Hi</b>");

        var headings = Page.Locator(".ren-data-grid__column-heading");

        await Expect(headings.First).ToBeAttachedAsync();

        Expect(await headings.EvaluateAllAsync<string[]>("elements => elements.map(element => element.title)"))
            .ToEqual(Headings);
        await Expect(Page.Locator(".ren-data-grid__cell.ren-c-1").First).ToBeAttachedAsync();
        Expect(violations).ToEqual(Array.Empty<string>());
    }
}
