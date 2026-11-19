# Changelog

Each version's changes, newest first.  Ren follows semantic versioning, and the client library
and the NuGet package (`Ren`) always share a version (see "Versions" in
[docs/development.md](docs/development.md) for what counts as a breaking change).

## Unreleased

Add a settings window to date/value charts, opened from a cog beside their pickers.
Let date/value charts draw some series as pies beside others drawn as bars, lines or dots.
Rename the date/value chart menu's "Chart type" to "Draw as", and "Chart appearance" to "Appearance".
Put "Draw as" and "Labels" with a series' own items on its menu.
Offer a series' colour and axis on the chart settings window's Individual Series tab.
Replace the pie layout's preset hole sizes with a "Holes" toggle beside "Hole size...".
Shrink or abbreviate pie totals that don't fit their holes.
Move "Estimate last period" to the chart's Dates, off the series menus.
Tick the aggregation a chart series uses by default, not just one it's given.
Stop the chart settings window shifting when switching between its series tabs.
Show "Draw as" and "Labels" under Series on the All Series tab, as on Individual Series.
Leave bar-only and pie-only settings out of the chart settings window, not greyed out, when they don't apply.
Give a chart's legend entries the same menu as the series they name.
Add a Reset link to the chart settings window, undoing changes made since it was opened.
Offer "Subdivide by" and "Series shown" on the chart's menu and settings window, as the pickers do.
Let charts set how many subdivisions each bar or slice shows, with "Subdivisions shown".
Mark the settings a split series shares with the others split from its column.
Put those on the All Series tab instead where the data are split from one column.
Keep a date/value chart's Group by when its date column is set to None and back.
Move "Date column" to the Dates section, before "Group by".
Line up the chart settings window's checkboxes with its radio buttons.
Mark a series' highest and lowest at its last period's estimate, where it has one.
Add "Gap between periods" to the chart's bar layout, to set periods apart.
Add a settings cog beside each filter module item's heading, opening a window of its settings or all items'.
Start a new filter module item with the last item's value settings.
Make a hierarchical filter module item's Sort toggle sort all its levels.
Move a filter module item's "Group by" into its menu's Values section, with "Invert grouping" and "Ungroup" in its submenu.
Add "Thousands" Number and Currency formats, showing every figure in thousands (£32k).
Keep a date/value chart's "Split data" and "Subdivide by" settings as one dropdown each.
Add "Subdivision name format" and "Subdivision value format" to date/value charts.

## 1.1.20 (2026-11-20)

Fix the message bus sometimes losing events passed between parts of a report.
Fix large grids being slow when the page has no format functions script element.
Update date/value charts faster after a filter change, by reusing their legend layouts.
Redraw date/value charts faster, as each is no longer styled twice.
Redraw date/value charts faster, as drag handles are only added once the pointer is over a chart.
After a filter change, redraw the visualisations in view first, showing each as it's done.
Update date/value charts faster when their points come out of date order.
Grey out visualisations catching up with a filter change only after half a second.
Lay out date/value chart labels faster, measuring axis and value labels together.
Stop naming the released branch in release commits and ren.manifest.json.
Fix the variations window's buttons for a name with quotes, which broke them or could run script.
Reload the page when its dates or parameters change if Ren made it the report context, rather than putting it inside itself.
Leave a date/value chart's first period unlabelled when it has no change on the period before.

## 1.1.19 (2026-11-17)

Scroll grids more smoothly, as scrolling one no longer restyles every grid on the page.
Scroll very large grids faster by finding the rows in view without checking every row.
Draw grouped grids faster, as each data row is now drawn once rather than once per grouping.
Scroll very wide grids much faster, as only the columns near the view are drawn.
Draw group rows that mix their data rows' backgrounds faster, especially in several columns.

## 1.1.18 (2026-11-16)

Render large grids faster by caching the results of parsing HTML from cell values.
Keep scrolling through large grids fast by removing rows far out of view from the page.
Fix missing grid lines and a jittery Bottom Fixed totals row far down very large grids.

## 1.1.17 (2026-11-15)

Fix columns-and-rows data with no rows failing to load, as its columns were lost.

## 1.1.16 (2026-11-15)

Omit groupByColumnIndexes from older date/value charts' saved settings.

## 1.1.15 (2026-11-15)

Omit groupByColumnIndexes from client-side date/value charts' saved settings.
Prevent lock errors upon building a release while the ren-watch and ren-serve VS Code tasks are running.

## 1.1.14 (2026-11-15)

Omit date/value charts' groupByColumnIndexes from saved settings, as they are rebuilt from the column names.
Omit visualisations' containingReportUrl from saved settings, as the saved value is not used.

## 1.1.13 (2026-11-14)

In publish.yml only run client tests against minified statics, to speed up releases.

## 1.1.12 (2026-11-14)

