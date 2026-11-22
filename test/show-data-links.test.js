/**
 * The "Show data" links in a report's text, which open their SQL through the host's
 * openSqlInEditor page hook, and are left as plain text where the host has none.
 */

const addLink = (sql) => {

    const link = document.createElement("span");
    link.setAttribute("data-show-data-sql", sql);
    link.textContent = "42 orders";
    document.body.appendChild(link);
    return link;
};

afterEach(() => {

    document.body.innerHTML = "";
});

test("a link is left as plain text where no page opens SQL", () => {

    const link = addLink("SELECT 1");

    Ren.ShowDataLinks.setUpElements();

    expect(link.classList.contains("ren-web-report-show-data")).toBe(false);
});

test("a link clicked opens its SQL through the page hook", () => {

    const openSqlInEditor = jest.fn();
    Ren.Extensions.registerPageHooks({ openSqlInEditor });
    const link = addLink("SELECT 1");

    Ren.ShowDataLinks.setUpElements();
    link.click();

    expect(link.classList.contains("ren-web-report-show-data")).toBe(true);
    expect(openSqlInEditor).toHaveBeenCalledWith("SELECT 1");
});
