![Ren](images/ren-logo.png)

### Quick start

Ren finds everything it needs through the page's DOM, a `ren.config`, and some endpoints.

To get a grid on a page, you'll need to:
- Include `ren.css`
- Include `ren.js`
- Add a `<ren-grid>` element pointing at some data

#### A whole report

Create a page with HTML:

```html
<link rel="stylesheet" href="ren.css">

<script src="ren.js"></script>

<ren-grid src="/data/sales.json" show-row-and-column-headings />
```
On page load, Ren replaces `<ren-grid>` with a grid component using data fetched from your `src`
endpoint.

Ren needs no other scripts: it draws its charts and writes its Excel downloads itself, in the
browser.

In production, use `ren.min.js` and `ren.min.css`, which are the same, minified (about 1.8 MB
rather than 6 MB of script).  Each has a source map, so errors still point at Ren's own source.

To import Ren as an ES module, use `ren.esm.js` (or `ren.esm.min.js`):

```html
<script type="module">
    import Ren from "./ren.esm.js";

    Ren.configure({ featureFlags: { saveShortcut: false } });
</script>
```

A bundler can import `ren.esm.js` the same way, and `require()` of `ren.js` gets `Ren` as a
CommonJS module.  Either way `Ren` is also `window.Ren`, as the elements need it.

Putting Ren on a site of your own, with a content security policy, or where users can save
reports for each other, is covered in [security.md](security.md).

There are examples in `examples/`, one page per data format, all showing the same 15 rows of sales
data.  They need to be served over HTTP, because the pages can't fetch their data from `file://`,
so I've added a small server for them:

```
dotnet run --project build/Ren.Build -- build
dotnet run --project build/Ren.Build -- serve
```

Then open http://localhost:8080/examples/.

### Elements

Each `<ren-*>` element becomes a visualisation.  When the page is scanned, the element is replaced
with a `script.js-ren-report-settings` element holding the settings parsed from it, and a target element
for the visualisation to render into.  (The exceptions are the 'virtual' elements, such as
`<ren-data-source>` and `<ren-default-dates>`, which don't render anything, so they only get the
settings.)

The attributes are read like this:
- Attribute names are kebab-case, and become camel-case options, e.g. `show-row-and-column-headings`
  becomes `showRowAndColumnHeadings`.
- An attribute with no value, or `true`, means `true`.  `false` and `null` mean those values, and
  anything else is a string.
- Self-closing tags such as `<ren-grid ... />` are fine.  HTML5 doesn't actually support
  self-closing custom tags, so Ren fixes them up before it reads them.

Elements added to the page after it has loaded aren't picked up automatically; you have to ask for
a re-scan (see `scanPageForDataSources` under The message bus).

__Where the data comes from__

A visualisation gets its data from the first of these attributes that it has:
- `data-source-uri`: the URI as it is.  Nothing is added to it.
- `src` (or its longer name, `fetch-uri`): a URI, with the report's parameters added to it (see
  Parameters below).
- `data-source-name` (or its older name, `sql-filename`): a named data source.  The name is put
  on the end of the `namedDataSources` endpoint, and the report's parameters are added, as for
  `src`.

__Other common attributes__

- `id` gives the visualisation's saved settings a stable key.  Without one, the settings are keyed
  by the visualisation's type, data source name and position, so moving things around on the page can
  lose them.
- `data-format` says what format the data is in, rather than leaving Ren to work it out (see Data
  formats).
- `settings-group` shares the grouping, grid state and visualisation settings with the other
  visualisations in the same group.  `data-grouping-settings-group` and `grid-state-group` share
  just the one.
- `fill-available-space` sizes the visualisation to fill the space left in its container.
- `exclude-from-downloaded-reports` leaves the visualisation out when the report is downloaded.

__The elements__

