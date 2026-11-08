describe("Ren.DateValueChart_Legend order", () => {

    const Legend = Ren.DateValueChart_Legend;

    beforeEach(() => {

        jest.spyOn(Ren.DateValueChart_StyleUpdater, "updateHoverStyles")
            .mockImplementation(() => {});
        jest.spyOn(Ren.DateValueChart_StyleUpdater, "updateSelectionStyles")
            .mockImplementation(() => {});
        jest.spyOn(Ren.DateValueChart_LastPeriodEstimate, "getExtentValue")
            .mockImplementation((props, seriesIndex, dataMax) => dataMax);
    });

    afterEach(() => {

        jest.restoreAllMocks();
    });

    /**
     * Gets a chart's props with its legend hidden, plotting one row of the given heights.
     */
    const createProps = (heights) => ({
        guid: "chart-guid",
        showLegend: false,
        valueHeadings: Object.keys(heights),
        seriesCount: Object.keys(heights).length,
        plottedData: [heights]
    });

    const getOrderedHeadings = (props) =>
        props.legendSeriesOrder.map(seriesIndex => props.valueHeadings[seriesIndex - 1]);

    test("renderLegend_FirstDrawn_HighestFirst", () => {

        const props = createProps({ A: 10, B: 30, C: 20 });

        Legend.renderLegend(props);

        expect(getOrderedHeadings(props)).toEqual(["B", "C", "A"]);
    });

    test("renderLegend_HeightsCloseOnRedraw_KeepsPreviousOrder", () => {

        const props = createProps({ A: 10, B: 30, C: 20 });

        Legend.renderLegend(props);

        props.plottedData = [{ A: 11, B: 20, C: 22 }];

        Legend.renderLegend(props);

        expect(getOrderedHeadings(props)).toEqual(["B", "C", "A"]);
    });

    test("renderLegend_SeriesClearlyHigherOnRedraw_MovesAhead", () => {

        const props = createProps({ A: 10, B: 30, C: 20 });

        Legend.renderLegend(props);

        props.plottedData = [{ A: 50, B: 30, C: 20 }];

        Legend.renderLegend(props);

        expect(getOrderedHeadings(props)).toEqual(["A", "B", "C"]);
    });

    test("renderLegend_SeriesChanged_NewSeriesPlacedByHeight", () => {

        const props = createProps({ A: 10, B: 30 });

        Legend.renderLegend(props);

        props.valueHeadings = ["A", "B", "D"];
        props.seriesCount = 3;
        props.plottedData = [{ A: 10, B: 30, D: 100 }];

        Legend.renderLegend(props);

        expect(getOrderedHeadings(props)).toEqual(["D", "B", "A"]);
    });
});
