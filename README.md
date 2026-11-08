<img src="docs/images/ren-logo.png" alt="Ren" width="231" height="72">

A client-side reporting library for data grids, charts, filters and report settings.

- Licence: MIT (see [LICENSE](LICENSE)).  `ren.js` includes Prism and code ported from d3, and
  requires web pages using it to pull in the write-excel-file library.  Their licences are in
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- NuGet package: `Ren`, which has the client's built files and an optional .NET library (see
  [dotnet/README.md](dotnet/README.md)).
- Changes in each version: [CHANGELOG.md](CHANGELOG.md).

## Using Ren

- [docs/quick-start.md](docs/quick-start.md): what a page needs to provide (scripts, report
  contexts, parameters, settings, containers, data formats, endpoints and the message bus).
- [docs/security.md](docs/security.md): the content security policy Ren needs, what it does to
  the page, and the risks of saved reports running code.
- `examples/`: a page for each data format.  To see them, build Ren, run
  `dotnet run --project build/Ren.Build -- serve`, and open http://localhost:8080/examples/.

### Using Ren in a site

Reference the `Ren` NuGet package from the site's web project.  Before each build, the package
copies the client's files into the project and makes them content, so they're published with the
site:
- ASP.NET projects get them in `Statics/ren/`.
- ASP.NET Core projects get them in `wwwroot/ren/`.
- Other projects don't get them.

Add the folder to `.gitignore`.  The files always match the package version the project
references, so to update Ren, update the package.  In a project that uses `packages.config`, use
Visual Studio's package manager (`Update-Package Ren -Version 1.1.1`) rather than editing
`packages.config`, as the project file names the version too.

Optional settings, in the project file or as environment variables:

```
RenStaticsEnabled     false to leave the files out, or true to add them to a project that
                      isn't a web project.
RenStaticsDirectory   The folder to put the files in, relative to the project.
RenRepo               A clone of this repo.  While it's on a branch with the same name as the
                      site's, the files come from its dist/ instead of the package.
RenDist               A dist/ folder to take the files from, whatever the branches are.
```

### Working on Ren against a site

1. Set `RenRepo` to this repo, and `REN_STATICS` to the site's folder for Ren's files (see
   "Building").  You only do this once.
2. Give the Ren work a branch with the same name as the site's branch (see "Branches").

While the branch names match, the watcher copies each build into the site, and building the site
takes the files from `dist/`, so a refresh shows each change.  On any other branch, the watcher
leaves the site alone and the site's build uses the package's files.  Both read the branches on
every build, so you can switch branches with the watcher running.

## Layout

| Folder or file | Contents |
| --- | --- |
| `src/` | The library's JavaScript.  A folder's own files are built before its subfolders', otherwise in code-point order of their paths (so `ren----init.js` is first). |
| `vendor/` | Third-party scripts, built in ahead of `src/`. |
| `templates/html/` | HTML templates, one file each, named after the template. |
| `templates/format-functions/` | The format functions Ren uses itself, one file each. |
| `styles/` | SCSS.  Files starting with `_` are partials. |
| `ren.config.schema.json` | The schema for `ren.config`, for editors. |
| `docs/` | How to use Ren. |
| `examples/` | A page for each data format, with its data. |
| `build/Ren.Build/` | The build, a .NET console app. |
| `test/` | The client's tests (see "Testing"). |
| `dist/` | The build output (not checked in). |
| `dotnet/` | The `Ren` NuGet package: the .NET library, and the build targets that put the client's files in a site. |
| `VERSION` | Ren's version (see "Versions"). |

## Building

You need the .NET 8 SDK.  Run the build from the repo's root:

```
dotnet run --project build/Ren.Build                    Builds dist/.
dotnet run --project build/Ren.Build -- watch           Builds, then rebuilds on every change.
dotnet run --project build/Ren.Build -- scripts         Builds just the scripts (or styles).
dotnet run --project build/Ren.Build -- build --statics <dir>
                                                        Builds, and copies the files into a
                                                        site's folder.
```

The first build downloads Dart Sass, Lightning CSS and esbuild into `.tools/`, at pinned versions
checked against hashes in `build/Ren.Build/Tools.cs`.  Set `REN_TOOLS` to keep them elsewhere.

`dist/` gets:
- `ren.js`: `vendor/`, `src/` and the compiled templates, wrapped in a function so their top-level
  names aren't globals.  `Ren` is `window.Ren`, and a CommonJS export.
- `ren.esm.js`: `ren.js` as an ES module, exporting `Ren`.
- `ren.css`: `styles/`, compiled with Dart Sass and prefixed with Lightning CSS.
- Minified versions of each (`ren.min.js`, `ren.esm.min.js`, `ren.min.css`), from esbuild.
- A source map for each file, and a copy of the schema.
- `ren.manifest.json`: the build's version and commit, whether it's a release, and SHA-256 hashes
  of the files (with line endings normalised to LF).

