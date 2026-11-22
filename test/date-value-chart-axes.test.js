describe("Ren.DateValueChart_Axes", () => {

    const Axes = Ren.DateValueChart_Axes;

    test("getValueTickCount_ShortPlot_FewerTicks", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 0.5 })).toBe(6);
    });

    test("getValueTickCount_TallPlot_AtMostTen", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 2 })).toBe(10);
    });

    test("getValueTickCount_TinyPlot_AtLeastTwo", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500, scaleY: 0.05 })).toBe(2);
    });

    test("getValueTickCount_ScaleNotYetKnown_Ten", () => {

        expect(Axes.getValueTickCount({ innerHeight: 500 })).toBe(10);
    });

    test("getValueTickCount_ChartOf250Px_TicksEvery500Of2600", () => {

        const scale = Ren.ChartScales.createLinearScale([0, 2600], [250, 0], { nice: true });
        const tickCount = Axes.getValueTickCount({ innerHeight: 250, scaleY: 1 });

        expect(scale.getTicks(tickCount)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    });
});
