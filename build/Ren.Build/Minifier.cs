namespace Ren.Build;

/// <summary>
/// Writes ren.min.js, ren.esm.min.js and ren.min.css, each with a source map, from the built
/// files, with esbuild.  esbuild follows each file's own source map, so the minified files map back
/// to src/ and styles/ rather than to the concatenated files.
///
/// Nothing is lowered to older syntax, as ren.js isn't.  Functions compiled on the page are
/// compiled in the global scope (see Ren.FunctionCompiler), so they name nothing esbuild renames,
/// and the precompiled format functions keep their unminified source for Ren to read (see
/// Ren.FormatFunctions).  The licence banner is a "/*!" comment, which esbuild keeps.
/// </summary>
internal static class Minifier
{
    /// <summary>
    /// The attempts made at minifying a file while another process, such as a virus scanner
    /// looking at the last build's file, briefly has the output open.
    /// </summary>
    private const int MaxAttempts = 5;

    /// <summary>
    /// The text of the Windows error esbuild reports when another process has the output open.
    /// </summary>
    private const string SharingViolation = "being used by another process";

    /// <summary>
    /// Minifies the built file of the specified name in dist/, writing it beside the original with
    /// ".min" before its extension, and gets the minified file's name.
    /// </summary>
    public static async Task<string> MinifyAsync(string fileName)
    {
        var extension = Path.GetExtension(fileName);
        var minifiedFileName = Path.GetFileNameWithoutExtension(fileName) + ".min" + extension;

        string[] args =
        [
            Path.Combine(Repo.Dist, fileName),
            "--outfile=" + Path.Combine(Repo.Dist, minifiedFileName),
            "--minify",
            "--sourcemap=linked",
            // The original sources are in the source map, as they are in the unminified files'.
            "--sources-content=true",
            "--legal-comments=inline",
            "--log-level=warning"
        ];

        for (var attempt = 1; ; attempt++)
        {
            var result = await Tools.RunEsbuildAsync(args);

            if (result.ExitCode == 0 || attempt == MaxAttempts
                || !(result.Error + result.Output).Contains(SharingViolation, StringComparison.Ordinal))
            {
                result.EnsureSuccess("Minifying " + fileName);

                return minifiedFileName;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt));
        }
    }
}
