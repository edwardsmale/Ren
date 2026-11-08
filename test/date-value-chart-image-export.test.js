describe("Ren.DateValueChart_ImageExport", () => {

    const ImageExport = Ren.DateValueChart_ImageExport;

    const createProps = () => ({
        seriesCount: 3,
        valueHeadings: ["Sales", "Margin", "Orders"],
        series: [
            { colour: "#FF0000", label: "Net sales" },
            { colour: "#00FF00", isEnabled: false },
            { colour: "#0000FF" }
        ]
    });

    const createShadedChart = () => {

        const container = document.createElement("div");

        container.innerHTML = "<div class='ren-chart-title'></div>"
            + "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
            + "<div class='ren-date-value-chart-period-slider'></div>"
            + "<div class='ren-date-value-chart-legend-html'></div>";

        const props = createProps();

        props.svg = container.querySelector("svg");
        ImageExport.setImageAreaShaded(props, true);

        return { container, props };
    };

    test("setImageAreaShaded_True_ShadesOnlyWhatTheImageShows", () => {

        const { container } = createShadedChart();
        const shaded = container.querySelectorAll(`.${ImageExport.IMAGE_AREA_CLASS}`);

        expect(shaded.length).toBe(3);
        expect(container.querySelector(".ren-date-value-chart-period-slider").classList.length)
            .toBe(1);
    });

    test("setImageAreaShaded_False_RemovesShading", () => {

        const { container, props } = createShadedChart();

        ImageExport.setImageAreaShaded(props, false);

        expect(container.querySelectorAll(`.${ImageExport.IMAGE_AREA_CLASS}`).length).toBe(0);
    });

    test("setImageAreaShaded_NoChart_DoesNothing", () => {

        expect(() => ImageExport.setImageAreaShaded({ svg: null }, true)).not.toThrow();
    });

    test("buildSvgString_WhileShaded_LeavesShadingOut", () => {

        const { props } = createShadedChart();

        expect(ImageExport.buildSvgString(props)).not.toContain(ImageExport.IMAGE_AREA_CLASS);
    });

    test("getLegendEntries_HiddenSeries_LeftOut", () => {

        expect(ImageExport.getLegendEntries(createProps())).toEqual([
            { text: "Net sales", colour: "#FF0000" },
            { text: "Orders", colour: "#0000FF" }
        ]);
    });

    test("getFileName_SeriesNames_JoinedWithExtension", () => {

        expect(ImageExport.getFileName(createProps(), "png")).toBe("Net sales, Orders.png");
    });

    test("getFileName_CharactersFilesCannotHold_Removed", () => {

        const props = createProps();

        props.series[0].label = "Sales/Margin: \"UK\"";

        expect(ImageExport.getFileName(props, "svg")).toBe("SalesMargin UK, Orders.svg");
    });

    test("getFileName_NameBrokenOverLines_SpaceKept", () => {

        const props = createProps();

        props.series[0].label = "Net\r\nsales";

        expect(ImageExport.getFileName(props, "svg")).toBe("Net sales, Orders.svg");
    });

    test("getFileName_NoSeries_Chart", () => {

        expect(ImageExport.getFileName({ seriesCount: 0, series: [] }, "svg")).toBe("Chart.svg");
    });

    test("layOutLegend_EntriesFitOneRow_OneRow", () => {

        const layout = ImageExport.layOutLegend([{ text: "A" }, { text: "B" }], 1000);

        expect(layout.positions[0].y).toBe(layout.positions[1].y);
        expect(layout.positions[1].x).toBeGreaterThan(layout.positions[0].x);
    });

    test("layOutLegend_EntriesOverflowWidth_WrappedToNextRow", () => {

        const entries = [{ text: "A long series name" }, { text: "Another long series name" }];

        const layout = ImageExport.layOutLegend(entries, 200);

        expect(layout.positions[1].y).toBeGreaterThan(layout.positions[0].y);
        expect(layout.positions[1].x).toBe(layout.positions[0].x);
    });

    test("layOutLegend_NoEntries_NoHeight", () => {

        expect(ImageExport.layOutLegend([], 500).height).toBe(0);
    });

    test("buildSvgString_NotDrawn_Null", () => {

        expect(ImageExport.buildSvgString(createProps())).toBeNull();
    });

    const createMultiChartPie = () => {

        const item = document.createElement("div");

        item.innerHTML = "<div><svg xmlns='http://www.w3.org/2000/svg'></svg></div>"
            + `<div class='${Ren.DateValueChart_MultiChart.DATE_RANGE_CLASS_NAME}'>2025</div>`;

        const props = createProps();

        props.svg = item.querySelector("svg");
        props.multiChartRange = {};
        props.showAsPies = true;

        return { item, props };
    };

    test("buildSvgString_MultiChartRangeLabel_YearDrawnInImage", () => {

        const { props } = createMultiChartPie();

        expect(ImageExport.buildSvgString(props))
            .toMatch(/<text class="ren-image-date-range"[^>]*text-anchor="middle"[^>]*>2025</);
    });

    test("getFileName_MultiChartRangeLabel_YearAfterName", () => {

        const { props } = createMultiChartPie();

        expect(ImageExport.getFileName(props, "png")).toBe("Net sales, Orders 2025.png");
    });

    test("getFileName_LongNameWithRangeLabel_YearKept", () => {

        const { props } = createMultiChartPie();

        props.series[0].label = "x".repeat(100);

        expect(ImageExport.getFileName(props, "png")).toBe(`${"x".repeat(80)} 2025.png`);
    });

    test("setImageAreaShaded_MultiChartRangeLabel_Shaded", () => {

        const { item, props } = createMultiChartPie();

        ImageExport.setImageAreaShaded(props, true);

        expect(item.lastChild.classList.contains(ImageExport.IMAGE_AREA_CLASS)).toBe(true);
    });

    describe("copying", () => {

        const ImageExport = Ren.DateValueChart_ImageExport;
        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = window.ClipboardItem;

        afterEach(() => {

            if (originalClipboardItem) window.ClipboardItem = originalClipboardItem;
            else delete window.ClipboardItem;

            Object.defineProperty(navigator, "clipboard", {
                value: originalClipboard,
                configurable: true
            });
        });

        const stubClipboard = () => {

            const written = [];

            window.ClipboardItem = function (data) {

                this.data = data;
            };

            const write = (items) => {

                written.push(items);

                return Promise.resolve();
            };

            Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });

            return written;
        };

        test("canCopyImage_NoClipboardItem_False", () => {

            delete window.ClipboardItem;

            expect(ImageExport.canCopyImage()).toBe(false);
        });

        test("canCopyImage_ClipboardWritable_True", () => {

            stubClipboard();

            expect(ImageExport.canCopyImage()).toBe(true);
        });

        test("copyPng_ChartNotDrawn_ClipboardWrittenAtOnceWithImageThatFails", async () => {

            const written = stubClipboard();

            await ImageExport.copyPng({});

            expect(written.length).toBe(1);
            expect(Object.keys(written[0][0].data)).toEqual(["image/png"]);
            await expect(written[0][0].data["image/png"]).rejects.toThrow("could not be drawn");
        });
    });
});