Each file starts with a licence comment naming the version.  The templates register themselves
through `Ren.Extensions`, so a page doesn't need template elements of its own (but its own still
override them).

### Versions of a build

A build is a release only if its commit is tagged `v<version>` and nothing is uncommitted.
Anything else is a development build, named after its commit, such as `1.1.0+dev.4f2a9c1` (or
`1.1.0+dev.4f2a9c1.dirty` with uncommitted changes).  A site can tell which it has, and refuse to
ship a development build.

### Copying builds into a site

`--statics <dir>` copies the files into `<dir>` after each build.  For more than one site, give
`--statics` more than once, or separate the folders with semicolons.  A folder in a git repo only
gets the files while its branch has the same name as Ren's (otherwise the site's build would
replace them with the package's).  The build says when it skips one.

### VS Code tasks

| Task | What it does |
| --- | --- |
| `ren-watch` | Starts when the folder opens (once you've allowed automatic tasks).  Rebuilds on every change. |
| `ren-build` | Builds once (Ctrl+Shift+B). |
| `ren-test` | Runs the tests against the build in `dist/`, without building first. |
| `ren-serve` | Serves the examples. |

`ren-watch` and `ren-build` copy each build into the folders in `REN_STATICS`.  Set it from
PowerShell or cmd, not a Unix shell, which removes the backslashes.  The paths must be absolute.

## Testing

```
dotnet run --project build/Ren.Build -- test             Builds, then runs every test.
dotnet run --project build/Ren.Build -- test --minified  The same, on the minified build.
dotnet run --project build/Ren.Build -- test --filter <filter>
                                                         Builds, then runs the tests the filter
                                                         picks.
dotnet test test/Ren.Client.Tests                        Runs every test against the current
                                                         build.
dotnet test test/Ren.Client.Tests --filter "FullyQualifiedName~PopupTests"
                                                         Runs one class's tests.
```

The tests are in `test/Ren.Client.Tests`, an MSTest project that drives Chrome with Playwright for
.NET.  You can also run them from Visual Studio's Test Explorer, or VS Code's Testing view with the
C# Dev Kit.

To set up Chrome, either set `REN_CHROME_PATH` to a Chrome (such as Chrome for Testing), or build
the test project and download Playwright's Chromium:

```
powershell -ExecutionPolicy Bypass -File test/Ren.Client.Tests/bin/Debug/net8.0/playwright.ps1 install chromium
```

Some things to know:
- The tests use `dist/`, not `src/`, so they test what a page gets.  They won't run if `ren.js` is
  older than its sources.
- `REN_TEST_MINIFIED=1` (which `--minified` sets) serves the minified files in place of
  `ren.js`, `ren.esm.js` and `ren.css`.
- The tests serve the repo themselves, as http://localhost:8124, without opening a port.

### Unit tests

`test/*.test.js` are Jest tests.  `JestFileTests` runs each file in its own Chrome page, after
write-excel-file and `ren.js`, so the tests can use `Ren` as a global.
`test/Ren.Client.Tests/jest-in-the-browser.js` provides the parts of Jest and Node they use.  Each
file shows as one test, which lists the tests in it that failed.

Helpers and tips:
- `test/helpers/tabular-data.js` builds a compressed tab from columns and rows.  Column 0 is Ren's
  Count column, so yours start at 1.
- `Ren.DerivedDataGroupingSettings` is the easiest way to test an aggregation, but doesn't show a
  sort.  For sorts, read the order from `rowYs`.
- `test/helpers/renpack-writer.js` writes renpack bodies from the format in
  `dotnet/src/Ren/RenPack/RenPackFormat.cs`, not from the reader, so it can't share its mistakes.
- `test/golden/` has renpack files from the .NET writer, mostly with matching JSON.
  `renpack-golden-files.test.js` checks the reader against them.  To rewrite them, see
  [dotnet/README.md](dotnet/README.md).
- A test that reads the repo's folders can't run in a page, so write it in C# (like
  `SourceEncodingTests`).

### Browser tests

The tests in `test/Ren.Client.Tests/Browser/` open the pages in `test/browser/fixtures/`, for what
needs a real page (rendering, `ren.config`, popups).  The pages load `/dist/ren.js` and
`examples/lib/`, with data from `examples/data/` or a script element.

A fixture starting with `<!doctype` is served as it is.  Any other fixture is a report view, which
is put in a layout (see `FixtureLayout.cs`) that adds Ren's files, a report context, a
`ren-web-report-page`, and a `ren.config` that reads data from `ported/data/`.  For
`<Name>.html`, the layout also adds:
- `<Name>.json` as the report's settings;
- `<Name>.js`, after `ren.js`, for setup before Ren starts;
- the format functions in `fixtures/format-functions/`.

Add `?layout=embedded` to the URL for an embedded report layout.  To look at a fixture, run
`serve` and open http://localhost:8080/test/browser/fixtures/grid.html, say.

