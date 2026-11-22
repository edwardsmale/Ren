describe("Ren.DateValueChart_SeriesLimit", () => {

    const SeriesLimit = Ren.DateValueChart_SeriesLimit;

    const createRows = () => [
        { A: 5, B: 40, C: 10, D: 30 },
        { A: 50, B: 20, C: 15, D: 35 }
    ];

    afterEach(() => {

        document.body.innerHTML = "";
    });

    test("getLimitedHeadings_MoreSeriesThanLimit_HighestKeptInTheirOwnOrder", () => {

        const headings = SeriesLimit.getLimitedHeadings(["A", "B", "C", "D"], createRows(), 2);

        expect(headings).toEqual(["A", "B"]);
    });

    test("getLimitedHeadings_SeriesReachingTheSameHeight_FirstGivenKept", () => {

        const rows = [{ A: 10, B: 10, C: 10 }];

        expect(SeriesLimit.getLimitedHeadings(["A", "B", "C"], rows, 2)).toEqual(["A", "B"]);
    });

    test("getLimitedHeadings_NoLimitOrFewerSeries_AllKept", () => {

        const headings = ["A", "B", "C", "D"];

        expect(SeriesLimit.getLimitedHeadings(headings, createRows(), null)).toBe(headings);
        expect(SeriesLimit.getLimitedHeadings(headings, createRows(), 4)).toBe(headings);
    });

    test("getLimitedHeadings_GroupKeyGiven_HighestKeptWithinEachGroup", () => {

        const rows = [{ "Revenue A": 900, "Revenue B": 800, "Profit A": 90, "Profit B": 80 }];
        const headings = ["Revenue A", "Revenue B", "Profit A", "Profit B"];

        const limited = SeriesLimit.getLimitedHeadings(
            headings,
            rows,
            1,
            heading => heading.split(" ")[0]
        );

        expect(limited).toEqual(["Revenue A", "Profit A"]);
    });

    test("getLargestGroupSize_UnevenGroups_SizeOfTheLargest", () => {

        const headings = ["Revenue A", "Revenue B", "Revenue C", "Profit A"];

        expect(SeriesLimit.getLargestGroupSize(headings, heading => heading.split(" ")[0]))
            .toBe(3);
    });

    test("describe_LimitPerColumn_SaysSo", () => {

        expect(SeriesLimit.describe(5, 74, 37)).toBe("Showing top 5 per column of 74 series");
        expect(SeriesLimit.describe(40, 74, 37)).toBe("Showing all 74 series");
    });

    test("openEditor_LimitPerColumn_RunsUpToTheMostInAColumn", () => {

        const props = {
            visualisation: {},
            limitableSeriesCount: 60,
            limitableSeriesPerColumnCount: 30,
            hasDateColumn: true,
            redrawVisualisation: jest.fn()
        };
        const openPopup = jest
            .spyOn(Ren, "CreateNumberEditorPopupWindow")
            .mockImplementation(() => {});

        SeriesLimit.openEditor(props, { x: 0, y: 0 });

        const [, initialValue, , options] = openPopup.mock.calls[0];

        expect(initialValue).toBe(30);
        expect(options.max).toBe(30);
        expect(options.label).toBe("Top series per column (of up to 30)");

        openPopup.mockRestore();
    });

    test("getLimit_SetOrUnset_LimitOrNull", () => {

        expect(SeriesLimit.getLimit({ legendSeriesLimit: 5 })).toBe(5);
        expect(SeriesLimit.getLimit({})).toBeNull();
        expect(SeriesLimit.getLimit(undefined)).toBeNull();
    });

    test("describe_LimitOrNone_SaysWhatIsShown", () => {

        expect(SeriesLimit.describe(5, 37)).toBe("Showing top 5 of 37 series");
        expect(SeriesLimit.describe(5)).toBe("Showing top 5 series");
        expect(SeriesLimit.describe(null, 37)).toBe("Showing all 37 series");
        expect(SeriesLimit.describe(40, 37)).toBe("Showing all 37 series");
        expect(SeriesLimit.describe(null)).toBe("Showing all series");
    });

    test("render_Limited_SaysSoInAButton", () => {

        const container = document.createElement("div");

        SeriesLimit.render(
            {
                visualisation: { legendSeriesLimit: 3 },
                valueHeadings: ["A", "B", "C"],
                limitableSeriesCount: 5
            },
            container
        );

        const status = container.querySelector(".ren-date-value-chart-series-limit");

        expect(status.tagName).toBe("BUTTON");
        expect(status.querySelector(".ren-date-value-chart-column-pickers__label").textContent)
            .toBe("Show:");
        expect(status.querySelector(".ren-date-value-chart-column-pickers__value").textContent)
            .toBe("top 3 of 5");
    });

    test("render_OneSeriesAndNoLimit_NothingDrawn", () => {

        const legend = document.createElement("div");

        SeriesLimit.render({ visualisation: {}, valueHeadings: ["A"] }, legend);

        expect(legend.children).toHaveLength(0);
    });

    test("openEditor_ValuesChanged_LastOfEachBurstSavedAndTheMostShowsAll", () => {

        jest.useFakeTimers();

        const props = {
            visualisation: { legendSeriesLimit: 3 },
            limitableSeriesCount: 10,
            redrawVisualisation: jest.fn()
        };
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation((visualisation, redraw) => redraw());
        const openPopup = jest
            .spyOn(Ren, "CreateNumberEditorPopupWindow")
            .mockImplementation(() => {});

        SeriesLimit.openEditor(props, { x: 0, y: 0 });

        const [, initialValue, onChange, options] = openPopup.mock.calls[0];

        expect(initialValue).toBe(3);
        expect(options.min).toBe(1);
        expect(options.max).toBe(10);
        expect(options.closeWhenFocusLost).toBe(true);

        onChange(4);
        onChange(5);
        jest.runAllTimers();

        expect(props.visualisation.legendSeriesLimit).toBe(5);
        expect(props.redrawVisualisation).toHaveBeenCalledTimes(1);

        onChange(10);
        jest.runAllTimers();

        expect(props.visualisation.legendSeriesLimit).toBeUndefined();
        expect(props.visualisation.legendSeriesLimitChosen).toBe(true);

        openPopup.mockRestore();
        commitChange.mockRestore();
        jest.useRealTimers();
    });

    test("openEditor_MoreThan100Series_LimitedTo100", () => {

        jest.useFakeTimers();

        const props = {
            visualisation: {},
            limitableSeriesCount: 300,
            hasDateColumn: true,
            redrawVisualisation: jest.fn()
        };
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});
        const openPopup = jest
            .spyOn(Ren, "CreateNumberEditorPopupWindow")
            .mockImplementation(() => {});

        SeriesLimit.openEditor(props, { x: 0, y: 0 });

        const [, initialValue, onChange, options] = openPopup.mock.calls[0];

        expect(initialValue).toBe(100);
        expect(options.max).toBe(100);

        onChange(150);
        jest.runAllTimers();

        expect(props.visualisation.legendSeriesLimit).toBe(100);

        openPopup.mockRestore();
        commitChange.mockRestore();
        jest.useRealTimers();
    });

    test("openEditor_MoreThan100SeriesWithoutDates_UpToEverySeries", () => {

        jest.useFakeTimers();

        const props = {
            visualisation: { legendSeriesLimit: 50 },
            limitableSeriesCount: 300,
            hasDateColumn: false,
            redrawVisualisation: jest.fn()
        };
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});
        const openPopup = jest
            .spyOn(Ren, "CreateNumberEditorPopupWindow")
            .mockImplementation(() => {});

        SeriesLimit.openEditor(props, { x: 0, y: 0 });

        const [, initialValue, onChange, options] = openPopup.mock.calls[0];

        expect(initialValue).toBe(50);
        expect(options.max).toBe(300);

        onChange(150);
        jest.runAllTimers();

        expect(props.visualisation.legendSeriesLimit).toBe(150);

        openPopup.mockRestore();
        commitChange.mockRestore();
        jest.useRealTimers();
    });

    test("openEditor_MoreThan500SeriesWithoutDates_LimitedTo500", () => {

        jest.useFakeTimers();

        const props = {
            visualisation: {},
            limitableSeriesCount: 800,
            hasDateColumn: false,
            redrawVisualisation: jest.fn()
        };
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});
        const openPopup = jest
            .spyOn(Ren, "CreateNumberEditorPopupWindow")
            .mockImplementation(() => {});

        SeriesLimit.openEditor(props, { x: 0, y: 0 });

        const [, initialValue, onChange, options] = openPopup.mock.calls[0];

        expect(initialValue).toBe(500);
        expect(options.max).toBe(500);

        onChange(600);
        jest.runAllTimers();

        expect(props.visualisation.legendSeriesLimit).toBe(500);

        openPopup.mockRestore();
        commitChange.mockRestore();
        jest.useRealTimers();
    });

    test("limitSplitSeries_MoreThan24SplitValues_Top24ShownAndSaidSo", () => {

        jest.useFakeTimers();

        const visualisation = {};
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});
        const popupMessage = jest.spyOn(Ren, "PopupMessage").mockImplementation(() => {});

        SeriesLimit.limitSplitSeries(visualisation, 31, "Category", true);

        expect(visualisation.legendSeriesLimit).toBe(24);

        jest.runAllTimers();

        expect(commitChange).toHaveBeenCalledWith(visualisation);
        expect(popupMessage.mock.calls[0][0]).toBe(
            "Splitting by \"Category\" makes 31 series - only the top 24 are shown"
        );

        commitChange.mockRestore();
        popupMessage.mockRestore();
        jest.useRealTimers();
    });

    test("limitSplitSeries_LimitChosenByUser_LimitKeptWithoutSayingSo", () => {

        jest.useFakeTimers();
        const popupMessage = jest.spyOn(Ren, "PopupMessage").mockImplementation(() => {});
        const showingAll = { legendSeriesLimitChosen: true };
        const showing30 = { legendSeriesLimit: 30, legendSeriesLimitChosen: true };

        SeriesLimit.limitSplitSeries(showingAll, 31, "Category", true);
        SeriesLimit.limitSplitSeries(showing30, 31, "Category", true);
        jest.runAllTimers();

        expect(showingAll.legendSeriesLimit).toBeUndefined();
        expect(showing30.legendSeriesLimit).toBe(30);
        expect(popupMessage).not.toHaveBeenCalled();

        popupMessage.mockRestore();
        jest.useRealTimers();
    });

    test("limitSplitSeries_24OrFewerValuesOrTighterLimit_LimitUnchanged", () => {

        const unlimited = {};
        const limited = { legendSeriesLimit: 5 };

        SeriesLimit.limitSplitSeries(unlimited, 24, "Category", true);
        SeriesLimit.limitSplitSeries(limited, 31, "Category", true);

        expect(unlimited.legendSeriesLimit).toBeUndefined();
        expect(limited.legendSeriesLimit).toBe(5);
    });

    test("limitSplitSeries_MoreThan50SplitValuesWithoutDates_Top50ShownAndSaidSo", () => {

        jest.useFakeTimers();

        const visualisation = {};
        const commitChange = jest
            .spyOn(Ren.VisualisationSettingsSynchroniser, "commitChange")
            .mockImplementation(() => {});
        const popupMessage = jest.spyOn(Ren, "PopupMessage").mockImplementation(() => {});

        SeriesLimit.limitSplitSeries(visualisation, 80, "Category", false);

        expect(visualisation.legendSeriesLimit).toBe(50);

        jest.runAllTimers();

        expect(popupMessage.mock.calls[0][0]).toBe(
            "Splitting by \"Category\" makes 80 series - only the top 50 are shown"
        );

        commitChange.mockRestore();
        popupMessage.mockRestore();
        jest.useRealTimers();
    });

    test("limitSplitSeries_50OrFewerValuesWithoutDates_LimitUnchanged", () => {

        const visualisation = {};

        SeriesLimit.limitSplitSeries(visualisation, 50, "Category", false);

        expect(visualisation.legendSeriesLimit).toBeUndefined();
    });

    test("getRemovedHeadings_SeriesBeyondLimit_NotCountedAsRemoved", () => {

        const removed = Ren.DateValueChart_SeriesRemoval.getRemovedHeadings({
            allValueHeadings: ["A", "B", "C", "D"],
            valueHeadings: ["A"],
            limitedOutHeadings: ["B", "C"]
        });

        expect(removed).toEqual(["D"]);
    });
});
