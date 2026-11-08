using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover narrowing a date/value chart to a range of its dates: from its Date range
// menu, on the calendar its Custom... item opens, by dragging across the plot, and by following
// another chart in its date range group.  The chart has a bar a day from 2024-01-01 to 2024-01-10,
// which no menu option narrows, as they count from today or are whole months, quarters and years.
[TestClass]
public class DateValueChartDateRangeTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest05.html";

    // Two charts in the same date range group.
    private const string TwoChartsFixture = "ported/DateValueChartTest09.html";

    // Saved with a range of 2024-01-03 to 2024-01-06, which, having no defaultDateRange, it takes
    // as its default.
    private const string SavedRangeFixture = "ported/DateValueChartTest13.html";

    // Saved with the same range, but with a defaultDateRange of null, so its default is every date.
    private const string NullDefaultRangeFixture = "ported/DateValueChartTest14.html";

    private const string FirstChart = ".js-first-chart";
    private const string SecondChart = ".js-second-chart";

    private static readonly string[] AllDates =
    {
        "2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05",
        "2024-01-06", "2024-01-07", "2024-01-08", "2024-01-09", "2024-01-10"
    };

    private static readonly string[] SavedRangeDates = { "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06" };

    private static readonly string[] ThirdToFifth = { "2024-01-03", "2024-01-04", "2024-01-05" };

    private static readonly string[] NinthAndTenth = { "2024-01-09", "2024-01-10" };

    private Task ExpectDatesAsync(params string[] dates) => Poll(() => DateValueChart.DatesWithValuesAsync(Ren)).ToEqual(dates);

    private Task ExpectBarCountAsync(string chartScope, int count) =>
        Expect(Ren.Root.Locator(chartScope + " .ren-bar.ren-vertical")).ToHaveCountAsync(count);

    private Task ExpectResetShownAsync(bool shown) =>
        Expect(Ren.Root.Locator(".ren-date-range-reset")).ToHaveCountAsync(shown ? 1 : 0);

    [TestMethod("the Date range menu: a month names the month on the Date range item")]
    public async Task AMonthNamesTheMonthOnTheDateRangeItem()
    {
        await Ren.OpenAsync(Fixture);

        // The month covers every date the chart has, so it's the naming that shows it was taken.
        await DateValueChart.SelectDateRangeMonthAsync(Ren, 2024, "Jan");

        await ExpectDatesAsync(AllDates);
        Expect(await DateValueChart.DateRangeMenuItemTextAsync(Ren)).ToMatch(new Regex(@"^Date range \(Jan 2024\)"));
    }

    [TestMethod("the Date range menu: all dates after a custom range restores every date")]
    public async Task AllDatesAfterACustomRangeRestoresEveryDate()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05");
        await ExpectDatesAsync(ThirdToFifth);

        await DateValueChart.SelectDateRangeAsync(Ren, "chart-date-range-all");

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("a custom range: the first and last days picked show the dates between")]
    public async Task TheFirstAndLastDaysPickedShowTheDatesBetween()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05");

        await ExpectDatesAsync(ThirdToFifth);
    }

    [TestMethod("a custom range: reset restores every date")]
    public async Task ACustomRangeResetRestoresEveryDate()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05");
        await ExpectDatesAsync(ThirdToFifth);

        await DateValueChart.ClickResetZoomAsync(Ren);

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("a custom range: with no zoom to undo only reset is shown")]
    public async Task WithNoZoomToUndoOnlyResetIsShown()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05");

        await ExpectResetShownAsync(true);
        await Expect(Ren.Root.Locator(".ren-date-range-undo")).ToHaveCountAsync(0);
    }

    [TestMethod("dragging across the plot: from the ninth bar shows the dates dragged over")]
    public async Task FromTheNinthBarShowsTheDatesDraggedOver()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.DragFromBarAsync(Ren, 9);

        await ExpectDatesAsync(NinthAndTenth);
        await ExpectResetShownAsync(true);
    }

    [TestMethod("dragging across the plot: reset restores every date")]
    public async Task DraggingResetRestoresEveryDate()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.DragFromBarAsync(Ren, 9);
        await ExpectDatesAsync(NinthAndTenth);

        await DateValueChart.ClickResetZoomAsync(Ren);

        await ExpectDatesAsync(AllDates);
        await ExpectResetShownAsync(false);
    }

    [TestMethod("dragging across the plot: undo undoes each of two drags in turn")]
    public async Task UndoUndoesEachOfTwoDragsInTurn()
    {
        var fromTheFifth = new[] { "2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08", "2024-01-09", "2024-01-10" };

        await Ren.OpenAsync(Fixture);

        await DateValueChart.DragFromBarAsync(Ren, 5);
        await ExpectDatesAsync(fromTheFifth);

        await DateValueChart.DragFromBarAsync(Ren, 5);
        await ExpectDatesAsync(NinthAndTenth);

        await DateValueChart.ClickUndoZoomAsync(Ren);
        await ExpectDatesAsync(fromTheFifth);

        await DateValueChart.ClickUndoZoomAsync(Ren);
        await ExpectDatesAsync(AllDates);
        await Expect(Ren.Root.Locator(".ren-date-range-undo")).ToHaveCountAsync(0);
    }

    [TestMethod("dragging across the plot: double-clicking the plot restores every date")]
    public async Task DoubleClickingThePlotRestoresEveryDate()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.DragFromBarAsync(Ren, 9);
        await ExpectDatesAsync(NinthAndTenth);

        await DateValueChart.DoubleClickPlotAsync(Ren);

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("charts in a date range group: a custom range on one is followed by the other")]
    public async Task ACustomRangeOnOneIsFollowedByTheOther()
    {
        await Ren.OpenAsync(TwoChartsFixture);
        await ExpectBarCountAsync(SecondChart, 10);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05", FirstChart);

        await ExpectBarCountAsync(FirstChart, 3);
        await ExpectBarCountAsync(SecondChart, 3);
    }

    [TestMethod("charts in a date range group: a drag on one is followed by the other, both ways")]
    public async Task ADragOnOneIsFollowedByTheOtherBothWays()
    {
        await Ren.OpenAsync(TwoChartsFixture);

        await DateValueChart.DragFromBarAsync(Ren, 9, FirstChart);

        await ExpectBarCountAsync(FirstChart, 2);
        await ExpectBarCountAsync(SecondChart, 2);

        // Resetting the follower puts the chart it followed back too.
        await DateValueChart.ClickResetZoomAsync(Ren, SecondChart);

        await ExpectBarCountAsync(FirstChart, 10);
        await ExpectBarCountAsync(SecondChart, 10);
    }

    [TestMethod("holding Alt over the plot shows crosshairs until it's released")]
    public async Task HoldingAltOverThePlotShowsCrosshairsUntilItsReleased()
    {
        await Ren.OpenAsync(Fixture);

        await DateValueChart.MouseOverPlotAsync(Ren);

        Expect(await DateValueChart.IsCrosshairsShownAsync(Ren)).ToBe(false);

        await Page.Keyboard.DownAsync("Alt");

        try
        {
            await Poll(() => DateValueChart.IsCrosshairsShownAsync(Ren)).ToBe(true);
        }
        finally
        {
            await Page.Keyboard.UpAsync("Alt");
        }

        await Poll(() => DateValueChart.IsCrosshairsShownAsync(Ren)).ToBe(false);
    }

    [TestMethod("a saved range: is shown without a reset")]
    public async Task ASavedRangeIsShownWithoutAReset()
    {
        await Ren.OpenAsync(SavedRangeFixture);

        await ExpectDatesAsync(SavedRangeDates);
        await ExpectResetShownAsync(false);
    }

    [TestMethod("a saved range: is restored by reset after a drag within it")]
    public async Task ASavedRangeIsRestoredByResetAfterADragWithinIt()
    {
        await Ren.OpenAsync(SavedRangeFixture);

        // The second bar, 2024-01-04, is the shortest, so there's room to press above its label.
        await DateValueChart.DragFromBarAsync(Ren, 2);
        await ExpectDatesAsync("2024-01-04", "2024-01-05", "2024-01-06");

        await DateValueChart.ClickResetZoomAsync(Ren);

        await ExpectDatesAsync(SavedRangeDates);
        await ExpectResetShownAsync(false);
    }

    [TestMethod("a saved range: is restored by reset after all dates")]
    public async Task ASavedRangeIsRestoredByResetAfterAllDates()
    {
        await Ren.OpenAsync(SavedRangeFixture);

        await DateValueChart.SelectDateRangeAsync(Ren, "chart-date-range-all");

        await ExpectDatesAsync(AllDates);
        await ExpectResetShownAsync(true);

        await DateValueChart.ClickResetZoomAsync(Ren);

        await ExpectDatesAsync(SavedRangeDates);
    }

    [TestMethod("a saved range: is restored by double-clicking the plot after a custom range")]
    public async Task ASavedRangeIsRestoredByDoubleClickingThePlotAfterACustomRange()
    {
        await Ren.OpenAsync(SavedRangeFixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-08", "2024-01-10");
        await ExpectDatesAsync("2024-01-08", "2024-01-09", "2024-01-10");

        // The calendar stays open where the chart was right-clicked, over the plot.
        await Calendar.CloseShowingAsync(Ren);

        await DateValueChart.DoubleClickPlotAsync(Ren);

        await ExpectDatesAsync(SavedRangeDates);
    }

    [TestMethod("a saved range: with a default of every date shows a reset on loading")]
    public async Task WithADefaultOfEveryDateShowsAResetOnLoading()
    {
        await Ren.OpenAsync(NullDefaultRangeFixture);

        await ExpectDatesAsync(SavedRangeDates);
        await ExpectResetShownAsync(true);
    }

    [TestMethod("a saved range: with a default of every date is reset to every date")]
    public async Task WithADefaultOfEveryDateIsResetToEveryDate()
    {
        await Ren.OpenAsync(NullDefaultRangeFixture);

        await DateValueChart.ClickResetZoomAsync(Ren);

        await ExpectDatesAsync(AllDates);
        await ExpectResetShownAsync(false);
    }
}
