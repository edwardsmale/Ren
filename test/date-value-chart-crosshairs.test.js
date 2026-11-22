describe("Ren.DateValueChart_Crosshairs", () => {

    afterEach(() => {

        document.body.innerHTML = "";
    });

    test("createShared_Shown_LinesThroughThePointerAcrossTheParent", () => {

        const parent = document.createElement("div");
        const crosshairs = Ren.DateValueChart_Crosshairs.createShared();

        parent.getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 400 });
        parent.appendChild(crosshairs.element);
        document.body.appendChild(parent);

        crosshairs.show(340, 210);

        const lines = crosshairs.element.children;

        expect(crosshairs.element.style.display).toBe("block");
        expect(lines[0].style.left).toBe("240px");
        expect(lines[0].style.bottom).toBe("0px");
        expect(lines[1].style.top).toBe("160px");
        expect(lines[1].style.right).toBe("0px");
    });

    test("createShared_Hidden_NotDisplayed", () => {

        const crosshairs = Ren.DateValueChart_Crosshairs.createShared();

        document.body.appendChild(crosshairs.element);
        crosshairs.show(10, 10);
        crosshairs.hide();

        expect(crosshairs.element.style.display).toBe("none");
    });
});
