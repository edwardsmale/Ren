namespace Ren.Client.Tests.Browser;

// These tests cover tabbed modules: a declared module's tabs switching what shows, and a module
// built on the page holding visualisations in its tabs.  A visualisation dragged into a tab in edit
// mode is scoped to that tab, nested in its content and clipped to it, so it shows only with that
// tab, moves with the module and survives the module being rebuilt as its tabs are edited.
//
// The module and popups are made through Ren.QA.TabbedModule on a page holding one grid, which
// the popup grids take their data from.
[TestClass]
public class TabbedModuleTests : BrowserTest
{
    private const string HostFixture = "ported/TabbedModuleTest03.html";

    private sealed record Module(string VisualisationGuid, string[] TabIds);

    private sealed record PopupInfo(
        string? TabbedModuleTabId,
        bool IsTabRelative,
        bool ParentIsTabContent,
        bool IsNestedInTabContent,
        bool IsClipped,
        double Opacity,
        double Left,
        double Top,
        double Width);

    private sealed record ModuleTabInfo(int TabCount, string[] Headers, int SelectedIndex);

    // A drop counts only in the report's edit mode, not an always-edit-mode scope, so this puts the
    // report header and its Edit toggle on the page, which a fixture page doesn't have, and clicks
    // it.
    private async Task EnableEditModeAsync()
    {
        await Page.EvaluateAsync("() => window.Ren.ReportHeaderModule.initialise('body')");
        await Page.Locator(".ren-report-header-module").WaitForAsync(new() { State = Microsoft.Playwright.WaitForSelectorState.Attached });
        await Page.EvaluateAsync("() => window.Ren.ReportEditModeModule.initialise()");

        await Page.Locator(".js-ren-report-edit-mode-module").ClickAsync();
        await Poll(() => Page.EvaluateAsync<bool>("() => window.Ren.ReportEditModeModule.getIsEditMode()")).ToBe(true);
    }

    private const string QaCall =
        "call => window.Ren.QA.TabbedModule[call.functionName].apply(null, call.args)";

    private Task<T> QaAsync<T>(string functionName, params object?[] args) =>
        EvaluateAsync<T>(QaCall, new { functionName, args });

    private Task QaAsync(string functionName, params object?[] args) =>
        Page.EvaluateAsync(QaCall, new { functionName, args });

    private async Task<Module> CreateModuleAsync(int tabCount = 1, string? tabId = null, int left = 600, int top = 200)
    {
        var module = tabId == null
            ? await QaAsync<Module>("createClientSideModule", left, top, tabCount)
            : await QaAsync<Module>("createClientSideModule", left, top, tabCount, tabId);

        await Ren.Root.Locator("." + module.VisualisationGuid).First.WaitForAsync();

        return module;
    }

    private async Task<string> CreatePopupGridAsync(string? tabId = null)
    {
        var popup = await QaAsync<Module>("createPopupGrid", 1100, 200, tabId);

        await Ren.Root.Locator("." + popup.VisualisationGuid).First.WaitForAsync();

        return popup.VisualisationGuid;
    }

    private Task<PopupInfo> PopupInfoAsync(string popupGuid) => QaAsync<PopupInfo>("getPopupInfo", popupGuid);

    private Task<ModuleTabInfo> ModuleTabInfoAsync(string moduleGuid) => QaAsync<ModuleTabInfo>("getModuleTabInfo", moduleGuid);

    private async Task<(Module Module, string PopupGuid)> OpenWithModuleAndPopupAsync(int tabCount = 1)
    {
        await Ren.OpenAsync(HostFixture);

        var module = await CreateModuleAsync(tabCount);
        var popupGuid = await CreatePopupGridAsync();

        return (module, popupGuid);
    }

    private Task DragPopupIntoModuleAsync(string popupGuid, Module module) =>
        QaAsync("dragPopupToTabContent", popupGuid, module.VisualisationGuid);

