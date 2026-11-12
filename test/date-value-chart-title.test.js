describe("Ren.DateValueChart_Title", () => {

    const Title = Ren.DateValueChart_Title;

    test("getTitle_SpaceAround_Trimmed", () => {

        expect(Title.getTitle({ chartTitle: "  Sales  " })).toBe("Sales");
    });

    test("getTitle_NoTitle_Empty", () => {

        expect(Title.getTitle({})).toBe("");
        expect(Title.getTitle({ chartTitle: null })).toBe("");
    });

    test("getTitle_TokensForValueAndSplit_NamesTheirColumns", () => {

        const props = {
            chartTitle: "{value} by {split}",
            valueColumnHeadings: ["Profit"],
            seriesSplit: { columnHeading: "Sales Channel" }
        };

        expect(Title.getTitle(props)).toBe("Profit by Sales Channel");
    });

    test("getTitle_SeveralValueColumns_NamesThemAll", () => {

        const props = { chartTitle: "{value}", valueColumnHeadings: ["Revenue", "Profit"] };

        expect(Title.getTitle(props)).toBe("Revenue, Profit");
    });

    test("getTitle_SplitTokenWithNoSplit_LeftOutWithWordBefore", () => {

        const props = {
            chartTitle: "{value} by {split}",
            valueColumnHeadings: ["Revenue"],
            seriesSplit: null
        };

        expect(Title.getTitle(props)).toBe("Revenue");
    });

    test("getTitle_ColumnNameHoldsDollar_KeptAsWritten", () => {

        const props = { chartTitle: "{value}", valueColumnHeadings: ["Spend $&"] };

        expect(Title.getTitle(props)).toBe("Spend $&");
    });

    test("getTitleTemplate_Tokens_KeptForEditing", () => {

        const props = { chartTitle: " {value} by {split} ", valueColumnHeadings: ["Revenue"] };

        expect(Title.getTitleTemplate(props)).toBe("{value} by {split}");
    });

    describe("subtitle", () => {

        const visualisation = {
            dataSourceUri: "uri",
            dataTabIndex: 1,
            dataGroupingSettingsGroup: "Chart",
            filterGroup: "Mix"
        };

        const tabularData = { columnResolver: { getColumnIndex: () => null } };

        const spyOnFilters = (columnFilters, predicates, otherVisualisations) => {

            jest.spyOn(Ren.DataSources, "getTabularData").mockReturnValue(tabularData);
            jest.spyOn(Ren.DateValueChart_DataPointGrid, "getChartFilters").mockReturnValue({
                columnFilters: new Map(Object.entries(columnFilters)),
                predicates: predicates ?? []
            });
            jest.spyOn(Ren.VisualisationCollection, "getVisualisations")
                .mockReturnValue(otherVisualisations ?? []);
        };

        const createChart = () => {

            const container = document.createElement("div");
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

            container.appendChild(svg);

            return { container, svg };
        };

        afterEach(() => jest.restoreAllMocks());

        test("getSubtitle_NoFiltersToken_ShownAsWritten", () => {

            expect(Title.getSubtitle({ chartSubtitle: " Excludes gifts " })).toBe("Excludes gifts");
        });

        test("getSubtitle_NothingFiltered_Empty", () => {

            spyOnFilters({});

            expect(Title.getSubtitle({ chartSubtitle: "Filtered: {filters}", visualisation }))
                .toBe("");
        });

        test("getSubtitle_Filtered_TokenNamesFilters", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"], ["Bic", "Bic"]]), isNegated: false }
            });

            expect(Title.getSubtitle({ chartSubtitle: "Filtered: {filters}", visualisation }))
                .toBe("Filtered: Brand: Acco; Bic");
        });

        test("getSubtitle_ManyValues_ShownCappedAndTooltipFull", () => {

            const values = ["A", "B", "C", "D", "E", "F", "G", "H"];

            spyOnFilters({
                Brand: { valueMap: new Map(values.map(value => [value, value])), isNegated: false }
            });

            const props = { chartSubtitle: "{filters}", visualisation };

            expect(Title.getSubtitle(props)).toBe("Brand: A; B; C; D; E; F and 2 more");
            expect(Title.getSubtitle(props, Infinity)).toBe("Brand: A; B; C; D; E; F; G; H");
        });

        test("getSubtitle_FilterModuleHeadsItsItem_HeadedAsTheModuleHeadsIt", () => {

            const categoryFilter = {
                type: "includeCombinations",
                columns: ["Top-Level Category", "Sub One Category"],
                tuples: [["Paper"], ["Pens", "Gel Pens"]]
            };

            const filterModule = {
                sourceDataGroupingSettingsGroup: "Mix",
                columnOverrides: {
                    "Top-Level Category": { HeadingOverride: "Category" },
                    "Sub One Category": { HeadingOverride: "Sub-category" }
                }
            };

            const otherModule = {
                sourceDataGroupingSettingsGroup: "Elsewhere",
                columnOverrides: { "Top-Level Category": { HeadingOverride: "Other" } }
            };

            spyOnFilters({}, [categoryFilter], [otherModule, filterModule]);

            expect(Title.getSubtitle({ chartSubtitle: "{filters}", visualisation }))
                .toBe("Category: Paper; Gel Pens");
        });

        test("getSubtitle_FilterModuleYesOrBothCheckboxTicked_HeadingAlone", () => {

            const filterModule = {
                sourceDataGroupingSettingsGroup: "Mix",
                columnOverrides: {
                    "Is Core": {
                        HeadingOverride: "Core Categories Only",
                        showAsCheckbox: "YesOrBoth"
                    }
                }
            };

            spyOnFilters(
                { "Is Core": { valueMap: new Map([["1", "1"]]), isNegated: false } },
                [],
                [filterModule]
            );

            Ren.DataSources.getTabularData.mockReturnValue({
                columnResolver: { getColumnIndex: () => 0, getColumnHeading: () => "Is Core" },
                ColumnModels: [{ ColumnFormat: Ren.SpreadsheetColumnFormatEnum.Boolean }]
            });

            expect(Title.getSubtitle({ chartSubtitle: "{filters}", visualisation }))
                .toBe("Core Categories Only");
        });

        test("getSubtitleParts_Filtered_OnlyValuesFlagged", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"], ["Bic", "Bic"]]), isNegated: true }
            });

            expect(Title.getSubtitleParts({ chartSubtitle: "In {filters}.", visualisation }))
                .toEqual([
                    { text: "In ", isValue: false },
                    { text: "", isValue: false, isFilterSymbol: true },
                    { text: "Brand: not ", isValue: false },
                    { text: "Acco", isValue: true },
                    { text: "; ", isValue: false },
                    { text: "Bic", isValue: true },
                    { text: ".", isValue: false }
                ]);
        });

        test("render_Filtered_ValuesInBold", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"], ["Bic", "Bic"]]), isNegated: false }
            });

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const subtitle = container.querySelector(".ren-chart-subtitle");
            const values = subtitle.querySelectorAll("strong");

            expect(subtitle.textContent).toBe("Brand: Acco; Bic");
            expect(values.length).toBe(2);
            expect(values[0].textContent).toBe("Acco");
            expect(values[1].textContent).toBe("Bic");
        });

        test("render_CrossFiltered_CrossFilterFirstInChip", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"]]), isNegated: false },
                Region: { valueMap: new Map([["South", "South"]]), isNegated: false }
            });

            const crossFilter = {
                filter: { column: "Region", group: "Mix" },
                text: "Region: South",
                title: "Filtered from \"Sales by region\" to Region = South."
            };

            jest.spyOn(Ren.VisualisationCrossFilterIndicators, "getCrossFilters")
                .mockReturnValue([crossFilter]);

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const subtitle = container.querySelector(".ren-chart-subtitle");
            const chip = subtitle.querySelector(".ren-cross-filter-chip--inline");

            expect(Title.getSubtitle({ chartSubtitle: "{filters}", visualisation }))
                .toBe("Region: South  |  Brand: Acco");
            expect(chip.querySelector(".ren-cross-filter-chip__text").textContent)
                .toBe("Region: South");
            expect(chip.querySelector("strong").textContent).toBe("South");
            expect(chip.title).toBe(crossFilter.title);
            expect(subtitle.querySelectorAll(".ren-cross-filter-chip").length).toBe(1);
        });

        test("render_FilteredByTwoColumns_FilterSymbolBetweenThem", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"]]), isNegated: false },
                Region: { valueMap: new Map([["South", "South"]]), isNegated: false }
            });

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const subtitle = container.querySelector(".ren-chart-subtitle");
            const separators = subtitle.querySelectorAll(".ren-chart-subtitle__separator");

            expect(subtitle.textContent).not.toContain("|");
            expect(separators.length).toBe(1);
            expect(separators[0].querySelector(".ren-chart-subtitle__filter-icon")).not.toBeNull();
        });

        test("render_FilteredWithoutChips_FilterSymbolFirst", () => {

            spyOnFilters({ Brand: { valueMap: new Map([["Acco", "Acco"]]), isNegated: false } });

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const text = container.querySelector(".ren-chart-subtitle__text");

            expect(text.firstChild.getAttribute("class")).toBe("ren-chart-subtitle__filter-icon");
            expect(text.textContent).toBe("Brand: Acco");
        });

        test("render_CrossFiltered_NoFilterSymbolBeforeChip", () => {

            spyOnFilters({ Region: { valueMap: new Map([["South", "South"]]), isNegated: false } });

            jest.spyOn(Ren.VisualisationCrossFilterIndicators, "getCrossFilters").mockReturnValue([
                { filter: { column: "Region", group: "Mix" }, text: "Region: South", title: "" }
            ]);

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const text = container.querySelector(".ren-chart-subtitle__text");

            expect(text.firstChild.classList.contains("ren-cross-filter-chip")).toBe(true);
            expect(text.querySelectorAll(".ren-chart-subtitle__filter-icon").length).toBe(0);
        });

        test("render_TwoCrossFilters_NoFilterSymbolBeforeSecondChip", () => {

            spyOnFilters({
                Brand: { valueMap: new Map([["Acco", "Acco"]]), isNegated: false },
                Region: { valueMap: new Map([["South", "South"]]), isNegated: false }
            });

            jest.spyOn(Ren.VisualisationCrossFilterIndicators, "getCrossFilters").mockReturnValue([
                { filter: { column: "Region", group: "Mix" }, text: "Region: South", title: "" },
                { filter: { column: "Brand", group: "Mix" }, text: "Brand: Acco", title: "" }
            ]);

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "{filters}", visualisation });

            const subtitle = container.querySelector(".ren-chart-subtitle");
            const separators = subtitle.querySelectorAll(".ren-chart-subtitle__separator");

            expect(subtitle.querySelectorAll(".ren-cross-filter-chip").length).toBe(2);
            expect(separators.length).toBe(1);
            expect(separators[0].querySelector("svg")).toBeNull();
        });

        test("render_TitleAndSubtitle_SubtitleBeneathTitle", () => {

            const { container, svg } = createChart();

            Title.render({ svg, chartTitle: "Sales", chartSubtitle: "All channels" });

            const children = container.children;

            expect(children[0].className).toBe("ren-chart-title");
            expect(children[1].className).toBe("ren-chart-subtitle");
            expect(children[1].textContent).toBe("All channels");
            expect(children[2]).toBe(svg);
        });

        test("render_FiltersSubtitleUnfiltered_RoomKeptHidden", () => {

            spyOnFilters({});

            const { container, svg } = createChart();

            Title.render({ svg, chartTitle: "Sales", chartSubtitle: "{filters}", visualisation });

            const children = container.children;

            expect(children[1].classList.contains("ren-chart-subtitle")).toBe(true);
            expect(children[1].classList.contains("ren-chart-subtitle--placeholder")).toBe(true);
            expect(children[1].style.visibility).toBe("hidden");
            expect(children[1].getAttribute("aria-hidden")).toBe("true");
            expect(children[1].getAttribute("role")).toBeNull();
            expect(children[2]).toBe(svg);
        });

        test("render_SubtitleRemoved_TakenAway", () => {

            const { container, svg } = createChart();

            Title.render({ svg, chartSubtitle: "All channels" });
            Title.render({ svg, chartSubtitle: "" });

            expect(container.querySelector(".ren-chart-subtitle")).toBeNull();
        });
    });

    test("getChartLabel_Titled_TitleLeads", () => {

        const props = {
            chartTitle: "Weekly sales",
            seriesCount: 1,
            series: [{}],
            valueHeadings: ["Sales"],
            dateHeading: "Week"
        };

        expect(Ren.DateValueChart_Accessibility.getChartLabel(props))
            .toBe("Weekly sales: Chart of Sales by Week");
    });

    test("getChartLabel_TitledWithNoSeries_Title", () => {

        const props = { chartTitle: "Weekly sales", seriesCount: 0, series: [] };

        expect(Ren.DateValueChart_Accessibility.getChartLabel(props)).toBe("Weekly sales");
    });

    test("getFileName_Titled_NamedByTitle", () => {

        const props = {
            chartTitle: "Sales: UK",
            seriesCount: 1,
            series: [{}],
            valueHeadings: ["Sales"]
        };

        expect(Ren.DateValueChart_ImageExport.getFileName(props, "png")).toBe("Sales UK.png");
    });
});
