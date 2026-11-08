describe("Ren.DateValueChart_Gridlines", () => {

    const Gridlines = Ren.DateValueChart_Gridlines;

    // A scale from 0 to 100 over a plot 200 high, ticked every 25.
    const makeScale = () => ({
        getTicks: () => [0, 25, 50, 75, 100],
        getPixel: value => 200 - value * 2,
        getDomain: () => [0, 100]
    });

    const makeProps = (overrides) => {

        const leftAxis = { yScale: makeScale() };
        const rightAxis = { yScale: makeScale() };

        return Object.assign({
            chartGroup: document.createElementNS("http://www.w3.org/2000/svg", "g"),
            axes: { leftAxis, rightAxis, hiddenAxis: {} },
            innerWidth: 300,
            innerHeight: 200,
            showGridlines: true,
            seriesTypes: ["bar"],
            useDualAxes: true,
            seriesCount: 2
        }, overrides);
    };

    test("getLinePixels_TickOnPlotBottom_LeftOut", () => {

        const props = makeProps();

        expect(Gridlines.getLinePixels(props, props.axes.leftAxis)).toEqual([150, 100, 50, 0]);
    });

    test("getAxis_LeftAxisShown_LeftAxis", () => {

        const props = makeProps();

        expect(Gridlines.getAxis(props)).toBe(props.axes.leftAxis);
    });

    test("getAxis_OnlyRightAxisShown_RightAxis", () => {

        const props = makeProps({ showLeftAxis: false });

        expect(Gridlines.getAxis(props)).toBe(props.axes.rightAxis);
    });

    test("getAxis_NoScale_Null", () => {

        const props = makeProps();

        props.axes.leftAxis.yScale = null;

        expect(Gridlines.getAxis(props)).toBeNull();
    });

    test("render_TurnedOn_LineAcrossPlotPerTickBehindEverythingElse", () => {

        const props = makeProps();

        Ren.Svg.append(props.chartGroup, "g", { "class": "ren-data-series" });

        Gridlines.render(props);

        const lines = props.chartGroup.querySelectorAll(".ren-gridline");

        expect(lines.length).toBe(4);
        expect(lines[0].getAttribute("x2")).toBe("300");
        expect(props.chartGroup.firstChild.getAttribute("class")).toBe("ren-gridlines");
    });

    test("render_DrawnAgain_LinesReplacedNotAdded", () => {

        const props = makeProps();

        Gridlines.render(props);
        Gridlines.render(props);

        expect(props.chartGroup.querySelectorAll(".ren-gridline").length).toBe(4);
    });

    test("render_TurnedOff_LinesRemoved", () => {

        const props = makeProps();

        Gridlines.render(props);
        props.showGridlines = false;
        Gridlines.render(props);

        expect(props.chartGroup.querySelectorAll(".ren-gridlines").length).toBe(0);
    });

    test("persistedProperties_ShowGridlines_Saved", () => {

        const names = Ren.VisualisationTypes_DateValueChart.persistedProperties
            .map(property => typeof property === "string" ? property : property.name);

        expect(names).toContain("showGridlines");
    });
});
