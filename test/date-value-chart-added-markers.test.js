describe("Ren.DateValueChart_MarkerLines added markers", () => {

    const MarkerLines = Ren.DateValueChart_MarkerLines;

    test("addDateSpec_NoMarkerLines_OneMarker", () => {

        expect(MarkerLines.addDateSpec(undefined, "2026-01-05", "Launch"))
            .toEqual([{ date: "2026-01-05", label: "Launch" }]);
    });

    test("addDateSpec_ExistingMarkerLines_AddedAfterThemAndOriginalLeft", () => {

        const existing = [{ column: "Published" }];

        const result = MarkerLines.addDateSpec(existing, "2026-01-05", "Launch");

        expect(result).toEqual([{ column: "Published" }, { date: "2026-01-05", label: "Launch" }]);
        expect(existing.length).toBe(1);
    });

    test("addDateSpec_MarkerLinesAsJson_Parsed", () => {

        const result = MarkerLines.addDateSpec("[{\"date\":\"today\"}]", "2026-01-05", "Launch");

        expect(result.length).toBe(2);
        expect(result[0]).toEqual({ date: "today" });
    });

    test("addDateSpec_BlankLabel_Unlabelled", () => {

        expect(MarkerLines.addDateSpec([], "2026-01-05", "   "))
            .toEqual([{ date: "2026-01-05" }]);
    });

    test("removeSpec_Index_ThatOneRemovedAndOriginalLeft", () => {

        const existing = [{ date: "2026-01-01" }, { date: "2026-02-01" }, { date: "2026-03-01" }];

        expect(MarkerLines.removeSpec(existing, 1))
            .toEqual([{ date: "2026-01-01" }, { date: "2026-03-01" }]);
        expect(existing.length).toBe(3);
    });
});
