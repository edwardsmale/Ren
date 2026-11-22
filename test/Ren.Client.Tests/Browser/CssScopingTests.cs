namespace Ren.Client.Tests.Browser;

// These tests cover ren.css leaving a third party's own elements alone, on a page where Ren has
// rendered (and so has put its classes on the body).
[TestClass]
public class CssScopingTests : BrowserTest
{
    [TestMethod("the host's body keeps the browser's margin")]
    public async Task HostBodyKeepsTheBrowsersMargin()
    {
        await Ren.OpenAsync("host-elements.html");

        Expect(await Page.EvaluateAsync<string>("() => getComputedStyle(document.body).margin")).ToBe("8px");
    }

    [TestMethod("the host's buttons keep the browser's cursor")]
    public async Task HostButtonsKeepTheBrowsersCursor()
    {
        await Ren.OpenAsync("host-elements.html");

        await Expect(Page.Locator(".host-button")).ToHaveCSSAsync("cursor", "default");
        await Expect(Page.Locator(".host-submit")).ToHaveCSSAsync("cursor", "default");
    }

    [TestMethod("Ren's own buttons still get a pointer")]
    public async Task RensOwnButtonsStillGetAPointer()
    {
        await Ren.OpenAsync("host-elements.html");

        // A button of Ren's own, inside an element of its own, as its popups and windows have.
        var cursor = await Page.EvaluateAsync<string>("""
            () => {

                const container = document.createElement("div");
                const button = document.createElement("button");

                container.className = "ren-popup-window";
                container.appendChild(button);
                document.body.appendChild(container);

                return getComputedStyle(button).cursor;
            }
            """);

        Expect(cursor).ToBe("pointer");
    }
}
