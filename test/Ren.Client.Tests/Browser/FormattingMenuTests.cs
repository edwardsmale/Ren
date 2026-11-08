namespace Ren.Client.Tests.Browser;

// These tests cover the leaves of the Format submenu (ren-context-menu-items-formatting.js).
[TestClass]
public class FormattingMenuTests : BrowserTest
{
    // Grouped by AccountId, so row 2 is the AccountId 111 group.  In that group OrderRevenue sums to
    // 45.04 (12.49 + 32.55) and OrderCount averages to 2 ((3 + 1) / 2).
    private const string Fixture = "ported/MultiSelectContextMenuTest01.html";

    // A flat grid whose Amount column runs 950, 32,200, 999,960, 1,450,000 and 2,500,000,000 in rows
    // 2 to 6.  Formatting one data row's cell formats the whole column's data rows.
    private const string AbbreviatedFixture = "ported/FormattingMenuTest01.html";

    // A flat grid where Id and Label hold no NULLs and CurrencyValue holds two.  Rows 2 to 8 are Ids
    // 1 to 7.
    private const string NullsFixture = "ported/FormatFunctionNullTest01.html";

    private Task SetCellFormatViaShowAsAsync(string columnHeading, int rowHeading, string showAsItem, string menuOption) =>
        Ren.Report.ChooseFromCellMenuAsync(
            columnHeading, rowHeading, ".qa-ren-formatting-menu-item", "#format-show-as", showAsItem, menuOption);

    private Task ExpectCellTextAsync(string columnHeading, int rowHeading, string expected) =>
        Poll(() => Ren.Report.CellTextAsync(columnHeading, rowHeading)).ToBe(expected);

    private async Task OpenFormattingMenuAsync(string columnHeading, int rowHeading)
    {
        await Ren.Report.RightClickCellAsync(columnHeading, rowHeading);
        await Ren.Root.MouseOverAsync(".qa-ren-formatting-menu-item");
    }

    private async Task SetAndExpectAsync(string fixture, string column, string subMenu, string option, params (int Row, string Text)[] expected)
    {
        await Ren.OpenAsync(fixture);
        await Ren.Report.SetCellFormatAsync(column, 2, subMenu, option);

        foreach (var (row, text) in expected)
        {
            await ExpectCellTextAsync(column, row, text);
        }
    }

    [TestMethod]
    public Task NumberFormat_OneDecimalPlaceApplied_StripsCurrencyAndShowsOneDecimal() =>
        SetAndExpectAsync(Fixture, "OrderRevenue", "#format-as-number", "#format-as-number-1-dp", (2, "45.0"));

    [TestMethod]
    public Task NumberFormat_TwoDecimalPlacesApplied_StripsCurrencyAndShowsTwoDecimals() =>
        SetAndExpectAsync(Fixture, "OrderRevenue", "#format-as-number", "#format-as-number-2-dp", (2, "45.04"));

    [TestMethod]
    public Task CurrencyFormat_TwoDecimalPlacesApplied_ShowsCurrencyWithTwoDecimals() =>
        SetAndExpectAsync(Fixture, "OrderCount", "#format-as-currency", "#format-as-currency-2dp", (2, "£2.00"));

    [TestMethod]
    public Task NumberFormat_TwoDecimalPlacesAppliedToIntegerColumn_ShowsTwoDecimals() =>
        SetAndExpectAsync(Fixture, "OrderCount", "#format-as-number", "#format-as-number-2-dp", (2, "2.00"));

    // The "Show as" submenu holds the relative formats (percentage-of and difference-from).

    [TestMethod]
    public async Task ShowAsPercentageOfGroupTotal_NoDecimalPlaces_ShowsGroupShare()
    {
        await Ren.OpenAsync(Fixture);

        // The group summary stats span the data rows (12.49, 32.55, 12.99 and 0.79), which sum to
        // 58.82, so this group's 45.04 is 76.57%.
        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 2,
            "#format-show-as-percentage-of-group-sum",
            "#format-show-as-percentage-of-group-sum-no-dp");

