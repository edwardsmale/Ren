describe("Ren.DateValueChart_ValueLines", () => {

    const ValueLines = Ren.DateValueChart_ValueLines;

    test("getLines_LineWithoutNumber_LeftOut", () => {

        const props = { valueLines: [{ value: 5 }, { value: "x" }, null, {}] };

        expect(ValueLines.getLines(props)).toEqual([{ value: 5 }]);
    });

    test("getLines_NoSetting_Empty", () => {

        expect(ValueLines.getLines({})).toEqual([]);
    });

    test("extendAxisMaxes_LinesAboveData_AxesRaisedToLines", () => {

        const props = { valueLines: [{ value: 50 }, { value: 7, axis: "rightAxis" }] };
        const axisMaxes = { leftAxis: 20, rightAxis: 10, hiddenAxis: 0 };

        ValueLines.extendAxisMaxes(props, axisMaxes);

        expect(axisMaxes).toEqual({ leftAxis: 50, rightAxis: 10, hiddenAxis: 0 });
    });

    test("getLabel_OwnLabel_LabelShown", () => {

        expect(ValueLines.getLabel({ value: 5, label: "Target" }, () => "£5")).toBe("Target");
    });

    test("getLabel_NoLabel_FormattedValue", () => {

        expect(ValueLines.getLabel({ value: 5 }, value => `£${value}.00`)).toBe("£5.00");
    });

    test("parseValue_ThousandsSeparatorsAndCurrency_Ignored", () => {

        expect(ValueLines.parseValue(" £1,250.5 ")).toBe(1250.5);
    });

    test("parseValue_Percentage_ReadAsFraction", () => {

        expect(ValueLines.parseValue("50%")).toBe(0.5);
    });

    test("parseValue_Negative_Negative", () => {

        expect(ValueLines.parseValue("-3")).toBe(-3);
    });

    const getPersistedTransform = () => Ren.VisualisationTypes_DateValueChart.persistedProperties
        .find(property => property.name === "valueLines").transform;

    test("persistedProperties_Lines_Saved", () => {

        const lines = [{ value: 5, label: "Target" }];

        expect(getPersistedTransform()(lines)).toBe(lines);
    });

    test("persistedProperties_NoLines_LeftOut", () => {

        expect(getPersistedTransform()([])).toBeUndefined();
    });

    test("parseValue_NoNumber_Null", () => {

        expect(ValueLines.parseValue("abc")).toBeNull();
        expect(ValueLines.parseValue("")).toBeNull();
        expect(ValueLines.parseValue(null)).toBeNull();
    });

    test("getBands_EndsReversed_FromIsLowerEnd", () => {

        const props = { valueBands: [{ from: 80, to: 20, label: "Target" }] };

        expect(ValueLines.getBands(props)).toEqual([{ from: 20, to: 80, label: "Target" }]);
    });

    test("getBands_EndWithoutNumber_LeftOut", () => {

        const props = { valueBands: [{ from: 5 }, { from: 1, to: "x" }, null, { from: 1, to: 2 }] };

        expect(ValueLines.getBands(props)).toEqual([{ from: 1, to: 2 }]);
        expect(ValueLines.getBands({})).toEqual([]);
    });

    test("extendAxisMaxes_BandAboveData_AxisRaisedToTopEnd", () => {

        const props = { valueBands: [{ from: 30, to: 60 }, { from: 1, to: 4, axis: "rightAxis" }] };
        const axisMaxes = { leftAxis: 20, rightAxis: 10, hiddenAxis: 0 };

        ValueLines.extendAxisMaxes(props, axisMaxes);

        expect(axisMaxes).toEqual({ leftAxis: 60, rightAxis: 10, hiddenAxis: 0 });
    });

    test("extendAxisMins_BandBelowData_AxisLoweredToBottomEnd", () => {

        const props = { valueBands: [{ from: -10, to: 5 }] };
        const axisMins = { leftAxis: 0 };

        ValueLines.extendAxisMins(props, axisMins);

        expect(axisMins.leftAxis).toBe(-10);
    });

    test("persistedProperties_Bands_SavedOnlyWhenAny", () => {

        const transform = Ren.VisualisationTypes_DateValueChart.persistedProperties
            .find(property => property.name === "valueBands").transform;
        const bands = [{ from: 1, to: 2 }];

        expect(transform(bands)).toBe(bands);
        expect(transform([])).toBeUndefined();
    });
});
