using System.Text;
using System.Text.RegularExpressions;

namespace Ren.Client.Tests;

/// <summary>
/// Answers requests for the repo's files, for the tests' browser contexts (see
/// RepoServer.Routing.cs) and for Ren.Build's serve command.
///
/// The test fixtures in test/browser/fixtures/ are put in their layout (see FixtureLayout), a path
/// with no extension is served from its .json file, as a named data source's URI is, and the root
/// is an empty page.  Where REN_TEST_MINIFIED is set, the minified build is served in place of
/// ren.js, ren.esm.js and ren.css.
/// </summary>
public static partial class RepoServer
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".css"] = "text/css; charset=utf-8",
        [".gif"] = "image/gif",
        [".html"] = "text/html; charset=utf-8",
        [".ico"] = "image/x-icon",
        [".jpg"] = "image/jpeg",
        [".js"] = "text/javascript; charset=utf-8",
        [".json"] = "application/json; charset=utf-8",
        [".map"] = "application/json; charset=utf-8",
        [".md"] = "text/plain; charset=utf-8",
        [".mjs"] = "text/javascript; charset=utf-8",
        [".png"] = "image/png",
        [".renpack"] = "application/x-ren-tabular-v1",
        [".svg"] = "image/svg+xml",
        [".tsv"] = "text/tab-separated-values; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8",
        [".woff2"] = "font/woff2"
    };

    private const string BlankPage = "<html><head></head><body></body></html>";

    /// <summary>
    /// Gets the response to a request for a URL.
    /// </summary>
    public static Response Serve(string url)
    {
        var uri = new Uri(url);
        var path = Uri.UnescapeDataString(uri.AbsolutePath);

        if (path == "/") return new Response(200, ContentTypes[".html"], Encoding.UTF8.GetBytes(BlankPage));

        if (RepoFiles.TestMinified) path = BuiltLibraryFile().Replace(path, "$1.min$2");

        if (path.EndsWith('/')) path += "index.html";

        var fullPath = RepoFiles.GetFullPath(path);

        if (fullPath == null) return new Response(403, ContentTypes[".txt"], []);

        if (Path.GetExtension(fullPath) == "" && File.Exists(fullPath + ".json")) fullPath += ".json";

        if (!File.Exists(fullPath)) return new Response(404, ContentTypes[".txt"], Encoding.UTF8.GetBytes("Not found"));

        ContentTypes.TryGetValue(Path.GetExtension(fullPath), out var contentType);

        var body = FixtureLayout.LayOut(fullPath, uri.Query.TrimStart('?'), File.ReadAllBytes(fullPath));

        return new Response(200, contentType ?? "application/octet-stream", body);
    }

    /// <summary>
    /// A response: its status, content type and body.
    /// </summary>
    public sealed record Response(int Status, string ContentType, byte[] Body)
    {
        public string Text => Encoding.UTF8.GetString(Body);
    }

    [GeneratedRegex(@"(/dist/ren(?:\.esm)?)(\.(?:js|css))$")]
    private static partial Regex BuiltLibraryFile();
}
