describe("Ren.DateValueChart_ValueAxisFit", () => {

    const ValueAxisFit = Ren.DateValueChart_ValueAxisFit;
    const LINE = Ren.SeriesChartTypeEnum.Line;

    const createProps = () => ({
        seriesCount: 2,
        valueHeadings: ["Sales", "Orders"],
        series: [
            { chartType: LINE, valueAxis: "leftAxis" },
            { chartType: LINE, valueAxis: "rightAxis" }
        ],
        useDualAxes: true,
        axes: {
            leftAxis: { startAtZero: false, yExtent: [0, 1000] },
            rightAxis: { startAtZero: true, yExtent: [0, 100] },
            hiddenAxis: { yExtent: [0, 1] }
        }
    });

    const createRows = () => [
        { Sales: 800, Orders: 40 },
        { Sales: 950, Orders: null },
        { Sales: 870, Orders: 60 }
    ];

    test("setAxisMins_LinesNotStartingAtZero_LowestValue", () => {

        const props = createProps();

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(800);
        expect(props.axes.rightAxis.minY).toBe(0);
    });

    test("setAxisMins_DotsNotStartingAtZero_LowestValue", () => {

        const props = createProps();

        props.series[0].chartType = Ren.SeriesChartTypeEnum.Dot;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(800);
    });

    test("setAxisMins_BarOnAxis_Zero", () => {

        const props = createProps();

        props.series[0].chartType = Ren.SeriesChartTypeEnum.Bar;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(0);
        expect(ValueAxisFit.canFit(props, "leftAxis")).toBe(false);
    });

    test("setAxisMins_ShadedOrStackedLines_Zero", () => {

        const shaded = createProps();
        const stacked = createProps();

        shaded.shadeLines = true;
        stacked.lineLayout = Ren.LineLayoutEnum.Stacked;

        ValueAxisFit.setAxisMins(shaded, createRows());
        ValueAxisFit.setAxisMins(stacked, createRows());

        expect(shaded.axes.leftAxis.minY).toBe(0);
        expect(stacked.axes.leftAxis.minY).toBe(0);
    });

    test("setAxisMins_LinearTrendLine_Zero", () => {

        const props = createProps();

        props.series[0].trendLine = Ren.DateValueChart_TrendLines.LINEAR;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(0);
    });

    test("setAxisMins_ValueLineBelowValues_LineValue", () => {

        const props = createProps();

        props.valueLines = [{ value: 500, axis: "leftAxis" }, { value: 10, axis: "rightAxis" }];

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(500);
    });

    test("setAxisMins_SharedScale_LeftSettingOverBothAxesSeries", () => {

        const props = createProps();

        props.useDualAxes = false;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(40);
        expect(props.axes.rightAxis.minY).toBe(40);
    });

    test("setAxisMins_HiddenSeries_Ignored", () => {

        const props = createProps();

        props.useDualAxes = false;
        props.series[1].isEnabled = false;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(800);
    });

    test("setAxisMins_ValueAtOrBelowZero_Zero", () => {

        const props = createProps();
        const rows = createRows();

        rows[0].Sales = 0;

        ValueAxisFit.setAxisMins(props, rows);

        expect(props.axes.leftAxis.minY).toBe(0);
    });

    test("getDomainMin_MinAtOrAboveTop_Zero", () => {

        expect(ValueAxisFit.getDomainMin({ minY: 800, yExtent: [0, 1000] })).toBe(800);
        expect(ValueAxisFit.getDomainMin({ minY: 1000, yExtent: [0, 1000] })).toBe(0);
        expect(ValueAxisFit.getDomainMin({ yExtent: [0, 1000] })).toBe(0);
    });

    test("isStartAtZero_NotSet_True", () => {

        expect(ValueAxisFit.isStartAtZero({ axes: { leftAxis: {} } }, "leftAxis")).toBe(true);
        expect(ValueAxisFit.isStartAtZero(createProps(), "leftAxis")).toBe(false);
    });
    test("setAxisMins_LogScale_LowestValueAndDrawnLog", () => {

        const props = createProps();

        props.axes.leftAxis.startAtZero = true;
        props.axes.leftAxis.logScale = true;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.minY).toBe(800);
        expect(props.axes.leftAxis.isLogScaleDrawn).toBe(true);
        expect(props.axes.rightAxis.isLogScaleDrawn).toBe(false);
    });

    test("setAxisMins_LogScaleWithValueAtZero_Linear", () => {

        const props = createProps();
        const rows = createRows();

        props.axes.leftAxis.logScale = true;
        rows[1].Sales = 0;

        ValueAxisFit.setAxisMins(props, rows);

        expect(props.axes.leftAxis.minY).toBe(0);
        expect(props.axes.leftAxis.isLogScaleDrawn).toBe(false);
        expect(ValueAxisFit.canUseLogScale(props, "leftAxis", rows)).toBe(false);
    });

    test("setAxisMins_LogScaleWithBar_Linear", () => {

        const props = createProps();

        props.axes.leftAxis.logScale = true;
        props.series[0].chartType = Ren.SeriesChartTypeEnum.Bar;

        ValueAxisFit.setAxisMins(props, createRows());

        expect(props.axes.leftAxis.isLogScaleDrawn).toBe(false);
        expect(ValueAxisFit.canUseLogScale(props, "leftAxis", createRows())).toBe(false);
    });

    test("canUseLogScale_NoValues_False", () => {

        expect(ValueAxisFit.canUseLogScale(createProps(), "leftAxis", [])).toBe(false);
    });

    test("isLogScale_NotSet_False", () => {

        expect(ValueAxisFit.isLogScale(createProps(), "leftAxis")).toBe(false);
    });
});
