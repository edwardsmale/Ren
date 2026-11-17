using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the Find window and what a data grid does with what it asks for: finding a
// cell, selecting or copying the rows holding the text, filtering the grid down to them, and the
// options and columns saying where and how the text is looked for.  The window opens on Ctrl+F and
// acts on the grid last worked in, so each test focuses the grid set first.
//
// The grid's six rows are:
//
//     Frank     Big Frank   56  £1,024.50
//     Eve       (none)      42  £256.24
//     Charlotte Charlie     21  (none)
//     Alice     Al          23  £512.53
//     David     Dave        16  £512.54
//     Bob       (none)      48  -£100.00
//
// So "512.5" is in two cells, "Al" in a cell of its own and inside "Alice", and "Dave" in one.
[TestClass]
public class FindWindowTests : BrowserTest
{
    private const string Fixture = "ported/CellSelectionTest01.html";

    private const string FindWindowSelector = ".ren-find-window";
    private const string Input = ".qa-ren-find-window-input";
    private const string FindNextButton = ".qa-ren-find-window-find-next-button";
    private const string RemoveRowFilterLink = ".qa-ren-remove-row-filter-link";
    private const string RemoveRowFilterLinkVisible = RemoveRowFilterLink + ".ren-data-grid__remove-row-filter-link--visible";

    private const string NoCellFound = "No cell found containing that text.";
    private const string NoRowsFound = "No rows found containing that text.";

    private static readonly Regex FindFromTop = new("find-window--find-from-top");
    private static readonly Regex FilterRowsActive = new("find-window--filter-rows-active");

    private static readonly string[] AllNames = { "Frank", "Eve", "Charlotte", "Alice", "David", "Bob" };

    private async Task PressControlFAsync()
    {
        var viewport = Ren.Report.Locator(".ren-grid-set__viewport").First;

        await viewport.DispatchEventAsync("mousedown", new { bubbles = true });
        await viewport.DispatchEventAsync("mouseup", new { bubbles = true });
        await Page.Keyboard.PressAsync("Control+f");
    }

