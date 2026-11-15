describe("Ren.VisualisationsTransformer", () => {

    const transform = (visualisation) =>
        Ren.VisualisationsTransformer.transform(false, [visualisation])[0];

    test("transform_ContainingReportUrl_LeftOut", () => {

        const transformed = transform({
            visualisationTypeName: "DataGrid",
            containingReportUrl:
                "https://reporting.example.com/BrandPartnershipSalesData_Overall?Partner=Durable"
        });

        expect(transformed.visualisationTypeName).toBe("DataGrid");
        expect(transformed.hasOwnProperty("containingReportUrl")).toBe(false);
    });

    test("transform_ForDownloadedReport_ContainingReportUrlLeftOut", () => {

        const transformed = Ren.VisualisationsTransformer.transform(true, [{
            visualisationTypeName: "DataGrid",
            containingReportUrl: "/Sales?Partner=Durable"
        }])[0];

        expect(transformed.hasOwnProperty("containingReportUrl")).toBe(false);
    });
});
