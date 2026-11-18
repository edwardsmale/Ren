describe("Ren.VisualisationsTransformer", () => {

    const transform = (visualisation) =>
        Ren.VisualisationsTransformer.transform(false, [visualisation])[0];

    test("transform_ContainingReportUrl_LeftOut", () => {

        const transformed = transform({
            visualisationTypeName: "DataGrid",
            containingReportUrl:
                "https://reports.example/CategorySales?Region=North"
        });

        expect(transformed.visualisationTypeName).toBe("DataGrid");
        expect(transformed.hasOwnProperty("containingReportUrl")).toBe(false);
    });

    test("transform_ForDownloadedReport_ContainingReportUrlLeftOut", () => {

        const transformed = Ren.VisualisationsTransformer.transform(true, [{
            visualisationTypeName: "DataGrid",
            containingReportUrl: "/Sales?Region=North"
        }])[0];

        expect(transformed.hasOwnProperty("containingReportUrl")).toBe(false);
    });

    test("transform_ChartDataGroupingSettings_SavedWithoutNamedColumnIndexes", () => {

        const chartDataGroupingSettings = {
            groupings: {
                entries: [
                    { groupByColumnIndexes: [3], groupByColumns: ["Amazon / Non-Amazon"] },
                    { groupByColumnIndexes: [] }
                ]
            }
        };

        const transformed = transform({
            visualisationTypeName: "DateValueChart",
            chartDataGroupingSettings
        });

        expect(transformed.chartDataGroupingSettings.groupings.entries).toEqual([
            { groupByColumns: ["Amazon / Non-Amazon"] },
            { groupByColumns: [] }
        ]);

        // The chart keeps its indexes.
        expect(chartDataGroupingSettings.groupings.entries[0].groupByColumnIndexes).toEqual([3]);
    });
});
