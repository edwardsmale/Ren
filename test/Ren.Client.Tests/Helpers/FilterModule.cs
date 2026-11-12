using System.Text.Json;
using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Helpers for the filter module and its items.  Each takes the test's RenContext.
///
/// An item is addressed by the heading it reads as, an option by its caption, and a node of a
/// hierarchical item by its own caption plus its parent's (null for a top-level node), since the
/// same caption recurs beneath different parents.
/// </summary>
public static class FilterModule
{
    private const string BusySpinner = ".qa-ren-filter-module-busy-spinner";

    // Puts the finders the helpers share on the page, once per page.
    private const string InstallFinders = """
        () => {

            if (window.renTestFilterModule) {
                return;
            }

            const textOf = (element, selector) => {

                const text = element.querySelector(selector);
                return text ? text.textContent.trim() : null;
            };

            const findItem = (itemHeading) => {

                const items = Array.from(document.querySelectorAll(".ren-filter-module__item"));

                return items.find(i => textOf(i, ".ren-filter-module__item-heading") === itemHeading) ||
                    null;
            };

            const findOption = (itemHeading, optionText) => {

                const item = findItem(itemHeading);

                if (!item) {
                    return null;
                }

                const options = Array.from(item.querySelectorAll(".ren-filter-module__option"));

                return options.find(o => textOf(o, ".ren-filter-module__option-text") === optionText) ||
                    null;
            };

            const findAllOption = (itemHeading) => {

                const item = findItem(itemHeading);
                return item ? item.querySelector(".ren-filter-module__all-option") : null;
            };

            // A branch's rows are built the first time it's expanded, so a parent whose rows aren't
            // built yet is expanded to build them.  One expanded before keeps its rows when collapsed
            // again.
            const findNodeRow = (parentNodeText, nodeText) => {

                const rowLabel = (row) => textOf(row, ".ren-filter-module__option-text");
                const rows = Array.from(document.querySelectorAll(".qa-ren-filter-module-node-row"));

                if (!parentNodeText) {
                    return rows.find(r => rowLabel(r) === nodeText) || null;
                }

                const parentRow = rows.find(r => rowLabel(r) === parentNodeText);
                const children = parentRow ? parentRow.nextElementSibling : null;

                if (!children || !children.classList.contains("qa-ren-filter-module-children")) {
                    return null;
                }

                if (!children.querySelector(".qa-ren-filter-module-node-row")) {

                    const expandIcon = parentRow.querySelector(".qa-ren-filter-module-expand-icon");

                    if (expandIcon) {
                        expandIcon.click();
                    }
                }

                const childRows = Array.from(children.querySelectorAll(".qa-ren-filter-module-node-row"));

                return childRows.find(r => rowLabel(r) === nodeText) || null;
            };

            window.renTestFilterModule = { findItem, findOption, findAllOption, findNodeRow };
        }
        """;

    /// <summary>
    /// Evaluates a function, given as its source, on the page with the finders installed, passing
    /// it the finders and the argument.
    /// </summary>
    public static async Task<T> EvaluateAsync<T>(RenContext ren, string pageFunction, object? arg = null)
    {
        await ren.Page.EvaluateAsync(InstallFinders);

        return await ren.Page.EvaluateAsAsync<T>(
            $"(argument) => ({pageFunction})(window.renTestFilterModule, argument)",
            arg);
    }

    /// <summary>
    /// Evaluates a function that finds and acts on something, failing with the description if it
    /// didn't find it.
    /// </summary>
    public static async Task ActAsync(RenContext ren, string description, string pageFunction, object? arg = null)
    {
        if (!await EvaluateAsync<bool>(ren, pageFunction, arg)) throw new InvalidOperationException("Expected to find " + description);
    }

