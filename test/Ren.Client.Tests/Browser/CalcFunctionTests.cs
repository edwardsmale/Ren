namespace Ren.Client.Tests.Browser;

// These tests cover calc functions: on data rows and on group rows, chained one after another,
// reading other columns' values and stats, and with template parameters that refer to each other.
//
// Every fixture has the same four rows:
//   Id 1, Amount 10,   Name "Hello"
//   Id 2, Amount NULL, Name "World"
//   Id 3, Amount 20,   Name "Foo"
//   Id 4, Amount NULL, Name "Bar"
public abstract class CalcFunctionTestBase : BrowserTest
{
    protected Task ExpectColumnTextAsync(string columnHeading, params string[] expected) =>
        Poll(async () => Tsv(await Ren.Report.ColumnTextAsync(columnHeading))).ToBe(string.Join("\n", expected));
}

[TestClass]
public class DataRowCalcFunctionTests : CalcFunctionTestBase
{
    // Amount's is "return value ?? 0" and Name's "return value == null ? 0 : String(value).length".
    private const string Fixture = "ported/CalcFunctionTest01.html";

    [TestMethod("a numeric column's nulls are calculated")]
    public async Task ANumericColumnsNullsAreCalculated()
    {
        await Ren.OpenAsync(Fixture);

        await ExpectColumnTextAsync("Amount", "Amount", "10", "0", "20", "0");
    }

    [TestMethod("a string column shows its calculated lengths")]
    public async Task AStringColumnShowsItsCalculatedLengths()
    {
        await Ren.OpenAsync(Fixture);

        await ExpectColumnTextAsync("Name", "Name", "5", "5", "3", "3");
    }

    [TestMethod("the calculated values survive saving and reopening")]
    public async Task TheCalculatedValuesSurviveSavingAndReopening()
    {
        await Ren.OpenAsync(Fixture);

        var settings = await Ren.SavedSettingsAsync();

        await Ren.OpenWithSettingsAsync(Fixture, settings);

        await ExpectColumnTextAsync("Amount", "Amount", "10", "0", "20", "0");
    }

    [TestMethod("chained calc functions apply in turn")]
    public async Task ChainedCalcFunctionsApplyInTurn()
    {
        // "return value ?? 0", then "return value * 2".
        await Ren.OpenAsync("ported/CalcFunctionTest03.html");

        await ExpectColumnTextAsync("Amount", "Amount", "20", "0", "40", "0");
    }

    [TestMethod("a calc function can read other columns' values and stats")]
    public async Task ACalcFunctionCanReadOtherColumnsValuesAndStats()
    {
        // Name's is "return compressedRowVals.Id / groupSummaryStats.Id.sum", over one group whose
        // IDs sum to 10.
        await Ren.OpenAsync("ported/CalcFunctionTest04.html");

        await Poll(() => Ren.Report.CellTextAsync("Name", 2)).ToBe("0.1");
        await Poll(() => Ren.Report.CellTextAsync("Name", 5)).ToBe("0.4");
        await ExpectColumnTextAsync("Name", "Name", "0.1", "0.2", "0.3", "0.4");
    }
}

[TestClass]
public class GroupCalcFunctionTests : CalcFunctionTestBase
{
    // Grouped by ID, one group per row, with Amount's "return (parseFloat(value) || 0) + 100".
    // Group row values arrive as strings, so a null is "NULL".
    private const string Fixture = "ported/CalcFunctionTest02.html";

    [TestMethod("a group's amount is offset")]
    public async Task AGroupsAmountIsOffset()
    {
        await Ren.OpenAsync(Fixture);

        await Poll(() => Ren.Report.CellTextAsync("Amount", 2)).ToBe("110");
        await Poll(() => Ren.Report.CellTextAsync("Amount", 4)).ToBe("120");
    }

    [TestMethod("a group's null amount gives just the offset")]
    public async Task AGroupsNullAmountGivesJustTheOffset()
    {
        await Ren.OpenAsync(Fixture);

        await Poll(() => Ren.Report.CellTextAsync("Amount", 3)).ToBe("100");
        await Poll(() => Ren.Report.CellTextAsync("Amount", 5)).ToBe("100");
    }
}

[TestClass]
public class TemplateParameterCalcFunctionTests : CalcFunctionTestBase
{
    // Both columns use greater-than-or-equal-to, whose trueValue and falseValue default to
    // "≥ $compareTo" and "< $compareTo".  trueValue is declared after compareTo and is as long, so
    // its $compareTo must still be replaced once trueValue has been.
    private const string Fixture = "ported/CalcFunctionTest05.html";

    [TestMethod("the editor's code declaring compareTo 3 replaces it")]
    public async Task TheEditorsCodeDeclaringCompareTo3ReplacesIt()
    {
        await Ren.OpenAsync(Fixture);

        await ExpectColumnTextAsync("Id", "Id", "< 3", "< 3", "≥ 3", "≥ 3");
    }

    [TestMethod("the named function's defaults use its compareTo of 15")]
    public async Task TheNamedFunctionsDefaultsUseItsCompareToOf15()
    {
        // A null compares as less.
        await Ren.OpenAsync(Fixture);

        await ExpectColumnTextAsync("Amount", "Amount", "< 15", "< 15", "≥ 15", "< 15");
    }
}
