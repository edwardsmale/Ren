namespace Ren.Client.Tests.Browser;

// These tests cover a hierarchical filter module item whose levels are of uneven depth: Range
// grouped beneath Area, where Pens has no ranges at all and Ink has a range for only some rows.
[TestClass]
public class FilterModuleUnevenHierarchyTests : BrowserTest
{
    private const string Fixture = "filter-module-uneven-hierarchy.html";

    private async Task OpenWithRangeGroupedByAreaAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Units");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Range");
        await FilterModule.GroupItemByAsync(Ren, "Range", "Area");
    }

    private Task<bool> HasExpandIconAsync(string nodeText) => FilterModule.EvaluateAsync<bool>(Ren, """
        (finders, text) => !!finders.findNodeRow(null, text).querySelector(".qa-ren-filter-module-expand-icon")
        """, nodeText);

    private Task ExpectRowCountAsync(int count) => Poll(() => FilterModule.GridRowCountAsync(Ren, "Units")).ToBe(count);

    [TestMethod("BlankOnlyBranch_Rendered_EndsAtItsParent")]
    public async Task BlankOnlyBranch_Rendered_EndsAtItsParent()
    {
        await OpenWithRangeGroupedByAreaAsync();

        Expect(await HasExpandIconAsync("Pens")).ToBe(false);
        Expect(await HasExpandIconAsync("Paper")).ToBe(true);
    }

    [TestMethod("BranchWithBlankAmongValues_Rendered_KeepsItsChildren")]
    public async Task BranchWithBlankAmongValues_Rendered_KeepsItsChildren()
    {
        await OpenWithRangeGroupedByAreaAsync();

        Expect(await HasExpandIconAsync("Ink")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Ink", "Black")).ToBe(true);
    }

    [TestMethod("BlankOnlyBranch_Unticked_DropsItsRows")]
    public async Task BlankOnlyBranch_Unticked_DropsItsRows()
    {
        await OpenWithRangeGroupedByAreaAsync();

        await ExpectRowCountAsync(6);

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Pens");
        await Ren.WaitUntilLoadedAsync();

        await ExpectRowCountAsync(4);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Pens")).ToBe(false);

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Pens");
        await Ren.WaitUntilLoadedAsync();

        await ExpectRowCountAsync(6);
    }
}
