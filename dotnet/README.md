# Ren's .NET library

Ren's NuGet package, `Ren`, has both sides of Ren:
- The client's built files (`ren.js`, `ren.css`, their minified and ES module versions, their
  source maps, the schema and `ren.manifest.json`).  Its build targets copy them into a web
  project that references the package, before each build, so the files are always the version
  the project references.  See "Getting it" in the [main README](../README.md).
- An optional .NET library for the server side, for netstandard2.0 and .NET Framework 4.8, that
  writes data in Ren's formats, and can compress it before returning it to the client.  It came
  out of a reporting system that's used every day, so it's had a lot of use already, but anything
  that can produce an `IDataReader`, a `DataTable` or a list of objects can use it.

The package's own README, which nuget.org shows, is [src/Ren/README.md](src/Ren/README.md).  The
rest of this README is about the .NET library.

### Building a collection

`TabularDataSetCollectionBuilder` makes one tab from each source you give it:

```csharp
var collection = new TabularDataSetCollectionBuilder()
    .AddSet("Sales")
    .AddTab("By order", reader)                 // An IDataReader's current result set.
    .AddTab("By product", productTable)         // A DataTable.
    .AddTab("By customer", customers, columns =>
    {
        columns["CustomerId"].Visible = false;
        columns["FirstOrdered"].ColumnFormat = TabularDataColumnFormatEnum.Date;
    })                                          // An IEnumerable<T>.
    .Build();
```

Some things worth knowing:
- Each column's format is worked out from its .NET type: strings, GUIDs and enums are General,
  `bool` is Boolean, the integer types are Integer, `float`, `double` and `decimal` are Number,
  and `DateTime` and `DateTimeOffset` are DateTime.  Nullable types count as their underlying
  type.
- The callback gets the columns before any of the values are read, so it's the place to change a
  format, a heading or an aggregation, hide a column, or give a column `EnumValues`.  (A numeric
  column given `EnumValues` becomes General, since the names it's mapped to aren't numbers.)
  Asking for a heading that isn't there throws, listing the ones that are.
- Each tab starts with a hidden `__Count` column (headed "Count"), which is 1 in every row.  Ren
  counts rows with it, such as for the row counts in filter modules and charts.  It's in the
  callback's columns too, so the source's columns start at index 1.  Set `AddCountColumn = false`
  on the builder to leave it out.  A source with its own `__Count` column doesn't get another.
- An integer or number column whose name ends in "Id" isn't totalled.  It doesn't make sense to
  sum IDs.
- A list of objects gets a column for each public readable property, in the order they're
  declared.
- NULLs (and `DBNull`, SQL types' nulls, and NaN and infinity) are kept apart from empty strings.
- A tab added before any set goes into a set of its own, named after the tab.
- `Build()` compresses the collection, which renpack needs, and you can't add anything after it.

If you need to send the client more than the collection has, subclass `TabularDataSetCollection`
and pass an instance to the builder's constructor.  The JSON and the renpack metadata are both
written from the instance's own type, so the extra properties get through either way.

### Writing it out

```csharp
var renPack = new RenPackWriter().TryWrite(collection);

if (renPack != null && RenPackFormat.IsAcceptedBy(acceptHeader))
{
    // Content-Type: RenPackFormat.CONTENT_TYPE.  Gzip it with RenPackCompressor if the
    // request's Accept-Encoding allows it, since a web server often won't for this type.
}
else
{
    var json = new TabularDataJsonWriter().ToJson(collection);
}
```

`TryWrite` returns null when the collection can't be written as renpack: it isn't compressed, it
lists missing uploaded files (the client checks for those before it knows the format), or it's
too big for the format's 32-bit offsets.  JSON always works.

### Versioning

There are two versions, and they mean different things:
- `RenPackFormat.VERSION` is the layout's version, and it's written into every renpack's header.
  Bump it for any change to the layout, however small.  The client reads anything from
  `RENPACK_MINIMUM_VERSION` to `RENPACK_VERSION` (in
  `src/data-sources/ren-data-source-decoding.js`), so when you bump it, bump `RENPACK_VERSION` to
  match, and teach the reader the new layout.  Only raise `RENPACK_MINIMUM_VERSION` once nothing
  writes the old layout any more.
- `RenPackFormat.CONTENT_TYPE` (`application/x-ren-tabular-v1`) only changes if a change is so
  big that a client couldn't even read the header to find out it's too old.  I don't expect that
  to happen.

`RenPackFormatTests` reads the JavaScript and fails if `RENPACK_VERSION` and `VERSION` disagree,
or if the client no longer accepts the content type.  That's why the package lives in the same
repo as the client.

The package's own version (in `src/Ren/Ren.csproj`) is Ren's version, which the client shares (see
"Versions" in [docs/development.md](../docs/development.md)).  It goes up a major version when
either side's API changes in a way that breaks callers, which a renpack version bump doesn't on
its own.

### Building and testing

You'll need the .NET 8 SDK or later.  The tests run on both .NET Framework 4.8 and .NET 8, since
the package targets both.  (It targets net48 as well because Razor views compiled at run time on
.NET Framework can't see netstandard assemblies.)

```
dotnet build Ren.sln
dotnet test Ren.sln
```

Packing needs a build of the client in the repo's `dist/` to put in the package, so pack with the
build command's `pack` (see "Releasing" in [docs/development.md](../docs/development.md)) rather than
`dotnet pack`.

`RenPackGoldenFilesTests` checks the writer's output byte for byte against the files in the
repo's `test/golden/`, which the client's tests decode.  If you change the output on purpose,
run the tests with `REN_WRITE_GOLDEN_FILES=1` set to rewrite them, then run
`dotnet run --project build/Ren.Build -- test` from the repo's root to check the client still
reads them.

### Layout

- `src/Ren/Building/` has the builder, and the column inference and value conversion behind it.
- `src/Ren/Models/` has the collection, its sets and tabs, and their columns and rows.
- `src/Ren/Compression/` has the compressor, which swaps strings for indexes into a dictionary,
  and dates for milliseconds since 1970.
- `src/Ren/RenPack/` has the renpack writer, its format constants, and the gzip helper.
- `src/Ren/Json/` has the JSON writer.
- `tests/Ren.Tests/` has the tests.
