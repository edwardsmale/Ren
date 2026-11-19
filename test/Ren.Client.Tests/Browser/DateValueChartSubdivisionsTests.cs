using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover subdividing a date/value chart's bars and pie slices by a further column,
// chosen from the "Subdivide by" picker at its top right.  Each band is a white-bordered mark over
// its bar or slice, and can be labelled with its name or value.
[TestClass]
public class DateValueChartSubdivisionsTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";
    private const string SavedChartFixture = "ported/DateValueChartTest11.html";

    private const string Picker = ".ren-date-value-chart-column-pickers__picker";
    private const string BarMark = ".ren-bar-subdivision";
    private const string PieMark = ".ren-pie-subdivision";
    private const string Label = ".ren-subdivision-label";

    // The chart is itself a popup, so the rows popup is the one not holding it.
    private const string RowsPopup = ".ren-report-popup-window:not(:has(.ren-visualisation--date-value-chart))";

    private const string ClickableMenuItem = ".ren-context-menu .ren-context-menu__item--clickable";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task ClickMenuItemAsync(string text)
    {
        await Ren.Root.Locator(ClickableMenuItem)
            .Filter(new() { HasTextRegex = new Regex("^\\s*" + text + "\\s*$") })
            .First
            .ClickAsync();

        await Ren.WaitUntilLoadedAsync();
    }

    private ILocator SubdividePicker => Ren.Root.Locator(Picker).Filter(new() { HasText = "Subdivide by:" });

    private async Task SubdivideByAsync(string column)
    {
        await SubdividePicker.ClickAsync();
        await ClickMenuItemAsync(column);
    }

    private async Task<string> PickerTextAsync() => await SubdividePicker.TextContentAsync() ?? "";

    private Task<string[]> VisibleLabelsAsync() => EvaluateAsync<string[]>("""
        (selector) => Array.from(document.querySelectorAll(selector))
            .filter(label => label.style.display !== "none")
            .map(label => label.textContent)
        """, Label);

    private async Task HideColumnAsync(string columnHeading)
    {
        await Ren.Report.ClickAsync(".qa-ren-show-hide-columns-link");
        await Ren.Root
            .Locator(".qa-ren-show-hide-columns-list-item--" + columnHeading.Replace(" ", ""))
            .First
            .DispatchEventAsync("mousedown", new { bubbles = true });
        await Ren.WaitUntilLoadedAsync();
        await Ren.Root.ClickAsync(".qa-ren-show-hide-columns-window .qa-ren-popup-window-close-button");
    }

    // A hidden column's heading stays in the page with no width, so only those with one are shown.
    private Task<string[]> ShownHeadingsAsync() => EvaluateAsync<string[]>("""
        () => Array.from(document.querySelectorAll(".ren-data-grid__cell.ren-h"))
            .filter(cell => cell.getBoundingClientRect().width > 0)
            .map(cell => cell.textContent.replace(/[^\w\s]/g, "").trim())
        """);

    private record Band(double X, double Y, string Label, string Date);

    // Gets a point on the largest band of those in a bar or slice with more than one, and what the band
    // covers, the title reading "<value of the column>: <value> (<share>)" on its last line.
    private Task<Band?> ReadBandAsync(string markSelector) => EvaluateAsync<Band?>("""
        (selector) => {
            const marks = Array.from(document.querySelectorAll(selector));
            const getArea = (mark) => {
                const box = mark.getBoundingClientRect();

                return box.width * box.height;
            };
            const candidates = marks
                .filter(mark => marks.some(other => other !== mark && other.parentNode === mark.parentNode))
                .sort((a, b) => getArea(b) - getArea(a));

            if (candidates.length === 0) return null;

            const mark = candidates[0];
            const box = mark.getBoundingClientRect();
            const isOnMark = (x, y) => document.elementFromPoint(x, y) === mark;

            // Mouse events report whole pixels, and a band's edge is its neighbour's border, so the point
            // is a whole pixel with the band all around it.
            for (let y = Math.ceil(box.top); y < box.bottom; y++) {
                for (let x = Math.ceil(box.left); x < box.right; x++) {
                    if (isOnMark(x, y) && isOnMark(x - 2, y) && isOnMark(x + 2, y) && isOnMark(x, y - 2) && isOnMark(x, y + 2)) {
                        const lines = mark.querySelector("title").textContent.split("\n");

                        return {
                            x,
                            y,
                            label: lines[lines.length - 1].replace(/: [^:]*$/, ""),
                            date: lines[0]
                        };
                    }
                }
            }

            return null;
        }
        """, markSelector);

    private async Task<Band> FindBandAsync(string markSelector)
    {
        Band? band = null;

        await Poll(async () =>
        {
            band = await ReadBandAsync(markSelector);

            return band != null;
        }).ToBe(true);

        return band!;
    }

    // Gets the texts of a column's data cells in the rows popup, which keeps the rows it leaves out
    // level with its heading row, or null while its heading isn't shown.
    private Task<string[]?> RowsPopupColumnTextsAsync(string columnHeading) => EvaluateAsync<string[]?>("""
        ({ popup, heading }) => {
            const headingCells = Array.from(document.querySelectorAll(popup + " .ren-data-grid__cell.ren-h"));
            const headingCell = headingCells.find(cell =>
                cell.getBoundingClientRect().width > 0
                && cell.textContent.replace(/[^\w\s]/g, "").trim() === heading);

            if (!headingCell) return null;

            const columnClass = Array.from(headingCell.classList).find(c => /^ren-c-\d+$/.test(c));
            const headingTop = headingCell.getBoundingClientRect().top;

            return Array.from(document.querySelectorAll(
                `${popup} .ren-data-grid__cell.${columnClass}:not(.ren-h)` + ":not(.ren-data-grid__cell--group)"
            ))
                .filter(cell => cell.getBoundingClientRect().top > headingTop)
                .map(cell => cell.textContent.trim());
        }
        """, new { popup = RowsPopup, heading = columnHeading });

    private async Task<string[]> DistinctRowsPopupColumnTextsAsync(string columnHeading) =>
        (await RowsPopupColumnTextsAsync(columnHeading) ?? []).Distinct().ToArray();

    private Task ExpectRowsPopupFilteredToAsync(Band band) =>
        Poll(() => DistinctRowsPopupColumnTextsAsync("Search Terms")).ToEqual(new[] { band.Label });

    private Task DoubleClickAsync(Band band) => Page.Mouse.DblClickAsync((float)band.X, (float)band.Y);

    [TestMethod("double-clicking a band opens its bar's rows, filtered to the band")]
    public async Task DoubleClickingABand_OpensItsBarsRowsFilteredToTheBand()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        var band = await FindBandAsync(BarMark);

        await DoubleClickAsync(band);

        await ExpectRowsPopupFilteredToAsync(band);

        await Expect(Page.Locator(RowsPopup + " .ren-report-popup-window__title-bar-caption"))
            .ToHaveTextAsync(band.Date + " Unique Searches Per Day");

        Expect((await DistinctRowsPopupColumnTextsAsync("CreatedOn")).Length).ToBe(1);
    }

    [TestMethod("clearing a band's filter shows the rows of its whole bar")]
    public async Task ClearingABandsFilter_ShowsTheRowsOfItsWholeBar()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        var band = await FindBandAsync(BarMark);

        await DoubleClickAsync(band);

        await ExpectRowsPopupFilteredToAsync(band);

        var filteredDates = await DistinctRowsPopupColumnTextsAsync("CreatedOn");

        await Page.EvaluateAsync("""
            () => {
                const gridSets = Ren.VisualisationCollection.getVisualisations()
                    .filter(visualisation => visualisation.instance?.dataGrids?.length);

                gridSets[gridSets.length - 1].instance.dataGrids[0]
                    .dataGroupingSettings.sortFilterGroup.removeColumnFilter("Search Terms");
            }
            """);

        await Poll(async () => (await DistinctRowsPopupColumnTextsAsync("Search Terms")).Length).ToBeGreaterThan(1);

        Expect(await DistinctRowsPopupColumnTextsAsync("CreatedOn")).ToEqual(filteredDates);
    }

    [TestMethod("the subdividing column is shown in the rows popup, though hidden")]
    public async Task SubdividingColumn_ShownInTheRowsPopupThoughHidden()
    {
        await Ren.OpenAsync(Fixture);
        await HideColumnAsync("Search Terms");

        await Poll(async () => (await ShownHeadingsAsync()).Contains("Search Terms")).ToBe(false);

        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await SubdivideByAsync("Search Terms");

        var band = await FindBandAsync(BarMark);

        await DoubleClickAsync(band);

        await ExpectRowsPopupFilteredToAsync(band);
    }

    [TestMethod("double-clicking a slice's band opens its rows, filtered to the band")]
    public async Task DoubleClickingASlicesBand_OpensItsRowsFilteredToTheBand()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await SubdivideByAsync("Search Terms");

        await Poll(() => Ren.Root.Locator(PieMark).CountAsync()).ToBeGreaterThan(1);

        var band = await FindBandAsync(PieMark);

        await DoubleClickAsync(band);

        await ExpectRowsPopupFilteredToAsync(band);
    }

    [TestMethod("Show rows on a band is filtered to the band, as double-clicking it is")]
    public async Task ShowRowsOnABand_IsFilteredToTheBand()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        var band = await FindBandAsync(BarMark);

        await Page.Mouse.ClickAsync((float)band.X, (float)band.Y, new() { Button = MouseButton.Right });
        await Ren.Root.ClickAsync("#chart-show-data-point-rows");

        await ExpectRowsPopupFilteredToAsync(band);
    }

    [TestMethod("the picker shows no subdivision until one is chosen")]
    public async Task Picker_ShowsNoSubdivisionUntilOneIsChosen()
    {
        await CreateChartAsync();

        Expect(await PickerTextAsync()).ToContain("None");
        await Expect(Ren.Root.Locator(BarMark)).ToHaveCountAsync(0);
    }

    private record MarkStyle(string Stroke, string Fill);

    private record Grooves(int Bands, int Lines, string CreaseStroke, string CreasePointerEvents, string HighlightStroke, double HighlightOffset);

    private record Coverage(int Count, double Top, double Bottom);

    [TestMethod("choosing a column draws grooved bands that fill each bar")]
    public async Task ChoosingAColumn_DrawsGroovedBandsThatFillEachBar()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        Expect(await PickerTextAsync()).ToContain("Search Terms");

        var marks = Ren.Root.Locator(BarMark);

        await Poll(() => marks.CountAsync()).ToBeGreaterThan(6);

        var style = await marks.First.EvaluateAsAsync<MarkStyle>("""
            (mark) => {
                const computed = window.getComputedStyle(mark);

                return { stroke: computed.stroke, fill: computed.fill };
            }
            """);

        Expect(style.Stroke).ToBe("none");
        // The largest band is washed a little darker than its bar, the rest lighter in turn.
        Expect(style.Fill).ToMatch(new Regex(@"^rgba\(0, 0, 0, 0\.\d+\)$"));

        // A groove runs between each pair of neighbouring bands, a dark crease with a highlight a
        // pixel below it, and leaves clicks to the bands beneath it.
        var grooves = await EvaluateAsync<Grooves>("""
            (selector) => {
                const bars = Array.from(document.querySelectorAll(".ren-bar.ren-vertical"));
                const bar = bars.find(node => node.querySelectorAll(selector).length > 1);
                const crease = bar.querySelector(".ren-subdivision-groove");
                const highlight = bar.querySelector(".ren-subdivision-groove-highlight");
                const creaseStyle = window.getComputedStyle(crease);

                return {
                    bands: bar.querySelectorAll(selector).length,
                    lines: (crease.getAttribute("d").match(/M/g) || []).length,
                    creaseStroke: creaseStyle.stroke,
                    creasePointerEvents: creaseStyle.pointerEvents,
                    highlightStroke: window.getComputedStyle(highlight).stroke,
                    highlightOffset: highlight.getBoundingClientRect().top - crease.getBoundingClientRect().top
                };
            }
            """, BarMark);

        // The crease and highlight are a darker and a lighter shade of the series' colour.
        static int[] Components(string stroke)
        {
            var match = Regex.Match(stroke, @"^rgb\((\d+), (\d+), (\d+)\)$");

            return match.Success ? match.Groups.Values.Skip(1).Select(group => int.Parse(group.Value)).ToArray() : [];
        }

        var crease = Components(grooves.CreaseStroke);
        var highlight = Components(grooves.HighlightStroke);

        Expect(grooves.Lines).ToBe(grooves.Bands - 1);
        Expect(crease.Length).ToBe(3);
        Expect(highlight.Length).ToBe(3);
        Expect(crease.Distinct().Count()).ToBeGreaterThan(1);
        Expect(highlight.Sum()).ToBeGreaterThan(crease.Sum());
        Expect(grooves.CreasePointerEvents).ToBe("none");
        Expect(Math.Abs(grooves.HighlightOffset - 1)).ToBeLessThan(0.1);

        // Together the bands of a bar cover it, from its baseline to its end.
        var coverage = await EvaluateAsync<Coverage>("""
            (selector) => {
                const bar = document.querySelector(".ren-bar.ren-vertical");
                const barPath = bar.querySelector(".ren-data-series__bar");
                const barBox = barPath.getBoundingClientRect();
                const boxes = Array.from(bar.parentNode.querySelectorAll(selector))
                    .filter(mark => mark.parentNode === bar)
                    .map(mark => mark.getBoundingClientRect());

                return {
                    count: boxes.length,
                    top: Math.min.apply(null, boxes.map(box => box.top)) - barBox.top,
                    bottom: Math.max.apply(null, boxes.map(box => box.bottom)) - barBox.bottom
                };
            }
            """, BarMark);

        Expect(coverage.Count).ToBeGreaterThan(0);
        Expect(Math.Abs(coverage.Top)).ToBeLessThan(2);
        Expect(Math.Abs(coverage.Bottom)).ToBeLessThan(2);
    }

    [TestMethod("a band's title names its value of the column")]
    public async Task ABandsTitle_NamesItsValueOfTheColumn()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        var title = await Ren.Root.Locator(BarMark + " title").First.TextContentAsync();

        Expect(title).ToMatch(new Regex(@": .*\(.*%\)$"));
    }

    [TestMethod("the column chosen is not offered to split by, and None clears the bands")]
    public async Task TheColumnChosen_NotOfferedToSplitByAndNoneClearsTheBands()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        await DateValueChart.HoverMenuPathAsync(Ren, "Split data");

        var splitItems = await EvaluateAsync<string[]>("""
            () => {
                const menus = document.querySelectorAll(".ren-context-menu");

                return Array.from(menus[menus.length - 1].querySelectorAll(".ren-context-menu__item--clickable"))
                    .map(item => item.textContent.trim());
            }
            """);

        Expect(splitItems).Not.ToContain("Search Terms");

        await Page.Keyboard.PressAsync("Escape");
        await SubdivideByAsync("None");

        await Expect(Ren.Root.Locator(BarMark)).ToHaveCountAsync(0);
    }

    [TestMethod("bands are labelled with their names until labels are turned off")]
    public async Task Bands_LabelledWithTheirNamesUntilLabelsAreTurnedOff()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        await Poll(async () => (await VisibleLabelsAsync()).Length).ToBeGreaterThan(0);

        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "None");

        await Poll(async () => (await VisibleLabelsAsync()).Length).ToBe(0);
    }

    // The items of the open menus, once the Labels submenu is open.
    private async Task<string[]> LabelsMenuTextsAsync()
    {
        await DateValueChart.HoverMenuPathAsync(Ren, "Labels", "Subdivision labels");

        var texts = await MenuItemTextsAsync();

        await Page.Keyboard.PressAsync("Escape");

        return texts;
    }

    [TestMethod("only the subdivision formats for what the labels show are offered")]
    public async Task SubdivisionFormats_OnlyThoseForWhatTheLabelsShowAreOffered()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");

        var names = await LabelsMenuTextsAsync();

        Expect(names).ToContain("Subdivision name format");
        Expect(names).Not.ToContain("Subdivision value format");

        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "Values");

        var values = await LabelsMenuTextsAsync();

        Expect(values).Not.ToContain("Subdivision name format");
        Expect(values).ToContain("Subdivision value format");

        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "Names and values");

        var both = await LabelsMenuTextsAsync();

        Expect(both).ToContain("Subdivision name format");
        Expect(both).ToContain("Subdivision value format");
    }

    // The shared formats' "Normal" counts an unset format as its own, so isn't ticked beside the
    // value format's "Same as series", nor offered twice for names.
    // The menus above the submenu have ticked items of their own, so only these are looked at.
    [TestMethod("an unset subdivision format ticks one item: Normal for names, Same as series for values")]
    public async Task UnsetSubdivisionFormats_TickOneItem()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");
        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "Names and values");

        await DateValueChart.HoverMenuPathAsync(Ren, "Labels", "Subdivision name format");
        Expect((await DateValueChart.TickedMenuItemsAsync(Ren)).Count(text => text == "Normal")).ToBe(1);
        await Page.Keyboard.PressAsync("Escape");

        await DateValueChart.HoverMenuPathAsync(Ren, "Labels", "Subdivision value format");
        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Same as series");
        Expect(ticked).Not.ToContain("Normal");
    }

    [TestMethod("Subdivision value format formats the bands' labelled values, and is saved")]
    public async Task SubdivisionValueFormat_FormatsTheLabelledValues()
    {
        await CreateChartAsync();
        await SubdivideByAsync("Search Terms");
        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "Values");

        await Poll(async () => (await VisibleLabelsAsync()).Length).ToBeGreaterThan(0);
        Expect((await VisibleLabelsAsync()).Any(label => label.EndsWith("k"))).ToBe(false);

        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision value format", "Number", "Thousands (32k)");

        await Poll(async () => (await VisibleLabelsAsync()).All(label => label.EndsWith("k"))).ToBe(true);
        Expect(await SavedSettingsTextAsync()).ToContain("\"subdivisionValueFormatFunction\":[{\"name\":\"number-thousands\"}]");

        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision value format", "Same as series");

        await Poll(async () => (await VisibleLabelsAsync()).Any(label => label.EndsWith("k"))).ToBe(false);
    }

    private record MarksBySeries(int Marks, int Series);

    [TestMethod("a split chart subdivides each series' bars by a further column")]
    public async Task ASplitChart_SubdividesEachSeriesBars()
    {
        await CreateChartAsync();
        await DateValueChart.SplitDataAsync(Ren, "Product Code");
        await SubdivideByAsync("Search Terms");

        var marksBySeries = await EvaluateAsync<MarksBySeries>("""
            (selector) => {
                const seriesNumbers = new Set();
                const marks = document.querySelectorAll(selector);

                marks.forEach(mark => seriesNumbers.add(mark.parentNode.getAttribute("data-series")));

                return { marks: marks.length, series: seriesNumbers.size };
            }
            """, BarMark);

        Expect(marksBySeries.Series).ToBeGreaterThan(1);
        Expect(marksBySeries.Marks).ToBeGreaterThan(marksBySeries.Series);
    }

    [TestMethod("a split pie chart subdivides each slice by a further column")]
    public async Task ASplitPieChart_SubdividesEachSlice()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await DateValueChart.SplitDataAsync(Ren, "Product Code");

        var slices = await Ren.Root.Locator(".ren-data-series__pie-slice").CountAsync();

        Expect(slices).ToBeGreaterThan(0);

        await SubdivideByAsync("Search Terms");

        await Poll(() => Ren.Root.Locator(PieMark).CountAsync()).ToBeGreaterThan(slices);
    }

    // Gets the texts of the clickable items of the open menus.
    private async Task<string[]> MenuItemTextsAsync() =>
        (await Ren.Root.Locator(ClickableMenuItem).AllTextContentsAsync()).Select(item => item.Trim()).ToArray();

    private void ExpectOnlyCategoryColumns(string[] items)
    {
        Expect(items).ToContain("Search Terms");
        Expect(items).ToContain("Active");
        Expect(items).Not.ToContain("Days Active");
        Expect(items).Not.ToContain("CreatedOn With Null");
    }

    [TestMethod("only category columns are offered to subdivide by")]
    public async Task OnlyCategoryColumns_OfferedToSubdivideBy()
    {
        await CreateChartAsync();
        await SubdividePicker.ClickAsync();

        ExpectOnlyCategoryColumns(await MenuItemTextsAsync());
    }

    [TestMethod("only category columns are offered to split the data by")]
    public async Task OnlyCategoryColumns_OfferedToSplitTheDataBy()
    {
        await CreateChartAsync();
        await DateValueChart.HoverMenuPathAsync(Ren, "Split data");

        ExpectOnlyCategoryColumns(await MenuItemTextsAsync());
    }

    [TestMethod("the column the data is split by is not offered to subdivide by")]
    public async Task TheSplitColumn_NotOfferedToSubdivideBy()
    {
        await CreateChartAsync();
        await DateValueChart.SplitDataAsync(Ren, "Product Code");

        await SubdividePicker.ClickAsync();

        var items = await MenuItemTextsAsync();

        Expect(items).ToContain("Search Terms");
        Expect(items).Not.ToContain("Product Code");
    }

    [TestMethod("the subdivide column and labels survive saving and reloading the report")]
    public async Task SubdivideColumnAndLabels_SurviveSavingAndReloading()
    {
        // A chart created from a grid's column is a popup, which isn't restored on reload, so this
        // uses a report whose chart is part of the page.
        await Ren.OpenAsync(SavedChartFixture);
        await SubdivideByAsync("Event");
        await DateValueChart.ClickMenuPathAsync(Ren, "Labels", "Subdivision labels", "Values");

        await Poll(() => Ren.Root.Locator(BarMark).CountAsync()).ToBeGreaterThan(0);

        var settings = await Ren.SavedSettingsAsync();
        var saved = Stringify(settings);

        Expect(saved).ToContain("\"subdivideColumn\":\"Event\"");
        Expect(saved).ToContain("\"subdivisionLabels\":\"values\"");

        await Ren.OpenWithSettingsAsync(SavedChartFixture, settings);

        await Poll(() => Ren.Root.Locator(BarMark).CountAsync()).ToBeGreaterThan(0);
        await Poll(async () => (await VisibleLabelsAsync()).Length).ToBeGreaterThan(0);
        Expect(await PickerTextAsync()).ToContain("Event");
    }

    [TestMethod("nothing about subdividing is saved for a chart that isn't subdivided")]
    public async Task NothingAboutSubdividing_SavedForAChartThatIsntSubdivided()
    {
        await CreateChartAsync();

        var saved = await SavedSettingsTextAsync();

        Expect(saved).Not.ToContain("subdivideColumn");
        Expect(saved).Not.ToContain("subdivisionLabels");
    }

    private record Share(string BackgroundFill, string SliceFill, bool IsBehindText, bool CoversText);

    [TestMethod("a share in a subdivided slice has a background of the slice's colour")]
    public async Task AShareInASubdividedSlice_HasABackgroundOfTheSlicesColour()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await SubdivideByAsync("Search Terms");

        await Poll(() => Ren.Root.Locator(PieMark).CountAsync()).ToBeGreaterThan(1);

        var shares = await EvaluateAsync<Share[]>("""
            () => {
                const groups = Array.from(document.querySelectorAll(
                    ".ren-pie-labels-layer > g > g:has(.ren-pie-share-background)"
                ));

                return groups.filter(group => group.style.display !== "none").map((group) => {
                    const series = group.parentNode.getAttribute("data-series");
                    const slice = document.querySelector(`.ren-pie-slice[data-series="${series}"] .ren-data-series__pie-slice`);
                    const background = group.querySelector(".ren-pie-share-background");
                    const backgroundBox = background.getBoundingClientRect();
                    const textBox = group.querySelector("text").getBoundingClientRect();

                    return {
                        backgroundFill: getComputedStyle(background).fill,
                        sliceFill: getComputedStyle(slice).fill,
                        isBehindText: background.nextElementSibling === group.querySelector("text"),
                        coversText: backgroundBox.left <= textBox.left && backgroundBox.right >= textBox.right
                    };
                });
            }
            """);

        Expect(shares.Length).ToBeGreaterThan(0);

        foreach (var share in shares)
        {
            Expect(share.BackgroundFill).ToBe(share.SliceFill);
            Expect(share.IsBehindText).ToBe(true);
            Expect(share.CoversText).ToBe(true);
        }
    }

    [TestMethod("a pie's band rules are scoped to its own chart")]
    public async Task APiesBandRules_AreScopedToItsOwnChart()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await SubdivideByAsync("Search Terms");

        await Poll(() => Ren.Root.Locator(PieMark).CountAsync()).ToBeGreaterThan(0);

        var unscopedRules = await EvaluateAsync<string[]>("""
            (selector) => {
                const stylesheets = Array.from(document.querySelectorAll("style"));
                const rules = [];

                for (let i = 0; i < stylesheets.length; i++) {
                    const cssRules = stylesheets[i].sheet ? stylesheets[i].sheet.cssRules : [];

                    for (let j = 0; j < cssRules.length; j++) {
                        const selectorText = cssRules[j].selectorText || "";
                        const selectors = selectorText.split(",");

                        for (let k = 0; k < selectors.length; k++) {
                            if (selectors[k].trim() === selector) rules.push(cssRules[j].cssText);
                        }
                    }
                }

                return rules;
            }
            """, PieMark);

        Expect(unscopedRules).ToEqual(Array.Empty<string>());
    }

    [TestMethod("pie slices are subdivided, and labelled within their bands")]
    public async Task PieSlices_SubdividedAndLabelledWithinTheirBands()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await SubdivideByAsync("Search Terms");

        await Poll(() => Ren.Root.Locator(PieMark).CountAsync()).ToBeGreaterThan(0);
        await Poll(async () => (await VisibleLabelsAsync()).Length).ToBeGreaterThan(0);
    }
}