        await ExpectCellTextAsync("OrderRevenue", 2, "77%");
    }

    [TestMethod]
    public async Task ShowAsPercentageOfGroupTotal_TwoDecimalPlaces_ShowsGroupShareWithDecimals()
    {
        await Ren.OpenAsync(Fixture);

        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 2,
            "#format-show-as-percentage-of-group-sum",
            "#format-show-as-percentage-of-group-sum-2-dp");

        await ExpectCellTextAsync("OrderRevenue", 2, "76.57%");
    }

    [TestMethod]
    public async Task ShowAsPercentageOfOverallTotal_NoDecimalPlaces_ShowsShareOfOverall()
    {
        await Ren.OpenAsync(Fixture);

        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 2,
            "#format-show-as-percentage-of-overall-sum",
            "#format-show-as-percentage-of-overall-sum-no-dp");

        await ExpectCellTextAsync("OrderRevenue", 2, "77%");
    }

    [TestMethod]
    public async Task ShowAsDifferenceFromGroupAverage_NoDecimalPlaces_ShowsSignedDifference()
    {
        await Ren.OpenAsync(Fixture);

        // The group average is the mean of the four data rows, 14.71, so 45.04 is +30.34 above it.
        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 2,
            "#format-show-as-difference-from-group-avg",
            "#format-show-as-difference-from-group-avg-no-dp");

        await ExpectCellTextAsync("OrderRevenue", 2, "+30");
    }

    // A data row's group stats are those of the innermost group containing it, so AccountId 222's
    // data rows, 12.99 and 0.79 in rows 4 and 5 once expanded, are stated against 12.99, while its
    // overall stats are the whole report's, whose largest row is 32.55.

    [TestMethod]
    public async Task ShowAsPercentageOfGroupMaximum_DataRows_ShowShareOfLargestRowInGroup()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(3);

        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 4,
            "#format-show-as-percentage-of-group-max",
            "#format-show-as-percentage-of-group-max-2-dp");

        await ExpectCellTextAsync("OrderRevenue", 4, "100.00%");
        await ExpectCellTextAsync("OrderRevenue", 5, "6.08%");
    }

    [TestMethod]
    public async Task ShowAsPercentageOfOverallMaximum_DataRows_ShowShareOfLargestRowOverall()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(3);

        await SetCellFormatViaShowAsAsync(
            "OrderRevenue", 4,
            "#format-show-as-percentage-of-overall-max",
            "#format-show-as-percentage-of-overall-max-2-dp");

        await ExpectCellTextAsync("OrderRevenue", 4, "39.91%");
        await ExpectCellTextAsync("OrderRevenue", 5, "2.43%");
    }

    // An ID column is numeric, and a grid has summary stats behind every cell.
    [TestMethod]
    public async Task ShowAsSubmenu_IdFormatColumn_IsOffered()
    {
        await Ren.OpenAsync(NullsFixture);

        await OpenFormattingMenuAsync("Id", 2);

        await Expect(Ren.Root.Locator("#format-show-as")).Not.ToHaveCountAsync(0);
    }

    [TestMethod]
    public async Task FormatMenu_NumberColumn_DoesNotOfferBinning()
    {
        await Ren.OpenAsync(Fixture);

        await OpenFormattingMenuAsync("OrderRevenue", 2);

        await Expect(Ren.Root.Locator("#format-as-default")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#group-by-column-binning-0-1-10-100-format")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#group-by-column-binning-zero-or-not-format")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#group-by-column-binning-custom-format")).ToHaveCountAsync(0);
    }

    // The Percentage submenu holds the "divided by 100" leaves.

    [TestMethod]
    public Task PercentageFormat_DividedBy100NoDecimalPlaces_ShowsValueAsPercentage() =>
        SetAndExpectAsync(Fixture, "OrderRevenue", "#format-as-percentage", "#format-as-percentage-div-100-no-dp", (2, "45%"));

    [TestMethod]
    public Task PercentageFormat_DividedBy100TwoDecimalPlaces_ShowsValueWithDecimals() =>
        SetAndExpectAsync(Fixture, "OrderRevenue", "#format-as-percentage", "#format-as-percentage-div-100-2-dp", (2, "45.04%"));

    // The abbreviated formats state a figure in the largest unit it reaches.

    [TestMethod]
    public Task CurrencyAbbreviatedNoDp_Applied_StatesEachFigureInItsLargestUnit() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-currency", "#format-as-currency-abbreviated-no-dp",
            (3, "£32k"), (5, "£1m"), (6, "£3bn"));

    [TestMethod]
    public Task CurrencyAbbreviatedOneDp_Applied_StatesEachFigureToOneDecimalPlace() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-currency", "#format-as-currency-abbreviated-1-dp",
            (3, "£32.2k"), (5, "£1.5m"), (6, "£2.5bn"));

    [TestMethod]
    public Task NumberAbbreviatedNoDp_Applied_StatesTheFigureWithoutACurrencySymbol() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-number", "#format-as-number-abbreviated-no-dp",
            (3, "32k"), (5, "1m"), (6, "3bn"));

    [TestMethod]
    public Task NumberAbbreviatedOneDp_Applied_StatesTheFigureToOneDecimalPlace() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-number", "#format-as-number-abbreviated-1-dp",
            (3, "32.2k"), (5, "1.5m"), (6, "2.5bn"));

    // 999,960 steps up to 1.0m, whose trailing ".0" is dropped.
    [TestMethod]
    public Task CurrencyAbbreviatedAutoDp_Applied_KeepsADecimalPlaceOnlyBelowTenOfTheUnit() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-currency", "#format-as-currency-abbreviated-auto-dp",
            (2, "£950"), (3, "£32k"), (4, "£1m"), (5, "£1.5m"), (6, "£2.5bn"));

    [TestMethod]
    public Task NumberAbbreviatedAutoDp_Applied_KeepsADecimalPlaceOnlyBelowTenOfTheUnit() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-number", "#format-as-number-abbreviated-auto-dp",
            (3, "32k"), (4, "1m"), (5, "1.5m"));

    // 950 doesn't reach a thousand, so it isn't rounded up into a unit it never reached.
    [TestMethod]
    public Task NumberAbbreviated_FigureTooSmallToAbbreviate_ShowsItAsItIs() =>
        SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-number", "#format-as-number-abbreviated-no-dp",
            (2, "950"));

    // 999,960 in thousands rounds to 1,000, which would read as "1000k", so the unit steps up.
    [TestMethod]
    public async Task NumberAbbreviated_FigureRoundsUpToAThousandOfItsUnit_StepsUpToTheNextUnit()
    {
        await SetAndExpectAsync(AbbreviatedFixture, "Amount", "#format-as-number", "#format-as-number-abbreviated-no-dp",
            (4, "1m"));

        await Ren.Report.SetCellFormatAsync("Amount", 2, "#format-as-number", "#format-as-number-abbreviated-1-dp");

        await ExpectCellTextAsync("Amount", 4, "1.0m");
    }

    // The formats that only restate a NULL are offered only where the column has a NULL in it.

    [TestMethod]
    public async Task ShowNullAs_ColumnHoldsNulls_IsOffered()
    {
        await Ren.OpenAsync(NullsFixture);

        await OpenFormattingMenuAsync("CurrencyValue", 2);

        await Expect(Ren.Root.Locator("#format-show-null-as")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#format-null-values")).Not.ToHaveCountAsync(0);
    }

    [TestMethod]
    public async Task ShowNullAs_ColumnHoldsNoNulls_IsNotOffered()
    {
        await Ren.OpenAsync(NullsFixture);

        await OpenFormattingMenuAsync("Id", 2);

        // The rest of the menu is there, so the items are missing rather than the menu.
        await Expect(Ren.Root.Locator("#format-as-default")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#format-show-null-as")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#format-null-values")).ToHaveCountAsync(0);
    }
}
