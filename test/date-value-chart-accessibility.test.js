describe("Ren.DateValueChart_Accessibility", () => {

    const Accessibility = Ren.DateValueChart_Accessibility;

    const createProps = () => ({
        seriesCount: 2,
        series: [{ label: "Net sales" }, {}],
        valueHeadings: ["NetSales", "Orders"],
        dateHeading: "Order date"
    });

    const createEntries = (count) => {

        const entries = [];

        for (let i = 0; i < count; i++) {
            entries.push(document.createElement("div"));
        }

        return entries;
    };

    test("getChartLabel_TwoSeries_NamedAfterSeriesByDate", () => {

        expect(Accessibility.getChartLabel(createProps()))
            .toBe("Chart of Net sales, Orders by Order date");
    });

    test("getChartLabel_HiddenSeries_LeftOut", () => {

        const props = createProps();

        props.series[0].isEnabled = false;

        expect(Accessibility.getChartLabel(props)).toBe("Chart of Orders by Order date");
    });

    test("getChartLabel_NoDateHeading_SeriesOnly", () => {

        const props = createProps();

        props.dateHeading = undefined;

        expect(Accessibility.getChartLabel(props)).toBe("Chart of Net sales, Orders");
    });

    test("getChartLabel_NoSeries_Chart", () => {

        expect(Accessibility.getChartLabel({ seriesCount: 0, series: [] })).toBe("Chart");
    });

    test("getAdjacentEntry_ArrowRight_NextEntry", () => {

        const entries = createEntries(3);

        expect(Accessibility.getAdjacentEntry(entries, entries[0], "ArrowRight"))
            .toBe(entries[1]);
    });

    test("getAdjacentEntry_ArrowLeftOnFirst_StaysOnFirst", () => {

        const entries = createEntries(3);

        expect(Accessibility.getAdjacentEntry(entries, entries[0], "ArrowLeft"))
            .toBe(entries[0]);
    });

    test("getAdjacentEntry_HomeAndEnd_FirstAndLastEntries", () => {

        const entries = createEntries(3);

        expect(Accessibility.getAdjacentEntry(entries, entries[1], "Home")).toBe(entries[0]);
        expect(Accessibility.getAdjacentEntry(entries, entries[1], "End")).toBe(entries[2]);
    });

    test("getAdjacentEntry_OtherKey_Null", () => {

        const entries = createEntries(3);

        expect(Accessibility.getAdjacentEntry(entries, entries[1], "a")).toBeNull();
    });

    test("makeLegendEntryButton_HiddenSeries_FocusableButtonNotPressed", () => {

        const entry = document.createElement("div");

        Accessibility.makeLegendEntryButton(entry, false);

        expect(entry.getAttribute("tabindex")).toBe("0");
        expect(entry.getAttribute("role")).toBe("button");
        expect(entry.getAttribute("aria-pressed")).toBe("false");
    });
});