The visualisations are `ren-grid`, `ren-key-value-grid`, `ren-date-value-chart`, `ren-calendar`,
`ren-word-cloud`, `ren-change-chart`, `ren-stat-bar`, `ren-filter-module`, `ren-filters-bar`,
`ren-paging-bar`, `ren-date-selector`, `ren-date-range-summary`, `ren-content-module`,
`ren-format-function-content-module`, `ren-html-content`, `ren-tabbed-module`,
`ren-expandable-module`, `ren-embedded-report`, `ren-parameters-module`,
`ren-uploaded-files-module`, `ren-tile-group`, `ren-link-tile`, `ren-task-board`, `ren-task-lane`
and `ren-task-tile`.  (The last five are containers or their children, which are easier to write
as report settings - see Containers.)

Each type's options are listed in its `availableOptions`, and the JSON settings editor shows them
too.

A change chart shows how something moved between two periods: a row per label, with an arrow from
its before value to its after value.  It picks the first text column as the labels and the first
two number columns as before and after, unless you name them.  Clicking a label or an arrow can
open a popup report, from a URL template filled in from the row:

```html
<ren-change-chart data-source-name="SearchTerms"
                  label-heading="SearchTerm" before-heading="RateBefore" after-heading="RateAfter"
                  before-label="Before" after-label="After"
                  value-format-function="percentage-no-dp"
                  label-popup-report="/SearchLog?SearchTerm={value}"
                  label-popup-report-title="Searches for {value}"
                  change-popup-report="/SearchTermDetail?SearchTerm={row.SearchTerm}" />
```

`{value}` is the label and `{row.Heading}` any of the row's values, with `{row.Heading:date}`
dropping a date's time.  A row missing a value its template takes isn't linked.

The legend and tooltips call the values by their columns' headings, unless you give them
`before-label` and `after-label`.

### Report contexts

A report context is the element that a report lives in.  The report's parameters, settings and data
all belong to its context, which is what allows one page to hold several reports.  (Popups and
embedded reports have their own contexts too.)

```html
<div class="js-ren-report-context"
     data-report-name="Sales/Overview"
     data-request-url="/Reports/Sales/Overview?region=North&startDate=2026-01-01">
    <script type="application/json" class="js-ren-input-parameters">{ "region": "North" }</script>

    <ren-grid data-source-name="Sales/Overview" />
</div>
```

The classes and attributes are:
- `js-ren-report-context` marks the element as a report context.
- `data-report-name` is the report's name, which its settings are saved under.
- `data-request-url` is the URL the report was requested with.  Its query parameters are the
  report's parameters.
- `data-report-context-guid` is added by Ren, to identify the context.
- `js-ren-report-context--on-page`, `js-ren-report-context--inside-popup` and
  `js-ren-report-context--embedded-report` say whether it's the page's own report, a report opened in a
  popup, or a report embedded in another.

