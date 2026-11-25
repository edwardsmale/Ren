describe("Ren.DateValueChart_Settings", () => {

    const Settings = Ren.DateValueChart_Settings;
    const DateValueChart = Ren.VisualisationTypes_DateValueChart;

    const apply = (visualisation) => {

        const props = {};

        Settings.applySettings(props, visualisation);

        return props;
    };

    // Each setting as [name, what the props hold when unset, a value it can be set to, what the
    // props hold then].
    const APPLIED_SETTINGS = [
        ["barLayout", Ren.BarLayoutEnum.SideBySide, Ren.BarLayoutEnum.Stacked,
            Ren.BarLayoutEnum.Stacked],
        ["periodGap", 0, "8", 8],
        ["lineLayout", Ren.LineLayoutEnum.Overlayed, "Stacked", Ren.LineLayoutEnum.Stacked],
        ["shadeLines", false, true, true],
        ["subdivideColumn", null, "Shape", "Shape"],
        ["subdivisionLabels", "names", "values", "values"],
        ["subdivisionLabelPlacement", "inside", "around", "around"],
        ["subdivisionLimit", null, 5, 5],
        ["pieHoleRadius", undefined, "0.5", 0.5],
        ["pieLabels", "outside", "inside", "inside"],
        ["pieLabelNames", true, false, false],
        ["pieLabelValues", false, true, true],
        ["pieValuePosition", "inline", "below", "below"],
        ["pieLabelPercentages", true, false, false],
        ["pieSharesInside", true, false, false],
        ["pieHoleTotals", true, false, false],
        ["lineShadingOpacity", undefined, "0.4", 0.4],
        ["showLegend", true, false, false],
        ["chartTitle", "", "Widgets", "Widgets"],
        ["chartSubtitle", "", "By week", "By week"],
        ["barValueLabelLayout", "auto", "above", "above"],
        ["lineNames", "auto", "ends", "ends"],
        ["showValueLabelsWhenHighlighted", false, true, true],
        ["showLeftAxis", true, false, false],
        ["showRightAxis", true, false, false],
        ["showDateAxis", true, false, false],
        ["showLeftAxisHeading", true, false, false],
        ["showRightAxisHeading", true, false, false],
        ["showGridlines", false, true, true],
        ["showHoverDateLine", false, true, true],
        ["hoverDateLineFullHeight", false, true, true],
        ["showHoverValues", false, true, true],
        ["showHoverChange", false, true, true],
        ["enableCrossFiltering", false, true, true],
        ["periodSlider", null, "month", "month"],
        ["multiChartPeriod", null, "quarter", "quarter"],
        ["multiChartMaxCount", null, 0, 0],
        ["multiChartShowDateRange", true, false, false],
        ["multiChartSlider", false, true, true],
        ["multiChartKeepEmptyPeriods", true, false, false],
        ["showIncompleteLastPeriod", Ren.ShowIncompleteLastPeriodEnum.Always, "Never",
            Ren.ShowIncompleteLastPeriodEnum.Never],
        ["seasonallyAdjustEstimate", true, false, false],
        ["showAsShareOfTotal", false, true, true],
        ["showAsIndex", false, true, true],
        ["showAsChange", false, true, true],
        ["showAsYearOnYearChange", false, true, true],
        ["showPerDay", false, true, true],
        ["valueLines", [], [{ value: 5 }], [{ value: 5 }]],
        ["valueBands", [], [{ from: 1, to: 2 }], [{ from: 1, to: 2 }]],
        ["valueLabelFontSize", undefined, "14", 14],
        ["axisLabelFontSize", undefined, 11, 11],
        ["seriesNamesInBarsFontSize", undefined, 10, 10],
        ["lineNamesFontSize", undefined, 12, 12],
        ["pieLabelFontSize", undefined, 13, 13],
        ["markerLines", null, [{ column: "Due" }], [{ column: "Due" }]]
    ];

    APPLIED_SETTINGS.forEach(([name, unsetValue, value, appliedValue]) => {

        test(`applySettings_${name}Unset_Default`, () => {

            expect(apply({})[name]).toEqual(unsetValue);
        });

        test(`applySettings_${name}Set_Applied`, () => {

            expect(apply({ [name]: value })[name]).toEqual(appliedValue);
        });
    });

    test("applySettings_ShowLegendNull_Null", () => {

        expect(apply({ showLegend: null }).showLegend).toBeNull();
    });

    test("applySettings_FalseFlagsGivenTruthyNonBoolean_Off", () => {

        const props = apply({ showGridlines: "yes", showAsIndex: 1 });

        expect(props.showGridlines).toBe(false);
        expect(props.showAsIndex).toBe(false);
    });

    test("applySettings_TrueFlagsGivenFalsyNonBoolean_On", () => {

        const props = apply({ showLeftAxis: 0, pieHoleTotals: null });

        expect(props.showLeftAxis).toBe(true);
        expect(props.pieHoleTotals).toBe(true);
    });

    test("applySettings_ValueLinesNotArray_Empty", () => {

        expect(apply({ valueLines: "x" }).valueLines).toEqual([]);
    });

    test("applySettings_NoBarNarrowingRatio_LeftUnset", () => {

        const props = { barNarrowingRatio: 0.3 };

        Settings.applySettings(props, {});

        expect(props.barNarrowingRatio).toBe(0.3);
    });

    test("applySettings_BarNarrowingRatio_RoundedOnPropsAndVisualisation", () => {

        const visualisation = { barNarrowingRatio: 0.123456 };

        expect(apply(visualisation).barNarrowingRatio).toBe(0.12);
        expect(visualisation.barNarrowingRatio).toBe(0.1235);
    });

    test("applySettings_PeriodGapNotPositive_None", () => {

        expect(apply({ periodGap: -4 }).periodGap).toBe(0);
    });

    test("applySettings_SubdivisionLimitNotPositive_Null", () => {

        expect(apply({ subdivisionLimit: 0 }).subdivisionLimit).toBeNull();
    });

    test("applySettings_LineLayoutAsValue_Kept", () => {

        expect(apply({ lineLayout: Ren.LineLayoutEnum.Stacked }).lineLayout)
            .toBe(Ren.LineLayoutEnum.Stacked);
    });

    const findPersistedProperty = (name) => DateValueChart.persistedProperties.find(
        persistedProperty => (persistedProperty.name ?? persistedProperty) === name
    );

    // Set by the chart's menus and saved settings, but not from <ren-date-value-chart> attributes,
    // where barLayout would be read as its enum key name rather than its value.
    const NOT_ATTRIBUTES = ["barLayout", "showLegend", "showValueLabelsWhenHighlighted"];

    Settings.SETTINGS.forEach(setting => {

        test(`SETTINGS_${setting.name}_DeclaredAsAvailableOption`, () => {

            expect(NOT_ATTRIBUTES.includes(setting.name)
                || DateValueChart.availableOptions[setting.name] !== undefined).toBe(true);
        });

        test(`SETTINGS_${setting.name}_PersistedAsSaved`, () => {

            const property = findPersistedProperty(setting.name);

            switch (setting.saved) {

                case Settings.Saved.never:
                    expect(property).toBeUndefined();
                    break;

                case Settings.Saved.always:
                    expect(property).toBe(setting.name);
                    break;

                default: // Saved through a transform, derived or its own.
                    expect(typeof property?.transform).toBe("function");
            }
        });
    });

    test("getDefaultValue_NotASetting_Undefined", () => {

        expect(Settings.getDefaultValue("dateHeading")).toBeUndefined();
    });

    test("withSavedTransforms_OtherProperties_Unchanged", () => {

        const transform = () => 1;
        const ownTransform = { name: "chartTitle", transform };

        const properties =
            Settings.withSavedTransforms(["dateHeading", ownTransform, "showLegend"]);

        expect(properties[0]).toBe("dateHeading");
        expect(properties[1]).toBe(ownTransform);
        expect(properties[2]).toBe("showLegend");
    });

    // As addPersistedProperties saves a visualisation's property: undefined is left out.
    const save = (name, value) => {

        const property = findPersistedProperty(name);

        if (!property) return "not persisted";

        return property.transform ? property.transform(value, {}) : value;
    };

    // Each setting as [name, value, what is saved for it].
    const SAVED_SETTINGS = [
        ["shadeLines", false, false],
        ["shadeLines", true, true],
        ["lineShadingOpacity", 0.4, 0.4],
        ["subdivideColumn", "Shape", "Shape"],
        ["subdivideColumn", "", undefined],
        ["subdivideColumn", null, undefined],
        ["subdivisionLabels", "names", undefined],
        ["subdivisionLabels", "values", "values"],
        ["subdivisionLabelPlacement", "inside", undefined],
        ["subdivisionLabelPlacement", "around", "around"],
        ["pieLabels", "outside", undefined],
        ["pieLabels", "inside", "inside"],
        ["pieLabelNames", true, undefined],
        ["pieLabelNames", false, false],
        ["pieLabelValues", false, undefined],
        ["pieLabelValues", true, true],
        ["pieValuePosition", "inline", undefined],
        ["pieValuePosition", "below", "below"],
        ["pieLabelPercentages", true, undefined],
        ["pieLabelPercentages", false, false],
        ["pieSharesInside", true, undefined],
        ["pieSharesInside", false, false],
        ["pieHoleTotals", true, undefined],
        ["pieHoleTotals", false, false],
        ["pieHoleRadius", 0, undefined],
        ["pieHoleRadius", 0.5, 0.5],
        ["pieLabelFontSize", 13, 13],
        ["showLegend", true, true],
        ["showLegend", false, false],
        ["chartTitle", "", undefined],
        ["chartTitle", "Widgets", "Widgets"],
        ["chartSubtitle", "", undefined],
        ["chartSubtitle", "By week", "By week"],
        ["showValueLabelsWhenHighlighted", false, false],
        ["valueLabelFontSize", 14, 14],
        ["axisLabelFontSize", 11, 11],
        ["seriesNamesInBarsFontSize", 10, 10],
        ["barValueLabelLayout", "auto", undefined],
        ["barValueLabelLayout", "above", "above"],
        ["lineNamesFontSize", 12, 12],
        ["lineNames", "auto", undefined],
        ["lineNames", "ends", "ends"],
        ["showLeftAxis", true, true],
        ["showRightAxis", false, false],
        ["showDateAxis", true, true],
        ["showLeftAxisHeading", true, true],
        ["showRightAxisHeading", false, false],
        ["showGridlines", false, false],
        ["showHoverDateLine", false, false],
        ["hoverDateLineFullHeight", true, true],
        ["showHoverValues", false, false],
        ["showHoverChange", true, true],
        ["enableCrossFiltering", false, false],
        ["showAsShareOfTotal", false, undefined],
        ["showAsShareOfTotal", true, true],
        ["showAsIndex", false, undefined],
        ["showAsIndex", true, true],
        ["showAsChange", false, undefined],
        ["showAsChange", true, true],
        ["showAsYearOnYearChange", false, undefined],
        ["showAsYearOnYearChange", true, true],
        ["showPerDay", false, undefined],
        ["showPerDay", true, true],
        ["valueLines", [], undefined],
        ["valueBands", [], undefined],
        ["seasonallyAdjustEstimate", true, undefined],
        ["seasonallyAdjustEstimate", false, false],
        ["periodSlider", "month", "month"],
        ["multiChartPeriod", "year", "year"],
        ["multiChartMaxCount", 3, 3],
        ["multiChartShowDateRange", true, undefined],
        ["multiChartShowDateRange", false, false],
        ["multiChartSlider", false, undefined],
        ["multiChartSlider", true, true],
        ["multiChartKeepEmptyPeriods", true, undefined],
        ["multiChartKeepEmptyPeriods", false, false],
        ["subdivisionLabels", "", undefined],
        ["chartTitle", null, undefined],
        ["pieLabelNames", "no", undefined],
        ["markerLines", [{ column: "Due" }], "not persisted"]
    ];

    SAVED_SETTINGS.forEach(([name, value, savedValue]) => {

        const testName = `persistedProperties_${name}Is${JSON.stringify(value)}` +
            `_Saved${JSON.stringify(savedValue)}`;

        test(testName, () => {

            expect(save(name, value)).toEqual(savedValue);
        });
    });
});
