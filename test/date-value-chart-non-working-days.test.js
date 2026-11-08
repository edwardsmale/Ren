describe("Ren.DateValueChart_NonWorkingDays", () => {

    const NonWorkingDays = Ren.DateValueChart_NonWorkingDays;

    const utc = (y, m, d, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

    const describeSpans = spans => spans.map(span =>
        span.start.toISOString() + " " + span.end.toISOString());

    test("getSpans_Fortnight_WeekendsAsSingleStretches", () => {

        // Monday 3 March 2025 to Monday 17 March.
        const spans = NonWorkingDays.getSpans([utc(2025, 3, 3), utc(2025, 3, 17)]);

        expect(describeSpans(spans)).toEqual([
            "2025-03-08T00:00:00.000Z 2025-03-10T00:00:00.000Z",
            "2025-03-15T00:00:00.000Z 2025-03-17T00:00:00.000Z"
        ]);
    });

    test("getSpans_DomainStartsMidWeekend_CutToDomain", () => {

        const spans = NonWorkingDays.getSpans([utc(2025, 3, 9, 12), utc(2025, 3, 11)]);

        expect(describeSpans(spans)).toEqual([
            "2025-03-09T12:00:00.000Z 2025-03-10T00:00:00.000Z"
        ]);
    });

    test("getSpans_TooManyDays_Nothing", () => {

        expect(NonWorkingDays.getSpans([utc(2020, 1, 1), utc(2025, 1, 1)])).toEqual([]);
    });

    test("isAvailable_ByWeekOrAllTime_False", () => {

        expect(NonWorkingDays.isAvailable({ datePeriod: Ren.DatePeriodEnum.Day })).toBe(true);
        expect(NonWorkingDays.isAvailable({ datePeriod: Ren.DatePeriodEnum.Hour })).toBe(true);
        expect(NonWorkingDays.isAvailable({ datePeriod: Ren.DatePeriodEnum.Week })).toBe(false);
        expect(NonWorkingDays.isAvailable({ datePeriod: Ren.DatePeriodEnum.Day, isAllTime: true }))
            .toBe(false);
    });

    test("isShown_SetOnVisualisation_True", () => {

        const props = {
            datePeriod: Ren.DatePeriodEnum.Day,
            visualisation: { shadeNonWorkingDays: true }
        };

        expect(NonWorkingDays.isShown(props)).toBe(true);
        expect(NonWorkingDays.isShown({ datePeriod: Ren.DatePeriodEnum.Day, visualisation: {} }))
            .toBe(false);
    });

    test("persistedProperties_ShadeNonWorkingDays_SavedOnlyWhenSet", () => {

        const transform = Ren.VisualisationTypes_DateValueChart.persistedProperties
            .find(property => property.name === "shadeNonWorkingDays").transform;

        expect(transform(true)).toBe(true);
        expect(transform(false)).toBeUndefined();
    });
});
