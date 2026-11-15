namespace Ren.Client.Tests.Browser;

// These tests cover a grid's data source: the data formats Ren reads from a fetch-uri or src, the
// column hints those formats can carry, the options its requests are made with, and the errors it
// shows when the data can't be read.
[TestClass]
public class DataSourceTests : BrowserTest
{
    private async Task<string> ErrorMessageAsync()
    {
        var message = Ren.Root.Locator(".qa-ren-data-source-error-message").First;

        await message.WaitForAsync(new() { State = Microsoft.Playwright.WaitForSelectorState.Attached });

        return await message.InnerTextAsync();
    }

    private Task FailingAsync(string name) => Page.RouteAsync("**/data-sources/" + name, route =>
        route.FulfillAsync(new() { Status = 500, ContentType = "text/plain", Body = "Server error" }));

    private static string LastPathSegment(string url) => new Uri(url).AbsolutePath.Split('/').Last();

    [TestMethod("Columns and rows data: asked for by data-format is read")]
    public async Task ColumnsAndRowsAskedForByDataFormatIsRead()
    {
        await Ren.OpenAsync("data-sources/columns-and-rows.html");

        var text = await Ren.Grid(0).ColumnTextAsync("Product", "Quantity");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("Paper");
        Expect(text).ToContain("12");
    }

    [TestMethod("Columns and rows data: starting with its columns is recognised without a data-format")]
    public async Task ColumnsAndRowsStartingWithItsColumnsIsRecognisedWithoutADataFormat()
    {
        await Ren.OpenAsync("data-sources/columns-and-rows.html");

        var text = await Ren.Grid(1).ColumnTextAsync("Product", "Quantity");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("Paper");
        Expect(text).ToContain("12");
    }

    [TestMethod("Columns and rows data: starting with its rows is recognised once parsed")]
    public async Task ColumnsAndRowsStartingWithItsRowsIsRecognisedOnceParsed()
    {
        await Ren.OpenAsync("data-sources/columns-and-rows.html");

        var text = await Ren.Grid(2).ColumnTextAsync("Product", "Quantity");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("12");
    }

    [TestMethod("Columns and rows data: with no rows is read as its columns with no rows")]
    public async Task ColumnsAndRowsWithNoRowsIsReadAsItsColumnsWithNoRows()
    {
        await Ren.OpenAsync("data-sources/columns-and-rows-empty.html");

        await Page.WaitForFunctionAsync("() => window.Ren.DataSources.getDataSources().length > 0");

        var table = await Page.EvaluateAsync<string>("""
            () => {

                const tabularData =
                    window.Ren.DataSources.getDataSources()[0].tabularDataSet.TabularDatas[0];
                const columnIds = [];

                for (let i = 0; i < tabularData.ColumnModels.length; i++) {
                    columnIds.push(tabularData.ColumnModels[i].ColumnId);
                }

                return columnIds.join(",") + " / " + tabularData.RowModels.length;
            }
            """);

        Expect(table).ToBe("__Count,Product,Quantity,OrderDate / 0");
        await Expect(Ren.Root.Locator(".qa-ren-data-source-error-message")).ToHaveCountAsync(0);
        await Expect(Page.Locator(".ren-popup-message--Error")).ToHaveCountAsync(0);
    }

    [TestMethod("Columns and rows data: with column hints takes their headings and types")]
    public async Task ColumnsAndRowsWithColumnHintsTakesTheirHeadingsAndTypes()
    {
        await Ren.OpenAsync("data-sources/column-hints.html");

        var text = await Ren.Grid(0).ColumnTextAsync("Item", "Code");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("007");
    }

    [TestMethod("Columns and rows data: with a column hint's format gives the column that format")]
    public async Task ColumnsAndRowsWithAColumnHintsFormatGivesTheColumnThatFormat()
    {
        await Ren.OpenAsync("data-sources/column-hints.html");

        var format = await Page.EvaluateAsync<string>("""
            () => {

                const dataSources = window.Ren.DataSources.getDataSources();

                for (let i = 0; i < dataSources.length; i++) {

                    const tabularDatas = dataSources[i].tabularDataSet.TabularDatas;

                    for (let j = 0; j < tabularDatas.length; j++) {

                        const columnModels = tabularDatas[j].ColumnModels;

                        for (let k = 0; k < columnModels.length; k++) {

                            if (columnModels[k].ColumnId === "Price") {
                                return window.Ren.SpreadsheetColumnFormatEnum.AsString(
                                    columnModels[k].ColumnFormat
                                );
                            }
                        }
                    }
                }

                return "no Price column";
            }
            """);

        Expect(format).ToBe("Currency");
    }

    [TestMethod("An array of objects: with column hints takes their headings and types")]
    public async Task AnArrayOfObjectsWithColumnHintsTakesTheirHeadingsAndTypes()
    {
        await Ren.OpenAsync("data-sources/column-hints.html");

        var text = await Ren.Grid(1).ColumnTextAsync("Item", "Code");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("012");
    }

    [TestMethod("An array of objects: asked for by data-format is read")]
    public async Task AnArrayOfObjectsAskedForByDataFormatIsRead()
    {
        await Ren.OpenAsync("data-sources/column-hints.html");

        var text = await Ren.Grid(2).ColumnTextAsync("Product", "Quantity");

        Expect(text).ToContain("Pens");
        Expect(text).ToContain("12");
    }

