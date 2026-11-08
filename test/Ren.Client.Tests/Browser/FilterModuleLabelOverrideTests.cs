namespace Ren.Client.Tests.Browser;

// These tests cover the captions a reader can rewrite within a filter module item: a checkbox's
// label, the "All" checkbox's label and a hierarchical item's node label, each through "Edit label"
// on the caption's own menu and each cleared by entering nothing.  An override is a caption alone,
// so a renamed checkbox filters exactly the rows it always did.
//
// The report holds 22 Castings rows and 32 Structures ones.
[TestClass]
public class FilterModuleLabelOverrideTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private async Task OpenWithCategoryItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    private Task ExpectOptionsInAnyOrderAsync(string itemHeading, params string[] expected) =>
        Poll(async () => Text.Sorted(await FilterModule.OptionTextsAsync(Ren, itemHeading))).ToEqual(Text.Sorted(expected));

    [TestMethod("EditOptionLabel_TextEntered_RenamesThatCheckboxAlone")]
    public async Task EditOptionLabel_TextEntered_RenamesThatCheckboxAlone()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditOptionLabelAsync(Ren, "Category", "Castings", "Maintenance");

        await ExpectOptionsInAnyOrderAsync("Category", "Maintenance", "Structures");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Maintenance")).ToBe("22");
    }

    [TestMethod("EditOptionLabel_RenamedCheckboxUnticked_FiltersOnItsOwnValue")]
    public async Task EditOptionLabel_RenamedCheckboxUnticked_FiltersOnItsOwnValue()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditOptionLabelAsync(Ren, "Category", "Castings", "Maintenance");
        await ExpectOptionsInAnyOrderAsync("Category", "Maintenance", "Structures");

        await FilterModule.ClickOptionAsync(Ren, "Category", "Maintenance");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");
    }

    [TestMethod("EditOptionLabel_OverriddenThenCleared_RevertsToTheValuesOwnCaption")]
    public async Task EditOptionLabel_OverriddenThenCleared_RevertsToTheValuesOwnCaption()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditOptionLabelAsync(Ren, "Category", "Castings", "Maintenance");
        await ExpectOptionsInAnyOrderAsync("Category", "Maintenance", "Structures");

        await FilterModule.EditOptionLabelAsync(Ren, "Category", "Maintenance", "");

        await ExpectOptionsInAnyOrderAsync("Category", "Castings", "Structures");
    }

    // With two options to choose between, the checkbox selecting them all reads "Both".
    [TestMethod("EditAllLabel_TextEnteredThenCleared_RenamesTheAllCheckboxAndRevertsIt")]
    public async Task EditAllLabel_TextEnteredThenCleared_RenamesTheAllCheckboxAndRevertsIt()
    {
        await OpenWithCategoryItemAsync();

        Expect(await FilterModule.AllLabelAsync(Ren, "Category")).ToBe("Both");

        await FilterModule.EditAllLabelAsync(Ren, "Category", "Everything");

        await Poll(() => FilterModule.AllLabelAsync(Ren, "Category")).ToBe("Everything");

        await FilterModule.EditAllLabelAsync(Ren, "Category", "");

        await Poll(() => FilterModule.AllLabelAsync(Ren, "Category")).ToBe("Both");
    }

    // The node still stands for the same 32 rows, and its sibling is untouched.
    [TestMethod("EditNodeLabel_TextEntered_RenamesThatNodeAlone")]
    public async Task EditNodeLabel_TextEntered_RenamesThatNodeAlone()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");

        await FilterModule.EditNodeLabelAsync(Ren, null, "Structures", "Office");

        await Poll(() => FilterModule.NodeValueAsync(Ren, null, "Office")).ToBe("32");
        Expect(await FilterModule.NodeValueAsync(Ren, null, "Castings")).ToBe("22");
    }
}
