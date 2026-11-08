/**
 * Ren's page-wide handlers only act on events in a report context or Ren's own elements, so a host
 * page keeps its right-click menu and keyboard shortcuts everywhere else.
 */

// Ren sets up its page-wide handlers once the page has loaded, which it says after the document is
// ready.
beforeAll(() => new Promise(resolve => Ren.Messages.Events.pageLoaded.handle(resolve)));

beforeEach(() => {

    document.body.className = "";
    document.body.removeAttribute("data-report-name");
    document.body.removeAttribute("data-request-url");
    document.body.innerHTML =
        "<div class=\"host\"><input class=\"host-input\"></div>" +
        "<div class=\"js-ren-report-context\" data-report-name=\"Sales\">" +
        "<div class=\"report-content\"></div></div>" +
        "<div class=\"ren-report-popup-window\"><button class=\"popup-button\"></button></div>";
});

const pointerDown = (element) => {

    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
};

const keyDown = (target, options) => {

    const event = new KeyboardEvent(
        "keydown",
        Object.assign({ bubbles: true, cancelable: true }, options)
    );

    target.dispatchEvent(event);

    return event;
};

test("elements in a report context or Ren's own elements are in scope", () => {

    expect(Ren.EventScope.isInScope(document.querySelector(".report-content"))).toBe(true);
    expect(Ren.EventScope.isInScope(document.querySelector(".popup-button"))).toBe(true);
    expect(Ren.EventScope.isInScope(document.querySelector(".host-input"))).toBe(false);
    expect(Ren.EventScope.isInScope(document.body)).toBe(false);
});

test("a ren- class on the body doesn't put the host's page in scope", () => {

    document.body.classList.add("ren-something");

    expect(Ren.EventScope.isInScope(document.querySelector(".host-input"))).toBe(false);
});

test("everything is in scope when the body is the report context", () => {

    document.body.classList.add("js-ren-report-context");

    expect(Ren.EventScope.isInScope(document.querySelector(".host-input"))).toBe(true);
});

test("a key press with nothing focused is in scope when the last click was", () => {

    pointerDown(document.querySelector(".report-content"));

    expect(Ren.EventScope.isKeyboardEventInScope({ target: document.body })).toBe(true);

    pointerDown(document.querySelector(".host"));

    expect(Ren.EventScope.isKeyboardEventInScope({ target: document.body })).toBe(false);
});

test("a right-click on the host's page is left to the host", () => {

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    document.querySelector(".host").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector(".ren-context-menu")).toBeNull();
});

test("Ctrl+S is left to the host outside a report, and saves the report inside one", () => {

    pointerDown(document.querySelector(".host"));

    expect(keyDown(document.querySelector(".host-input"), { key: "s", ctrlKey: true })
        .defaultPrevented).toBe(false);

    pointerDown(document.querySelector(".report-content"));

    expect(keyDown(document.body, { key: "s", ctrlKey: true }).defaultPrevented).toBe(true);
});
