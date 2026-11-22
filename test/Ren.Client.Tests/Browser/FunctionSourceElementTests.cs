namespace Ren.Client.Tests.Browser;

// A page hosting Ren without its own format functions and HTML templates has neither element
// holding their source, which Ren looks for in case it arrives later.  These check that the page
// isn't searched for it on every function used, and that one arriving later is still used.
[TestClass]
public class FunctionSourceElementTests : BrowserTest
{
    private const string Fixture = "format-functions/no-source-elements.html";

    // Counts the searches for the selector while the callback runs, in a single run of code.
    private const string CountSearches = """
        (selector, callback) => {

            let count = 0;
            const querySelector = document.querySelector;

            document.querySelector = function (s) {

                if (s === selector) count++;
                return querySelector.apply(this, arguments);
            };

            try {

                callback();
            }
            finally {

                document.querySelector = querySelector;
            }

            return count;
        }
        """;

    [TestMethod("Format functions: with no source element, the page is searched once per run of code")]
    public async Task FormatFunctions_NoSourceElement_SearchedOncePerRunOfCode()
    {
        await Ren.OpenAsync(Fixture);

        var result = await Page.EvaluateAsync<string>($$"""
            () => {

                const countSearches = {{CountSearches}};
                let found = 0;

                const count = countSearches(".format-function-source-code", () => {

                    const name = Ren.FormatFunctions.getFunctionNames()[0];

                    for (let i = 0; i < 500; i++) {

                        if (Ren.FormatFunctions.getFunctionMetadata(name)) found++;
                    }
                });

                return count + " searches, " + found + " found";
            }
            """);

        Expect(result).ToBe("1 searches, 500 found");
    }

    [TestMethod("Format functions: a source element added later is used")]
    public async Task FormatFunctions_SourceElementAddedLater_Used()
    {
        await Ren.OpenAsync(Fixture);

        await Page.EvaluateAsync("""
            () => {

                Ren.FormatFunctions.getFunctionMetadata("zzLateFunction");

                const element = document.createElement("script");
                element.type = "application/data";
                element.className = "format-function-source-code";
                element.textContent = JSON.stringify({ zzLateFunction: "/**\n * Added late.\n */\nreturn '@value';" });
                document.body.appendChild(element);
            }
            """);

        var isFound = await Page.EvaluateAsync<bool>("() => Ren.FormatFunctions.getFunctionMetadata('zzLateFunction') !== undefined");

        Expect(isFound).ToBe(true);
    }

    [TestMethod("HTML templates: with no source element, the page is searched once per run of code")]
    public async Task HtmlTemplates_NoSourceElement_SearchedOncePerRunOfCode()
    {
        await Ren.OpenAsync(Fixture);

        var count = await Page.EvaluateAsync<int>($$"""
            () => {

                const countSearches = {{CountSearches}};

                return countSearches(".html-template-function-source-code", () => {

                    for (let i = 0; i < 200; i++) {

                        try { Ren.HtmlTemplateFunctions.renderHtmlTemplate("CalendarStatus", {}); } catch (e) { }
                    }
                });
            }
            """);

        Expect(count).ToBe(1);
    }
}