On a page of your own, the easiest way to make one is a `<ren-report-context>` element, which Ren
turns into the div above when the page loads (keeping whatever's inside it):

```html
<ren-report-context report-name="SearchSynonyms">
    <ren-grid data-source-name="SearchSynonyms" />
</ren-report-context>
```

It's marked as the page's own report (`js-ren-report-context--on-page`), and its request URL is the
page's unless you give it a `request-url` attribute.  Any other attributes, such as an `id` or
`class`, are carried over to the div.

If there's no report context on the page, Ren makes the closest element that contains all of the
page's `<ren-*>` elements one (or the body, if there are none), so the rest of a host page's layout
is left alone.  The exception is a page served
by a host layout (i.e. one that defines `window.reportUrl`, see Page globals), since the layout is
expected to provide its own contexts.

### Parameters

__Input parameters__

The `script.js-ren-input-parameters` element inside the report context holds the request's parameters
as JSON.  Format functions and templates read them through `Ren.ReportInputParameters`.

You should leave out the parameters the host only uses to serve the page (`isPopup`,
`isEmbeddedReport`, `settingsName` and `isPreset`).

__Data source URI parameters__

When a visualisation's data comes from a `src` or `data-source-name`, these query parameters are
added to its URI:
- The report's query parameters, from `data-request-url`
- The element's own attributes that aren't options, so `<ren-grid src="/x" region="North" />`
  requests `/x?region=North`
- The dates: `startDate`, `endDate`, `compareStartDate` and `compareEndDate`, from the page's
  `<ren-default-dates>` or a date selector
- The uploaded file parameters, from an uploaded files module: `uploadedFile`, `uploadedFiles`,
  `uploadedFilesDelimiter`, `uploadedFilesHaveHeaderRows`, `uploadedFilesColumnHeadings`,
  `uploadedFilesSkipIISNoise` and `uploadedFilesApplyBSTCorrection`

All of the names are camel-cased.  Where the same parameter comes from more than one place, the
report's query parameters win over the attributes, and the attributes win over the dates.

Any parameter ending in `Date` is written as a sortable date (e.g. `2026-10-21`), and the query
string is sorted by name.  This means that the same request always ends up with the same URI, no
matter what order the parameters were added in.

__Default dates__

```html
<ren-default-dates date-range="L12M" whole-months />
```

This sets the dates for the report's data sources.  You can give a `start-date` and `end-date`, or
a `date-range` acronym such as `L12M` (the last 12 months), plus the `compare-` versions of each.
`whole-weeks`, `whole-months`, `whole-quarters`, `whole-years` and `up-to-today` round the dates.

`<ren-data-source>` takes the same date attributes, if a data source needs different dates to the
rest of the report.

### Report settings

Everything about a report's visualisations (what they show, and how they're grouped, filtered,
sorted and laid out) is held in report settings, which are JSON in `script.js-ren-report-settings`
elements:

```html
<script type="application/json" class="js-ren-report-settings">
{
    "visualisations": [{ "visualisationTypeName": "DataGrid", "targetSelector": "#sales" }],
    "dataSources": [{ "dataSourceUri": "/data/sales.json" }],
    "dataGroupingSettings": {},
    "gridState": {}
}
</script>
```

A few things to note:
- `visualisation` and `dataSource` can be single objects rather than arrays.
- All of the settings elements on the page are merged, in the order they appear.
- `<ren-*>` elements are turned into settings elements when the page is scanned (see Elements), so
  you can mix and match the two.
- Rather than writing settings into the page, it can name an endpoint that gives them, with
  `<ren-report-settings src="/reports/sales/settings" />`.  Ren fetches each of these before it
  reads the page's settings, and puts what the endpoint returns in a settings element where the
  `<ren-report-settings>` was.  An endpoint with no settings for the page answers with not found,
  nothing, or `null`, and the element is just removed.
- `js-ren-report-settings-file` marks the settings loaded from a saved file, as opposed to the ones the
  page was written with.  An embedded report's settings file is skipped, because the containing
  report's file already has its visualisations, and applying both would put two of each on the
  page.

__Settings stores__

Saved settings are kept in a settings store.  There are four kinds of saved settings: `preset` (the
report's own named presets), `user`, `default` (the report's default for everyone) and
`sqlBasedPreset`.

Which store is used depends on `settingsStore` in `ren.config`:
- `"http"` (the default) uses the settings endpoints (see Endpoints).
- `"localStorage"` keeps the settings in the browser, which is handy for a page without a server.
- Anything else is the name of a store registered with `Ren.Extensions.registerSettingsStore`.

### Containers

A visualisation can hold others.  I added this for menus of links and task boards, where the
page is really just a list of things the user wants to add to, take away from and shuffle about,
and having it in the report settings means all of that gets saved like any other change.

It works by ID rather than by nesting the JSON:
- The container has a `visualisationId`.  This is what its children point at, and unlike
  `visualisationGuid` it stays the same between loads.  (If you leave it out, the container gets
  one made up for it, but then you've nothing to point the children at, so you'll want to give
  one.)
- Each child has a `containerVisualisationId` naming its container, and a `containerOrder`, lowest
  first.  A child with a container doesn't need a `targetSelector`, only the container does.