Fix embedded reports' scripts not finding their elements when the report was already loaded.
Fix Ren.Log.warning logging entries with no log level, as it used Ren.LogLevelEnum.Warning rather than Warn.

## 1.1.11 (2026-11-13)

Add the released branch to ren.manifest.json, for settings file versioning code to use.

## 1.1.10 (2026-11-12)

Show a chart's cross filters in its filters subtitle, first and as chips that clear them on hover, rather than again in its corner.
Retry minifying for a few seconds when another process briefly has the minified file open, rather than failing the build.
Fix cross filter chips covering the focus mode button in popped-in windows, so it can't be clicked.
Stop tracing browser tests on CI too, as it nearly doubled the tests' time there.  Set REN_TEST_TRACE=1 to trace them.
Leave a filter's heading out of a filter summary where each of its values holds a word of the heading, so "New / Returning" filtered to "New customers" reads "New customers".
Separate the filters in a chart's filters subtitle with the filter symbol rather than a pipe, and lead it with the symbol where no cross filter chip does.
Show cross filter chips without a background or border.
Add followChartDates to filter modules, so their options and counts cover only the dates their source group's charts show, following a multi-chart's slider.

## 1.1.9 (2026-11-12)

Add diagnostic code for flaky test.
Keep a Playwright trace of each failed browser test when REN_TEST_TRACE=1 (as on CI), as tracing every test made full local runs time out.
Avoid chart jumping when filter summary appears.
Update README.
Fix pie labels outside the pies disappearing when the pies are close together or their charts narrow.
Keep the build watcher running when a build fails or files are locked.
Improve display of Boolean filters in filter summaries.
Shade the bands of a subdivided bar or pie slice alternately a little darker and lighter, so neighbouring bands stand out from each other.
Improve pie label positioning.

## 1.1.8 (2026-11-11)

Fix flaky test.
Run tests and check they pass before publishing to Nuget.org.

## 1.1.7 (2026-11-11)

Amend GitHub Actions configuration.

## 1.1.6 (2026-11-11)

Set up GitHub Action to publish releases to Nuget.org.

## 1.1.5 (2026-11-11)

Fix filter saving when no data grid exists for the data source.
Add options for initial expansion of hierarchical filter module items.
Add option to show Boolean filter module items as checkboxes.
Add style options to filter module items.
Make expliticly-sized filter module items get wider if they need to.
Add option to multi-charts to reserve a gap for periods with no data.

## 1.1.4 (2026-11-10)

Update Nuget package description.

## 1.1.3 (2026-11-10)

Fix errors with pack command.
Make minor tweaks to JS code layout + comments.
Add progress indicator when running Ren tests.

## 1.1.2 (2026-11-10)

