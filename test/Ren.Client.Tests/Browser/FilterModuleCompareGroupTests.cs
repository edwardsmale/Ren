using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover how a filter module column's compare filters say what joins them.  The "and"
// link gives the column a further filter in a box of its own, which a row must pass as well, and
// the "or" link adds one inside the same box, which a row may pass instead.  Both links belong to
// the last filter of a group, and the "and" to the last group besides, so the strips above say "or"
// as plain text instead.
//
// The strips are addressed by their position down the module: a group's own strips, then each
// further group beneath them.
[TestClass]
public class FilterModuleCompareGroupTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const string Strip = ".qa-ren-filter-module-compare-strip";

    private async Task CreateModuleWithCategoryCompareStripAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
        await FilterModule.ShowCompareStripAsync(Ren, "Category");
    }

    private ILocator Strips => Ren.Root.Locator(Strip);

    private async Task<bool> HasJoinLinkAsync(int stripIndex, string word) =>
        await Strips.Nth(stripIndex).Locator(".qa-ren-compare-filter-" + word).CountAsync() > 0;

    private async Task<string?> JoinWordAsync(int stripIndex)
    {
        var word = Strips.Nth(stripIndex).Locator(".qa-ren-compare-filter-join-word");

        return await word.CountAsync() > 0 ? (await word.First.TextContentAsync())?.Trim() : null;
    }

    // The only filter is the last of its group and of the column, and nothing is drawn beneath it.
    [TestMethod("CompareStrip_OnlyFilter_CarriesBothJoinLinksAndNoJoinWord")]
    public async Task CompareStrip_OnlyFilter_CarriesBothJoinLinksAndNoJoinWord()
    {
        await CreateModuleWithCategoryCompareStripAsync();

        await Expect(Strips).ToHaveCountAsync(1);
        Expect(await HasJoinLinkAsync(0, "and")).ToBe(true);
        Expect(await HasJoinLinkAsync(0, "or")).ToBe(true);
        Expect(await JoinWordAsync(0)).ToBeNull();
    }

    [TestMethod("OrLink_Clicked_MovesTheLinksToTheNewFilterAndNamesTheJoin")]
    public async Task OrLink_Clicked_MovesTheLinksToTheNewFilterAndNamesTheJoin()
    {
        await CreateModuleWithCategoryCompareStripAsync();

        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "or");

        await Expect(Strips).ToHaveCountAsync(2);
        Expect(await JoinWordAsync(0)).ToBe("or");
        Expect(await HasJoinLinkAsync(0, "and")).ToBe(false);
        Expect(await HasJoinLinkAsync(0, "or")).ToBe(false);
        Expect(await HasJoinLinkAsync(1, "and")).ToBe(true);
        Expect(await HasJoinLinkAsync(1, "or")).ToBe(true);
        Expect(await JoinWordAsync(1)).ToBeNull();
    }

    // The first group keeps its "or", but the "and" moves to the bottom-most filter of all, since a
    // further ANDed filter is added at the end of the column's filters.
    [TestMethod("AndLink_ClickedOnAnOrGroup_LeavesThatGroupItsOrAlone")]
    public async Task AndLink_ClickedOnAnOrGroup_LeavesThatGroupItsOrAlone()
    {
        await CreateModuleWithCategoryCompareStripAsync();

        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "or");
        await Expect(Strips).ToHaveCountAsync(2);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 1, "and");

        await Expect(Strips).ToHaveCountAsync(3);
        Expect(await JoinWordAsync(0)).ToBe("or");
        Expect(await HasJoinLinkAsync(1, "or")).ToBe(true);
        Expect(await HasJoinLinkAsync(1, "and")).ToBe(false);
        Expect(await HasJoinLinkAsync(2, "and")).ToBe(true);
        Expect(await HasJoinLinkAsync(2, "or")).ToBe(true);
    }
}
