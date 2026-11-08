namespace Ren.Build;

/// <summary>
/// Writes ren.min.js, ren.esm.min.js and ren.min.css, each with a source map, from the built
/// files, with esbuild.  esbuild follows each file's own source map, so the minified files map back
/// to src/ and styles/ rather than to the concatenated files.
///
/// Nothing is lowered to older syntax, as ren.js isn't, and names aren't changed in a scope
/// holding a direct eval (esbuild leaves those alone), so format functions can still name what's in
/// scope where they're compiled.  The licence banner is a "/*!" comment, which esbuild keeps.
/// </summary>
internal static class Minifier
{
    /// <summary>
    /// Minifies the built file of the specified name in dist/, writing it beside the original with
    /// ".min" before its extension, and gets the minified file's name.
    /// </summary>
    public static async Task<string> MinifyAsync(string fileName)
    {
        var extension = Path.GetExtension(fileName);
        var minifiedFileName = Path.GetFileNameWithoutExtension(fileName) + ".min" + extension;

        (await Tools.RunEsbuildAsync(
        [
            Path.Combine(Repo.Dist, fileName),
            "--outfile=" + Path.Combine(Repo.Dist, minifiedFileName),
            "--minify",
            "--sourcemap=linked",
            // The original sources are in the source map, as they are in the unminified files'.
            "--sources-content=true",
            "--legal-comments=inline",
            "--log-level=warning"
        ])).EnsureSuccess("Minifying " + fileName);

        return minifiedFileName;
    }
}
