describe("Ren.DateValueChart_CrossFiltering", () => {

    const CrossFiltering = Ren.DateValueChart_CrossFiltering;

    const createTabularData = () => ({
        Title: "Data",
        ColumnModels: [
            { Heading: "Date", ColumnIdOrHeading: "Date" },
            { Heading: "Region", ColumnIdOrHeading: "Region" },
            { Heading: "Size", ColumnIdOrHeading: "Size" },
            { Heading: "Colour", ColumnIdOrHeading: "Colour" }
        ],
        IsColumnCompressed: [true, true, false, true],
        columnResolver: {
            getColumnIndex: (column) => ["Date", "Region", "Size", "Colour"].indexOf(column)
        },
        findColumnIndex: (heading) => ["Date", "Region", "Size", "Colour"].indexOf(heading)
    });

    const createSettings = (columnValueFilters) => ({
        dataRows: { filterSet: { Data: { columnValueFilters: columnValueFilters ?? {} } } },
        sortFilterGroup: {
            setAllFilter: jest.fn(),
            removeColumnFilter: jest.fn()
        }
    });

    // A series group holding one bar, inside the chart's svg.
    const createChart = (props) => {

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const seriesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const bar = document.createElementNS("http://www.w3.org/2000/svg", "path");

        seriesGroup.setAttribute("data-series", "2");
        seriesGroup.appendChild(bar);
        svg.appendChild(seriesGroup);

        return {
            bar,
            props: Object.assign({
                svg,
                valueHeadings: ["Sales – North", "Sales – South"],
                seriesSplit: {
                    columnKey: "Region",
                    splitValueBySeriesHeading: {
                        "Sales – North": "North",
                        "Sales – South": "South"
                    }
                }
            }, props)
        };
    };

    afterEach(() => {

        jest.restoreAllMocks();
    });

    test("getClickedFilter_SplitSeriesBar_GetsSplitColumnAndValue", () => {

        const chart = createChart();

        const clickedFilter =
            CrossFiltering.getClickedFilter(chart.props, createTabularData(), chart.bar);

        expect(clickedFilter).toEqual({ column: "Region", values: ["South"] });
    });

    test("getClickedFilter_UnsplitSeries_GetsNull", () => {

        const chart = createChart({ seriesSplit: null });

        const clickedFilter =
            CrossFiltering.getClickedFilter(chart.props, createTabularData(), chart.bar);

        expect(clickedFilter).toBeNull();
    });

    test("getClickedFilter_EmptySplitValueOfNumericColumn_GetsNullSentinel", () => {

        const chart = createChart({
            seriesSplit: {
                columnKey: "Size",
                splitValueBySeriesHeading: { "Sales – North": "1", "Sales – South": "" }
            }
        });

        const clickedFilter =
            CrossFiltering.getClickedFilter(chart.props, createTabularData(), chart.bar);

        expect(clickedFilter).toEqual({ column: "Size", values: [Ren.NullSentinel] });
    });

    test("getClickedFilter_SubdivisionBand_GetsSubdivideColumnAndValues", () => {

        const chart = createChart({ subdivideColumn: "Colour" });

        jest.spyOn(Ren.DateValueChart_SeriesSubdivisions, "getMarkSubdivision")
            .mockImplementation(() => ({ columnValues: ["Red", "Blue"] }));

        const clickedFilter =
            CrossFiltering.getClickedFilter(chart.props, createTabularData(), chart.bar);

        expect(clickedFilter).toEqual({ column: "Colour", values: ["Red", "Blue"] });
    });

    test("getClickedFilter_SeriesGatheringUndrawnValues_GetsNull", () => {

        const chart = createChart({
            seriesSplit: {
                columnKey: "Region",
                splitValueBySeriesHeading: {
                    "Sales – North": "North",
                    "Sales – South": Ren.DateValueChart_SeriesSplit.OTHER_VALUE
                }
            }
        });

        const clickedFilter =
            CrossFiltering.getClickedFilter(chart.props, createTabularData(), chart.bar);

        expect(clickedFilter).toBeNull();
    });

    const createSplitVisualisation = (properties) => Object.assign({
        enableCrossFiltering: true,
        chartDataGroupingSettings: {
            groupings: { entries: [{ groupByColumnIndexes: [1], groupByColumns: ["Region"] }] }
        }
    }, properties);

    const createResolvedTabularData = () => {

        const tabularData = createTabularData();

        tabularData.columnResolver = Ren.DataGridColumnResolver(tabularData);

        return tabularData;
    };

    test("getUnfilteredColumns_SplitAndSubdivided_GetsBothColumns", () => {

        const visualisation = createSplitVisualisation({ subdivideColumn: "Colour" });

        const columns =
            CrossFiltering.getUnfilteredColumns(visualisation, createResolvedTabularData());

        expect(columns).toEqual(["Region", "Colour"]);
    });

    test("getUnfilteredColumns_CrossFilteringOff_GetsNull", () => {

        const visualisation = createSplitVisualisation({ enableCrossFiltering: false });

        const columns =
            CrossFiltering.getUnfilteredColumns(visualisation, createResolvedTabularData());

        expect(columns).toBeNull();
    });

    test("getUnfilteredColumns_NeitherSplitNorSubdivided_GetsNull", () => {

        const visualisation = { enableCrossFiltering: true };

        const columns =
            CrossFiltering.getUnfilteredColumns(visualisation, createResolvedTabularData());

        expect(columns).toBeNull();
    });

    test("applyClick_NoFilter_NarrowsColumnToValue", () => {

        const settings = createSettings();

        CrossFiltering.applyClick(settings, createTabularData(), "Region", ["South"], false);

        expect(settings.sortFilterGroup.setAllFilter).toHaveBeenCalledWith("Region", ["South"]);
    });

    test("applyClick_ValueIsSoleSelection_RemovesFilter", () => {

        const settings = createSettings({ Region: ["South"] });

        CrossFiltering.applyClick(settings, createTabularData(), "Region", ["South"], false);

        expect(settings.sortFilterGroup.removeColumnFilter).toHaveBeenCalledWith("Region");
        expect(settings.sortFilterGroup.setAllFilter).not.toHaveBeenCalled();
    });

    test("applyClick_OtherValueSelected_NarrowsColumnToValue", () => {

        const settings = createSettings({ Region: ["North"] });

        CrossFiltering.applyClick(settings, createTabularData(), "Region", ["South"], false);

        expect(settings.sortFilterGroup.setAllFilter).toHaveBeenCalledWith("Region", ["South"]);
    });

    test("applyClick_CtrlClickOnUnselectedValue_AddsValue", () => {

        const settings = createSettings({ Region: ["North"] });

        CrossFiltering.applyClick(settings, createTabularData(), "Region", ["South"], true);

        expect(settings.sortFilterGroup.setAllFilter)
            .toHaveBeenCalledWith("Region", ["North", "South"]);
    });

    test("clearFilters_SplitColumnFiltered_RemovesOnlyFilteredColumns", () => {

        const settings = createSettings({ Region: ["South"] });
        const visualisation = createSplitVisualisation({ subdivideColumn: "Colour" });

        jest.spyOn(Ren.DataSources, "getTabularData")
            .mockImplementation(() => createResolvedTabularData());

        jest.spyOn(Ren.DataGroupingSettingsSource, "resolve").mockImplementation(() => settings);

        CrossFiltering.clearFilters({ visualisation });

        expect(settings.sortFilterGroup.removeColumnFilter).toHaveBeenCalledTimes(1);
        expect(settings.sortFilterGroup.removeColumnFilter).toHaveBeenCalledWith("Region");
    });

    describe("filter cleared elsewhere", () => {

        let settings;
        let props;

        // A cross-filtering chart, on the page, whose split column is filtered.
        const attachFilteredChart = () => {

            settings = createSettings({ Region: ["South"] });

            jest.spyOn(Ren.DataSources, "getTabularData")
                .mockImplementation(() => createResolvedTabularData());

            jest.spyOn(Ren.DataGroupingSettingsSource, "resolve")
                .mockImplementation(() => settings);

            jest.spyOn(Ren.DateValueChart_Legend, "clearSelection").mockImplementation(() => {});
            jest.spyOn(Ren.DateValueChart_Legend, "showSelection").mockImplementation(() => {});

            props = createChart({
                enableCrossFiltering: true,
                visualisation: createSplitVisualisation()
            }).props;

            document.body.appendChild(props.svg);
            CrossFiltering.attach(props);
        };

        beforeEach(() => {

            jest.useFakeTimers();
            attachFilteredChart();
        });

        afterEach(() => {

            jest.useRealTimers();
            document.body.innerHTML = "";
        });

        test("filterChanged_ChartsColumnNoLongerFiltered_ClearsSelection", () => {

            delete settings.dataRows.filterSet.Data.columnValueFilters.Region;
            Ren.Messages.Events.filterChanged.notifyImmediately("data", "grid", null);
            jest.runOnlyPendingTimers();

            expect(Ren.DateValueChart_Legend.clearSelection).toHaveBeenCalledWith(props);
        });

        const changeRegionFilter = (values) => {

            settings.dataRows.filterSet.Data.columnValueFilters.Region = values;
            Ren.Messages.Events.filterChanged.notifyImmediately("data", "grid", null);
            jest.runOnlyPendingTimers();
        };

        test("filterChanged_SplitColumnFilteredToOtherValue_SelectsItsSeries", () => {

            changeRegionFilter(["North"]);

            expect(Ren.DateValueChart_Legend.showSelection).toHaveBeenCalledWith(props, [1]);
            expect(Ren.DateValueChart_Legend.clearSelection).not.toHaveBeenCalled();
        });

        test("filterChanged_SplitColumnFilteredToSeveralValues_SelectsEachSeries", () => {

            changeRegionFilter(["South", "North"]);

            expect(Ren.DateValueChart_Legend.showSelection).toHaveBeenCalledWith(props, [1, 2]);
        });

        test("filterChanged_SplitColumnFilterUnchanged_LeavesSelection", () => {

            settings.dataRows.filterSet.Data.columnValueFilters.Size = ["1"];
            changeRegionFilter(["South"]);

            expect(Ren.DateValueChart_Legend.showSelection).not.toHaveBeenCalled();
            expect(Ren.DateValueChart_Legend.clearSelection).not.toHaveBeenCalled();
        });
    });
});
