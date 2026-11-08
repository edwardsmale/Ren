describe("Ren.DateValueChart_Legend chart clicks", () => {

    const Legend = Ren.DateValueChart_Legend;
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

    let props;
    let background;

    // A chart with its second series selected, and a background rect standing for empty space.
    const createProps = () => {

        const svg = document.createElementNS(SVG_NAMESPACE, "svg");

        background = document.createElementNS(SVG_NAMESPACE, "rect");
        svg.appendChild(background);
        document.body.appendChild(svg);

        const chartProps = { svg, valueHeadings: ["North", "South"] };

        Legend.showSelection(chartProps, [2]);

        return chartProps;
    };

    const press = (target, fromX, toX) => {

        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: fromX }));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: toX, detail: 1 }));
    };

    beforeEach(() => {

        jest.spyOn(Ren.DateValueChart_StyleUpdater, "updateSelectionStyles")
            .mockImplementation(() => {});

        jest.spyOn(Ren.DateValueChart_CrossFiltering, "clearFilters")
            .mockImplementation(() => {});

        props = createProps();
        Legend.attachChartClicks(props);
    });

    afterEach(() => {

        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    test("chartClick_OnEmptySpace_ClearsSelection", () => {

        press(background, 10, 10);

        expect(Legend.getSelectedSeriesIndexes(props)).toEqual([]);
    });

    test("chartClick_OnEmptySpace_ClearsCrossFilters", () => {

        press(background, 10, 10);

        expect(Ren.DateValueChart_CrossFiltering.clearFilters).toHaveBeenCalledWith(props);
    });

    test("chartClick_OnEmptySpaceWithNothingSelected_LeavesCrossFilters", () => {

        Legend.clearSelection(props);

        press(background, 10, 10);

        expect(Ren.DateValueChart_CrossFiltering.clearFilters).not.toHaveBeenCalled();
    });

    test("chartClick_EndOfDragAcrossPlot_KeepsSelection", () => {

        press(background, 10, 60);

        expect(Legend.getSelectedSeriesIndexes(props)).toEqual([2]);
    });

    test("chartClick_OnAxis_KeepsSelection", () => {

        const axis = document.createElementNS(SVG_NAMESPACE, "g");

        axis.setAttribute("class", "ren-axis");
        props.svg.appendChild(axis);

        press(axis, 10, 10);

        expect(Legend.getSelectedSeriesIndexes(props)).toEqual([2]);
    });
});
