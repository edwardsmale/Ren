using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a task board, which lays its task tiles out in a grid of lanes and columns:
// adding, dragging and saving tiles, and renaming its lanes and columns.
[TestClass]
public class TaskBoardsTests : BrowserTest
{
    private const string Fixture = "task-boards.html";

    private static readonly string[] StartingBoard = { "Containers: A | B", "Tiles: C | " };

    // Gets the task IDs in each cell of each lane, as "lane: cell | cell".
    private Task<string[]> GetBoardAsync() => Page.EvaluateAsync<string[]>("""
        () => Array.prototype.map.call(
            document.querySelectorAll(".ren-task-lane"),
            lane => lane.querySelector(".ren-task-lane__heading").textContent + ": " +
                Array.prototype.map.call(
                    lane.querySelectorAll(".ren-task-lane__cell"),
                    cell => Array.prototype.map.call(
                        cell.querySelectorAll(".ren-task-tile__id"),
                        id => id.textContent
                    ).join(" ")
                ).join(" | ")
        )
        """);

    // Gets each saved task tile as its ID, lane, slot and order.
    private Task<string[]> GetSavedTilesAsync() => Page.EvaluateAsync<string[]>("""
        () => window.Ren.ReportSerializer
            .getReportSettingsObject(false)
            .visualisations
            .filter(visualisation => visualisation.visualisationTypeName === "TaskTile")
            .map(visualisation => [
                visualisation.taskId ?? visualisation.taskTitle,
                visualisation.containerVisualisationId,
                visualisation.containerSlot,
                visualisation.containerOrder
            ].join(" "))
            .sort()
        """);

    private ILocator GetTile(string taskId) => Page.Locator(".ren-task-tile", new()
    {
        Has = Page.Locator(".ren-task-tile__id", new() { HasText = taskId })
    });

    private ILocator Cell(int index) => Page.Locator(".ren-task-lane__cell").Nth(index);

    private async Task AddTaskToFourthCellAsync()
    {
        await Cell(3).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-add-task-tile").ClickAsync();

        await Expect(Cell(3).Locator(".ren-task-tile")).ToHaveCountAsync(1);
    }

    [TestMethod("a task board puts each tile in its lane's cell for its column")]
    public async Task ATaskBoardPutsEachTileInItsLanesCellForItsColumn()
    {
        await Ren.OpenAsync(Fixture);

        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Start", "Next" });
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var start = (await Page.Locator(".ren-task-board__column-heading").Nth(0).BoundingBoxAsync())!;
        var next = (await Page.Locator(".ren-task-board__column-heading").Nth(1).BoundingBoxAsync())!;
        var a = (await GetTile("A").BoundingBoxAsync())!;
        var b = (await GetTile("B").BoundingBoxAsync())!;

        Expect(a.X).ToBe(start.X);
        Expect(b.X).ToBe(next.X);
        Expect(b.Y).ToBe(a.Y);
    }

    [TestMethod("a task is added to the cell that was right-clicked")]
    public async Task ATaskIsAddedToTheCellThatWasRightClicked()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await AddTaskToFourthCellAsync();

        Expect(await GetSavedTilesAsync()).ToContain("New task lane-2 next 1");
    }

    [TestMethod("a task is dragged into another lane's column")]
    public async Task ATaskIsDraggedIntoAnotherLanesColumn()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var from = (await GetTile("A").BoundingBoxAsync())!;
        var to = (await Cell(3).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 10);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width / 2, to.Y + to.Height / 2, new() { Steps = 10 });
        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(new[] { "Containers:  | B", "Tiles: C | A" });
        Expect(await GetSavedTilesAsync()).ToEqual(new[]
        {
            "A lane-2 next 1",
            "B lane-1 next 1",
            "C lane-2  1"
        });
    }

    [TestMethod("a lane is renamed in place")]
    public async Task ALaneIsRenamedInPlace()
    {
        await Ren.OpenAsync(Fixture);

        var heading = Page.Locator(".ren-task-lane__heading").Nth(1);

        await heading.DblClickAsync();
        await Page.Keyboard.TypeAsync("Link tiles");
        await Page.Keyboard.PressAsync("Enter");

        await Expect(heading).ToHaveTextAsync("Link tiles");
        await Expect(heading).Not.ToHaveAttributeAsync("contenteditable", new Regex(".*"));

        var saved = await Page.EvaluateAsync<string>("""
            () => window.Ren.ReportSerializer
                .getReportSettingsObject(false)
                .visualisations
                .find(visualisation => visualisation.visualisationId === "lane-2")
                .heading
            """);

        Expect(saved).ToBe("Link tiles");
    }

    [TestMethod("a column heading is edited from its menu")]
    public async Task AColumnHeadingIsEditedFromItsMenu()
    {
        await Ren.OpenAsync(Fixture);

        await Page.Locator(".ren-task-board__heading").Nth(1).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#task-board-edit-heading").ClickAsync();

        var input = Page.Locator(".qa-ren-text-editor-input");

        await input.FillAsync("Later");
        await input.PressAsync("Enter");

        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Start", "Later" });

        // Its keys in order, so that it compares whatever order they were written in.
        var column = await Page.EvaluateAsync<string>("""
            () => {

                const column = window.Ren.ReportSerializer
                    .getReportSettingsObject(false)
                    .visualisations
                    .find(visualisation => visualisation.visualisationId === "board")
                    .columns[1];

                return JSON.stringify(column, Object.keys(column).sort());
            }
            """);

        Expect(column).ToBe("""{"heading":"Later","id":"next"}""");
    }

    [TestMethod("a status is set from the tile's status menu")]
    [DataRow("Tentative", "tentative", "Tentative")]
    [DataRow("AwaitingInput", "awaiting-input", "Awaiting input")]
    [DataRow("OnHold", "on-hold", "On hold")]
    [DataRow("NotDoing", "not-doing", "Not doing")]
    public async Task AStatusIsSetFromTheTilesStatusMenu(string status, string modifier, string text)
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var tile = GetTile("A");

        await tile.Locator(".qa-ren-task-tile-status").ClickAsync();
        await Page.Locator("#task-tile-status-" + modifier).ClickAsync();

        await Expect(tile).ToHaveClassAsync(new Regex("ren-task-tile--" + modifier));
        await Expect(tile.Locator(".qa-ren-task-tile-status")).ToHaveTextAsync(text);

        var saved = await Page.EvaluateAsync<string>("""
            () => window.Ren.ReportSerializer
                .getReportSettingsObject(false)
                .visualisations
                .find(visualisation => visualisation.taskId === "A")
                .taskStatus
            """);

        Expect(saved).ToBe(status);
    }

    [TestMethod("tiles keep their lanes and columns once saved and reloaded")]
    public async Task TilesKeepTheirLanesAndColumnsOnceSavedAndReloaded()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await AddTaskToFourthCellAsync();

        var settings = await Ren.SavedSettingsAsync();

        await Ren.OpenWithSettingsAsync(Fixture, settings);

        await Poll(GetBoardAsync).ToEqual(StartingBoard);
        await Expect(Cell(3).Locator(".ren-task-tile")).ToHaveCountAsync(1);
        Expect(await GetSavedTilesAsync()).ToContain("New task lane-2 next 1");
    }
}
