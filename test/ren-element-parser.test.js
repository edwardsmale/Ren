describe("Ren.RenElementParser", () => {

    const parse = (attributes) => {

        const element = document.createElement("ren-date-value-chart");

        for (const name in attributes) element.setAttribute(name, attributes[name]);

        return Ren.RenElementParser.parseRenElement(element);
    };

    test("parseRenElement_ChartSettingAttributes_SetOnVisualisation", () => {

        const visualisation = parse({
            "bar-layout": "StackedPerSplit",
            "show-legend": "false",
            "show-value-labels-when-highlighted": ""
        });

        expect(visualisation.barLayout).toBe("StackedPerSplit");
        expect(visualisation.showLegend).toBe(false);
        expect(visualisation.showValueLabelsWhenHighlighted).toBe(true);
        expect(visualisation.dataSourceUriParameters.barLayout).toBeUndefined();
        expect(visualisation.dataSourceUriParameters.showLegend).toBeUndefined();
    });

    test("parseRenElement_BarLayoutAttribute_AppliedAsEnumValue", () => {

        const props = {};

        Ren.DateValueChart_Settings.applySettings(props, parse({ "bar-layout": "Stacked" }));

        expect(props.barLayout).toBe(Ren.BarLayoutEnum.Stacked);
    });

    test("parseRenElement_Attributes_OptionsListedAsSetByMarkup", () => {

        const visualisation =
            parse({ "show-as-index": "true", "chart-title": "Widgets", "region": "North" });

        expect(visualisation.markupOptionNames).toContain("showAsIndex");
        expect(visualisation.markupOptionNames).toContain("chartTitle");
        expect(visualisation.markupOptionNames).not.toContain("region");
    });

    test("parseRenElement_NoAttributes_NoneListedAsSetByMarkup", () => {

        expect(parse({}).markupOptionNames).toEqual([]);
    });

    test("parseRenElement_SettingSetByMarkupTurnedBackToDefault_DefaultSaved", () => {

        const visualisation = parse({ "show-as-index": "true", "id": "markup-saved-default" });

        visualisation.showAsIndex = false;

        const saved = Ren.VisualisationPropertiesTransformer.transform([visualisation]);

        expect(saved["markup-saved-default"].showAsIndex).toBe(false);
    });
});
