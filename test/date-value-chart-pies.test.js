describe("Ren.DateValueChart_Pies", () => {

    const Pies = Ren.DateValueChart_Pies;

    test("isShown_ShowAsPiesUnset_False", () => {

        expect(Pies.isShown({})).toBe(false);
    });

    test("isShown_ShowAsPiesTrue_True", () => {

        expect(Pies.isShown({ showAsPies: true })).toBe(true);
    });

    test("getHoleRadius_Unset_Zero", () => {

        expect(Pies.getHoleRadius({})).toBe(0);
    });

    test("getHoleRadius_AboveMaximum_ClampedToMaximum", () => {

        expect(Pies.getHoleRadius({ pieHoleRadius: 2 })).toBe(Pies.MAX_HOLE_RADIUS);
    });

    test("getSlicePath_QuarterWithoutHole_ArcFromTopToRightThenCentre", () => {

        expect(Pies.getSlicePath(0, Math.PI / 2, 0))
            .toBe("M0,-1000A1000,1000 0 0 1 1000,0L0,0Z");
    });

    test("getSlicePath_ThreeQuartersWithoutHole_LargeArc", () => {

        expect(Pies.getSlicePath(0, Math.PI * 1.5, 0)).toBe(
            "M0,-1000A1000,1000 0 1 1 -1000,0L0,0Z"
        );
    });

    test("getSlicePath_QuarterWithHole_InnerArcDrawnBack", () => {

        expect(Pies.getSlicePath(0, Math.PI / 2, 0.5))
            .toBe("M0,-1000A1000,1000 0 0 1 1000,0L500,0A500,500 0 0 0 0,-500Z");
    });

    test("getSlicePath_WholePieWithHole_RingWithHoleDrawnTheOtherWay", () => {

        expect(Pies.getSlicePath(0, Math.PI * 2, 0.5)).toBe(
            "M0,-1000A1000,1000 0 1 1 0,1000A1000,1000 0 1 1 0,-1000Z"
            + "M0,-500A500,500 0 1 0 0,500A500,500 0 1 0 0,-500Z"
        );
    });

    test("buildStyles_NotPies_NoStyles", () => {

        expect(Pies.buildStyles({ innerHeight: 500 }, 1, 1)).toEqual([]);
    });

    test("buildStyles_UnevenScale_SlicesScaledBackToRound", () => {

        const props = { showAsPies: true, piePeriodWidth: 100, innerHeight: 500 };

        // The narrowest period is 200px wide on screen and the plot 250px high, so the pies
        // span 90% of 200px.
        const styles = Pies.buildStyles(props, 2, 0.5);

        expect(styles[0]).toContain("scale: 0.045 0.18;");
    });

    describe("getClickTarget", () => {

        const SVG_NS = "http://www.w3.org/2000/svg";
        let svg;
        let slicePath;
        let labelText;

        const append = (parent, tagName, attributes) => {

            const element = document.createElementNS(SVG_NS, tagName);
            const names = Object.keys(attributes || {});

            for (let index = 0; index < names.length; index++) {
                element.setAttribute(names[index], attributes[names[index]]);
            }

            parent.appendChild(element);

            return element;
        };

        beforeEach(() => {

            svg = append(document.body, "svg");

            const sliceGroup = append(append(svg, "g"), "g", {
                "class": "ren-pie-slice",
                "data-series": 1
            });

            slicePath = append(sliceGroup, "path", { "class": Pies.SLICE_CLASS });

            const labelsLayer =
                append(svg, "g", { "class": Ren.DateValueChart_PieLabels.LAYER_CLASS });

            labelText = append(append(labelsLayer, "g", { "data-series": 2 }), "text");
        });

        afterEach(() => {

            svg.remove();
            delete document.elementsFromPoint;
        });

        test("getClickTarget_LabelOverSlice_GetsSlice", () => {

            document.elementsFromPoint = () => [labelText, slicePath, svg];

            expect(Pies.getClickTarget(labelText, 10, 10)).toBe(slicePath);
        });

        test("getClickTarget_LabelOverNoSlice_GetsLabel", () => {

            document.elementsFromPoint = () => [labelText, svg];

            expect(Pies.getClickTarget(labelText, 10, 10)).toBe(labelText);
        });

        test("getClickTarget_Slice_GetsSlice", () => {

            document.elementsFromPoint = () => [labelText];

            expect(Pies.getClickTarget(slicePath, 10, 10)).toBe(slicePath);
        });
    });
});
