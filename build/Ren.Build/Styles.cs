using System.Text;
using System.Text.RegularExpressions;

namespace Ren.Build;

/// <summary>
/// Builds ren.css from styles/: each file that isn't a partial (whose name starts with "_") is
/// compiled with Dart Sass, then given the vendor prefixes the browsers Ren supports need, with
/// Lightning CSS.  They're joined in source order under the licence banner, with a single
/// @charset at the very top, with a source map back to styles/.  Then it's minified into
/// ren.min.css.
/// </summary>
internal static partial class Styles
{
    public const string FileName = "ren.css";

    private const string CharsetRule = "@charset \"UTF-8\";";

    // The browsers Ren supports, as a browserslist query.  Lightning CSS adds the prefixes these
    // need.
    public const string Browsers = "> 1%, last 2 versions";

    private static string SassDirectory => Path.Combine(Repo.Generated, "styles", "sass");
    private static string PrefixedDirectory => Path.Combine(Repo.Generated, "styles", "prefixed");

    public static List<string> SourceFiles() =>
        SourceOrder.GetOrderedFiles(Path.Combine(Repo.Root, "styles"), ".scss")
            .Where(file => !Path.GetFileName(file).StartsWith('_'))
            .ToList();

    public static async Task BuildAsync(BuildIdentity identity, Publisher publisher)
    {
        var files = SourceFiles();

        if (files.Count == 0)
        {
            Log.Info("No styles to build");
            return;
        }

        await CompileAsync(files);

        var prefixed = new SourceFileResult[files.Count];

        await Parallel.ForEachAsync(Enumerable.Range(0, files.Count),
            new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
            async (i, _) => prefixed[i] = await PrefixAsync(files[i]));

        WriteConcatenated(identity, prefixed);
        publisher.Publish(identity, FileName);
        publisher.Publish(identity, await Minifier.MinifyAsync(FileName));
    }

    private sealed record SourceFileResult(string Css, SourceMap Map);

    private static string IntermediateName(string file) => Path.GetFileNameWithoutExtension(file) + ".css";

    /// <summary>
    /// Compiles each file into .generated/styles/sass/, with a source map, in one run of Dart Sass.
    /// Its paths are given relative to the repo, since Sass reads an absolute Windows path's drive
    /// colon as the colon between a file and its output.
    /// </summary>
    private static async Task CompileAsync(List<string> files)
    {
        if (Directory.Exists(SassDirectory)) Directory.Delete(SassDirectory, recursive: true);

        Directory.CreateDirectory(SassDirectory);

        var args = new List<string> { "--no-charset", "--embed-sources", "--no-error-css" };

        foreach (var file in files)
        {
            args.Add(Repo.Relative(file) + ":" + Repo.Relative(Path.Combine(SassDirectory, IntermediateName(file))));
        }

        var result = (await Tools.RunSassAsync(args)).EnsureSuccess("Sass");
        var warnings = (result.Error + result.Output).Trim();

        if (warnings.Length > 0) Log.Warning(warnings);
    }

    /// <summary>
    /// Adds the prefixes to a compiled file with Lightning CSS, and gets the result, with a map
    /// straight back to its Sass sources (Lightning CSS's own map only goes back to Sass's CSS).
    /// </summary>
    private static async Task<SourceFileResult> PrefixAsync(string file)
    {
        var compiled = Path.Combine(SassDirectory, IntermediateName(file));
        var output = Path.Combine(PrefixedDirectory, IntermediateName(file));

        Directory.CreateDirectory(PrefixedDirectory);

        (await Tools.RunLightningCssAsync(["--targets", Browsers, "--sourcemap", "-o", output, compiled]))
            .EnsureSuccess("Lightning CSS, for " + Repo.Relative(file));

        var sassMap = ReadMap(compiled + ".map");
        var prefixedMap = SourceMap.Parse(Repo.ReadText(output + ".map"));

        if (prefixedMap.Sources.Count > 1)
        {
            throw new BuildException($"Lightning CSS's map for {Repo.Relative(file)} has more than one source.");
        }

        var css = SourceMapCommentPattern().Replace(Repo.ReadText(output), "");

        return new SourceFileResult(css, prefixedMap.ChainThrough(sassMap));
    }

    /// <summary>
    /// Reads one of Sass's maps, with its sources made relative to the repo.
    /// </summary>
    private static SourceMap ReadMap(string path)
    {
        var map = SourceMap.Parse(Repo.ReadText(path));
        var directory = Path.GetDirectoryName(path)!;

        for (var i = 0; i < map.Sources.Count; i++)
        {
            var source = map.Sources[i];

            if (source.StartsWith("file:", StringComparison.Ordinal)) source = new Uri(source).LocalPath;

            map.Sources[i] = Repo.Relative(Path.GetFullPath(Path.Combine(directory, Uri.UnescapeDataString(source))));
        }

        return map;
    }

    /// <summary>
    /// Writes ren.css and its map: the files joined with a newline between each, under the licence
    /// banner, under the @charset rule.
    /// </summary>
    private static void WriteConcatenated(BuildIdentity identity, SourceFileResult[] files)
    {
        var map = new SourceMap { File = FileName };
        var output = new StringBuilder();
        var line = 0;

        for (var i = 0; i < files.Length; i++)
        {
            if (i > 0) output.Append('\n');

            output.Append(files[i].Css);
            map.Append(files[i].Map, line, source => source);
            line += files[i].Css.Count(c => c == '\n') + 1;
        }

        map.InsertLinesAtTop(2);

        var css = CharsetRule + "\n" + LicenceBanner.Style(identity.Version) + "\n" + output;

        Repo.WriteText(Path.Combine(Repo.Dist, FileName),
            SourceMapComment.Append(css, "/*# sourceMappingURL=" + FileName + ".map */"));
        Repo.WriteText(Path.Combine(Repo.Dist, FileName + ".map"), map.ToJson());
    }

    [GeneratedRegex(@"/\*# sourceMappingURL=[^*]*\*/\s*$")]
    private static partial Regex SourceMapCommentPattern();
}
