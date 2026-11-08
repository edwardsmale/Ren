describe("Ren.VisualisationInputDataHelper unfiltered columns", () => {

    const InputDataHelper = Ren.VisualisationInputDataHelper;

    const rows = [{ Region: "North", Size: "1" }, { Region: "South", Size: "2" }];

    let filteredColumnValueFilters;

    // Each test reads its own data source, so the helper's caches hold nothing from another.
    let dataSourceNumber = 0;

    const createVisualisation = (filterGroup) => ({
        dataSourceUri: "unfiltered-columns-" + (++dataSourceNumber),
        dataGroupingSettingsGroup: "chart",
        filterGroup
    });

    const createFilterSet = () => ({
        Data: {
            columnValueFilters: { Region: ["North"], Size: ["1"] },
            negatedColumns: ["Region"]
        }
    });

    beforeEach(() => {

        filteredColumnValueFilters = [];

        const settingsByGroup = {
            grid: { signifier: "grid-1", dataRows: { filterSet: createFilterSet() } }
        };

        jest.spyOn(Ren.DataGroupingSettingsCollection, "getDataGroupingSettings")
            .mockImplementation((group) => settingsByGroup[group] ?? null);

        jest.spyOn(Ren.DataGroupingSettingsCollection, "getDataGroupingSettingsTransformed")
            .mockImplementation(() => null);

        jest.spyOn(Ren.DataGroupingSettings_Services_FilterAccessors,
            "getRowFilterableGroupingColumnValueFilters")
            .mockImplementation(() => []);

        jest.spyOn(Ren.DataGroupingSettingsFactory, "createDataGroupingSettings")
            .mockImplementation(() => ({
                groupings: { entries: [] },
                sortFilterGroup: { getRowIndexesInOutermostGrouping: () => null }
            }));

        jest.spyOn(Ren, "DataGroupingSettingsApplyer").mockImplementation(() => ({}));

        jest.spyOn(Ren.DataGroupingSettingsInitialiser, "initialiseDataGroupingSettings")
            .mockImplementation(() => {});

        jest.spyOn(Ren.TabularDataAdapter_Array, "getDataArray").mockImplementation(() => rows);

        jest.spyOn(Ren.RowObjectFilter, "filterRowsByColumnValueFilters")
            .mockImplementation((filteredRows, columnValueFilters) => {

                filteredColumnValueFilters.push(columnValueFilters);
                return filteredRows;
            });
    });

    afterEach(() => {

        jest.restoreAllMocks();
    });

    const tabularData = { Title: "Data", DataRowCount: 2 };

    test("getInputData_UnfilteredColumnInFilterGroup_LeftOutOfRowFilter", () => {

        InputDataHelper.getInputData(tabularData, createVisualisation("grid"), null, ["Region"]);

        expect(filteredColumnValueFilters).toEqual([{ Size: ["1"] }]);
    });

    test("getInputData_NoUnfilteredColumns_FilteredByEveryColumn", () => {

        InputDataHelper.getInputData(tabularData, createVisualisation("grid"), null, null);

        expect(filteredColumnValueFilters).toEqual([{ Region: ["North"], Size: ["1"] }]);
    });

    test("getInputData_UnfilteredColumnInFilterGroup_SourceFilterSetLeftAlone", () => {

        InputDataHelper.getInputData(tabularData, createVisualisation("grid"), null, ["Region"]);

        const sourceSettings = Ren.DataGroupingSettingsCollection.getDataGroupingSettings("grid");

        expect(sourceSettings.dataRows.filterSet).toEqual(createFilterSet());
    });

    test("getInputData_UnfilteredColumnInOwnSettings_LeftOutOfAppliedFilterSet", () => {

        const ownSettings = { signifier: "chart-1", dataRows: { filterSet: createFilterSet() } };
        const applyDataGroupingSettings = jest.fn();

        Ren.DataGroupingSettingsCollection.getDataGroupingSettingsTransformed
            .mockImplementation(() => ownSettings);

        Ren.DataGroupingSettingsApplyer.mockImplementation(() => ({ applyDataGroupingSettings }));

        InputDataHelper.getInputData(tabularData, createVisualisation(null), null, ["Region"]);

        const appliedFilterSet = applyDataGroupingSettings.mock.calls[0][0].dataRows.filterSet;

        expect(appliedFilterSet.Data.columnValueFilters).toEqual({ Size: ["1"] });
        expect(appliedFilterSet.Data.negatedColumns).toEqual([]);
        expect(ownSettings.dataRows.filterSet).toEqual(createFilterSet());
    });
});
