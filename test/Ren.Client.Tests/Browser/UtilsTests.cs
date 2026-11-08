namespace Ren.Client.Tests.Browser;

// These tests cover Ren.Utils' string and date helpers.
[TestClass]
public class UtilsTests : BrowserTest
{
    [TestMethod("AddSpacesBeforeCapitals_VariousInputs_AllConvertedCorrectly")]
    public async Task AddSpacesBeforeCapitals_VariousInputs_AllConvertedCorrectly()
    {
        await Ren.OpenAsync("ported/AddSpacesBeforeCapitalsTest01.html");

        await Ren.Report.SelectAllAsync();

        Expect(Tsv(await Ren.Report.SelectedTextAsync())).ToBe(Tsv("""
            Original|Str
            Number|Number
            AccountId|Account Id
            OrderID|Order ID
            UUID|UUID
            SalesOrderID|Sales Order ID
            number|number
            accountId|account Id
            orderID|order ID
            salesOrderID|sales Order ID
            Num DPD Despatches|Num DPD Despatches
            DPD Despatches|DPD Despatches
            Num DPD|Num DPD
            NumDPD|Num DPD
            Answer42|Answer 42
            Created (or last updated)|Created (or last updated)
            """));
    }

    [TestMethod("ParseDateTimeUniversal_VariousFormats_AllParsedCorrectly")]
    public async Task ParseDateTimeUniversal_VariousFormats_AllParsedCorrectly()
    {
        await Ren.OpenAsync("ported/ParseDateTimeUniversalTest01.html");

        await Ren.Report.SelectAllAsync();

        Expect(Tsv(await Ren.Report.SelectedTextAsync())).ToBe(Tsv("""
            Original|Str
            10/12/2025|2025-12-10 00:00:00
            13/09/2024 12:54:36|2024-09-13 12:54:36
            2025-12-11|2025-12-11 00:00:00
            2025-09-14 09:56:13|2025-09-14 09:56:13
            January 2025|2025-01-01 00:00:00
            Dec 2024|2024-12-01 00:00:00
            Q1 2023|2023-01-01 00:00:00
            2026 Q1|2026-01-01 00:00:00
            """));
    }
}
