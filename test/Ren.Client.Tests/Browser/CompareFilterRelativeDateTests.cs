namespace Ren.Client.Tests.Browser;

// These tests cover the compare filter's relative date operators ("is this week", "month to date",
// "last N calendar months", ...), whose windows are reckoned from today.  Each test fixes today as
// Wednesday 13 March 2024, which the fixture's dates are laid out around.
[TestClass]
public class CompareFilterRelativeDateTests : BrowserTest
{
    private const string Fixture = "ported/CompareFilterTest12.html";

    private const string AllIds = "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16";

    private async Task OpenRelativeDateFilterAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.SetTodayAsync(Ren, 2024, 3, 13);
        await Filters.OpenColumnFilterAsync(Ren, "Ordered On");
    }

    private Task ExpectDistinctIdsAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe(csv);

    // The last four working days are Wednesday, Tuesday and Monday, then back over the weekend to
    // Friday 8 March, so the Sunday between is inside the window.
    [TestMethod]
    [DataRow("dateToday", null, "1", DisplayName = "RelativeDateFilter_IsToday_ShowsOnlyToday")]
    [DataRow("dateYesterday", null, "2", DisplayName = "RelativeDateFilter_IsYesterday_ShowsOnlyYesterday")]
    [DataRow("dateThisWeek", null, "1,2,3,13", DisplayName = "RelativeDateFilter_IsThisWeek_ShowsMondayToSundayIncludingTomorrow")]
    [DataRow("dateWeekToDate", null, "1,2,3", DisplayName = "RelativeDateFilter_WeekToDate_StopsAtToday")]
    [DataRow("datePreviousWeek", null, "4,5", DisplayName = "RelativeDateFilter_IsInThePreviousWeek_ShowsTheMondayToSundayBefore")]
    [DataRow("dateMonthToDate", null, "1,2,3,4,5,6", DisplayName = "RelativeDateFilter_MonthToDate_ShowsFromTheFirstToToday")]
    [DataRow("datePreviousMonth", null, "7,8", DisplayName = "RelativeDateFilter_IsInThePreviousMonth_ShowsTheWholeOfFebruary")]
    [DataRow("dateThisQuarter", null, "1,2,3,4,5,6,7,8,9,13", DisplayName = "RelativeDateFilter_IsThisQuarter_ShowsJanuaryToMarchIncludingTomorrow")]
    [DataRow("datePreviousQuarter", null, "10,11", DisplayName = "RelativeDateFilter_IsInThePreviousQuarter_ShowsOctoberToDecember")]
    [DataRow("dateYearToDate", null, "1,2,3,4,5,6,7,8,9", DisplayName = "RelativeDateFilter_YearToDate_LeavesOutTheRestOfTheYear")]
    [DataRow("dateThisYear", null, "1,2,3,4,5,6,7,8,9,13,14", DisplayName = "RelativeDateFilter_IsThisYear_ShowsTheWholeYear")]
    [DataRow("datePreviousYear", null, "10,11,12,15,16", DisplayName = "RelativeDateFilter_IsInThePreviousYear_ShowsTheWholeOf2023")]
    [DataRow("dateLastNDays", "3", "1,2,3", DisplayName = "RelativeDateFilter_LastThreeDays_CountsTodayAsTheFirst")]
    [DataRow("dateLastNWorkingDays", "4", "1,2,3,4", DisplayName = "RelativeDateFilter_LastFourWorkingDays_SpansTheWeekendBetween")]
    [DataRow("dateLastNMonths", "12", "1,2,3,4,5,6,7,8,9,10,11,12,15", DisplayName = "RelativeDateFilter_LastTwelveMonths_StartsTheDayAfterAYearAgo")]
    [DataRow("dateLastNCalendarMonths", "2", "7,8,9", DisplayName = "RelativeDateFilter_LastTwoCalendarMonths_LeavesOutThisMonth")]
    public async Task RelativeDateFilter(string operatorId, string? value, string expectedIds)
    {
        await OpenRelativeDateFilterAsync();

        await Filters.ApplyCompareFilterAsync(Ren, operatorId, value);

        await ExpectDistinctIdsAsync(expectedIds);
    }

    [TestMethod("RelativeDateFilter_OperatorTakingNoValuePicked_AppliesWithoutApply")]
    public async Task RelativeDateFilter_OperatorTakingNoValuePicked_AppliesWithoutApply()
    {
        await OpenRelativeDateFilterAsync();

        await Filters.SetCompareFilterOperatorAsync(Ren, "dateMonthToDate");

        await ExpectDistinctIdsAsync("1,2,3,4,5,6");
        Expect(await Filters.IsCompareFilterInEffectAsync(Ren)).ToBe(true);
    }

    [TestMethod("RelativeDateFilter_OperatorTakingAValuePicked_WaitsForApply")]
    public async Task RelativeDateFilter_OperatorTakingAValuePicked_WaitsForApply()
    {
        await OpenRelativeDateFilterAsync();

        await Filters.SetCompareFilterOperatorAsync(Ren, "dateLastNDays");
        await Ren.WaitUntilLoadedAsync();

        Expect(await Filters.IsCompareFilterInEffectAsync(Ren)).ToBe(false);
        Expect(await Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe(AllIds);
    }
}