    private async Task OpenFindWindowAsync()
    {
        await Ren.OpenAsync(Fixture);
        await PressControlFAsync();
        await Ren.Root.Locator(Input).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    private Task SetTextAsync(string text) => Ren.Root.Locator(Input).First.FillAsync(text);

    private async Task FindNextAsync(string text)
    {
        await SetTextAsync(text);
        await Ren.Root.ClickAsync(FindNextButton);
    }

    private ILocator Status => Ren.Root.Locator(".qa-ren-find-window-status").First;

    private ILocator FindWindow => Ren.Root.Locator(FindWindowSelector).First;

    private Task ExpectSelectedAsync(string expected) => Poll(() => Ren.Report.SelectedTextAsync()).ToBe(expected);

    private async Task ExpectSelectionToContainAsync(params string[] texts)
    {
        foreach (var text in texts)
        {
            await Poll(async () => (await Ren.Report.SelectedTextAsync()).Contains(text)).ToBe(true);
        }
    }

    private async Task ExpectNamesAsync(params string[] names)
    {
        await Ren.Report.SelectColumnsAsync("Name");

        await ExpectSelectedAsync("Name\n" + string.Join("\n", names));
    }

    private async Task FilterRowsAsync(string text)
    {
        await SetTextAsync(text);
        await Ren.Root.ClickAsync(".qa-ren-find-window-filter-rows-button");
        await Expect(Ren.Root.Locator(RemoveRowFilterLinkVisible).First).ToBeAttachedAsync();
    }

    [TestMethod("Ctrl+F: opens the window with nothing to say")]
    public async Task CtrlFOpensTheWindowWithNothingToSay()
    {
        await OpenFindWindowAsync();

        await Expect(Ren.Root.Locator(FindNextButton).First).ToBeAttachedAsync();
        await Expect(Status).ToHaveTextAsync("");
    }

    // The second press brings the window back into view rather than opening another.
    [TestMethod("Ctrl+F: pressed again leaves one window open")]
    public async Task CtrlFPressedAgainLeavesOneWindowOpen()
    {
        await OpenFindWindowAsync();

        await PressControlFAsync();

        await Expect(Ren.Root.Locator(FindNextButton).First).ToBeAttachedAsync();
        await Expect(Ren.Root.Locator(FindWindowSelector)).ToHaveCountAsync(1);
    }

    [TestMethod("Find Next: selects the cell holding the text and says nothing")]
    public async Task FindNextSelectsTheCellHoldingTheTextAndSaysNothing()
    {
        await OpenFindWindowAsync();

        await FindNextAsync("Dave");

        await ExpectSelectedAsync("Dave");
        await Expect(Status).ToHaveTextAsync("");
    }

    [TestMethod("Find Next: clicked again moves on to the next match, then wraps around")]
    public async Task FindNextClickedAgainMovesOnToTheNextMatchThenWrapsAround()
    {
        await OpenFindWindowAsync();

        await FindNextAsync("512.5");
        await ExpectSelectedAsync("£512.53");

        await Ren.Root.ClickAsync(FindNextButton);
        await ExpectSelectedAsync("£512.54");

        await Ren.Root.ClickAsync(FindNextButton);
        await ExpectSelectedAsync("£512.53");
    }

    [TestMethod("Find Next: says when no cell holds the text")]
    public async Task FindNextSaysWhenNoCellHoldsTheText()
    {
        await OpenFindWindowAsync();

        await FindNextAsync("Nobody");

        await Expect(Status).ToHaveTextAsync(NoCellFound);
    }

    [TestMethod("Find Next: with Match case ticked passes over a cell in the other case")]
    public async Task FindNextWithMatchCaseTickedPassesOverACellInTheOtherCase()
    {
        await OpenFindWindowAsync();
        await FindNextAsync("dave");
        await ExpectSelectedAsync("Dave");

        await Ren.Root.ClickAsync(".qa-ren-find-window-match-case");
        await Ren.Root.ClickAsync(FindNextButton);

        await Expect(Status).ToHaveTextAsync(NoCellFound);
    }

    // "Alice" comes first, and holds the text.
    [TestMethod("Find Next: with Match whole cell ticked passes over a cell holding more")]
    public async Task FindNextWithMatchWholeCellTickedPassesOverACellHoldingMore()
    {
        await OpenFindWindowAsync();
        await FindNextAsync("Al");
        await ExpectSelectedAsync("Alice");

        await Ren.Root.ClickAsync(".qa-ren-find-window-match-whole-cell");
        await Ren.Root.ClickAsync(FindNextButton);

        await ExpectSelectedAsync("Al");
    }

    // "Alice" would be found first were the Name column searched too.
    [TestMethod("Find Next: with a column selected searches only that column")]
    public async Task FindNextWithAColumnSelectedSearchesOnlyThatColumn()
    {
        await OpenFindWindowAsync();

        await Ren.Report.SelectColumnsAsync("Nickname");
        await Expect(Ren.Root.Locator(".qa-ren-find-window-columns-text").First)
            .ToHaveTextAsync(new Regex(@"^\s*In: Nickname\s*$"));

        await FindNextAsync("Al");

        await ExpectSelectedAsync("Al");
    }

    [TestMethod("Find Next: after its columns are cleared searches every column")]
    public async Task FindNextAfterItsColumnsAreClearedSearchesEveryColumn()
    {
        await OpenFindWindowAsync();

        await Ren.Report.SelectColumnsAsync("Nickname");
        await Ren.Root.ClickAsync(".qa-ren-find-window-columns-clear-button");
        await Expect(Ren.Root.Locator(".qa-ren-find-window-columns-text").First)
            .ToHaveTextAsync(new Regex(@"^\s*In: all columns\s*$"));

        await FindNextAsync("Al");

        await ExpectSelectedAsync("Alice");
    }

    // Once the one search has started from the top, the button goes back to Find Next.
    [TestMethod("Find Next: after Start from top goes back to the first row")]
    public async Task FindNextAfterStartFromTopGoesBackToTheFirstRow()
    {
        await OpenFindWindowAsync();
        await FindNextAsync("512.5");
        await Ren.Root.ClickAsync(FindNextButton);
        await ExpectSelectedAsync("£512.54");

        await Ren.Root.ClickAsync(".qa-ren-find-window-start-from-top-button");
        await Expect(FindWindow).ToHaveClassAsync(FindFromTop);

        await Ren.Root.ClickAsync(FindNextButton);

        await ExpectSelectedAsync("£512.53");
        await Expect(FindWindow).Not.ToHaveClassAsync(FindFromTop);
    }

    // Whole rows are selected, not just the matching cells.
    [TestMethod("Select rows: selects the rows holding the text and says how many")]
    public async Task SelectRowsSelectsTheRowsHoldingTheTextAndSaysHowMany()
    {
        await OpenFindWindowAsync();

        await SetTextAsync("512.5");
        await Ren.Root.ClickAsync(".qa-ren-find-window-select-rows-button");

        await Expect(Status).ToHaveTextAsync("2 rows selected.");
        await ExpectSelectionToContainAsync("Alice", "David", "Dave");
    }

    [TestMethod("Select rows: says when no row holds the text")]
    public async Task SelectRowsSaysWhenNoRowHoldsTheText()
    {
        await OpenFindWindowAsync();

        await SetTextAsync("Nobody");
        await Ren.Root.ClickAsync(".qa-ren-find-window-select-rows-button");

        await Expect(Status).ToHaveTextAsync(NoRowsFound);
    }

    // The clipboard is caught rather than written to, since the browser refuses a write from a
    // page without focus, which a page often hasn't got while the tests run in parallel.
    private Task CatchClipboardAsync() => Page.EvaluateAsync("""
        () => {

            window.caughtClipboardText = null;

            navigator.clipboard.writeText = (text) => {

                window.caughtClipboardText = text;

                return Promise.resolve();
            };
        }
        """);

    [TestMethod("Copy rows says the row was copied rather than selected")]
    public async Task CopyRowsSaysTheRowWasCopiedRatherThanSelected()
    {
        await OpenFindWindowAsync();
        await CatchClipboardAsync();

        await SetTextAsync("Charlie");
        await Ren.Root.ClickAsync(".qa-ren-find-window-copy-rows-button");

        await Expect(Status).ToHaveTextAsync("1 row copied.");
        await ExpectSelectionToContainAsync("Charlotte");
        await Poll(() => Page.EvaluateAsync<string?>("() => window.caughtClipboardText")).ToMatch(new Regex("Charlotte"));
    }

    // Nothing on the grid itself says rows are hidden, so its Remove Row Filter link does.
    [TestMethod("Filter rows: leaves only the rows holding the text")]
    public async Task FilterRowsLeavesOnlyTheRowsHoldingTheText()
    {
        await OpenFindWindowAsync();

        await FilterRowsAsync("512.5");

        await Expect(Status).ToHaveTextAsync("Filtered to 2 rows.");
        await Expect(FindWindow).ToHaveClassAsync(FilterRowsActive);
        await ExpectNamesAsync("Alice", "David");
    }

    [TestMethod("Filter rows: cleared from the window brings the hidden rows back")]
    public async Task FilterRowsClearedFromTheWindowBringsTheHiddenRowsBack()
    {
        await OpenFindWindowAsync();
        await FilterRowsAsync("512.5");

        await Ren.Root.ClickAsync(".qa-ren-find-window-filter-rows-clear-button");

        await Expect(Ren.Root.Locator(RemoveRowFilterLinkVisible)).ToHaveCountAsync(0);
        await Expect(FindWindow).Not.ToHaveClassAsync(FilterRowsActive);
        await ExpectNamesAsync(AllNames);
    }

    // The link belongs to the grid rather than the window, so clearing from there has to reach
    // the window too.
    [TestMethod("Filter rows: cleared from the grid's link tells the window")]
    public async Task FilterRowsClearedFromTheGridsLinkTellsTheWindow()
    {
        await OpenFindWindowAsync();
        await FilterRowsAsync("512.5");

        await Ren.Report.ClickAsync(RemoveRowFilterLink);

        await Expect(Ren.Root.Locator(RemoveRowFilterLinkVisible)).ToHaveCountAsync(0);
        await Expect(FindWindow).Not.ToHaveClassAsync(FilterRowsActive);
        await ExpectNamesAsync(AllNames);
    }

    // A grid far wider than the window has cells only for the columns near the view, so the
    // cell found has to be drawn as the grid scrolls to it.
    [TestMethod("Find Next: in a wide grid, scrolls to and draws a cell in a far column")]
    public async Task FindNextInAWideGridScrollsToAndDrawsACellInAFarColumn()
    {
        await Ren.OpenAsync("wide-grid.html");

        var needleCell = Ren.Root.Locator(".ren-data-grid__cell").Filter(new() { HasText = "Needle" });

        await Expect(Ren.Root.Locator(".ren-data-grid__cell").Filter(new() { HasText = "R1C1" }).First).ToBeVisibleAsync();
        await Expect(needleCell).ToHaveCountAsync(0);

        // As PressControlFAsync, but on a grid outside any report.
        var viewport = Ren.Root.Locator(".ren-grid-set__viewport").First;
        await viewport.DispatchEventAsync("mousedown", new { bubbles = true });
        await viewport.DispatchEventAsync("mouseup", new { bubbles = true });
        await Page.Keyboard.PressAsync("Control+f");
        await Ren.Root.Locator(Input).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        await FindNextAsync("Needle");

        await Poll(() => Ren.Root.SelectedTextAsync()).ToBe("Needle");
        await Expect(needleCell).ToHaveCountAsync(1);
        await Expect(needleCell).ToBeInViewportAsync();
    }
}