- A container with more than one place for its children (a task lane has one for each of the
  board's columns) calls each place a slot, and a child picks one with `containerSlot`.  A child
  that names no slot, or one the container hasn't got, goes in the first.  The orders are counted
  within a slot.

A child can be a container too, so they nest as deep as you like.  The order the visualisations
appear in the settings doesn't matter, because a child that turns up before its container is held
back until the container has rendered.  The flip side is that a child whose container never turns
up (a typo in the ID, say) is never shown, and nothing tells you, so that's the first thing to
check when a tile goes missing.

This is a Sales menu, a tile group with a link tile in it:

```html
<div class="js-sales-menu"></div>

<script type="application/json" class="js-ren-report-settings">
{
    "visualisations": [
        {
            "visualisationTypeName": "TileGroup",
            "visualisationId": "sales-menu",
            "targetSelector": ".js-sales-menu",
            "heading": "Sales",
            "subheading": "reports"
        },
        {
            "visualisationTypeName": "LinkTile",
            "containerVisualisationId": "sales-menu",
            "containerOrder": 1,
            "title": "Sales by Category",
            "url": "/SalesByCategory?Category=Paper",
            "imageUrl": "category-icon.png",
            "imageFilter": "hue-rotate(275deg)"
        }
    ]
}
</script>
```

__Editing the children__

A container type can say which types of children it takes, in its `containerOptions`, and if it
does the user can add, remove and reorder them from the context menu.  They can also drag a child
somewhere else by holding the mouse button down on it, and the others slide out of its way.  None
of this is offered in a downloaded report, since it couldn't be saved anywhere.

__The container types__

- `TileGroup` lays out its tiles in rows that wrap, under a `heading` and an optional
  `subheading` (shown after the heading, in a lighter style).  `tileWidth` (16rem by default) and
  `tileGap` are CSS lengths.  Link tiles are the only thing its context menu will add.
- `LinkTile` isn't a container, but it's what goes in a tile group: an image with a `title`
  underneath, the whole tile being a link to `url`.  `imageFilter` is a CSS filter for the image,
  which is how I get several colours out of one icon.  The `url` and `imageUrl` go through
  `Ren.HostUrls`, so if the page defines `reportUrl()` and `imageUrl()` (see Page globals) the
  host gets to map them, and otherwise they're used as they are.  The title, link, image and
  filter can all be edited from the tile's context menu.
- `TaskBoard` has a row of `columns` across the top, each `{ "id", "heading", "subheading" }`,
  and its children are task lanes, one under the other.  `columnWidth` (15.5rem by default) and
  `laneHeadingWidth` (8rem) are CSS lengths.
- `TaskLane` has a `heading` and a cell for each of its board's columns, and its children are task
  tiles.  The slots are the column IDs, so a tile's `containerSlot` says which column it's in.
  Tiles can be dragged between cells and into other lanes.  The lane's colour, on its heading and
  along the top of its cells, is the `--ren-task-lane-colour` CSS variable, which you can set
  through the lane's `moduleCssClass`.

A task board looks like this (with a tile's text cut short):

```json
{
    "visualisations": [
        {
            "visualisationTypeName": "TaskBoard",
            "visualisationId": "board",
            "targetSelector": ".js-task-board",
            "columns": [
                { "id": "start", "heading": "Start" },
                { "id": "next", "heading": "Next", "subheading": "once these are done" }
            ]
        },
        {
            "visualisationTypeName": "TaskLane",
            "visualisationId": "lane-docs",
            "containerVisualisationId": "board",
            "containerOrder": 1,
            "heading": "Docs",
            "moduleCssClass": "lane-colour-1"
        },
        {
            "visualisationTypeName": "TaskTile",
            "containerVisualisationId": "lane-docs",
            "containerSlot": "next",
            "containerOrder": 1,
            "taskId": "M",
            "taskTitle": "Docs and changelog",
            "taskStatus": "NotStarted",
            "contentHtml": "Document containers in the quick start."
        }
    ]
}
```

### Data formats

Ren works out a data source's format by checking, in order:
1. The element's `data-format` attribute
2. The response's content type
3. The structure of the content itself

Whatever the format, the data is converted into a tabular data set collection (described below),
which is what the rest of Ren works with.

The formats are:
- `renpack`: binary, with the content type `application/x-ren-tabular-v1`, starting with the bytes
  `RENP`.  It's read on a worker, so big data sets don't hold up the page.  See
  [renpack.html](../examples/renpack.html).
- `script-element-html`: HTML holding `ren-tabular-data-set-collection-json` script elements (see
  Embedded data).
- `columns-and-rows`: `{ "columns": [...], "rows": [[...], ...] }`.  See
  [columns-and-rows.html](../examples/columns-and-rows.html).
- `array-of-objects`: `[{ "Product": "Pens", "Revenue": 12.5 }, ...]`.  See
  [array-of-objects.html](../examples/array-of-objects.html).
- `tsv`: tab-separated, with the headings on the first line.  It's recognised by the content type
  `text/tab-separated-values`, otherwise you'll need `data-format="tsv"`.  See
  [tsv.html](../examples/tsv.html).
- `tabular-data-set-collection`: Ren's own JSON.  Any JSON that isn't one of the other formats is
  read as this.  See
  [tabular-data-set-collection.html](../examples/tabular-data-set-collection.html).

Formats registered with `Ren.Extensions.registerDataSourceFormat` are sniffed after the built-in
ones, but before `tsv`.

Unfortunately, TSV values currently all come through as strings, numbers included.  If that's a
problem, it's best to use one of the JSON formats for now.

__Column hints__

In `columns-and-rows`, each column can be just a name, or an object of hints:

```json
{ "name": "Revenue", "heading": "Revenue (£)", "type": "number", "format": "Currency" }
```

`type` is `number`, `date`, `datetime` or `string`, and `format` is `General`, `Number`, `Integer`,
`Currency`, `Percentage`, `Id`, `Date` or `DateTime` (in any case).  Without hints, Ren works the
types out from the values.

__Tabular data set collection__

```json
{
    "DataSourceUri": "/data/sales.json",
    "TabularDataSets": [{
        "Title": "Sales",
        "TabularDatas": [{
            "Title": "Sales",
            "IsColumnCompressed": [false, true, false],
            "ColumnModels": [
                { "Heading": "__Count", "ColumnId": "__Count", "Visible": false, "AggregationType": 0, "ColumnFormat": 1 },
                { "Heading": "Product", "ColumnId": "Product", "Visible": true, "AggregationType": 10, "ColumnFormat": 0 },
                { "Heading": "Revenue", "ColumnId": "Revenue", "Visible": true, "AggregationType": 0, "ColumnFormat": 3 }
            ],
            "RowModels": [{ "CV": [1, 0, 12.5] }, { "CV": [1, 1, 7] }]
        }]
    }],
    "CompressionDictionary": ["Pens", "Paper"]
}
```

Each data set is a tab, and each of its `TabularDatas` is a grid on that tab.

The first column is always a hidden `__Count`, which is 1 in every row; this is what counts the rows
when they're grouped.

A compressed column's values are indexes into the `CompressionDictionary`, rather than the values
themselves.  (`RowModels` can use `RowValues` instead of `CV`.)

`AggregationType` and `ColumnFormat` are numbers from `Ren.AggregationTypeEnum` and
`Ren.SpreadsheetColumnFormatEnum`: here 0 is Sum and 10 no total, and 0 is General, 1 Number and 3
Currency.

There's a full example in `examples/data/sales.collection.json`.

__Embedded data__

Data can be written into the page, rather than fetched:

```html
<script type="application/json"
        class="ren-tabular-data-set-collection-json"
        data-source-uri="/data/sales.json">
    { "DataSourceUri": "/data/sales.json", "TabularDataSets": [...] }
</script>
```

A data source with the same URI uses this, and doesn't make a request.  This is how a downloaded
report carries its data with it.

### Data requests

Every data source request:
- Sends `Accept: application/x-ren-tabular-v1, application/json, */*;q=0.1`
- Sends `Cache-Control: no-cache`, unless the page has a `.js-ren-is-cache-enabled` element with the
  value `True`
- Applies the `dataSourceRequests` settings from `ren.config` (`credentials` and `headers`)
- Calls each hook registered with `Ren.Extensions.registerDataSourceRequestHook(hook)`, as
  `hook(uri, options)`, so the host can change the fetch options

The `Accept` header is like that for a few reasons.  Asking for JSON means a server sends back its
error details as JSON, rather than as an HTML error page.  The binary formats Ren can read are listed
first, to tell the server it can reply with one of them.  And anything else is accepted last, so
that an endpoint serving some other format replies, rather than refusing with a 406.

If a request fails, the error is shown in place of the visualisation.  The error response can be
JSON, like this:

```json
{ "Error": "Timeout expired", "Details": "...", "SqlThatFailed": "...", "IsUserFacing": false }
```

Any other response body is shown as it is.  Note that an empty body counts as an error.  A 404 from
a named data source doesn't, though, because some named data sources are virtual.

### ren.config

The page's configuration: endpoints, formatting, links, menus, theme, working days and feature
flags.  The
properties are described in `ren.config.schema.json`, which the build copies into `dist/`.
If your config file's `"$schema"` points at it, VS and VS Code will complete and check it.

```html
<script type="application/json" class="js-ren-config">
{ "endpoints": { "namedDataSources": "/data/" }, "theme": { "accent": "#0288d1" } }
</script>
```

The configuration is built up from:
1. Ren's defaults
2. Any `Ren.configure({...})` calls, which have to come after `ren.js` is loaded, and can only
   pass data
3. The `js-ren-config` element, which wins

It's read the first time it's needed, then frozen, so changing it after that has no effect.

Feature flags turn features off: setting a flag to `false` disables its feature.

### Formatting

`formatting` in `ren.config` sets how currency, numbers and dates are shown, in the grids, the
charts, format functions and Excel exports.  The defaults are British:
- `currencyPrefix` (`"£"`) and `currencySuffix` (`""`), so an empty prefix and a `"€"` suffix,
  with the separators below swapped, gives `1.234,50€`;
- `decimalSeparator` (`"."`), `thousandsSeparator` (`","`) and `minusSign` (`"-"`);
- `dateFormat` (`"dd/MM/yyyy"`) and `dateTimeFormat` (`"dd/MM/yyyy HH:mm:ss"`).

The date formats' letters are `yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `mm`
and `ss`, and text in single quotes is written as it is.  Month names are still English.  Excel
exports get the same formats, so a DateTime column now keeps its time there.

Chart axes don't follow these yet: their dates have formats of their own, from
`Ren.ChartDateTime`.

### Theming

Ren draws in light colours, but the ones it works out in script (rather than leaving to the
stylesheet) come from `--ren-*` CSS custom properties when the page sets them on the body.  So to
give Ren a dark theme, I'd set those under a body class of my own, restyle whatever else I want in
my own stylesheet, and notify `Ren.Messages.Events.themeChanged` whenever the class goes on or off,
so the grids and word clouds redraw.  The properties, with their light defaults, are:
- `--ren-data-grid-background` (`#FFFFFF`) and `--ren-data-grid-group-background` (`#F4F4F4`),
  from which the group rows' shades and text colours are worked out;
- `--ren-data-grid-edge-border` (`1px #CCCCCC`), `--ren-data-grid-heading-row-background`
  (`#EEEEEE`), `--ren-data-grid-heading-row-border-colour` (`#CCCCCC`) and
  `--ren-data-grid-null-cell-background` (`#FEFFE3`);
- `--ren-data-grid-totals-row-border` (`1px #BBBBBB`) and
  `--ren-data-grid-totals-row-background` (`#EEEEEE`);
- `--ren-cell-selection-border-colour`, `--ren-cell-selection-heading-background` and
  `--ren-cell-selection-heading-colour` (`#217346`, `#D2D2D2` and `#217346`);
- `--ren-toggle-switch-on-background`, `--ren-toggle-switch-off-background` and
  `--ren-toggle-switch-knob-background` (`#4d85ff`, `#C6C6C6` and `white`);
- `--ren-word-cloud-invert-colours`, which inverts the word clouds' colours when it's `1` (a
  word cloud's own invert setting then turns them back).

Script reads them with `Ren.Theme.getValue(name, defaultValue)`, or puts
`Ren.Theme.cssValue(name, defaultValue)` into a style rule, leaving the `--ren-` off the name.

### Endpoints

`endpoints` in `ren.config` gives the URL of each server action Ren uses.  A URL starting with `/`
has `endpoints.baseUrl` put in front of it.

A missing endpoint hides the feature that needs it, so a page that only shows data doesn't need any
endpoints at all.

__Data__

`namedDataSources` is a GET, with the data source's name and parameters on the end.  It can return
data in any of the formats.

__Settings__

There are four `load` and four `save` endpoints, one for each kind of saved settings:
`loadUserReportSettings`, `loadDefaultReportSettings`, `loadWebReportSettings` and
`loadSqlBasedReportPresetSettings`, and the same for `save`.
- The `load` endpoints are a GET with `?reportName=&settingsName=`, returning the report settings
  JSON.  A 404, or an empty body, means there are no settings.
- The `save` endpoints are a POST of `{ serializedReportSettings }`.
- `deleteUserReportSettings` is a POST of `{ reportName, settingsName }`.
- `listReportSettingsFiles` is a GET with `?reportName=&onEditorPage=`, returning a JSON list of
  the settings files.

__Everything else__

The rest are for optional features, and are described in the schema: `generateReport`,
`updateConnectionHeartbeat`, `disposeConnection`, `renLogInsert`, `eventInsert`, `makeRequest`,
`makeRequestAndExtract`, `fetchImage`, `listSharedFunctions`, `sharedFunctions`,
`convertToSettingsOnlyReport`, `uploadFiles`, `savePastedData`, `autoDetectUploadedFileDelimiter`,
`visualisationDimensions` and `upsertVisualisationDimensions`.

### The message bus

Ren's various parts talk to each other through `Ren.Messages`, and the host page can join in.  There
are two kinds of message: events say something has happened, and requests ask for something to be
done.

```js
Ren.Messages.Events.filterChanged.handle((tabularDataGuid, settingsGroup, reportGuid) => {
    console.log("Filtered", tabularDataGuid);
});

Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
```

`handle(callback, runOnce)` adds a listener.  To remove listeners later, you can add them inside
`Ren.Messages.withOwner(owner, register)`, which tags them with an owner, then remove them all with
`removeListenersByOwner(owner)`.  (`removeListener` removes just the one.)

`notify(...)` queues a message, so that repeats of it are merged, and `notifyImmediately(...)`
sends it straight away.

__Events__

These are the events a page is most likely to want:
- `pageLoaded()` and `allReportsLoaded()`
- `dataSourceChanged(dataSourceUri)` and `dataSourceRemoved(dataSourceUri)`
- `visualisationRendered()` and `visualisationDataChanged(visualisationGuid, dataSourceUri)`
- `filterChanged(tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid)`
- `filterGroupChanged(tabularDataGuid, filterGroup, filterSet, containingReportGuid)`
- `groupingsChanged(tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid)`
- `selectedValuesChanged(visualisationGuid, getStatBarValues)`
- `reportSettingsLoaded()` and `reportSettingsSaved(success, url, errorDetails)`
- `reportUrlChanged(reportContextGuid, reportUrl)`
- `reportDownloaded()` and `reportDownloadFailed()`
- `themeChanged()`, which a host notifies after changing the `--ren-*` theme properties
- `generalEvent(eventName, data)`

__Requests__

- `renderUnrenderedVisualisations()`
- `saveDefaultReportSettings()`
- `scanPageForDataSources(callback)`, which scans for `<ren-*>` elements added since the page loaded
- `createAdHocVisualisation()`

`Ren.Messages.Events` and `Ren.Messages.Requests` have the full lists.

### Extensions

`Ren.Extensions` is how a host adds its own stuff to Ren.  It doesn't matter if a registration is
made before the part of Ren it extends has loaded; it's kept until it has.

- `registerDataSourceFormat(format)` adds a data format, with a `name`, `contentTypes`, `sniff` and
  `parse` (or, for a binary format, `isBinary`, `sniffBuffer` and `parseBuffer`).
- `registerDataSourceRequestHook(hook)` changes every data request's fetch options (see Data
  requests).
- `registerNamedDataSourceOptions(name, options)` changes how one named data source is fetched:
  `noCache` always fetches it afresh, and `quiet`, for one the page polls in the background, keeps
  its requests out of the log and its failures out of sight.
- `registerSettingsStore(name, store)` adds a settings store, with `load`, `save`, `delete`, `list`,
  `canSave` and `canList`.
- `registerPageHooks(hooks)` gives Ren the host page's behaviour, such as `isEditorPage`,
  `readInputs`, `settingsLoaded` and `getFallbackSettings`.  `openSqlInEditor(sql)` opens SQL in
  the host's SQL editor, for the "Show data" links in a report's text; without it they're left
  as plain text.
- `registerVisualisationType(type, tagOptions)` adds a visualisation, and its `<ren-*>` element.
- `registerVisualisationDefaults(typeName, defaults)` sets the options every visualisation of a
  type starts with, which its element's attributes override.  `<ren-date-selector>` and
  `<ren-date-range-summary>` show the report's own dates, from `<ren-default-dates>` and the
  report's query string, but a host that works them out on its server can give them a data source
  with, say, `registerVisualisationDefaults("DateSelector", { dataSourceName: "Dates" })`.  The
  selector's has a row for the date range and one for the range compared against, each with a
  `StartDate` and an `EndDate`, and the summary's has one row with `StartDate`, `EndDate`,
  `CompareStartDate` and `CompareEndDate`.  End dates are exclusive.
- `registerCellMenuItems(columnProperties, buildItems)` adds context menu items to the cells of
  matching columns.
- `registerSearchLink(id, text, getUrl)` adds a search link to the cell menus.
- `registerFormatFunction(name, source)` and `registerHtmlTemplate(name, source)` add a format
  function or an HTML template, by name.
- `registerBaseUrl(name, getBaseUrl)` adds a link base URL that has to be worked out in code, rather
  than set in `ren.config`.
- `registerLogEntryMapper(mapLogEntry)` turns Ren's log entries into whatever your log endpoint
  wants.  Logging's off unless `loggingEnabled` is true in `ren.config`, and if it's on without a
  mapper Ren says so in the console and logs nothing.  I did it this way because everyone's log
  table looks different: Ren hands over `createdOn` (a `Date`), `logLevel`, `eventType`,
  `logGroup`, `topic`, `itemGuid`, `pageGuid`, `userGuid`, `sessionGuid`, `pageUrl`, `pageSeq`,
  `pageEventTypeSeq` and `data` (an object, or null), and the mapper returns the body that's
  POSTed to `renLogInsert`.

### Page globals

A host layout can define these functions on `window`.  Without them, URLs are used as they are.
- `reportUrl(url, inheritParameters)` builds a report's URL.  If it's there, Ren takes the page as
  being served by a host layout, which provides the report contexts.
- `imageUrl(path)` builds an image's URL.
- `websiteUrl(url)` builds a URL on the host's website.
- `hasDevelopmentUrls()` says whether the URLs point at a development server.