    private Task ExpectPopupNestedInAsync(string popupGuid, string? tabId)
    {
        var nested = tabId != null;

        return Poll(async () =>
        {
            var info = await PopupInfoAsync(popupGuid);

            return $"{info.TabbedModuleTabId}|{info.IsTabRelative}|{info.ParentIsTabContent}|{info.IsNestedInTabContent}";

        }).ToBe($"{tabId}|{nested}|{nested}|{nested}");
    }

    private Task ExpectOpacityAsync(string popupGuid, double opacity) =>
        Poll(async () => (await PopupInfoAsync(popupGuid)).Opacity).ToBe(opacity);

    // Its loading animation was in a hidden tab, so the page counts as loaded without the grid.
    [TestMethod("a declared module's tab, clicked, shows its data grid")]
    public async Task ADeclaredModulesTabClickedShowsItsDataGrid()
    {
        await Ren.OpenAsync("ported/TabbedModuleTest02.html");

        await Ren.Root.ClickAsync(
            ".ren-tabbed-module__tab:not(.ren-tabbed-module__tab--selected) .ren-tabbed-module__tab-header");

        await Poll(() => Page.EvaluateAsync<double>("""
            () => {

                const viewport = document.querySelector(".ren-grid-set__viewport");

                return viewport ? viewport.getBoundingClientRect().height : 0;
            }
            """)).ToBeGreaterThan(0);
    }

    // The popup sits at page coordinates rather than in the tab, so only the tab's selection shows
    // and hides it.
    [TestMethod("a popup scoped to a tab shows only while the tab is selected")]
    public async Task APopupScopedToATabShowsOnlyWhileTheTabIsSelected()
    {
        await Ren.OpenAsync(HostFixture);
        var module = await CreateModuleAsync(2);
        var popupGuid = await CreatePopupGridAsync(module.TabIds[0]);

        await ExpectOpacityAsync(popupGuid, 1);

        await QaAsync("selectTab", module.VisualisationGuid, 1);
        await ExpectOpacityAsync(popupGuid, 0);

        await QaAsync("selectTab", module.VisualisationGuid, 0);
        await ExpectOpacityAsync(popupGuid, 1);
    }

    [TestMethod("A popup dragged into a tab: in edit mode is scoped to the tab and nested in it")]
    public async Task InEditModeIsScopedToTheTabAndNestedInIt()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();
        await EnableEditModeAsync();
        await ExpectPopupNestedInAsync(popupGuid, null);

