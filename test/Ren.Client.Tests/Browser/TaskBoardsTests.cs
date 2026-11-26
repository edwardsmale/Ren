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

    // Holds the mouse down on the first column's heading until it's picked up, then moves it past
    // the second, leaving the button down.
    private async Task PickUpFirstColumnAndMoveItAfterSecondAsync()
    {
        var from = (await Page.Locator(".ren-task-board__column-heading").Nth(0).BoundingBoxAsync())!;
        var to = (await Page.Locator(".ren-task-board__column-heading").Nth(1).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 5);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-task-board__column-heading--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width - 5, to.Y + 5, new() { Steps = 10 });
    }

    // Gets the IDs of the saved board's columns, in order.
    private Task<string[]> GetSavedColumnIdsAsync() => Page.EvaluateAsync<string[]>("""
        () => window.Ren.ReportSerializer
            .getReportSettingsObject(false)
            .visualisations
            .find(visualisation => visualisation.visualisationId === "board")
            .columns
            .map(column => column.id)
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

    [TestMethod("a lane is added to the board from its menu")]
    public async Task ALaneIsAddedToTheBoardFromItsMenu()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await Page.Locator(".ren-task-lane__heading").Nth(1).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-add-task-lane").ClickAsync();

        await Poll(GetBoardAsync).ToEqual(new[] { "Containers: A | B", "Tiles: C | ", "New lane:  | " });
    }

    [TestMethod("an added lane keeps its tasks once saved and reloaded")]
    public async Task AnAddedLaneKeepsItsTasksOnceSavedAndReloaded()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await Page.Locator(".ren-task-lane__heading").Nth(1).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-add-task-lane").ClickAsync();
        await Expect(Page.Locator(".ren-task-lane")).ToHaveCountAsync(3);

        await Cell(4).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-add-task-tile").ClickAsync();
        await Expect(Cell(4).Locator(".ren-task-tile")).ToHaveCountAsync(1);

        var settings = await Ren.SavedSettingsAsync();

        await Ren.OpenWithSettingsAsync(Fixture, settings);

        await Expect(Page.Locator(".ren-task-lane")).ToHaveCountAsync(3);
        await Expect(Cell(4).Locator(".ren-task-tile")).ToHaveCountAsync(1);
    }

    [TestMethod("a lane is dragged below another")]
    public async Task ALaneIsDraggedBelowAnother()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var from = (await Page.Locator(".ren-task-lane__heading").Nth(0).BoundingBoxAsync())!;
        var to = (await Page.Locator(".ren-task-lane").Nth(1).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 5);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + 10, to.Y + to.Height - 2, new() { Steps = 10 });
        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(new[] { "Tiles: C | ", "Containers: A | B" });
    }

    [TestMethod("a column is added after the heading that was right-clicked")]
    public async Task AColumnIsAddedAfterTheHeadingThatWasRightClicked()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await Page.Locator(".ren-task-board__heading").Nth(0).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#task-board-add-column").ClickAsync();

        await Expect(Page.Locator(".ren-task-board__heading"))
            .ToHaveTextAsync(new[] { "Start", "New column", "Next" });
        await Poll(GetBoardAsync).ToEqual(new[] { "Containers: A |  | B", "Tiles: C |  | " });
        Expect(await GetSavedColumnIdsAsync()).ToEqual(new[] { "start", "column-3", "next" });
    }

    [TestMethod("an empty column is removed from its heading's menu")]
    public async Task AnEmptyColumnIsRemovedFromItsHeadingsMenu()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await Page.Locator(".ren-task-board__heading").Nth(1).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#task-board-add-column").ClickAsync();
        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveCountAsync(3);

        await Page.Locator(".ren-task-board__heading").Nth(2).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#task-board-remove-column").ClickAsync();
        await Page.Locator(".js-ren-popup-confirm-yes").ClickAsync();

        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Start", "Next" });
        await Poll(GetBoardAsync).ToEqual(StartingBoard);
        Expect(await GetSavedColumnIdsAsync()).ToEqual(new[] { "start", "next" });
    }

    [TestMethod("a column with tasks in it can't be removed")]
    public async Task AColumnWithTasksInItCantBeRemoved()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        await Page.Locator(".ren-task-board__heading").Nth(1).ClickAsync(new() { Button = MouseButton.Right });

        await Expect(Page.Locator("#task-board-add-column")).ToBeVisibleAsync();
        await Expect(Page.Locator("#task-board-remove-column")).ToHaveCountAsync(0);
    }

    [TestMethod("a column's tasks are shown in its new position while it's dragged")]
    public async Task AColumnsTasksAreShownInItsNewPositionWhileItsDragged()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var a = (await GetTile("A").BoundingBoxAsync())!;
        var b = (await GetTile("B").BoundingBoxAsync())!;

        await PickUpFirstColumnAndMoveItAfterSecondAsync();

        await Poll(async () => Math.Round((await GetTile("A").BoundingBoxAsync())!.X))
            .ToEqual(Math.Round(b.X));
        await Poll(async () => Math.Round((await GetTile("B").BoundingBoxAsync())!.X))
            .ToEqual(Math.Round(a.X));

        await Page.Keyboard.PressAsync("Escape");

        await Poll(async () => Math.Round((await GetTile("A").BoundingBoxAsync())!.X))
            .ToEqual(Math.Round(a.X));
        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Start", "Next" });

        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(StartingBoard);
        Expect(await GetSavedColumnIdsAsync()).ToEqual(new[] { "start", "next" });
    }

    [TestMethod("a column dragged across and back again is shown where it was")]
    public async Task AColumnDraggedAcrossAndBackAgainIsShownWhereItWas()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var a = (await GetTile("A").BoundingBoxAsync())!;
        var from = (await Page.Locator(".ren-task-board__column-heading").Nth(0).BoundingBoxAsync())!;

        await PickUpFirstColumnAndMoveItAfterSecondAsync();
        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Next", "Start" });

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 5, new() { Steps = 10 });

        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Start", "Next" });
        await Poll(async () => Math.Round((await GetTile("A").BoundingBoxAsync())!.X))
            .ToEqual(Math.Round(a.X));

        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(StartingBoard);
        Expect(await GetSavedColumnIdsAsync()).ToEqual(new[] { "start", "next" });
    }

    [TestMethod("a column is dragged to a new position")]
    public async Task AColumnIsDraggedToANewPosition()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var from = (await Page.Locator(".ren-task-board__column-heading").Nth(0).BoundingBoxAsync())!;
        var to = (await Page.Locator(".ren-task-board__column-heading").Nth(1).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 5);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-task-board__column-heading--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width - 5, to.Y + 5, new() { Steps = 10 });
        await Page.Mouse.UpAsync();

        await Expect(Page.Locator(".ren-task-board__heading")).ToHaveTextAsync(new[] { "Next", "Start" });
        await Poll(GetBoardAsync).ToEqual(new[] { "Containers: B | A", "Tiles: C | " });
        Expect(await GetSavedColumnIdsAsync()).ToEqual(new[] { "next", "start" });
    }

    [TestMethod("the page doesn't scroll when a column is dropped")]
    public async Task ThePageDoesntScrollWhenAColumnIsDropped()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        // A board taller than the window, scrolled down to its headings, where a page that was
        // shorter for a moment would scroll up, with the redraws held back as on a busier page.
        var scrollY = await Page.EvaluateAsync<double>("""
            () => {
                const renderVisualisation = window.Ren.VisualisationRenderer.renderVisualisation;

                const pending = new Set();

                window.Ren.VisualisationRenderer.renderVisualisation = (visualisation) => {

                    if (pending.has(visualisation)) return;

                    pending.add(visualisation);

                    setTimeout(() => {

                        pending.delete(visualisation);
                        renderVisualisation(visualisation);
                    }, 100);
                };

                const style = document.createElement("style");
                style.textContent = ".ren-task-lane__cell { min-height: 60rem; }";
                document.head.appendChild(style);

                document.body.style.paddingTop = "50rem";

                const header = document.querySelector(".ren-task-board__header");
                window.scrollTo(0, window.scrollY + header.getBoundingClientRect().top - 10);

                window.lowestScrollY = window.scrollY;
                window.addEventListener("scroll", () => {

                    window.lowestScrollY = Math.min(window.lowestScrollY, window.scrollY);
                });

                return window.scrollY;
            }
            """);

        Expect(scrollY).ToBeGreaterThan(0);

        var from = (await Page.Locator(".ren-task-board__column-heading").Nth(0).BoundingBoxAsync())!;
        var to = (await Page.Locator(".ren-task-board__column-heading").Nth(1).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 5);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-task-board__column-heading--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width - 5, to.Y + 5, new() { Steps = 10 });
        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(new[] { "Containers: B | A", "Tiles: C | " });

        Expect(await Page.EvaluateAsync<double>("() => window.lowestScrollY")).ToBe(scrollY);
    }

    [TestMethod("a column is resized by dragging its edge")]
    public async Task AColumnIsResizedByDraggingItsEdge()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var heading = Page.Locator(".ren-task-board__column-heading").Nth(0);
        var before = (await heading.BoundingBoxAsync())!;
        var handle = (await heading.Locator(".qa-ren-task-board-resize-handle").BoundingBoxAsync())!;
        var handleX = handle.X + handle.Width / 2;
        var handleY = handle.Y + handle.Height / 2;

        await Page.Mouse.MoveAsync(handleX, handleY);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(handleX + 80, handleY, new() { Steps = 5 });
        await Page.Mouse.UpAsync();

        var after = (await heading.BoundingBoxAsync())!;
        var tile = (await GetTile("A").BoundingBoxAsync())!;

        Expect(Math.Round(after.Width)).ToBe(Math.Round(before.Width + 80));
        Expect(Math.Round(tile.Width)).ToBe(Math.Round(after.Width));

        var saved = await Page.EvaluateAsync<string>("""
            () => window.Ren.ReportSerializer
                .getReportSettingsObject(false)
                .visualisations
                .find(visualisation => visualisation.visualisationId === "board")
                .columns[0]
                .width
            """);

        Expect(saved).ToBe("23rem");
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

    [TestMethod("a dragged task is put back where it was by its Reset")]
    public async Task ADraggedTaskIsPutBackWhereItWasByItsReset()
    {
        await Ren.OpenAsync(Fixture);
        await Poll(GetBoardAsync).ToEqual(StartingBoard);

        var from = (await GetTile("A").BoundingBoxAsync())!;
        var to = (await GetTile("B").BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 10);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width / 2, to.Y + 2, new() { Steps = 10 });
        await Page.Mouse.UpAsync();

        await Poll(GetBoardAsync).ToEqual(new[] { "Containers:  | A B", "Tiles: C | " });

        await GetTile("A").ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#visualisation-reset").ClickAsync();

        await Poll(GetBoardAsync).ToEqual(StartingBoard);
        Expect(await GetSavedTilesAsync()).ToEqual(new[]
        {
            "A lane-1 start 1",
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
