using System.Text;

namespace Ren.Build;

/// <summary>
/// Builds ren.js from vendor/, src/ and the compiled templates, inside a function (so their
/// top-level names aren't globals), with a source map back to each file; ren.esm.js, the same as
/// an ES module; and the minified versions of both.
/// </summary>
internal static class Scripts
{
    public const string FileName = "ren.js";
    public const string EsmFileName = "ren.esm.js";

    private static string WrapperDirectory => Path.Combine(Repo.Root, "build", "script-wrapper");

    public static List<string> SourceFiles() =>
    [
        Path.Combine(WrapperDirectory, "open.js"),
        .. SourceOrder.GetOrderedFiles(Path.Combine(Repo.Root, "vendor"), ".js"),
        .. SourceOrder.GetOrderedFiles(Path.Combine(Repo.Root, "src"), ".js"),
        Templates.OutputFile,
        Path.Combine(WrapperDirectory, "close.js")
    ];

    /// <summary>
    /// Compiles the templates, then writes ren.js and ren.esm.js, then minifies them, publishing
    /// each file as it's written.
    /// </summary>
    public static async Task BuildAsync(BuildIdentity identity, Publisher publisher)
    {
        Templates.Write();
        WriteConcatenated(identity);
        publisher.Publish(identity, FileName);

        WriteEsm();
        publisher.Publish(identity, EsmFileName);

        await Task.WhenAll(
            MinifyAndPublishAsync(FileName),
            MinifyAndPublishAsync(EsmFileName));

        async Task MinifyAndPublishAsync(string fileName) =>
            publisher.Publish(identity, await Minifier.MinifyAsync(fileName));
    }

    /// <summary>
    /// Writes ren.js and its map.  The files are joined with a newline between each, and each of
    /// a file's lines maps to the start of the same line of the file.
    /// </summary>
    private static void WriteConcatenated(BuildIdentity identity)
    {
        var map = new SourceMap { File = FileName };
        var output = new StringBuilder();
        var line = 0;

        output.Append(LicenceBanner.Script(identity.Version)).Append('\n');

        var files = SourceFiles();

        for (var i = 0; i < files.Count; i++)
        {
            var content = Repo.ReadText(files[i]);
            var source = map.AddSource(Repo.Relative(files[i]), content);
            var lineCount = content.Count(c => c == '\n') + 1;

            for (var j = 0; j < lineCount; j++)
            {
                map.Line(line + j).Add(new Segment
                {
                    GeneratedColumn = 0,
                    Source = source,
                    OriginalLine = j,
                    OriginalColumn = 0,
                    Name = -1
                });
            }

            if (i > 0) output.Append('\n');

            output.Append(content);
            line += lineCount;
        }

        // The banner's line maps to nothing.
        map.InsertLinesAtTop(1);

        Repo.WriteText(Path.Combine(Repo.Dist, FileName),
            SourceMapComment.Append(output.ToString(), "//# sourceMappingURL=" + FileName + ".map"));
        Repo.WriteText(Path.Combine(Repo.Dist, FileName + ".map"), map.ToJson());
    }

    // ren.js runs inside a function, so the module declares no other names, and the export's own
    // name isn't Ren: the code in that function names the global Ren, which a module-level Ren
    // would hide (and be read before it was set).
    private const string EsmExports =
        "const renModuleExport = window.Ren;\n" +
        "export { renModuleExport as default, renModuleExport as Ren };\n";

    /// <summary>
    /// Writes ren.esm.js, ren.js as an ES module: the same script, then exports of Ren, as the
    /// default export and as Ren.  The exports go in before the source map comment, so every line
    /// before them is where it was, and ren.js's source map is copied for it.
    /// </summary>
    private static void WriteEsm()
    {
        var source = Repo.ReadText(Path.Combine(Repo.Dist, FileName));
        var comment = "//# sourceMappingURL=" + FileName + ".map";
        var commentIndex = source.LastIndexOf(comment, StringComparison.Ordinal);

        if (commentIndex < 0) throw new BuildException(FileName + " has no source map comment.");

        Repo.WriteText(Path.Combine(Repo.Dist, EsmFileName),
            source.Substring(0, commentIndex) + EsmExports + "//# sourceMappingURL=" + EsmFileName + ".map\n");

        var map = SourceMap.Parse(Repo.ReadText(Path.Combine(Repo.Dist, FileName + ".map")));

        map.File = EsmFileName;
        Repo.WriteText(Path.Combine(Repo.Dist, EsmFileName + ".map"), map.ToJson());
    }
}

/// <summary>
/// The one-line licence comment at the top of each built file, naming the build's version.  The
/// "/*!" comment is the kind minifiers keep.  ren.js's also names Prism, which is built into it.
/// </summary>
internal static class LicenceBanner
{
    private static string Banner(string version) => $"/*! Ren {version} | Copyright (c) 2026 Ed Smale | MIT licence";

    public static string Script(string version) =>
        Banner(version) + " | Includes Prism (MIT) - see THIRD-PARTY-NOTICES.md */";

    public static string Style(string version) => Banner(version) + " */";
}

internal static class SourceMapComment
{
    /// <summary>
    /// Puts the specified source map comment at the end of the specified file's text: after the
    /// text's own final line ending, followed by another the same.
    /// </summary>
    public static string Append(string text, string comment) =>
        text.EndsWith("\r\n", StringComparison.Ordinal) ? text + comment + "\r\n"
        : text.EndsWith('\n') ? text + comment + "\n"
        : text + "\n" + comment;
}
