describe("Ren.PopupMessage", () => {

    const TRIANGLE_SELECTOR = ".ren-report-popup-window__warning-triangle";

    afterEach(() => {

        document.body.innerHTML = "";
    });

    const getCaption = () => document.querySelector(".ren-report-popup-window__title-bar-caption");

    test("PopupMessage_WarningTriangle_TriangleBeforeTitle", () => {

        Ren.PopupMessage(
            "Message",
            Ren.PopupMessageTypeEnum.SuccessWithWarning,
            { title: "Series limited", warningTriangle: true }
        );

        const triangle = getCaption().querySelector(TRIANGLE_SELECTOR);

        expect(triangle.textContent).toBe("⚠");
        expect(getCaption().firstChild).toBe(triangle);
    });

    test("PopupMessage_NoWarningTriangle_NoTriangle", () => {

        Ren.PopupMessage("Message", Ren.PopupMessageTypeEnum.Success, { title: "Saved" });

        expect(getCaption().querySelector(TRIANGLE_SELECTOR)).toBeNull();
    });
});
