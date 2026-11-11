![Ren](https://raw.githubusercontent.com/edwardsmale/Ren/main/docs/images/ren-logo.png)

**A powerful client-side reporting library for the browser: data grids, charts, and data grouping,
sorting and filtering.**

Give Ren some tabular data and it builds a full, interactive report in the browser.  Your users can
group, sort, filter, total, chart, select and export the data themselves, and save or download 
reports.  The heavy lifting is all done in the browser, making implementation a breeze.

```html
<link rel="stylesheet" href="/ren/ren.css">
<script src="/ren/ren.js"></script>

<ren-grid src="/data/sales" show-row-and-column-headings />
<ren-date-value-chart src="/data/sales" />
```

[Quick start](https://github.com/edwardsmale/Ren/blob/main/docs/quick-start.md) ·
[Security](https://github.com/edwardsmale/Ren/blob/main/docs/security.md) ·
[Examples](https://github.com/edwardsmale/Ren/tree/main/examples) ·
[Changelog](https://github.com/edwardsmale/Ren/blob/main/CHANGELOG.md) ·
[Source](https://github.com/edwardsmale/Ren)

---

## What's in it

### Data grids

- **Grouping** on as many levels as you like, with expandable and collapsible group rows, and a
  totals row.
- **More than 20 aggregations** for group and total rows: sum, average, median, min, max, count,
  count distinct, first, last, most common, distinct values (with or without counts), and more.
- **Sorting and filtering** on any column, with column filters that show what's been applied.
- **Spreadsheet-style cell selection**, with a stat bar that totals what's selected. You can copy
  the selection straight into Excel, or find text in the grid.
- **Resizable and reorderable columns**, paging, saved grid variations, and tooltips for values
  that don't fit.
- **Excel downloads** that keep your number and date formats.

### Charts

- **Date/value charts**: line, bar, stacked and pie charts, and multi-charts, with trend lines,
  previous-year comparisons, date markers, non-working days, crosshairs and hover values. You can
  select date ranges on them, and export them as images.
- **Change charts**, which show how each row moved between two periods.
- **Calendars**, **word clouds**, **stat bars** and **key-value grids**.
- **Cross-filtering**: click a series or a period to filter everything else on the page.

All of the charts are drawn by Ren itself, so you don't need a charting library.

### Filtering and grouping across a report

- **Filter modules**, **filters bars** and **date selectors**, which filter every visualisation
  that shares the data.
- **Settings groups**, so a grid and a chart can share one grouping, filter and sort.
- **Report parameters** that pass through to your data endpoints.

### Whole reports

- **Saved settings**: named presets, per-user settings and a default for everyone. They're stored
  on your server or in the browser's local storage.
- **Layout containers**: tabs, expandable sections, tile groups, task boards and embedded reports.
- **Downloadable reports**, which bundle the data and the page into a single HTML file.
- **Theming** through `--ren-*` CSS custom properties, so you can do a dark mode, and
  **formatting** settings for currency, number and date formats.
- **Extensions** for your own data formats, settings stores and format functions.

---

## Getting started

### 1. Add the package

```
dotnet add package Ren
```

Before each build, the package copies Ren's files into your web project and makes them content,
so they're published with your site. The files always match the version of the package you
reference.

| Project | Where the files go |
| --- | --- |
| ASP.NET Core | `wwwroot/ren/` |
| ASP.NET (.NET Framework) | `Statics/ren/` |

Add that folder to `.gitignore`. To update Ren, update the package.

To change where the files go, or to leave them out, set `RenStaticsDirectory` or
`RenStaticsEnabled` in the project file.

### 2. Put Ren on a page

```html
<link rel="stylesheet" href="/ren/ren.min.css">

<script src="write-excel-file.min.js"></script>   <!-- Only needed for Excel downloads. -->
<script src="/ren/ren.min.js"></script>

<ren-grid src="/data/sales" show-row-and-column-headings />
```

When the page loads, Ren replaces each `<ren-*>` element with a visualisation, using data fetched
from its `src`.

| File | What it is |
| --- | --- |
| `ren.js` / `ren.min.js` | The library, as a script that defines `window.Ren`. |
| `ren.esm.js` / `ren.esm.min.js` | The same, as an ES module. |
| `ren.css` / `ren.min.css` | The styles. |
| `ren.manifest.json` | The version, the commit, and a hash of each file. |

Each file has a source map.

### 3. Serve some data

Your endpoints can return the data in any of these formats. Ren tells them apart by themselves:

| Format | Looks like |
| --- | --- |
| Array of objects | `[{ "Product": "Pens", "Revenue": 12.5 }, ...]` |
| Columns and rows | `{ "columns": [...], "rows": [[...], ...] }` |
| TSV | Tab-separated, with headings on the first line. |
| Tabular data set collection | Ren's own JSON, with column formats and several tabs. |
| renpack | A compact binary format, read on a worker so big data sets don't hold up the page. |

You can serve the first three from any server. The package's .NET library can write the last two
for you.

---

## The .NET library (optional)

You don't have to use the library: you can leave it to the package to deliver the client's files.
If your server is .NET, though, the library can turn an `IDataReader`, a `DataTable` or a list of
objects into Ren's data formats, with each column's format worked out from its .NET type. It can
also compress the data before it's sent. It targets .NET Standard 2.0 and .NET Framework 4.8.

```csharp
var collection = new TabularDataSetCollectionBuilder()
    .AddSet("Sales")
    .AddTab("By order", reader)                  // An IDataReader.
    .AddTab("By product", productTable)          // A DataTable.
    .AddTab("By customer", customers, columns => // A list of objects.
    {
        columns["CustomerId"].Visible = false;
        columns["FirstOrdered"].ColumnFormat = TabularDataColumnFormatEnum.Date;
    })
    .Build();

var renPack = new RenPackWriter().TryWrite(collection);

if (renPack != null && RenPackFormat.IsAcceptedBy(acceptHeader))
{
    // Send renPack as RenPackFormat.CONTENT_TYPE.
}
else
{
    var json = new TabularDataJsonWriter().ToJson(collection);
}
```

There's more about the library in its
[README](https://github.com/edwardsmale/Ren/blob/main/dotnet/README.md).

---

## Licence

MIT. `ren.js` includes Prism and code ported from d3, and Excel downloads use write-excel-file.
Their licences are in
[THIRD-PARTY-NOTICES.md](https://github.com/edwardsmale/Ren/blob/main/THIRD-PARTY-NOTICES.md).
