using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the settings window a filter module item's cog opens, which offers what the
// item's heading menu does, with a dropdown choosing which of the module's items it shows.
//
// The report has 54 rows, 22 Castings and 32 Structures, so an untouched Category item reads
// Structures (32) then Castings (22) over a totals row of 54.
[TestClass]
public class FilterModuleSettingsWindowTests : BrowserTest
{
    private ILocator Window => Page.Locator(".ren-menu-settings-window");

    private async Task OpenWithCategoryAndActiveItemsAsync()
    {
        await Ren.OpenAsync("ported/FilterModuleTest04.html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Active");
    }

    private async Task OpenSettingsWindowAsync(string itemHeading)
    {
        await FilterModule.ClickItemElementAsync(Ren, itemHeading, ".qa-ren-filter-module-item-settings", "Settings cog");
        await Expect(Window).ToBeVisibleAsync();
    }

    private async Task ShowViewSettingsAsync()
    {
        var subtab = Window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "View settings" });

        if (await subtab.CountAsync() > 0) await subtab.First.ClickAsync();
    }

    [TestMethod("the cog: opens the window on its own item, offering the module's items to choose from")]
    public async Task Cog_OpensTheWindowOnItsOwnItem()
    {
        await OpenWithCategoryAndActiveItemsAsync();

        await OpenSettingsWindowAsync("Active");

        var select = Window.Locator(".ren-menu-settings-window__subject-select");

        await Expect(select.Locator("option")).ToHaveTextAsync((await FilterModule.ItemHeadingsAsync(Ren)).Append("All").ToArray());
        Expect(await select.EvaluateAsync<string>("select => select.selectedOptions[0]?.textContent ?? ''")).ToBe("Active");
    }

    [TestMethod("the window: unticking Show option totals hides the item's per-option values")]
    public async Task UntickingShowOptionTotals_HidesThePerOptionValues()
    {
        await OpenWithCategoryAndActiveItemsAsync();
        await OpenSettingsWindowAsync("Category");
        await ShowViewSettingsAsync();

        var checkbox = Window.Locator(".ren-menu-settings-form__toggle:visible", new() { HasTextString = "Show option totals" }).Locator("input");

        await Expect(checkbox).ToBeCheckedAsync();
        await checkbox.ClickAsync();

        await Poll(() => FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBeNull();
        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("54");
        await Expect(checkbox).Not.ToBeCheckedAsync();
    }

    [TestMethod("the window: Flip sort order is a button that flips the item's options")]
    public async Task FlipSortOrderButton_FlipsTheOptions()
    {
        await OpenWithCategoryAndActiveItemsAsync();

        var before = await FilterModule.OptionTextsAsync(Ren, "Category");

        await OpenSettingsWindowAsync("Category");
        await Window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Sort" }).First.ClickAsync();
        await Window.Locator(".ren-menu-settings-form__button:visible", new() { HasTextString = "Flip sort order" }).ClickAsync();

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(before.Reverse().ToArray());
    }

    private async Task ChooseAllAsync()
    {
        await Window.Locator(".ren-menu-settings-window__subject-select").SelectOptionAsync(new SelectOptionValue { Label = "All" });
    }

    private Task<int> OptionCountsShownAsync() =>
        Page.Locator(".ren-filter-module .ren-filter-module__option-count").CountAsync();

    [TestMethod("All: Flip sort order flips every item's options")]
    public async Task All_FlipSortOrder_FlipsEveryItem()
    {
        await OpenWithCategoryAndActiveItemsAsync();

        var categoryBefore = await FilterModule.OptionTextsAsync(Ren, "Category");
        var activeBefore = await FilterModule.OptionTextsAsync(Ren, "Active");

        await OpenSettingsWindowAsync("Category");
        await ChooseAllAsync();
        await Window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Sort" }).First.ClickAsync();
        await Window.Locator(".ren-menu-settings-form__button:visible", new() { HasTextString = "Flip sort order" }).ClickAsync();

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(categoryBefore.Reverse().ToArray());
        Expect(await FilterModule.OptionTextsAsync(Ren, "Active")).ToEqual(activeBefore.Reverse().ToArray());
    }

    // Shown ticked only where ticked for every item, so ticking it ticks it for those without.
    [TestMethod("All: a toggle ticked for only some items shows unticked, and ticking it ticks every item's")]
    public async Task All_Toggle_SetsEveryItemAlike()
    {
        await OpenWithCategoryAndActiveItemsAsync();

        var headings = await FilterModule.ItemHeadingsAsync(Ren);

        // The second item's totals off, the first's on, so that they differ.
        await FilterModule.ToggleViewSettingAsync(Ren, headings[1], "#filter-module-show-option-totals");

        var countsWithFirstOnly = await OptionCountsShownAsync();

        await OpenSettingsWindowAsync(headings[0]);
        await ChooseAllAsync();
        await ShowViewSettingsAsync();

        var checkbox = Window.Locator(".ren-menu-settings-form__toggle:visible", new() { HasTextString = "Show option totals" }).Locator("input");

        await Expect(checkbox).Not.ToBeCheckedAsync();

        await checkbox.ClickAsync();
        await Poll(OptionCountsShownAsync).ToBeGreaterThan(countsWithFirstOnly);
        await Expect(checkbox).ToBeCheckedAsync();

        await checkbox.ClickAsync();
        await Poll(OptionCountsShownAsync).ToBe(0);
        await Expect(checkbox).Not.ToBeCheckedAsync();
    }

    // The values shown against an item's options, a hierarchy's top level's where it is one.
    private Task<string[]> ItemValuesAsync(string itemHeading) => Page.EvaluateAsync<string[]>("""
        heading => {

            const item = Array.from(document.querySelectorAll(".ren-filter-module__item")).find(item =>
                item.querySelector(".ren-filter-module__item-heading, .ren-filter-module__checkbox-heading")
                    ?.textContent.trim() === heading);

            return item
                ? Array.from(item.querySelectorAll(".ren-filter-module__option-count")).map(c => c.textContent.trim())
                : [];
        }
        """, itemHeading);

    // A hierarchy's heading sets its leaf's value column, but each level shows its own.
    [TestMethod("All: Value column sets a hierarchy's levels too, so its values change")]
    public async Task All_ValueColumn_SetsAHierarchysLevels()
    {
        await Ren.OpenAsync("ported/FilterModuleTest04.html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Product Code");
        await FilterModule.GroupItemByAsync(Ren, "Category", "Active");

        var before = await ItemValuesAsync("Active");

        await OpenSettingsWindowAsync("Product Code");
        await ChooseAllAsync();
        await Window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Values" }).First.ClickAsync();
        await Window.Locator(".ren-menu-settings-form__row:visible", new() { HasTextString = "Value column" })
            .Locator("select").SelectOptionAsync(new SelectOptionValue { Label = "Id" });

        await Poll(async () => string.Join(",", await ItemValuesAsync("Active"))).Not.ToBe(string.Join(",", before));
    }

    // The first item's format is already the one chosen, which the others' isn't.
    [TestMethod("All: Value format sets every item's, where only some have it already")]
    public async Task All_ValueFormat_SetsTheItemsWithoutIt()
    {
        await OpenWithCategoryAndActiveItemsAsync();

        var headings = await FilterModule.ItemHeadingsAsync(Ren);

        await FilterModule.ShowItemHeadingMenuAsync(Ren, headings[0]);
        await Ren.Root.MouseOverAsync("#format-menu");
        await Ren.Root.MouseOverAsync("#format-as-number");
        await Ren.Root.ClickAsync("#format-as-number-2-dp");

        await Poll(async () => (await ItemValuesAsync(headings[0])).All(v => v.EndsWith(".00"))).ToBe(true);
        Expect((await ItemValuesAsync(headings[1])).Any(v => v.EndsWith(".00"))).ToBe(false);

        await OpenSettingsWindowAsync(headings[0]);
        await ChooseAllAsync();
        await Window.Locator(".ren-menu-settings-form__subtab:visible", new() { HasTextString = "Values" }).First.ClickAsync();
        await Window.Locator(".ren-menu-settings-form__row:visible", new() { HasTextString = "Value format" })
            .Locator(".ren-menu-settings-form__menu-button").ClickAsync();
        await Ren.Root.MouseOverAsync("#format-as-number");
        await Ren.Root.ClickAsync("#format-as-number-2-dp");

        await Poll(async () => (await ItemValuesAsync(headings[1])).All(v => v.EndsWith(".00"))).ToBe(true);
        Expect((await ItemValuesAsync(headings[0])).All(v => v.EndsWith(".00"))).ToBe(true);
    }
}
