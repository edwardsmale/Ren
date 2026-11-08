// The rules weigh Christmas week at a tenth of a day and Christmas Eve at half, with Christmas
// Day a bank holiday.
const CHRISTMAS_CLOSURE = {
    name: "Christmas closure",
    weight: 0.1,
    when: {
        dayRanges: [
            { month: 12, fromDay: 25, toDay: 31 },
            { month: 1, fromDay: 1, toDay: 1 }
        ]
    }
};

beforeAll(() => {

    Ren.configure({
        workingDays: {
            nonWorkingDays: ["2026-12-25"],
            workingDayWeights: [
                CHRISTMAS_CLOSURE,
                {
                    name: "Christmas Eve",
                    weight: 0.5,
                    when: { dayRanges: [{ month: 12, fromDay: 24, toDay: 24 }] }
                },
                {
                    name: "Christmas run-up",
                    weight: 0.85,
                    when: { dayRanges: [{ month: 12, fromDay: 18, toDay: 23 }] }
                },
                {
                    name: "Back after New Year",
                    weight: 0.8,
                    when: { firstWorkingDaysOfYear: 2 }
                },
                {
                    name: "Easter school holidays",
                    weight: 0.9,
                    when: { easterHolidays: { daysBefore: 6, daysAfter: 5 } }
                },
                {
                    name: "Summer school holidays",
                    weight: 0.9,
                    when: {
                        dayRanges: [
                            { month: 7, fromDay: 22, toDay: 31 },
                            { month: 8, fromDay: 1, toDay: 31 }
                        ]
                    }
                }
            ],
            nonWorkingDayWeights: [
                CHRISTMAS_CLOSURE,
                { name: "Saturdays", listedAs: "Weekends", weight: 0.15, when: { daysOfWeek: [6] } },
                { name: "Sundays", listedAs: "Weekends", weight: 0.1, when: { daysOfWeek: [0] } },
                { name: "Bank holidays", weight: 0.1 }
            ]
        }
    });
});

const getEasterSunday = (year) => Ren.DateUtils.easterSunday(year).toISOString().substring(0, 10);

describe("WorkingDayWeights", () => {

    const WorkingDayWeights = Ren.WorkingDayWeights;

    test("EasterSunday_KnownYears_FallsOnTheKnownDate", () => {

        expect(getEasterSunday(2024)).toBe("2024-03-31");
        expect(getEasterSunday(2025)).toBe("2025-04-20");
        expect(getEasterSunday(2026)).toBe("2026-04-05");
        expect(getEasterSunday(2027)).toBe("2027-03-28");
    });

    test("EasterSunday_EarliestAndLatestPossibleDates_FallsOnTheKnownDate", () => {

        expect(getEasterSunday(2285)).toBe("2285-03-22");
        expect(getEasterSunday(2038)).toBe("2038-04-25");
    });

    test("GetDayWeight_DayNoRuleCovers_IsOne", () => {

        expect(WorkingDayWeights.getDayWeight("2026-03-10")).toBe(1);
    });

    test("GetDayWeight_DayInASeasonalRule_IsTheRulesWeight", () => {

        expect(WorkingDayWeights.getDayWeight("2026-04-08")).toBe(0.9);
        expect(WorkingDayWeights.getDayWeight("2026-07-28")).toBe(0.9);
        expect(WorkingDayWeights.getDayWeight("2026-12-21")).toBe(0.85);
        expect(WorkingDayWeights.getDayWeight("2026-12-24")).toBe(0.5);
    });

    test("GetDayWeight_Weekend_IsTheWeekendDaysWeight", () => {

        expect(WorkingDayWeights.getDayWeight("2026-03-14")).toBe(0.15);
        expect(WorkingDayWeights.getDayWeight("2026-03-15")).toBe(0.1);
    });

    // 29 December is a working day and Christmas Day a bank holiday: the closure outranks both.
    test("GetDayWeight_DayBetweenChristmasAndNewYear_IsTheClosuresWeight", () => {

        expect(WorkingDayWeights.getDayRule("2026-12-29").name).toBe("Christmas closure");
        expect(WorkingDayWeights.getDayRule("2026-12-25").name).toBe("Christmas closure");
        expect(WorkingDayWeights.getDayWeight("2026-12-29")).toBe(0.1);
        expect(WorkingDayWeights.getDayWeight("2026-12-25")).toBe(0.1);
    });

    // Mon 9 to Fri 13 March 2026, the end being exclusive as for countWorkingDays.
    test("SumWeights_RangeNoRuleCovers_IsTheWorkingDayCountWithNoRules", () => {

        const sum = WorkingDayWeights.sumWeights("2026-03-09", "2026-03-14");

        expect(sum.weight).toBe(5);
        expect(sum.ruleNames).toEqual([]);
    });

    // Mon 14 to Thu 24 December 2026: ordinary days, then the run-up either side of a weekend,
    // whose Saturday and Sunday are listed together, then Christmas Eve.
    test("SumWeights_RangeAcrossSeveralRules_NamesEachRuleOnceInOrder", () => {

        const sum = WorkingDayWeights.sumWeights("2026-12-14", "2026-12-25");

        expect(sum.ruleNames).toEqual(["Christmas run-up", "Weekends", "Christmas Eve"]);
    });
});