`test/browser/fixtures/ported/` has reports generated from an existing reporting app, with their
data in `ported/data/`.  Don't edit them: regenerate them.

Each test class derives from `BrowserTest`, which gives each test its own page, and fails it if
the page has an uncaught error (unless the test calls `AllowPageErrors()`).  It has:
- `Ren`, a `RenContext` for the page:
  - `OpenAsync(fixture)` opens a fixture and waits for Ren to load.
  - `SavedSettingsAsync()` gets the settings as they'd be saved, and
    `OpenWithSettingsAsync(fixture, settings)` reopens with them, as after a save and reload.
  - `Grid(n)`, `PopupAsync(n)`, `Report` and `Within(selector)` scope to part of the page, and
    `Locator()` finds elements in it.  Popups count from 1, in the order they opened.
  - `ColumnTextAsync(headings)` and `RowTextAsync(n)` read a grid, where row 1 is the first data
    row.
  - `CellTextAsync(column, row)`, `CellHtmlAsync(column, row)`, `ExpandCollapseGroupAsync(row)`,
    `SelectAllAsync()`, `SelectCellsAsync(...)` and `SelectedTextAsync()` take a column heading
    and the row heading's number, where row 2 is the first data row.
- `Expect(value)` with Jest's matchers, and `Expect(locator)` and `Expect(page)` from Playwright.
- `Poll(() => ...)`, which retries until a value matches (up to 5 seconds), and `ToPassAsync`,
  which retries a block of expectations.
- `Tsv(text)`, which turns pipe-separated text into tab-separated text.
- `EvaluateJsonAsync` and `EvaluateAsync<T>`, which run a script and read its result.

`Helpers/` has helpers for the date/value chart, calendar, filter module, column filters and
confirm popup.  Note that grid column headings show their `title`, so their text is empty, and a
grid's last row is usually its totals row (`.ren-data-grid__cell--group`).

## CI

`.github/workflows/ci.yml` builds, runs the client tests on the normal and minified builds, then
builds and tests the .NET package.  It runs on Windows, for the .NET Framework 4.8 tests, with
Playwright's Chromium.  The repo has no remote yet, so run the same steps locally (they stop at
the first failure):

```
dotnet run --project build/Ren.Build -- ci
```

## Versions

Ren has one semantic version, in `VERSION`, shared by the client and the .NET package.  They're
released together, because the renpack format ties them together.  A release that only changes one
of them still bumps both.

These are the API, for deciding between a major, minor and patch version:
- `ren.config` and its schema.
- The elements, classes and attributes a page provides (everything in the quick start).
- The data source formats, endpoint contracts and message bus events.
- `Ren.configure()`, `Ren.Extensions`, and the .NET package's public types.

Anything else on `Ren.*` can change in a minor version.

## Branches

Releases are made from main, so do work on a branch off main.  When the work goes with a site's
branch, give the Ren branch the same name, so it's clear which go together, and so the site uses
the Ren branch's build (see "Working on Ren against a site").  Switch both repos when you move
between pieces of work.

When the work is ready, merge it into main, release, and update the site's branch to the new
package.  The release includes anything else merged into main since the last one, so a site never
gets a Ren that's missing something an earlier release had.

## Releasing

1. Add each change under "Unreleased" in `CHANGELOG.md`.
2. Release, on main with nothing uncommitted:

   ```
   dotnet run --project build/Ren.Build -- release 1.1.1
   ```

   This dates the version's CHANGELOG section, sets `VERSION`, runs CI (undoing both if it fails),
   commits "Ren 1.1.1", and tags it `v1.1.1`.  It doesn't push or publish anything.  If there's
   already a "## 1.1.1 (not released yet)" section, it dates that, and "Unreleased" must be empty.
3. Pack the release:

   ```
   dotnet run --project build/Ren.Build -- pack 1.1.1
   ```

   This builds the tag in a temporary worktree, so nothing uncommitted gets in, and writes
   `packages/Ren.1.1.1.nupkg`.  It refuses a build that isn't that release.
4. Publish the package to your NuGet feed:

   ```
   dotnet nuget push packages/Ren.1.1.1.nupkg --source <feed>
   ```

   A version can't be replaced once published, so only publish releases.

Releases before 1.1.1 can't be packed, as they don't have the build targets.  To try out a
development build locally, `dotnet pack dotnet/src/Ren -p:RenPackDevBuild=true` packs `dist/` as
a prerelease, such as `1.1.0-dev.4f2a9c1`.

For a site that doesn't use the package, copy a release's files into its folders:

```
dotnet run --project build/Ren.Build -- export 1.1.1 <dir>[;<dir>...]
```

## Conventions

- LF line endings, and UTF-8 without a BOM (see `.editorconfig`)
- Double quotes in JavaScript
- Indexed loops rather than spreads or `for...of` in hot code
- Lines of around 100 characters