Fix pie chart subdivision hit testing (mouse position wasn't mapping to correct subdivision).
Show tooltips when data grid cell values are truncated.

## 1.1.1 (2026-11-08)

The NuGet package carries the client's built files, and build targets that copy them into a web
project (ASP.NET or ASP.NET Core) before each build, as its content, so a site gets the files for
the version it references and deploys them with everything else (see "Using Ren in a site" in the
README).  With `RenRepo` set to a clone of Ren, a site whose branch has the same name as the
clone's takes the files from the clone's `dist/` instead.  The .NET library itself is the same as
1.0.0's.

Building, testing and releasing need only the .NET 8 SDK, with
`dotnet run --project build/Ren.Build -- <command>` (see the README):
- `build` and `watch` build the client into `dist/`.  The build downloads the pinned Dart Sass,
  Lightning CSS and esbuild it uses into `.tools/`, and checks their hashes.
- Each build names its version in the licence comment at the top of `ren.js` and `ren.css`, and
  writes `ren.manifest.json` with the version, the commit, whether it's a release, and each
  file's hash.  A build that isn't of a tagged, clean commit has a version like
  `1.1.0+dev.4f2a9c1`.  The version is in `VERSION`, which the client build and the .NET package
  both read.
- `--statics` (or `REN_STATICS`) copies each build into one or more host folders, but only
  into a folder in a git repo while that repo has a branch checked out with the same name as
  Ren's, as the host's build only keeps the files then.  The watcher can be left running when the
  host switches branch.
- `test` and `ci` run the client tests, which are C# (MSTest and Playwright for .NET), in
  `test/Ren.Client.Tests`.  The unit tests in `test/*.test.js` run in Chrome, each file as one
  test.  CI runs them on the minified files too.
- `release <version>` dates the changelog, sets the version, runs CI, and commits and tags it
  as "Ren <version>".
  `pack <version>` builds a release from its tag and packs it as the NuGet package, and
  `export <version> <dir>` builds one and copies it into a host.

## 1.0.0 (2026-11-01)

The first release on its own.  Ren grew up inside a reporting system that's in daily use, so 1.0
isn't new code, but it is the first time it's been separate from that system, with its own build,
tests and docs.

Every class Ren defines or looks for is prefixed, so none can clash with a host page's own
classes.  Most of them weren't while Ren was part of that system, so a page moving over needs
its markup, its overrides of Ren's styles and any script that selects Ren's elements updating.
- `ren-` goes at the front: `ren-data-grid__cell--group`, the date/value chart's `ren-bar`, the
  data grid's per-cell `ren-r-3`, `ren-c-0` and `ren-h`, and generated GUID classes such as
  `ren-data-grid-<guid>`.  The chart axes' `tick` and `domain`, d3's names for them, aren't
  prefixed.
- The `js-*` hooks are `js-ren-*`, including the ones a page puts on its own elements
  (`js-ren-report-context`, `js-ren-report-settings`, `js-ren-report-settings-file` and so on),
  and the `qa-*` test hooks are `qa-ren-*`.
- `report-context-<guid>`, which the host page provides, syntax-highlighting tokens, element
  names and ids aren't prefixed.

[Class renames](docs/class-renames.md) lists every old and new name.

What that system called a "Razor view-based report" is a web report here, since nothing in Ren
cares how the host renders its pages:
- Its classes say `web-report` where they said `razor-view`, `razor-view-report` or
  `razor-view-based-report`: `ren-web-report-page`, `js-ren-web-report-download-module`.
- `Ren.WebReports` (with `getWebReportName`) and `Ren.WebReportDisplay` are what were
  `Ren.RazorViewBasedReports` and `Ren.RazorViewReportDisplay`.
- `ren.config`'s preset settings endpoints are `loadWebReportSettings` and
  `saveWebReportSettings`.
- A visualisation from the report's own markup is `isMarkupOriginVisualisation`.

The charts draw their SVG as plain DOM rather than with d3, with d3's scales, ticks and curves
ported across (so the axes pick the same ticks), so a page doesn't need d3.  For anything that
reached into the charts:
- `Ren.ChartUtils`, `Ren.ChartProps.setScales` and `Ren.DateValueChart_BarResize` are gone.
- A chart's `props.svg`, `props.chartGroup` and `props.defs` are SVG elements rather than d3
  selections, and `Ren.ChartSvgAxis` and `Ren.ChartSvgSeries` take and return elements.
- A series' `curve` is `Ren.ChartPaths.LINEAR` or `Ren.ChartPaths.BASIS`.
- The datum an element was drawn for is on `renDatum` (read it with `Ren.Svg.getDatum`) rather
  than `__data__`.

The client (`ren.js` and `ren.css`):
- Data grids with grouping, multi-level sorting, aggregation, calculated columns, column filters
  (including exclusion filters), format functions and copying to the clipboard.
- Date/value charts, with split series, date and calendar markers (whose labels can show on
  hover), and axis value formats.
- The change chart (`ren-change-chart`), for how a value moved between two periods across a list
  of things: each label gets a row with an arrow from its before value to its after value, all on
  one axis, so the big movers stand out.  `before-label` and `after-label` name the two periods
  in its legend and tooltips, and clicking a label or an arrow can open a popup report from a
  URL template filled in from the row.  It's deliberately simple for now, with no sorting or
  context-menu settings of its own.
- Filter modules, with cross-filtering between them.
- Report settings that can be saved and loaded, and popups and tabbed modules to show them in.
- Data sources as JSON (a tabular data set collection, columns and rows, or an array of objects),
  TSV, or renpack, the binary format the .NET package writes.
- `ren.config`, described by `ren.config.schema.json`, for endpoints, links, menus, the theme,
  working days and feature flags, and `Ren.configure()` for setting the same from script.
- `formatting` in ren.config, which sets the currency prefix and suffix, the decimal and
  thousands separators, the minus sign, and the date and date-time formats.
  `Ren.ValueFormatter.formatDate`, `formatDateTime` and `getExcelFormats` use them, as do the
  date format function templates.
- Its own HTML templates and format functions, so a page doesn't need to provide any.
- Visualisations that contain others.  A container has a `visualisationId`, and each child names
  it with `containerVisualisationId`, picks one of its slots with `containerSlot` when it has
  more than one, and is placed by its `containerOrder`, to any depth.  A container type that
  declares `containerOptions` lets the user add, remove, reorder and drag its children (but not
  in a downloaded report).
- `LinkTile` (an image and a title, the whole tile a link) and `TileGroup` (link tiles under a
  heading, in wrapping rows).
- `TaskBoard` (column headings over task lanes) and `TaskLane` (a lane with a cell for each
  column, which task tiles are added to and dragged between).

The .NET package (`Ren`, for netstandard2.0 and .NET Framework 4.8):
- `TabularDataSetCollectionBuilder`, which builds a collection from an `IDataReader`, a
  `DataTable` or a list of objects.
- Compression of a collection's columns into a shared dictionary.
- Writers for renpack (version 1, `application/x-ren-tabular-v1`) and JSON.

Putting it on a page of your own (see [docs/security.md](docs/security.md)):
- `ren.js` runs in strict mode and inside a function, so the only globals it adds are
  `window.Ren` and Prism's `window.Prism`.  It loads as a classic script, as a
  `<script type="module">`, inside a bundle, or after the page has loaded (injected, lazy-loaded
  or by a single-page app), when it starts up straight away.
- The user and session guids Ren's log records are kept in the page's storage under
  `ren-user-guid` and `ren-session-guid`, and the Editor's dark mode under `ren-dark-mode`.
  Those kept under the older `userGuid`, `sessionGuid` and `DarkMode` are moved to them.  The
  page's own guid is no longer `window.pageGuid`.  The user and session guids are only put in
  storage where `renLogInsert` is configured, as nothing else uses them, and they're made the
  first time an entry is logged.
- `ren.esm.js` is `ren.js` as an ES module, with `Ren` as its default export and as `Ren`, and
  `ren.js` exports `Ren` where it's loaded as a CommonJS module.  `Ren` is `window.Ren` either
  way.
- `ren.min.js`, `ren.esm.min.js` and `ren.min.css` are the same, minified with esbuild, each with
  a source map back to the original sources (about 1.5 MB of script rather than 5 MB).
- `ren.css` only styles Ren's own elements.  While Ren was part of that system it also set the
  page's `body` margin (`0 0.5rem 0.5rem`) and a pointer cursor on every button, so a page that
  relied on them needs to set them itself.
- Ren leaves the rest of the page alone too.  Resizing a compare filter's value box and dragging a
  data grid column put back the body's own `cursor` and `user-select` afterwards, rather than
  clearing them.  The class a container child's drag puts on the page, and the blank drag images
  of filter module items and grouping editor tiles, go on the report context rather than the
  body, where there is one.
- Ren names none of that system's own data sources, and leaves its setup script status module
  with it.  A named data source that should always be fetched afresh, or that the page polls in
  the background (kept out of the log, with its failures out of sight), says so with
  `Ren.Extensions.registerNamedDataSourceOptions(name, { noCache, quiet })`.
- `<ren-date-selector>` and `<ren-date-range-summary>` need no data source.  They show the
  report's own dates, those a data source would be requested with, where in that system they
  fetched its `DateSelector_Data` and `DateRangeSummary_Data`.  A host that works the dates out on
  its server gives every one of them a data source with
  `Ren.Extensions.registerVisualisationDefaults(typeName, defaults)`, which sets the options every
  visualisation of a type starts with; an element's own `src`, `fetch-uri` or `data-source-name`
  still wins.  Both render in a downloaded report whose data source isn't there.
- Numbers aren't formatted with d3 any more.  `Ren.ValueFormatter.locale.format` still takes the
  d3-style specifiers Ren uses (such as `"$,.2f"`, `"0.0%"` and `".1~f"`), but throws for others.
  Excel exports' DateTime columns now include the time.
- A named data source is given with `data-source-name`.  `sql-filename`, its name in that system,
  still works, but `data-source-name` wins where an element has both.
- The global error handler listens for `error` and `unhandledrejection` alongside the page's own
  handlers rather than replacing them, and only where `renLogInsert` is configured.  It no longer
  replaces `console.error`: Ren logs its own errors itself, and the page's `console.error` calls
  are left alone.  The `globalErrorHandler: false` feature flag turns it off, and
  `saveShortcut: false` leaves Ctrl+S to the browser rather than saving the report's settings.
- The library's own HTML templates are compiled into functions by the build, so a report that
  uses no functions, and none of the page's own templates, renders on a page whose content
  security policy doesn't allow `unsafe-eval`.  Format, calculation and binning functions, and the
  page's own templates, are compiled when they're used.  `Ren.Extensions.registerHtmlTemplate`
  takes a function or the template's source.  Turning rows into objects falls back to building
  each object by assignment where the policy blocks the generated function.
- The `userFunctions: false` feature flag stops Ren running code that comes with a report rather
  than with the page: functions and HTML written into report settings or the function editor,
  functions a report's settings add, and parameter values from report settings that could run as
  code once written into a function (anything with ``= ( ) [ ] { } ; ' " ` \`` or a line break).
  Each shows `#VALUE!`, and the function editor says it's turned off rather than opening.  The
  library's own functions and templates, and those the page provides itself (its template elements
  and `Ren.Extensions` registrations), still run.  It's on by default.

Notes:
- Ren needs write-excel-file 1.4 on the page alongside it.  `ren.js` has Prism built in.
- A build of 1.0.0 of the NuGet package went to a private feed before this release, without the
  package readme.  The code in it is the same.