        await DragPopupIntoModuleAsync(popupGuid, module);

        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);
    }

    // Just looking at a report mustn't move its visualisations about.
    [TestMethod("A popup dragged into a tab: outside edit mode stays where it was")]
    public async Task OutsideEditModeStaysWhereItWas()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();

        await DragPopupIntoModuleAsync(popupGuid, module);

        await ExpectPopupNestedInAsync(popupGuid, null);
    }

    [TestMethod("A popup dragged into a tab: then dragged out again is neither scoped nor nested")]
    public async Task ThenDraggedOutAgainIsNeitherScopedNorNested()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();
        await EnableEditModeAsync();
        await DragPopupIntoModuleAsync(popupGuid, module);
        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);

        await QaAsync("dragPopupToPoint", popupGuid, 200, 800);

        await ExpectPopupNestedInAsync(popupGuid, null);
    }

    [TestMethod("A popup dragged into a tab: moves with the module")]
    public async Task MovesWithTheModule()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();
        await EnableEditModeAsync();
        await DragPopupIntoModuleAsync(popupGuid, module);
        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);
        var before = await PopupInfoAsync(popupGuid);

        await QaAsync("dragPopupByDelta", module.VisualisationGuid, 150, 100);

        await Poll(async () =>
        {
            var info = await PopupInfoAsync(popupGuid);

            return Math.Abs(info.Left - (before.Left + 150)) <= 8 && Math.Abs(info.Top - (before.Top + 100)) <= 8;

        }).ToBe(true);
    }

    [TestMethod("A popup dragged into a tab: is clipped to the module")]
    public async Task IsClippedToTheModule()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();
        await EnableEditModeAsync();

        await DragPopupIntoModuleAsync(popupGuid, module);

        await Poll(async () => (await PopupInfoAsync(popupGuid)).IsClipped).ToBe(true);
        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);
    }

    // Adding a tab rebuilds the module's content, which the popup has to be lifted out of and put
    // back into.
    [TestMethod("A popup dragged into a tab: stays in its tab when another tab is added")]
    public async Task StaysInItsTabWhenAnotherTabIsAdded()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync();
        await EnableEditModeAsync();
        await DragPopupIntoModuleAsync(popupGuid, module);
        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);

        await QaAsync("addTabToModule", module.VisualisationGuid, "Second Tab");

        await Poll(async () => (await ModuleTabInfoAsync(module.VisualisationGuid)).TabCount).ToBe(2);
        await ExpectPopupNestedInAsync(popupGuid, module.TabIds[0]);
    }

    // A module scoped to an unselected tab is only transparent, so it still has a box to land in,
    // but a popup put there would vanish with it.
    [TestMethod("A popup dragged into a tab: of a module hidden with another tab stays where it was")]
    public async Task OfAModuleHiddenWithAnotherTabStaysWhereItWas()
    {
        var (module, popupGuid) = await OpenWithModuleAndPopupAsync(2);
        var hiddenModule = await CreateModuleAsync(1, module.TabIds[0], 100, 450);
        await QaAsync("selectTab", module.VisualisationGuid, 1);
        await ExpectOpacityAsync(hiddenModule.VisualisationGuid, 0);
        await EnableEditModeAsync();

        await DragPopupIntoModuleAsync(popupGuid, hiddenModule);

        await ExpectPopupNestedInAsync(popupGuid, null);
    }

    [TestMethod("A module's tabs: gain a tab when one is added, and select it")]
    public async Task GainATabWhenOneIsAddedAndSelectIt()
    {
        await Ren.OpenAsync(HostFixture);
        var module = await CreateModuleAsync(1);

        await QaAsync("addTabToModule", module.VisualisationGuid, "Second Tab");

        await Poll(async () =>
        {
            var info = await ModuleTabInfoAsync(module.VisualisationGuid);

            return info.Headers.Length == 2 && info.Headers[1] == "Second Tab" && info.SelectedIndex == 1;

        }).ToBe(true);
    }

    [TestMethod("A module's tabs: show a renamed tab's new header")]
    public async Task ShowARenamedTabsNewHeader()
    {
        await Ren.OpenAsync(HostFixture);
        var module = await CreateModuleAsync(1);

        await QaAsync("renameModuleTab", module.VisualisationGuid, 0, "Renamed Tab");

        await Poll(async () => (await ModuleTabInfoAsync(module.VisualisationGuid)).Headers)
            .ToEqual(new[] { "Renamed Tab" });
    }

    [TestMethod("A module's tabs: lose a deleted tab")]
    public async Task LoseADeletedTab()
    {
        await Ren.OpenAsync(HostFixture);
        var module = await CreateModuleAsync(2);

        await QaAsync("deleteModuleTab", module.VisualisationGuid, 1);

        await Poll(async () => (await ModuleTabInfoAsync(module.VisualisationGuid)).TabCount).ToBe(1);
    }

    // Part of the popup stays on screen, and its title bar below the top edge, wherever it's
    // dragged.
    [TestMethod("a popup dragged beyond the viewport is kept on screen")]
    public async Task APopupDraggedBeyondTheViewportIsKeptOnScreen()
    {
        await Ren.OpenAsync(HostFixture);
        var popupGuid = await CreatePopupGridAsync();

        await QaAsync("dragPopupToPoint", popupGuid, -600, -600);

        await Poll(async () =>
        {
            var info = await PopupInfoAsync(popupGuid);

            return info.Left + info.Width >= 20 && info.Top >= 0;

        }).ToBe(true);

        await QaAsync("dragPopupToPoint", popupGuid, 5000, 400);

        var viewportWidth = await Page.EvaluateAsync<double>("() => window.innerWidth");

        await Poll(async () => (await PopupInfoAsync(popupGuid)).Left).ToBeLessThanOrEqual(viewportWidth - 20);
    }
}