    /// <summary>
    /// Waits for the spinner a clicked checkbox shows to go, which it does once the page has
    /// finished updating for the filter it applied, then for the report to finish loading.
    /// </summary>
    public static async Task WaitUntilSettledAsync(RenContext ren)
    {
        await ren.Root.Locator(BusySpinner).First.WaitForAsync(new() { State = WaitForSelectorState.Detached });
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Creates a filter module from a column header's menu (Create visualisation > Filter module)
    /// and waits for it to appear.  The column is the report's unless another grid's context is
    /// given.
    /// </summary>
    public static async Task CreateFromColumnHeaderAsync(RenContext ren, string columnHeading, RenContext? gridContext = null)
    {
        var modules = ren.Root.Locator(".ren-filter-module");
        var countBefore = await modules.CountAsync();
        var headerCell = await (gridContext ?? ren.Report).CellSelectorAsync(columnHeading, 1);

        await ren.Root.RightClickAsync(headerCell);
        await ren.Root.MouseOverAsync("#create-visualisation");
        await ren.Root.ClickAsync("#create-visualisation-filter-module");

        await Assertions.Expect(modules).ToHaveCountAsync(countBefore + 1);
    }

    /// <summary>
    /// Gets a value indicating whether the filter module has an item reading as the given heading.
    /// </summary>
    public static Task<bool> ItemExistsAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<bool>(ren, "(finders, heading) => !!finders.findItem(heading)", itemHeading);

    /// <summary>
    /// Right-clicks a filter module item's heading, opening its context menu.
    /// </summary>
    public static Task ShowItemHeadingMenuAsync(RenContext ren, string itemHeading) =>
        ActAsync(ren, "the item " + itemHeading, """
            (finders, heading) => {

                const item = finders.findItem(heading);

                if (!item) {
                    return false;
                }

                item.querySelector(".ren-filter-module__item-heading")
                    .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

                return true;
            }
            """, itemHeading);

    /// <summary>
    /// Right-clicks the filter module's panel, opening the menu a module with no items is given its
    /// first column through.
    /// </summary>
    public static Task ShowPanelMenuAsync(RenContext ren) => ren.Root.RightClickAsync(".ren-filter-module");

    // Clicks a column in the "Add filter" submenu of the menu showing, which adds its item or takes
    // an already-ticked one off.
    private static async Task ClickAddFilterSubmenuColumnAsync(RenContext ren, string columnHeading)
    {
        await ren.Root.MouseOverAsync("#filter-module-add-column");

        await ActAsync(ren, "an Add filter item for " + columnHeading, """
            (finders, heading) => {

                const menuItems = Array.from(
                    document.querySelectorAll("[id^=\"filter-module-add-column-\"]"));
                const menuItem = menuItems.find(m => m.textContent.trim() === heading);

                if (!menuItem) {
                    return false;
                }

                menuItem.click();
                return true;
            }
            """, columnHeading);
    }

    /// <summary>
    /// Waits until the filter module has, or hasn't, an item reading as the given heading.
    /// </summary>
    public static async Task ExpectItemExistsAsync(RenContext ren, string itemHeading, bool exists = true)
    {
        await new PollExpectation<bool>(() => ItemExistsAsync(ren, itemHeading)).ToBe(exists);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Adds an item for a column through the "Add filter" submenu of the panel's own menu, for a
    /// module with no items to right-click yet.
    /// </summary>
    public static async Task AddFirstItemForColumnAsync(RenContext ren, string columnHeading)
    {
        await ShowPanelMenuAsync(ren);
        await ClickAddFilterSubmenuColumnAsync(ren, columnHeading);
        await ExpectItemExistsAsync(ren, columnHeading);
    }

    /// <summary>
    /// Adds an item for a column through the "Add filter" submenu of an existing item's heading
    /// menu.
    /// </summary>
    public static async Task AddItemForColumnAsync(RenContext ren, string existingItemHeading, string columnHeading)
    {
        await ShowItemHeadingMenuAsync(ren, existingItemHeading);
        await ClickAddFilterSubmenuColumnAsync(ren, columnHeading);
        await ExpectItemExistsAsync(ren, columnHeading);
    }

    /// <summary>
    /// Takes a column off through the "Add filter" submenu of an item's heading menu, by clicking
    /// the column already ticked there.
    /// </summary>
    public static async Task RemoveItemViaAddFilterMenuAsync(RenContext ren, string existingItemHeading, string columnHeading)
    {
        await ShowItemHeadingMenuAsync(ren, existingItemHeading);
        await ClickAddFilterSubmenuColumnAsync(ren, columnHeading);
        await ExpectItemExistsAsync(ren, columnHeading, false);
    }

    /// <summary>
    /// Opens an item's heading menu and clicks one of its entries, moving over each submenu on the
    /// way, then waits for the report to load.
    /// </summary>
    public static async Task ChooseFromItemHeadingMenuAsync(RenContext ren, string itemHeading, params string[] itemSelectors)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);

        foreach (var itemSelector in itemSelectors[..^1])
        {
            await ren.Root.MouseOverAsync(itemSelector);
        }

        await ren.Root.ClickAsync(itemSelectors[^1]);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks "Remove filter" on an item's heading menu, and waits for the item to go.
    /// </summary>
    public static async Task RemoveItemAsync(RenContext ren, string itemHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.ClickAsync("#filter-module-remove-column");
        await ExpectItemExistsAsync(ren, itemHeading, false);
    }

    /// <summary>
    /// Clicks the cross on an item's heading row, which is only there in edit mode, and waits for
    /// the item to go.
    /// </summary>
    public static async Task RemoveItemViaCrossAsync(RenContext ren, string itemHeading)
    {
        await EnableEditModeAsync(ren);
        await ClickItemElementAsync(ren, itemHeading, ".qa-ren-filter-module-item-remove", "Remove cross");
        await ExpectItemExistsAsync(ren, itemHeading, false);
    }

    /// <summary>
    /// Renames an item through "Edit heading..." on its heading menu.  An empty heading clears the
    /// override, which reverts the item to its column's own heading.
    /// </summary>
    public static async Task EditItemHeadingAsync(RenContext ren, string itemHeading, string newHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await CompleteTextEditAsync(ren, "#filter-module-edit-heading", newHeading);
    }

    // Clicks an "Edit ..." entry on the open menu, then enters the text in the editor it opens.
    private static async Task CompleteTextEditAsync(RenContext ren, string editMenuItemSelector, string text)
    {
        await ren.Root.ClickAsync(editMenuItemSelector);

        var input = ren.Root.Locator(".qa-ren-text-editor-input").First;

        await input.WaitForAsync();
        await input.FillAsync(text);
        await ren.Root.ClickAsync(".qa-ren-text-editor-ok");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Renames one of an item's checkboxes through "Edit label" on its caption's menu.  An empty
    /// label clears the override, which reverts the checkbox to its value's own caption.
    /// </summary>
    public static async Task EditOptionLabelAsync(RenContext ren, string itemHeading, string optionText, string newLabel)
    {
        await RightClickOptionTextAsync(ren, itemHeading, optionText);
        await CompleteTextEditAsync(ren, "#filter-module-edit-label", newLabel);
    }

    /// <summary>
    /// Renames an item's "All" checkbox through "Edit label" on its caption's menu.
    /// </summary>
    public static async Task EditAllLabelAsync(RenContext ren, string itemHeading, string newLabel)
    {
        await ActAsync(ren, "the All caption of " + itemHeading, """
            (finders, heading) => {

                const allOption = finders.findAllOption(heading);
                const text = allOption ? allOption.querySelector(".ren-filter-module__option-text") : null;

                if (!text) {
                    return false;
                }

                text.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
                return true;
            }
            """, itemHeading);

        await CompleteTextEditAsync(ren, "#filter-module-edit-all-label", newLabel);
    }

    /// <summary>
    /// Gets the caption of an item's "All" checkbox.
    /// </summary>
    public static Task<string?> AllLabelAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string?>(ren, """
            (finders, heading) => {

                const allOption = finders.findAllOption(heading);
                const text = allOption ? allOption.querySelector(".ren-filter-module__option-text") : null;

                return text ? text.textContent.trim() : null;
            }
            """, itemHeading);

    /// <summary>
    /// Renames a hierarchical item's node through "Edit label" on its caption's menu.
    /// </summary>
    public static async Task EditNodeLabelAsync(RenContext ren, string? parentNodeText, string nodeText, string newLabel)
    {
        await ActAsync(ren, "the node " + nodeText, """
            (finders, [parentText, text]) => {

                const row = finders.findNodeRow(parentText, text);
                const caption = row ? row.querySelector(".ren-filter-module__option-text") : null;

                if (!caption) {
                    return false;
                }

                caption.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
                return true;
            }
            """, new[] { parentNodeText, nodeText });

        await CompleteTextEditAsync(ren, "#filter-module-edit-label", newLabel);
    }

    /// <summary>
    /// Clicks an item's include-when-saving ring, which is only there in edit mode.  Each click
    /// moves the mark on a state: unmarked, marked, marked as negative, and back.
    /// </summary>
    public static async Task CycleIncludeWhenSavingAsync(RenContext ren, string itemHeading)
    {
        await EnableEditModeAsync(ren);
        await ClickItemElementAsync(ren, itemHeading, ".qa-ren-filter-module-item-include-when-saving", "Include-when-saving ring");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Gets a value indicating whether an item's ring is drawn filled in, marking its filter as one
    /// the report states.
    /// </summary>
    public static async Task<bool> IsIncludedWhenSavingAsync(RenContext ren, string itemHeading) =>
        await ItemElementCountAsync(ren, itemHeading, ".qa-ren-filter-module-item-include-when-saving-on") > 0;

    /// <summary>
    /// Gets a value indicating whether an item's ring is drawn as a negative mark, the filter to be
    /// saved as the values it leaves out.
    /// </summary>
    public static async Task<bool> IsIncludedWhenSavingAsNegativeAsync(RenContext ren, string itemHeading) =>
        await ItemElementCountAsync(ren, itemHeading, ".qa-ren-filter-module-item-include-when-saving-negative") > 0;

    // The colour is resolved through a probe element so that the theme states it, not the test.  A
    // panelled item draws its border on the panel.
    private static Task<bool> IsItemBorderedWithAsync(RenContext ren, string itemHeading, string colourPropertyName) =>
        EvaluateAsync<bool>(ren, """
            (finders, [heading, propertyName]) => {

                const item = finders.findItem(heading);

                if (!item) {
                    return false;
                }

                const declared = window.getComputedStyle(item).getPropertyValue(propertyName).trim();

                if (!declared) {
                    return false;
                }

                const probe = document.createElement("div");
                probe.style.color = declared;
                document.body.appendChild(probe);

                const expected = window.getComputedStyle(probe).color;

                probe.remove();

                const bordered = item.querySelector(".ren-filter-module__panel") || item;

                return window.getComputedStyle(bordered).borderTopColor === expected;
            }
            """, new[] { itemHeading, colourPropertyName });

    /// <summary>
    /// Gets a value indicating whether an item is bordered in the mark colour.
    /// </summary>
    public static Task<bool> IsBorderedAsIncludedWhenSavingAsync(RenContext ren, string itemHeading) =>
        IsItemBorderedWithAsync(ren, itemHeading, "--ren-filter-module-mark-colour");

    /// <summary>
    /// Gets a value indicating whether an item is bordered in the negative mark colour.
    /// </summary>
    public static Task<bool> IsBorderedAsIncludedWhenSavingNegativeAsync(RenContext ren, string itemHeading) =>
        IsItemBorderedWithAsync(ren, itemHeading, "--ren-filter-module-mark-negative-colour");

    /// <summary>
    /// Gets the headings of the filter module's items, in the order they show in.
    /// </summary>
    public static Task<string[]> ItemHeadingsAsync(RenContext ren) => ren.Page.EvaluateAsync<string[]>("""
        () => Array.from(document.querySelectorAll(".qa-ren-filter-module-item-heading"))
            .map(heading => heading.textContent.trim())
        """);

    /// <summary>
    /// Drags an item by its handle over one half of another item, then drops it there or, without
    /// drop, ends the drag without a drop as a cancelled drag does.  The module puts the item after
    /// the target when the pointer is past the target's horizontal midpoint.
    /// </summary>
    public static async Task DragItemAsync(RenContext ren, string itemHeading, string targetItemHeading, bool dropAfter, bool drop = true)
    {
        await ActAsync(ren, itemHeading + " dragged onto " + targetItemHeading, """
            (finders, [heading, targetHeading, after, isDrop]) => {

                const item = finders.findItem(heading);
                const target = finders.findItem(targetHeading);
                const handle = item ? item.querySelector(".qa-ren-filter-module-drag-handle") : null;

                if (!handle || !target) {
                    return false;
                }

                const dataTransfer = new DataTransfer();
                const rect = target.getBoundingClientRect();
                const pointer = {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer,
                    clientX: rect.left + rect.width * (after ? 0.75 : 0.25),
                    clientY: rect.top + rect.height / 2
                };

                handle.dispatchEvent(
                    new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer })
                );
                target.dispatchEvent(new DragEvent("dragover", pointer));

                if (isDrop) {
                    target.dispatchEvent(new DragEvent("drop", pointer));
                }

                handle.dispatchEvent(
                    new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer })
                );

                return true;
            }
            """, new object[] { itemHeading, targetItemHeading, dropAfter, drop });

        await ren.Page.WaitForTimeoutAsync(500);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks "Invert grouping" on a hierarchical item's heading menu, and waits for the item to
    /// show under the heading of its new top level.
    /// </summary>
    public static async Task InvertGroupingAsync(RenContext ren, string itemHeading, string newTopColumnHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.ClickAsync("#filter-module-invert-grouping");
        await ExpectItemExistsAsync(ren, newTopColumnHeading);
    }

    /// <summary>
    /// Clicks "Ungroup" on a hierarchical item's heading menu, and waits for the item to be headed
    /// by its leaf column again.
    /// </summary>
    public static async Task UngroupItemAsync(RenContext ren, string itemHeading, string leafColumnHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.ClickAsync("#filter-module-ungroup");
        await ExpectItemExistsAsync(ren, leafColumnHeading);
    }

    /// <summary>
    /// Chooses the totals row's own aggregation, through "Total aggregation" on the row's menu, by
    /// the text the entry reads as ("Average", "None" and so on).
    /// </summary>
    public static async Task SetTotalAggregationAsync(RenContext ren, string itemHeading, string aggregationText)
    {
        await ActAsync(ren, "the totals row of " + itemHeading, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const totalRow = item ? item.querySelector(".ren-filter-module__total-row") : null;

                if (!totalRow) {
                    return false;
                }

                totalRow.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
                return true;
            }
            """, itemHeading);

        await ren.Root.MouseOverAsync("#filter-module-total-aggregation");
        await ClickMenuItemByTextAsync(ren, aggregationText);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks a hierarchical item's node's expand/collapse icon.
    /// </summary>
    public static Task ToggleNodeAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        ActAsync(ren, "the expand icon of " + nodeText, """
            (finders, [parentText, text]) => {

                const row = finders.findNodeRow(parentText, text);
                const icon = row ? row.querySelector(".qa-ren-filter-module-expand-icon") : null;

                if (!icon) {
                    return false;
                }

                icon.click();
                return true;
            }
            """, new[] { parentNodeText, nodeText });

    /// <summary>
    /// Gets a value indicating whether a node's expand/collapse icon reads as a minus, its branch
    /// open.
    /// </summary>
    public static Task<bool> IsNodeExpandedAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        EvaluateAsync<bool>(ren, """
            (finders, [parentText, text]) => {

                const row = finders.findNodeRow(parentText, text);
                const icon = row ? row.querySelector(".qa-ren-filter-module-expand-icon") : null;

                return icon ? icon.textContent.trim() === "−" : false;
            }
            """, new[] { parentNodeText, nodeText });

    /// <summary>
    /// Gets the max-height a node's children are capped at, which is "0px" while its branch is
    /// closed.
    /// </summary>
    public static Task<string?> NodeChildrenMaxHeightAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        EvaluateAsync<string?>(ren, """
            (finders, [parentText, text]) => {

                const row = finders.findNodeRow(parentText, text);
                const children = row ? row.nextElementSibling : null;

                if (!children || !children.classList.contains("qa-ren-filter-module-children")) {
                    return null;
                }

                return children.style.maxHeight;
            }
            """, new[] { parentNodeText, nodeText });

    /// <summary>
    /// Turns on an item's compare filter strip and waits for its compare filter to show.
    /// </summary>
    public static async Task ShowCompareStripAsync(RenContext ren, string itemHeading)
    {
        await ChooseFromItemHeadingMenuAsync(ren, itemHeading, "#filter-module-view", "#filter-module-show-compare-filter");
        await ren.Root
            .Locator(".qa-ren-filter-module-compare-strip .qa-ren-compare-filter")
            .First
            .WaitForAsync();
    }

    /// <summary>
    /// Turns edit mode on, which the menu entries for authoring a report need.  A fixture page has
    /// no report header to hold the edit mode toggle, so without one the body joins the
    /// always-edit-mode scope instead.
    /// </summary>
    public static async Task EnableEditModeAsync(RenContext ren) => await ren.Page.EvaluateAsync("""
        () => {

            const editMode = window.Ren.ReportEditModeModule;
            const toggle = document.querySelector(".js-ren-report-edit-mode-module");

            if (editMode.getIsEditMode()) {
                return;
            }

            if (toggle) {
                toggle.click();
            }
            else {
                document.body.classList.add(editMode.ALWAYS_EDIT_MODE_CLASS_NAME);
            }
        }
        """);

    /// <summary>
    /// Clicks "Filter excludes unticked values" on an item's heading menu, in edit mode.
    /// </summary>
    public static async Task ToggleExcludeUntickedValuesAsync(RenContext ren, string itemHeading)
    {
        await EnableEditModeAsync(ren);
        await ChooseFromItemHeadingMenuAsync(ren, itemHeading, "#filter-module-exclude-filter");
    }

    /// <summary>
    /// Gets a value indicating whether "Filter excludes unticked values" is ticked on an item's
    /// heading menu, leaving the menu open.
    /// </summary>
    public static async Task<bool> IsExcludeUntickedValuesTickedAsync(RenContext ren, string itemHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);

        return await ren.Root.Locator("#filter-module-exclude-filter.ren-is-checked").CountAsync() > 0;
    }

    /// <summary>
    /// Clicks "Include when saving settings" on an item's heading menu, in edit mode.
    /// </summary>
    public static async Task ToggleIncludeWhenSavingAsync(RenContext ren, string itemHeading)
    {
        await EnableEditModeAsync(ren);
        await ChooseFromItemHeadingMenuAsync(ren, itemHeading, "#filter-module-include-when-saving");
    }

    /// <summary>
    /// Clicks an entry of the "View settings" submenu of an item's heading menu.
    /// </summary>
    public static Task ToggleViewSettingAsync(RenContext ren, string itemHeading, string viewMenuItemSelector) =>
        ChooseFromItemHeadingMenuAsync(ren, itemHeading, "#filter-module-view", viewMenuItemSelector);

    /// <summary>
    /// Sets an item's heading tooltip through "Filter heading tooltip..." in its "View settings"
    /// submenu.  An empty tooltip clears it.
    /// </summary>
    public static async Task SetFilterHeadingTooltipAsync(RenContext ren, string itemHeading, string filterHeadingTooltip)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.MouseOverAsync("#filter-module-view");
        await CompleteTextEditAsync(ren, "#filter-module-filter-heading-tooltip", filterHeadingTooltip);
    }

    /// <summary>
    /// Gets the tooltip on an item's heading, or null where it has none.
    /// </summary>
    public static Task<string?> FilterHeadingTooltipAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string?>(ren, """
            (finders, heading) => finders.findItem(heading)
                ?.querySelector(".ren-filter-module__item-heading")
                ?.getAttribute("title") ?? null
            """, itemHeading);

    /// <summary>
    /// Clicks "Flip sort order" on an item's heading menu.
    /// </summary>
    public static Task FlipSortOrderAsync(RenContext ren, string itemHeading) =>
        ChooseFromItemHeadingMenuAsync(ren, itemHeading, "#filter-module-flip-sort-order");

    /// <summary>
    /// Clicks the item of the newest context menu reading as the given text.
    /// </summary>
    public static Task ClickMenuItemByTextAsync(RenContext ren, string text) =>
        ActAsync(ren, "a menu item reading " + text, """
            (finders, itemText) => {

                const menus = document.querySelectorAll(".ren-context-menu");
                const menu = menus[menus.length - 1];
                const items = menu
                    ? Array.from(menu.querySelectorAll(".ren-context-menu__item--clickable"))
                    : [];
                const item = items.find(i => i.offsetParent !== null &&
                    i.textContent.trim().replace(/\s+/g, " ") === itemText);

                if (!item) {
                    return false;
                }

                item.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
                item.click();
                return true;
            }
            """, text);

    /// <summary>
    /// Chooses the column shown against an item's checkboxes, through its "Value column" submenu,
    /// and then its aggregation, where one's given, as it reads in the "Value aggregation" menu.
    /// </summary>
    public static async Task SetValueColumnAsync(RenContext ren, string itemHeading, string valueColumnHeading, string? aggregationText = null)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.MouseOverAsync("#filter-module-value-column");
        await ClickMenuItemByTextAsync(ren, valueColumnHeading);
        await ren.WaitUntilLoadedAsync();

        if (aggregationText != null) await SetValueAggregationAsync(ren, itemHeading, aggregationText);
    }

    /// <summary>
    /// Chooses the aggregation of an item's value column, as it reads in the "Value aggregation"
    /// menu.
    /// </summary>
    public static async Task SetValueAggregationAsync(RenContext ren, string itemHeading, string aggregationText)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.MouseOverAsync("#filter-module-value-aggregation");
        await ClickMenuItemByTextAsync(ren, aggregationText);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Nests an item's values within another column's, through its "Group by" submenu, and waits
    /// for the hierarchy, which is headed by that column.
    /// </summary>
    public static async Task GroupItemByAsync(RenContext ren, string itemHeading, string parentColumnHeading)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ren.Root.MouseOverAsync("#filter-module-group-by");

        await ActAsync(ren, "a Group by item for " + parentColumnHeading, """
            (finders, heading) => {

                const menuItems = Array.from(
                    document.querySelectorAll("[id^=\"filter-module-group-by-\"]"));
                const menuItem = menuItems.find(m => m.textContent.trim() === heading);

                if (!menuItem) {
                    return false;
                }

                menuItem.click();
                return true;
            }
            """, parentColumnHeading);

        await ExpectItemExistsAsync(ren, parentColumnHeading);
    }

    /// <summary>
    /// Gets the caption of every value checkbox of an item, other than "All".
    /// </summary>
    public static Task<string[]> OptionTextsAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string[]>(ren, """
            (finders, heading) => {

                const item = finders.findItem(heading);

                if (!item) {
                    return [];
                }

                const options = Array.from(item.querySelectorAll(
                    ".ren-filter-module__option:not(.ren-filter-module__all-option)"));

                return options.map(o =>
                    o.querySelector(".ren-filter-module__option-text").textContent.trim());
            }
            """, itemHeading);

    /// <summary>
    /// Gets the value shown against an option, such as "(22)", or null where there's none.
    /// </summary>
    public static Task<string?> OptionCountAsync(RenContext ren, string itemHeading, string optionText) =>
        EvaluateAsync<string?>(ren, """
            (finders, [heading, text]) => {

                const option = finders.findOption(heading, text);
                const count = option ? option.querySelector(".ren-filter-module__option-count") : null;

                return count ? count.textContent.trim() : null;
            }
            """, new[] { itemHeading, optionText });

    /// <summary>
    /// Gets the value of an item's totals row, or null where it has none.
    /// </summary>
    public static Task<string?> TotalValueAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string?>(ren, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const value = item ? item.querySelector(
                    ".ren-filter-module__total-row .ren-filter-module__total-value") : null;

                return value ? value.textContent.trim() : null;
            }
            """, itemHeading);

    /// <summary>
    /// Gets the caption of an item's totals row, or null where it has none.
    /// </summary>
    public static Task<string?> TotalLabelAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string?>(ren, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const label = item ? item.querySelector(
                    ".ren-filter-module__total-row .ren-filter-module__total-label") : null;

                return label ? label.textContent.trim() : null;
            }
            """, itemHeading);

    /// <summary>
    /// Clicks an option's checkbox and waits for the filter it applies.
    /// </summary>
    public static async Task ClickOptionAsync(RenContext ren, string itemHeading, string optionText)
    {
        await ActAsync(ren, "the option " + optionText + " of " + itemHeading, """
            (finders, [heading, text]) => {

                const option = finders.findOption(heading, text);

                if (!option) {
                    return false;
                }

                option.querySelector(".ren-filter-module__checkbox").click();
                return true;
            }
            """, new[] { itemHeading, optionText });

        await WaitUntilSettledAsync(ren);
    }

    /// <summary>
    /// Clicks an item's "All" checkbox and waits for the filter it applies.
    /// </summary>
    public static async Task ClickAllOptionAsync(RenContext ren, string itemHeading)
    {
        await ActAsync(ren, "the All checkbox of " + itemHeading, """
            (finders, heading) => {

                const allOption = finders.findAllOption(heading);

                if (!allOption) {
                    return false;
                }

                allOption.querySelector(".ren-filter-module__checkbox").click();
                return true;
            }
            """, itemHeading);

        await WaitUntilSettledAsync(ren);
    }

    /// <summary>
    /// Clicks an item's "Invert" link and waits for the filter it applies.
    /// </summary>
    public static async Task ClickInvertAsync(RenContext ren, string itemHeading)
    {
        await ActAsync(ren, "the Invert link of " + itemHeading, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const link = item ? item.querySelector(".qa-ren-filter-module-invert") : null;

                if (!link) {
                    return false;
                }

                link.click();
                return true;
            }
            """, itemHeading);

        await WaitUntilSettledAsync(ren);
    }

    // Gets a property of an option's checkbox, such as "checked" or "type".
    private static Task<JsonElement> OptionCheckboxPropertyAsync(RenContext ren, string itemHeading, string optionText, string property) =>
        EvaluateAsync<JsonElement>(ren, """
            (finders, [heading, text, name]) => {

                const option = finders.findOption(heading, text);
                return option ? option.querySelector(".ren-filter-module__checkbox")[name] : null;
            }
            """, new[] { itemHeading, optionText, property });

    /// <summary>
    /// Gets a value indicating whether an option's checkbox is ticked.
    /// </summary>
    public static async Task<bool> IsOptionCheckedAsync(RenContext ren, string itemHeading, string optionText) =>
        (await OptionCheckboxPropertyAsync(ren, itemHeading, optionText, "checked")).ValueKind == JsonValueKind.True;

    /// <summary>
    /// Gets a value indicating whether an option's checkbox is drawn as a radio button, as
    /// single-select mode draws them.
    /// </summary>
    public static async Task<bool> IsOptionRadioAsync(RenContext ren, string itemHeading, string optionText)
    {
        var type = await OptionCheckboxPropertyAsync(ren, itemHeading, optionText, "type");

        return type.ValueKind == JsonValueKind.String && type.GetString() == "radio";
    }

    // Gets a property of an item's "All" checkbox, or false where it has none.
    private static Task<bool> AllCheckboxPropertyAsync(RenContext ren, string itemHeading, string property) =>
        EvaluateAsync<bool>(ren, """
            (finders, [heading, name]) => {

                const allOption = finders.findAllOption(heading);
                return allOption ? allOption.querySelector(".ren-filter-module__checkbox")[name] : false;
            }
            """, new[] { itemHeading, property });

    /// <summary>
    /// Gets a value indicating whether an item's "All" checkbox is ticked.
    /// </summary>
    public static Task<bool> IsAllOptionCheckedAsync(RenContext ren, string itemHeading) => AllCheckboxPropertyAsync(ren, itemHeading, "checked");

    /// <summary>
    /// Gets a value indicating whether an item's "All" checkbox reads as partly ticked.
    /// </summary>
    public static Task<bool> IsAllOptionIndeterminateAsync(RenContext ren, string itemHeading) => AllCheckboxPropertyAsync(ren, itemHeading, "indeterminate");

    /// <summary>
    /// Right-clicks an option's checkbox, which changes the item's ticks rather than opening a
    /// menu, and waits for the filter it applies.
    /// </summary>
    public static async Task RightClickOptionAsync(RenContext ren, string itemHeading, string optionText, bool ctrlKey = false)
    {
        await ActAsync(ren, "the option " + optionText + " of " + itemHeading, """
            (finders, args) => {

                const option = finders.findOption(args.heading, args.text);

                if (!option) {
                    return false;
                }

                option.querySelector(".ren-filter-module__checkbox").dispatchEvent(
                    new MouseEvent("contextmenu", { bubbles: true, ctrlKey: args.ctrlKey }));

                return true;
            }
            """, new { heading = itemHeading, text = optionText, ctrlKey });

        await WaitUntilSettledAsync(ren);
    }

    /// <summary>
    /// Right-clicks an option's caption, opening the item's context menu.
    /// </summary>
    public static Task RightClickOptionTextAsync(RenContext ren, string itemHeading, string optionText) =>
        ActAsync(ren, "the option " + optionText + " of " + itemHeading, """
            (finders, [heading, text]) => {

                const option = finders.findOption(heading, text);

                if (!option) {
                    return false;
                }

                option.querySelector(".ren-filter-module__option-text")
                    .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

                return true;
            }
            """, new[] { itemHeading, optionText });

    /// <summary>
    /// Clicks a toggle on an item's strip by its caption ("Sort" or "Single").
    /// </summary>
    public static async Task ClickStripToggleAsync(RenContext ren, string itemHeading, string toggleLabel)
    {
        await ActAsync(ren, "a " + toggleLabel + " toggle on " + itemHeading, """
            (finders, [heading, label]) => {

                const item = finders.findItem(heading);
                const labels = item
                    ? Array.from(item.querySelectorAll(".ren-filter-module__item-strip-label"))
                    : [];
                const match = labels.find(l => l.textContent.trim() === label);

                if (!match) {
                    return false;
                }

                match.click();
                return true;
            }
            """, new[] { itemHeading, toggleLabel });

        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Counts the elements matching a selector within an item, or gives -1 where there's no such
    /// item.
    /// </summary>
    public static Task<int> ItemElementCountAsync(RenContext ren, string itemHeading, string selector) =>
        EvaluateAsync<int>(ren, """
            (finders, [heading, elementSelector]) => {

                const item = finders.findItem(heading);
                return item ? item.querySelectorAll(elementSelector).length : -1;
            }
            """, new[] { itemHeading, selector });

    /// <summary>
    /// Clicks the first element matching a selector within an item.
    /// </summary>
    public static Task ClickItemElementAsync(RenContext ren, string itemHeading, string selector, string description) =>
        ActAsync(ren, description + " of " + itemHeading, """
            (finders, [heading, elementSelector]) => {

                const item = finders.findItem(heading);
                const element = item ? item.querySelector(elementSelector) : null;

                if (!element) {
                    return false;
                }

                element.click();
                return true;
            }
            """, new[] { itemHeading, selector });

    /// <summary>
    /// Gets a value indicating whether an item shows its "+ binning function" link.
    /// </summary>
    public static Task<bool> IsBinningLinkShownAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<bool>(ren, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const link = item ? item.querySelector(".qa-ren-filter-module-add-binning") : null;

                return link !== null && link.style.display !== "none";
            }
            """, itemHeading);

    /// <summary>
    /// Toggles an item's "Show + binning function" view setting.
    /// </summary>
    public static Task ToggleBinningLinkAsync(RenContext ren, string itemHeading) =>
        ToggleViewSettingAsync(ren, itemHeading, "#filter-module-show-binning-function-link");

    /// <summary>
    /// Bins an item's values from its "+ binning function" link, turning the link on first where
    /// the item doesn't show it.
    /// </summary>
    public static async Task SetBinningFunctionAsync(RenContext ren, string itemHeading, string binningMenuItemSelector)
    {
        if (!await IsBinningLinkShownAsync(ren, itemHeading)) await ToggleBinningLinkAsync(ren, itemHeading);

        await ClickItemElementAsync(ren, itemHeading, ".qa-ren-filter-module-add-binning", "the + binning function link");
        await ren.Root.ClickAsync(binningMenuItemSelector);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Picks another binning function from the menu the current function's button opens.
    /// </summary>
    public static async Task ChangeBinningFunctionAsync(RenContext ren, string itemHeading, string binningMenuItemSelector)
    {
        await ClickItemElementAsync(ren, itemHeading, ".qa-ren-filter-module-binning-function", "the binning function's button");
        await ren.Root.ClickAsync(binningMenuItemSelector);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Gets the caption of an item's binning function, or null where none is stated.
    /// </summary>
    public static Task<string?> BinningLabelAsync(RenContext ren, string itemHeading) =>
        EvaluateAsync<string?>(ren, """
            (finders, heading) => {

                const item = finders.findItem(heading);
                const button = item ? item.querySelector(".qa-ren-filter-module-binning-function") : null;

                return !button || button.style.display === "none" ? null : button.textContent.trim();
            }
            """, itemHeading);

    /// <summary>
    /// Takes an item's binning function off with its cross.
    /// </summary>
    public static async Task ClearBinningFunctionAsync(RenContext ren, string itemHeading)
    {
        await ClickItemElementAsync(ren, itemHeading, ".qa-ren-filter-module-binning-clear", "the binning function's cross");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks a node's checkbox, with Ctrl held if asked, and waits for the filter it applies.
    /// </summary>
    public static async Task ClickNodeCheckboxAsync(RenContext ren, string? parentNodeText, string nodeText, bool ctrlKey = false)
    {
        await ActAsync(ren, "the node " + nodeText, """
            (finders, args) => {

                const row = finders.findNodeRow(args.parent, args.node);

                if (!row) {
                    return false;
                }

                row.querySelector(".ren-filter-module__checkbox").dispatchEvent(
                    new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: args.ctrlKey }));

                return true;
            }
            """, new { parent = parentNodeText, node = nodeText, ctrlKey });

        await WaitUntilSettledAsync(ren);
    }

    /// <summary>
    /// Right-clicks a node's checkbox, which changes the tree's ticks rather than opening a menu,
    /// and waits for the filter it applies.
    /// </summary>
    public static async Task RightClickNodeCheckboxAsync(RenContext ren, string? parentNodeText, string nodeText, bool ctrlKey = false)
    {
        await ActAsync(ren, "the node " + nodeText, """
            (finders, args) => {

                const row = finders.findNodeRow(args.parent, args.node);

                if (!row) {
                    return false;
                }

                row.querySelector(".ren-filter-module__checkbox").dispatchEvent(
                    new MouseEvent("contextmenu", { bubbles: true, ctrlKey: args.ctrlKey }));

                return true;
            }
            """, new { parent = parentNodeText, node = nodeText, ctrlKey });

        await WaitUntilSettledAsync(ren);
    }

    // Picks a "Show as" format from the Value format menu showing.
    private static async Task ChooseShowAsAsync(RenContext ren, string showAsItemSelector, string menuOptionSelector)
    {
        await ren.Root.MouseOverAsync("#format-menu");
        await ren.Root.MouseOverAsync("#format-show-as");
        await ren.Root.MouseOverAsync(showAsItemSelector);
        await ren.Root.ClickAsync(menuOptionSelector);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Formats an item's per-option values with a "Show as" format, from its heading menu.
    /// </summary>
    public static async Task SetValueFormatViaShowAsAsync(RenContext ren, string itemHeading, string showAsItemSelector, string menuOptionSelector)
    {
        await ShowItemHeadingMenuAsync(ren, itemHeading);
        await ChooseShowAsAsync(ren, showAsItemSelector, menuOptionSelector);
    }

    /// <summary>
    /// Formats the values of a node's level with a "Show as" format, from the node value's own
    /// menu.
    /// </summary>
    public static async Task SetNodeValueFormatViaShowAsAsync(RenContext ren, string? parentNodeText, string nodeText, string showAsItemSelector, string menuOptionSelector)
    {
        await ActAsync(ren, "the value of the node " + nodeText, """
            (finders, [parent, node]) => {

                const row = finders.findNodeRow(parent, node);
                const value = row ? row.querySelector(".ren-filter-module__option-count") : null;

                if (!value) {
                    return false;
                }

                value.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
                return true;
            }
            """, new[] { parentNodeText, nodeText });

        await ChooseShowAsAsync(ren, showAsItemSelector, menuOptionSelector);
    }

    // Gets a property of a node's checkbox, or false where there's no such node.
    private static Task<bool> NodeCheckboxPropertyAsync(RenContext ren, string? parentNodeText, string nodeText, string property) =>
        EvaluateAsync<bool>(ren, """
            (finders, [parent, node, name]) => {

                const row = finders.findNodeRow(parent, node);
                return row ? row.querySelector(".ren-filter-module__checkbox")[name] : false;
            }
            """, new[] { parentNodeText, nodeText, property });

    /// <summary>
    /// Gets a value indicating whether a node's checkbox is ticked.
    /// </summary>
    public static Task<bool> IsNodeCheckedAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        NodeCheckboxPropertyAsync(ren, parentNodeText, nodeText, "checked");

    /// <summary>
    /// Gets a value indicating whether a node's checkbox reads as partly ticked.
    /// </summary>
    public static Task<bool> IsNodeIndeterminateAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        NodeCheckboxPropertyAsync(ren, parentNodeText, nodeText, "indeterminate");

    /// <summary>
    /// Gets the value shown against a node, or null where there's none.
    /// </summary>
    public static Task<string?> NodeValueAsync(RenContext ren, string? parentNodeText, string nodeText) =>
        EvaluateAsync<string?>(ren, """
            (finders, [parent, node]) => {

                const row = finders.findNodeRow(parent, node);
                const value = row ? row.querySelector(".ren-filter-module__option-count") : null;

                return value ? value.textContent.trim() : null;
            }
            """, new[] { parentNodeText, nodeText });

    /// <summary>
    /// Gets the number of rows the grid shows, counted from a column's text.  The values aren't
    /// de-duplicated, as an ID can repeat.
    /// </summary>
    public static async Task<int> GridRowCountAsync(RenContext ren, string columnHeading = "Id") =>
        (await ren.Report.ColumnTextAsync(columnHeading))
            .Replace("\r", "")
            .Split('\n')
            .Skip(1)
            .Count(line => line.Length > 0);
}
