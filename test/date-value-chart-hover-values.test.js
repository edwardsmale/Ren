describe("Ren.DateValueChart_HoverValues", () => {

    const HoverValues = Ren.DateValueChart_HoverValues;

    const props = { valueHeadings: ["Sales"] };

    test("getChange_Rise_FractionOfPrevious", () => {

        expect(HoverValues.getChange(props, 0, { Sales: 150 }, { Sales: 100 })).toBe(0.5);
    });

    test("getChange_FromNegative_SignFollowsDirection", () => {

        expect(HoverValues.getChange(props, 0, { Sales: -50 }, { Sales: -100 })).toBe(0.5);
    });

    test("getChange_MissingOrZeroBefore_Null", () => {

        expect(HoverValues.getChange(props, 0, { Sales: 150 }, null)).toBeNull();
        expect(HoverValues.getChange(props, 0, { Sales: 150 }, { Sales: 0 })).toBeNull();
        expect(HoverValues.getChange(props, 0, { Sales: null }, { Sales: 100 })).toBeNull();
    });

    test("formatChange_UnderTenPercent_OneDecimalPlace", () => {

        expect(HoverValues.formatChange(0.0512)).toBe("+5.1%");
        expect(HoverValues.formatChange(-0.0512)).toBe("−5.1%");
    });

    test("formatChange_TenPercentOrMore_WholePercent", () => {

        expect(HoverValues.formatChange(0.256)).toBe("+26%");
        expect(HoverValues.formatChange(-2)).toBe("−200%");
    });

    test("formatChange_RoundsToNothing_ZeroUnsigned", () => {

        expect(HoverValues.formatChange(0.0001)).toBe("0%");
        expect(HoverValues.formatChange(-0.0004)).toBe("0%");
    });
});
