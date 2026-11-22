namespace Ren.Client.Tests.Browser;

// Pages whose content security policy doesn't allow eval: the library's own templates and format
// functions are compiled by the build, so a report needing none of the page's own code still
// renders, and where the page allows its scripts by nonce, a report's own functions are compiled
// through it.
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

        // The library's own format functions are compiled by the build, so they run, while one written
        // into a report can't be compiled.
        Expect(await Page.EvaluateAsync<string[]>(RunFormatFunctions)).ToEqual(new[] { "Pens!", "refused" });

        var headings = Page.Locator(".ren-data-grid__column-heading");

        await Expect(headings.First).ToBeAttachedAsync();

        Expect(await headings.EvaluateAllAsync<string[]>("elements => elements.map(element => element.title)"))
            .ToEqual(Headings);
        await Expect(Page.Locator(".ren-data-grid__cell.ren-c-1").First).ToBeAttachedAsync();
        Expect(violations).ToEqual(Array.Empty<string>());
    }

    [TestMethod("a function written into a report runs where the page allows its scripts by nonce")]
    public async Task CustomFunctionRunsWherePolicyAllowsNonce()
    {
        var violations = new List<string>();

        Page.Console += (_, message) =>
        {
            if (message.Text.Contains("Content Security Policy")) lock (violations) violations.Add(message.Text);
        };

        await Page.GotoAsync("/test/browser/fixtures/nonce-csp.html");

        Expect(await Page.EvaluateAsync<string[]>(RunFormatFunctions)).ToEqual(new[] { "Pens!", "Pens?" });

        // Only the eval Ren tries first, once, before using the nonce.
        Expect(violations.Count(violation => !violation.Contains("unsafe-eval"))).ToBe(0);
    }

    // Runs a library format function and one written into a report, from a timer, as the page's own
    // code would (Playwright's evaluate isn't held to the policy).
    private const string RunFormatFunctions = """
        () => new Promise((resolve) => setTimeout(() => {

            const library = Ren.FormatFunctions.createFunction({
                name: "append-string-if",
                parameters: { sourceColumn: "Flag", stringToAppend: "!" }
            })("Pens", { Flag: true });

            const custom = Ren.FormatFunctions.createFunction("return value + '?';")("Pens", {});

            resolve([library, /#VALUE!/.test(custom) ? "refused" : custom]);
        }))
        """;
}
