/**
 * <ren-report-context> elements become div report contexts, keeping their contents, so that a host
 * page's body is left alone.
 */

beforeEach(() => {

    document.body.className = "";
    document.body.removeAttribute("data-report-name");
    document.body.removeAttribute("data-request-url");
    document.body.innerHTML = "";
});

test("a ren-report-context element becomes a div report context with its contents", () => {

    document.body.innerHTML =
        "<ren-report-context report-name=\"SearchSynonyms\">" +
        "<h1>Synonyms</h1><ren-grid data-source-name=\"SearchSynonyms\"></ren-grid>" +
        "</ren-report-context>";

    Ren.ReportContextElement.upgradeElements();

    const context = document.body.firstElementChild;

    expect(document.querySelector("ren-report-context")).toBeNull();
    expect(context.tagName).toBe("DIV");
    expect(context.classList.contains("js-ren-report-context")).toBe(true);
    expect(context.classList.contains("js-ren-report-context--on-page")).toBe(true);
    expect(context.getAttribute("data-report-name")).toBe("SearchSynonyms");
    expect(context.getAttribute("data-request-url"))
        .toBe(window.location.pathname + window.location.search);
    expect(context.querySelector("h1").textContent).toBe("Synonyms");
    expect(context.querySelector("ren-grid")).not.toBeNull();
});

test("a request-url attribute and the host's own attributes are carried over", () => {

    document.body.innerHTML =
        "<ren-report-context report-name=\"Sales\" request-url=\"/Sales?region=North\" " +
        "id=\"sales\" class=\"admin-panel\"></ren-report-context>";

    Ren.ReportContextElement.upgradeElements();

    const context = document.getElementById("sales");

    expect(context.getAttribute("data-request-url")).toBe("/Sales?region=North");
    expect(context.classList.contains("admin-panel")).toBe(true);
    expect(context.classList.contains("js-ren-report-context")).toBe(true);
    expect(context.hasAttribute("report-name")).toBe(false);
    expect(context.hasAttribute("request-url")).toBe(false);
});

test("the body isn't made the report context when the page has a ren-report-context", () => {

    document.body.innerHTML = "<ren-report-context report-name=\"Sales\"></ren-report-context>";

    Ren.PageReportContext.ensure();

    expect(document.body.classList.contains("js-ren-report-context")).toBe(false);
    expect(document.body.hasAttribute("data-report-name")).toBe(false);
    expect(document.querySelectorAll(".js-ren-report-context").length).toBe(1);
});

test("without a ren-report-context, the closest common ancestor of the ren-* elements is the context", () => {

    document.body.innerHTML =
        "<nav id=\"menu\"></nav>" +
        "<main id=\"main\"><section><ren-grid data-source-name=\"A\"></ren-grid></section>" +
        "<div><ren-grid data-source-name=\"B\"></ren-grid></div></main>";

    Ren.PageReportContext.ensure();

    const main = document.getElementById("main");

    expect(document.querySelectorAll(".js-ren-report-context").length).toBe(1);
    expect(main.classList.contains("js-ren-report-context")).toBe(true);
    expect(main.classList.contains("js-ren-report-context--on-page")).toBe(true);
    expect(main.hasAttribute("data-report-name")).toBe(true);
    expect(main.getAttribute("data-request-url"))
        .toBe(window.location.pathname + window.location.search);
});

test("a nested ren-* element doesn't make its outer ren-* element the context", () => {

    document.body.innerHTML =
        "<div id=\"panel\"><ren-tabbed-module><ren-grid data-source-name=\"A\"></ren-grid>" +
        "</ren-tabbed-module></div>";

    Ren.PageReportContext.ensure();

    expect(document.getElementById("panel").classList.contains("js-ren-report-context")).toBe(true);
});

test("without any ren-* elements, the body is the context", () => {

    document.body.innerHTML = "<p>Nothing to see</p>";

    Ren.PageReportContext.ensure();

    expect(document.body.classList.contains("js-ren-report-context")).toBe(true);
});
