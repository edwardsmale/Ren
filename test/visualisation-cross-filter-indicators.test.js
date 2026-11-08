describe("Ren.VisualisationCrossFilterIndicators", () => {

    const Indicators = Ren.VisualisationCrossFilterIndicators;

    const createTabularData = () => {

        const tabularData = {
            Title: "Data",
            ColumnModels: [
                { Heading: "Region", ColumnId: "Region", ColumnIdOrHeading: "Region" },
                { Heading: "Sales", ColumnId: "Sales", ColumnIdOrHeading: "Sales" }
            ],
            IsColumnCompressed: [true, false]
        };

        tabularData.columnResolver = Ren.DataGridColumnResolver(tabularData);

        return tabularData;
    };

    const createVisualisation = (properties) => {

        const element = document.createElement("div");

        document.body.appendChild(element);

        return Object.assign({ element, dataGroupingSettingsGroup: "grid" }, properties);
    };

    let settings;
    let tabularData;
    let sourceChart;
    let grid;
    let otherGroupChart;

    const addRegionFilter = () => {

        Indicators.addFilter({
            group: "grid",
            containingReportGuid: null,
            tabTitle: "Data",
            column: "Region",
            sourceVisualisation: sourceChart,
            getSettings: () => settings,
            getTabularData: () => tabularData
        });

        Indicators.refresh();
    };

    const getChipText = (visualisation) =>
        visualisation.element.querySelector(".ren-cross-filter-chip__text")?.textContent ?? null;

    beforeEach(() => {

        tabularData = createTabularData();

        settings = {
            dataRows: { filterSet: { Data: { columnValueFilters: { Region: ["South"] } } } },
            sortFilterGroup: { removeColumnFilter: jest.fn() }
        };

        sourceChart = createVisualisation({
            title: "Sales by region",
            dataGroupingSettingsGroup: "chart",
            filterGroup: "grid"
        });

        grid = createVisualisation();
        otherGroupChart = createVisualisation({ dataGroupingSettingsGroup: "other" });

        jest.spyOn(Ren.VisualisationCollection, "getVisualisations")
            .mockImplementation(() => [sourceChart, grid, otherGroupChart]);
    });

    afterEach(() => {

        settings.dataRows.filterSet = {};
        Indicators.refresh();
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    test("refresh_ColumnFiltered_ChipNamesColumnAndValueOnFollowingVisualisation", () => {

        addRegionFilter();

        expect(getChipText(grid)).toBe("Region: South");
    });

    test("refresh_ColumnFiltered_NoChipOnSourceOrOtherGroup", () => {

        addRegionFilter();

        expect(getChipText(sourceChart)).toBeNull();
        expect(getChipText(otherGroupChart)).toBeNull();
    });

    test("refresh_SeveralValues_ChipCountsTheRestAndTitleListsAll", () => {

        settings.dataRows.filterSet.Data.columnValueFilters.Region = ["South", "North", "East"];

        addRegionFilter();

        const chip = grid.element.querySelector(".ren-cross-filter-chip");

        expect(getChipText(grid)).toBe("Region: South +2");
        expect(chip.title).toBe(
            "Filtered from \"Sales by region\" to Region = South, North, East."
        );
    });

    test("refresh_ColumnNoLongerFiltered_ChipRemoved", () => {

        addRegionFilter();

        delete settings.dataRows.filterSet.Data.columnValueFilters.Region;
        Indicators.refresh();

        expect(getChipText(grid)).toBeNull();
    });

    test("clearButton_Clicked_RemovesColumnFilter", () => {

        addRegionFilter();

        grid.element.querySelector(".ren-cross-filter-chip__clear").click();

        expect(settings.sortFilterGroup.removeColumnFilter).toHaveBeenCalledWith("Region");
    });

    test("clearButton_Clicked_CallsOnCleared", () => {

        const onCleared = jest.fn();

        Indicators.addFilter({
            group: "grid",
            containingReportGuid: null,
            tabTitle: "Data",
            column: "Region",
            sourceVisualisation: sourceChart,
            getSettings: () => settings,
            getTabularData: () => tabularData,
            onCleared
        });

        Indicators.refresh();
        grid.element.querySelector(".ren-cross-filter-chip__clear").click();

        expect(onCleared).toHaveBeenCalledTimes(1);
    });
});
