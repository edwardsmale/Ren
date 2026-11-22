using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;

namespace Ren.Client.Tests;

/// <summary>
/// Puts a fixture page in a layout, as a host's page layout would for a report, so a fixture holds
/// only what a report would.  A fixture that's a whole page (starting with "&lt;!doctype") is served
/// as it is.  Otherwise, for test/browser/fixtures/&lt;path&gt;/&lt;Name&gt;.html:
/// - the page has Ren's statics, a ren.config pointing the namedDataSources endpoint at
///   ported/data/, and a report context named &lt;Name&gt; (PascalCased when it's hyphenated);
/// - &lt;Name&gt;.json beside it, if there is one, is the report's settings file;
/// - &lt;Name&gt;.js beside it, if there is one, is included after ren.js, for anything the page needs
///   to set up before Ren starts;
/// - the format functions in fixtures/format-functions/ are on the page, as a host would put its own
///   on every report page.
///
/// With "layout=embedded" in its query string, it's laid out as an embedded (popup) report instead:
/// just the report context, for Ren to fetch into a popup.
/// </summary>
public static partial class FixtureLayout
{
    private const string NamedDataSourcesPath = "/test/browser/fixtures/ported/data/";

    private static readonly string FixturesFolder = Path.Combine(RepoFiles.Root, "test", "browser", "fixtures");
    private static readonly string FormatFunctionsFolder = Path.Combine(FixturesFolder, "format-functions");

    private static readonly JsonSerializerOptions ScriptJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>
    /// Gets the content to serve for a file: a fixture laid out as above, or else the file as it is.
    /// </summary>
    public static byte[] LayOut(string filePath, string query, byte[] content)
    {
        if (!filePath.StartsWith(FixturesFolder + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            || Path.GetExtension(filePath) != ".html")
        {
            return content;
        }

        var html = WithoutBom(Encoding.UTF8.GetString(content));

        if (WholePage().IsMatch(html)) return content;

        var page = HttpUtility.ParseQueryString(query)["layout"] == "embedded"
            ? GetEmbeddedReport(filePath, html)
            : GetPage(filePath, html);

        return Encoding.UTF8.GetBytes(page);
    }

    private static string GetPage(string filePath, string body)
    {
        var reportName = GetReportName(filePath);
        var settings = ReadIfExists(Path.ChangeExtension(filePath, ".json"));

        var pageScript = File.Exists(Path.ChangeExtension(filePath, ".js"))
            ? $"    <script src=\"{Path.GetFileNameWithoutExtension(filePath)}.js\"></script>\n"
            : "";

        return $$"""
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>{{reportName}} - Ren test fixture</title>
                <link href="/dist/ren.css" rel="stylesheet" />
                <script src="/examples/lib/write-excel-file.v1.4.27.min.js"></script>
                <script src="/dist/ren.js"></script>
            {{pageScript}}{{GetFormatFunctionsScript()}}</head>
            <body>
                <script type="application/json" class="js-ren-config">
                { "endpoints": { "namedDataSources": "{{NamedDataSourcesPath}}" } }
                </script>
                <div class="js-ren-report-context js-ren-report-context--on-page
                            qa-ren-report-context qa-ren-report-context--on-page"
                     data-report-name="{{reportName}}"
                     data-settings-name=""
                     data-is-preset="true">
            {{GetSettingsScript(settings, 8)}}        <div class="ren-web-report-page">
            {{Indent(body, 12)}}
                    </div>
                </div>
            </body>
            </html>

            """.Replace("\r\n", "\n");
    }

    private static string GetEmbeddedReport(string filePath, string body)
    {
        var settings = ReadIfExists(Path.ChangeExtension(filePath, ".json"));

        return $$"""
            <div class="js-ren-report-context js-ren-report-context--embedded-report
                        qa-ren-report-context qa-ren-report-context--embedded-report"
                 data-report-name="{{GetReportName(filePath)}}">
            {{GetSettingsScript(settings, 4)}}    <div class="ren-web-report-page">
            {{Indent(body, 8)}}
                </div>
            </div>

            """.Replace("\r\n", "\n");
    }

    private static string GetReportName(string filePath) =>
        string.Concat(Path.GetFileNameWithoutExtension(filePath)
            .Split('-')
            .Select(part => part.Length == 0 ? part : char.ToUpperInvariant(part[0]) + part[1..]));

    private static string? ReadIfExists(string filePath) =>
        File.Exists(filePath) ? WithoutBom(File.ReadAllText(filePath, Encoding.UTF8)) : null;

    private static string WithoutBom(string text) => text.TrimStart('﻿');

    private static string Indent(string text, int spaces) =>
        string.Join("\n", text.Trim()
            .Split('\n')
            .Select(line => line.TrimEnd('\r'))
            .Select(line => line.Length > 0 ? new string(' ', spaces) + line : line));

    // Escaped so markup in a string (such as "</script>") can't end the element.
    private static string GetSettingsScript(string? settings, int spaces) => settings == null
        ? ""
        : Indent($"""
            <script type="application/json" class="js-ren-report-settings js-ren-report-settings-file">
            {settings.Trim().Replace("<", "\\u003c")}
            </script>
            """, spaces) + "\n";

    private static string GetFormatFunctionsScript()
    {
        if (!Directory.Exists(FormatFunctionsFolder)) return "";

        var formatFunctions = Directory.EnumerateFiles(FormatFunctionsFolder, "*.js")
            .Order(StringComparer.Ordinal)
            .ToDictionary(path => Path.GetFileNameWithoutExtension(path), path => ReadIfExists(path));

        var json = JsonSerializer.Serialize(formatFunctions, ScriptJson).Replace("</", "<\\/");

        return $"""
                <script class="format-function-source-code" type="application/data">
                {json}
                </script>

            """.Replace("\r\n", "\n");
    }

    [GeneratedRegex(@"^\s*<!doctype", RegexOptions.IgnoreCase)]
    private static partial Regex WholePage();
}
