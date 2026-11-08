describe("Ren.DateValueChart_CalendarMarkers", () => {

    const CalendarMarkers = Ren.DateValueChart_CalendarMarkers;

    /**
     * Gets a chart's props, marked with the given periods, over a domain.
     */
    const createProps = (calendarMarkers, from, toExclusive) => ({
        visualisation: { calendarMarkers },
        xScale: Ren.ChartScales.createTimeScale([from, toExclusive], [0, 100])
    });

    const getTimes = (markers) => markers.map(marker => marker.date.getTime());

    test("getMarkers_YearChart_LeavesOffTheNextYearAtItsEnd", () => {

        const markers = CalendarMarkers.getMarkers(createProps(
            ["years"],
            new Date(Date.UTC(2025, 0, 1)),
            new Date(Date.UTC(2026, 0, 1))
        ));

        expect(getTimes(markers)).toEqual([Date.UTC(2025, 0, 1)]);
    });

    test("getMarkers_QuarterMarkersOverAYear_EveryQuarterStartingInIt", () => {

        const markers = CalendarMarkers.getMarkers(createProps(
            ["quarters"],
            new Date(Date.UTC(2025, 0, 1)),
            new Date(Date.UTC(2026, 0, 1))
        ));

        expect(getTimes(markers)).toEqual([
            Date.UTC(2025, 0, 1),
            Date.UTC(2025, 3, 1),
            Date.UTC(2025, 6, 1),
            Date.UTC(2025, 9, 1)
        ]);
    });
});
