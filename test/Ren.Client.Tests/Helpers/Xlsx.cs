using System.Globalization;
using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Reads back the Excel files a page saves, with .NET's own ZIP and XML readers rather than
/// anything of Ren's, so that a file Ren writes wrongly can't be read back as it meant.
/// </summary>
public static class Xlsx
{
    private static readonly XNamespace Main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace Rels = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRels = "http://schemas.openxmlformats.org/package/2006/relationships";

    /// <summary>A cell: its text or number as written, its formula, and how it's shown.</summary>
    public sealed record Cell(string Ref, string Value, string? Formula, string? NumberFormat, bool Bold)
    {
        public double Number => double.Parse(Value, NumberStyles.Float, CultureInfo.InvariantCulture);

        /// <summary>Gets the cell's number as a date, as Excel counts days from 30 December 1899.</summary>
        public DateTime Date => DateTime.FromOADate(Number);
    }

    /// <summary>A sheet, with its rows' cells by column letter (an empty cell has none).</summary>
    public sealed record Sheet(string Name, int FrozenRows, Dictionary<string, double> ColumnWidths, Dictionary<string, Cell>[] Rows)
    {
        public string[] Headings => Rows[0].Values.Select(cell => cell.Value).ToArray();

        public Cell? this[string reference] => Rows
            .SelectMany(row => row.Values)
            .FirstOrDefault(cell => cell.Ref == reference);
    }

    public sealed record Workbook(string FileName, string MimeType, Sheet[] Sheets);

    /// <summary>
    /// Reads a workbook from its bytes.
    /// </summary>
    public static Workbook Read(string fileName, string mimeType, byte[] bytes)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);

        XDocument Load(string name)
        {
            var entry = zip.GetEntry(name) ?? throw new AssertFailedException($"The workbook has no {name}.");
            using var stream = entry.Open();

            return XDocument.Load(stream);
        }

        // Each part must be there and be well-formed XML, even those only Excel reads.
        Load("[Content_Types].xml");
        Load("_rels/.rels");

        var workbook = Load("xl/workbook.xml");
        var targets = Load("xl/_rels/workbook.xml.rels").Root!
            .Elements(PackageRels + "Relationship")
            .ToDictionary(rel => (string)rel.Attribute("Id")!, rel => (string)rel.Attribute("Target")!);

        var styles = Load("xl/styles.xml").Root!;
        var numberFormats = styles.Element(Main + "numFmts")?.Elements(Main + "numFmt")
            .ToDictionary(format => (int)format.Attribute("numFmtId")!, format => (string)format.Attribute("formatCode")!)
            ?? [];
        var boldFonts = styles.Element(Main + "fonts")!.Elements(Main + "font")
            .Select(font => font.Element(Main + "b") != null)
            .ToArray();
        var cellStyles = styles.Element(Main + "cellXfs")!.Elements(Main + "xf")
            .Select(xf => (
                Format: numberFormats.GetValueOrDefault((int)xf.Attribute("numFmtId")!),
                Bold: boldFonts[(int)xf.Attribute("fontId")!]))
            .ToArray();

        var sheets = workbook.Root!.Element(Main + "sheets")!.Elements(Main + "sheet").Select(sheet =>
        {
            var xml = Load("xl/" + targets[(string)sheet.Attribute(Rels + "id")!]).Root!;

            var pane = xml.Descendants(Main + "pane").FirstOrDefault();
            var frozenRows = (string?)pane?.Attribute("state") == "frozen" ? (int?)pane.Attribute("ySplit") ?? 0 : 0;

            var widths = new Dictionary<string, double>();

            foreach (var col in xml.Descendants(Main + "col"))
            {
                for (var i = (int)col.Attribute("min")!; i <= (int)col.Attribute("max")!; i++)
                {
                    widths[ColumnLetters(i - 1)] = (double)col.Attribute("width")!;
                }
            }

            var rows = xml.Element(Main + "sheetData")!.Elements(Main + "row").Select(row => row
                .Elements(Main + "c")
                .Select(c =>
                {
                    var reference = (string)c.Attribute("r")!;
                    var style = cellStyles[(int?)c.Attribute("s") ?? 0];
                    var value = (string?)c.Attribute("t") == "inlineStr"
                        ? string.Concat(c.Element(Main + "is")!.Elements(Main + "t").Select(t => t.Value))
                        : c.Element(Main + "v")?.Value ?? "";

                    return new Cell(reference, value, c.Element(Main + "f")?.Value, style.Format, style.Bold);
                })
                .ToDictionary(cell => cell.Ref.TrimEnd("0123456789".ToCharArray())))
                .ToArray();

            return new Sheet((string)sheet.Attribute("name")!, frozenRows, widths, rows);
        }).ToArray();

        return new Workbook(fileName, mimeType, sheets);
    }

    /// <summary>
    /// Gets a column's letters from its place counting from 0, as Excel names them.
    /// </summary>
    public static string ColumnLetters(int index)
    {
        var letters = "";

        for (var n = index + 1; n > 0; n = (n - 1) / 26)
        {
            letters = (char)('A' + (n - 1) % 26) + letters;
        }

        return letters;
    }

    /// <summary>
    /// Makes the page keep the files it saves rather than download them (headless Chrome doesn't),
    /// catching each one's blob and name as the link to it is clicked.
    /// </summary>
    public static Task CatchDownloadsAsync(IPage page) => page.EvaluateAsync("""
        () => {

            window.caughtDownloads = [];

            const blobsByUrl = {};
            const createObjectURL = URL.createObjectURL;

            URL.createObjectURL = (blob) => {

                const url = createObjectURL(blob);

                blobsByUrl[url] = blob;

                return url;
            };

            HTMLAnchorElement.prototype.click = function () {

                window.caughtDownloads.push({ name: this.download, blob: blobsByUrl[this.href] });
            };
        }
        """);

    /// <summary>
    /// Waits for the page to save a file, after CatchDownloadsAsync, and reads it as a workbook.
    /// </summary>
    public static async Task<Workbook> CaughtWorkbookAsync(IPage page)
    {
        await page.WaitForFunctionAsync("() => window.caughtDownloads.length > 0");

        var download = await page.EvaluateAsync<string[]>("""
            async () => {

                const download = window.caughtDownloads[0];
                const bytes = new Uint8Array(await download.blob.arrayBuffer());

                let binary = "";

                for (let i = 0; i < bytes.length; i += 0x8000) {

                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                }

                return [download.name, download.blob.type, btoa(binary)];
            }
            """);

        return Read(download[0], download[1], Convert.FromBase64String(download[2]));
    }

    /// <summary>
    /// Makes a workbook in the page from the given sheets (as Ren.XlsxWriter takes them, with a
    /// date given as { utc: milliseconds }), and reads it back.
    /// </summary>
    public static async Task<Workbook> CreateAsync(IPage page, object sheets)
    {
        var base64 = await page.EvaluateAsync<string>("""
            async (sheets) => {

                const revive = value => value && typeof value === "object" && "utc" in value
                    ? new Date(value.utc)
                    : value;

                const blob = await Ren.XlsxWriter.createWorkbook(sheets.map(sheet => ({
                    ...sheet,
                    rows: (sheet.rows || []).map(row => row.map(revive))
                })));

                const bytes = new Uint8Array(await blob.arrayBuffer());

                let binary = "";

                for (let i = 0; i < bytes.length; i += 0x8000) {

                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                }

                return btoa(binary);
            }
            """, sheets);

        return Read("", "", Convert.FromBase64String(base64));
    }
}
