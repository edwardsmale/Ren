describe("Ren.ContextMenuItems_DateValueChart_DateFilter filter by", () => {

    let filterModules;
    let createVisualisation;
    let destroyVisualisation;

    beforeEach(() => {

        filterModules = [];

        jest.spyOn(Ren.VisualisationCollection, "getVisualisations")
            .mockImplementation(() => filterModules);
        jest.spyOn(Ren.DataGroupingSettingsCollection, "getDataGroupingSettings")
            .mockImplementation(() => ({}));

        createVisualisation = jest.spyOn(Ren.VisualisationCreator, "createVisualisation")
            .mockImplementation(() => {});
        destroyVisualisation = jest.spyOn(Ren.VisualisationCollection, "destroyVisualisation")
            .mockImplementation(() => {});
    });

    afterEach(() => {

        jest.restoreAllMocks();
    });

    const createChart = (props, visualisationOverrides) => ({
        tabularData: {
            ColumnModels: [
                { Heading: "Date", ColumnIdOrHeading: "Date" },
                { Heading: "Region", ColumnIdOrHeading: "Region" },
                { Heading: "Product", ColumnIdOrHeading: "Product" },
                { Heading: "Sales", ColumnIdOrHeading: "Sales" },
                { Heading: "Hidden__Id", ColumnIdOrHeading: "Hidden__Id" }
            ],
            findColumnIndex: () => 0
        },
        visualisation: Object.assign({
            visualisationGuid: "chart-guid",
            dataGroupingSettingsGroup: "group",
            isAdHoc: false
        }, visualisationOverrides),
        props: Object.assign({ dateHeading: "Date", valueHeadings: ["Sales"] }, props)
    });

    const getHeadings = (columns) => columns.map(column => column.Heading);

    test("getFilterableColumns_DatesValuesAndHiddenColumns_LeftOut", () => {

        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(createChart());

        expect(getHeadings(items.getFilterableColumns())).toEqual(["Region", "Product"]);
    });

    test("getFilterableColumns_SplitChart_LeavesOutSourceColumns", () => {

        const chart = createChart({
            valueHeadings: ["North", "South"],
            seriesSourceHeadings: ["Sales", "Sales"]
        });

        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(chart);

        expect(getHeadings(items.getFilterableColumns())).toEqual(["Region", "Product"]);
    });

    test("filterByMenuItem_AdHocChart_IsHidden", () => {

        const chart = createChart(null, { isAdHoc: true });

        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(chart);

        expect(items.filterByMenuItem.visible()).toBe(false);
    });

    test("filterByMenuItem_ColumnChosen_OpensFilterModuleOnFilterGroup", () => {

        const chart = createChart(null, { filterGroup: "filters" });
        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(chart);

        items.filterByMenuItem.submenu[0].action();

        expect(createVisualisation).toHaveBeenCalledTimes(1);

        const options = createVisualisation.mock.calls[0][0];

        expect(options.visualisationTypeName).toBe("FilterModule");
        expect(options.sourceDataGroupingSettingsGroup).toBe("filters");
        expect(options.popupTitle).toBe("Region filter");
        expect(options.chartColumnFilterGuid).toBe("chart-guid");
        expect(options.chartColumnFilterColumn).toBe("Region");
        expect(options.columnOverrides).toEqual({ Region: { included: true } });
    });

    test("filterByMenuItem_ColumnFilterOpen_TickedAndClosedByAction", () => {

        const openFilter = {
            chartColumnFilterGuid: "chart-guid",
            chartColumnFilterColumn: "Product"
        };

        filterModules.push(openFilter);

        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(createChart());
        const submenu = items.filterByMenuItem.submenu;

        expect(submenu[0].ticked()).toBe(false);
        expect(submenu[1].ticked()).toBe(true);

        submenu[1].action();

        expect(destroyVisualisation).toHaveBeenCalledWith(openFilter);
        expect(createVisualisation).not.toHaveBeenCalled();
    });

    test("filterByMenuItem_OtherChartsFilter_NotTicked", () => {

        filterModules.push({
            chartColumnFilterGuid: "other-chart",
            chartColumnFilterColumn: "Region"
        });

        const items = Ren.ContextMenuItems_DateValueChart_DateFilter(createChart());

        expect(items.filterByMenuItem.submenu[0].ticked()).toBe(false);
    });
});
