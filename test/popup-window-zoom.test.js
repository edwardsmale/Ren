describe("Ren.PopupWindow_Zoom", () => {

    const createWindow = (options) => {

        const element = document.createElement("div");

        document.body.appendChild(element);
        Ren.PopupWindow_Zoom(element, options);

        return element;
    };

    const wheelOut = (element) => {

        const event = new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, cancelable: true });

        element.dispatchEvent(event);

        return event;
    };

    afterEach(() => {

        document.body.innerHTML = "";
    });

    test("wheel_CtrlWheelDown_ScalesDown", () => {

        const options = { scale: 1 };
        const element = createWindow(options);

        wheelOut(element);

        expect(options.scale).toBe(0.95);
        expect(element.style.transform).toBe("scale(0.95)");
    });

    test("wheel_Disabled_KeepsScaleAndHoldsOffBrowserZoom", () => {

        const options = { scale: 1, disableWheelZoom: true };
        const element = createWindow(options);

        const event = wheelOut(element);

        expect(options.scale).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });

    test("wheel_DisabledByFunction_AskedOnEachWheel", () => {

        let isDisabled = true;
        const options = { scale: 1, disableWheelZoom: () => isDisabled };
        const element = createWindow(options);

        wheelOut(element);
        expect(options.scale).toBe(1);

        isDisabled = false;
        wheelOut(element);
        expect(options.scale).toBe(0.95);
    });
});