    [TestMethod("a src given in place of a fetch-uri is fetched")]
    public async Task ASrcGivenInPlaceOfAFetchUriIsFetched()
    {
        await Ren.OpenAsync("data-sources/src.html");

        var text = await Ren.Grid(0).ColumnTextAsync("Product", "Quantity");

        Expect(text).ToContain("Stapler");
        Expect(text).ToContain("12");
    }

    [TestMethod("A named data source: given by data-source-name is fetched")]
    public async Task ANamedDataSourceGivenByDataSourceNameIsFetched()
    {
        await Ren.OpenAsync("data-sources/data-source-name.html");

        Expect(await Ren.Grid(0).ColumnTextAsync("Product", "Quantity")).ToContain("Stapler");
    }

    [TestMethod("A named data source: given by sql-filename, its older name, is fetched")]
    public async Task ANamedDataSourceGivenBySqlFilenameIsFetched()
    {
        await Ren.OpenAsync("data-sources/data-source-name.html");

        Expect(await Ren.Grid(1).ColumnTextAsync("Product", "Quantity")).ToContain("Stapler");
    }

    [TestMethod("A named data source: given by both is the data-source-name's")]
    public async Task ANamedDataSourceGivenByBothIsTheDataSourceNames()
    {
        var requested = new List<string>();

        Page.Request += (_, request) =>
        {
            lock (requested) requested.Add(new Uri(request.Url).AbsolutePath);
        };

        await Ren.OpenAsync("data-sources/data-source-name.html");

        Expect(await Ren.Grid(2).ColumnTextAsync("Product", "Quantity")).ToContain("Stapler");

        lock (requested)
        {
            Expect(requested.Where(path => path.EndsWith("/background-status")).ToArray()).ToEqual(Array.Empty<string>());
        }
    }

    [TestMethod("request options configured and hooked are applied over Ren's own")]
    public async Task RequestOptionsConfiguredAndHookedAreAppliedOverRensOwn()
    {
        await Ren.OpenAsync("data-sources/src.html");

        var options = await Page.EvaluateAsync<string[]>("""
            async () => {

                window.Ren.configure({
                    dataSourceRequests: {
                        credentials: "include",
                        headers: { "X-Test": "configured" }
                    }
                });

                window.Ren.Extensions.registerDataSourceRequestHook(async (uri, requestOptions) => {

                    requestOptions.headers.Authorization = "Bearer " + uri;
                });

                const options = await window.Ren.DataSourceRequests
                    .getOptions("/data", { headers: { Accept: "text/plain" } });

                return [
                    options.headers.Accept,
                    options.headers["X-Test"],
                    options.headers.Authorization,
                    options.credentials
                ];
            }
            """);

        Expect(options).ToEqual(new[] { "text/plain", "configured", "Bearer /data", "include" });
    }

    [TestMethod("A named data source's registered options: noCache fetches it afresh where others may be cached")]
    public async Task NoCacheFetchesItAfreshWhereOthersMayBeCached()
    {
        var requests = new Dictionary<string, Dictionary<string, string>>();

        Page.Request += (_, request) =>
        {
            lock (requests) requests[LastPathSegment(request.Url)] = request.Headers;
        };

        await Ren.OpenAsync("data-sources/named-options.html");

        lock (requests)
        {
            Expect(requests["columns-and-rows-with-hints"].GetValueOrDefault("cache-control")).ToBe("no-cache");
            Expect(requests["columns-and-rows"].GetValueOrDefault("cache-control")).ToBeNull();
        }
    }

    [TestMethod("A named data source's registered options: quiet shows no popup for its failure")]
    public async Task QuietShowsNoPopupForItsFailure()
    {
        await FailingAsync("background-status");
        await Ren.OpenAsync("data-sources/named-options.html");

        Expect(await Ren.Grid(0).ColumnTextAsync("Product", "Quantity")).ToContain("Stapler");
        await Expect(Page.Locator(".ren-popup-message--Error")).ToHaveCountAsync(0);
    }

    [TestMethod("A named data source's registered options: left out shows a popup for its failure")]
    public async Task LeftOutShowsAPopupForItsFailure()
    {
        await FailingAsync("columns-and-rows");
        await Ren.OpenAsync("data-sources/named-options.html");

        await Expect(Page.Locator(".ren-popup-message--Error")).ToHaveCountAsync(1);
    }

    [TestMethod("A data source that can't be read: because it isn't found shows the status as an error")]
    public async Task BecauseItIsntFoundShowsTheStatusAsAnError()
    {
        await Ren.OpenAsync("data-sources/not-found.html");

        Expect(await ErrorMessageAsync()).ToContain("404");
    }

    [TestMethod("A data source that can't be read: because it's in no known format shows the formats Ren reads")]
    public async Task BecauseItsInNoKnownFormatShowsTheFormatsRenReads()
    {
        await Ren.OpenAsync("data-sources/unknown-format.html");

        var message = await ErrorMessageAsync();

        Expect(message).ToContain("isn't in a data format Ren recognises");
        Expect(message).ToContain("columns-and-rows");
    }
}
