using System.Net;
using Ren.Client.Tests;

namespace Ren.Build;

/// <summary>
/// Serves the repo over HTTP, for the pages in examples/, which can't fetch their data from
/// file://, and for opening a test fixture in a browser.  It answers requests just as the browser
/// tests' pages are answered (see test/Ren.Client.Tests/RepoServer.cs), so a fixture is put in
/// its layout, and REN_TEST_MINIFIED serves the minified build.
/// </summary>
internal static class Server
{
    public static async Task RunAsync(int port)
    {
        var prefix = $"http://localhost:{port}/";
        using var listener = new HttpListener();

        listener.Prefixes.Add(prefix);

        try
        {
            listener.Start();
        }
        catch (HttpListenerException e)
        {
            throw new BuildException($"Can't serve at {prefix}: {e.Message}");
        }

        Log.Info($"Serving {Repo.Root} at {prefix}examples/");

        while (true)
        {
            var context = await listener.GetContextAsync();

            _ = Task.Run(() => Answer(context));
        }
    }

    private static void Answer(HttpListenerContext context)
    {
        try
        {
            var response = RepoServer.Serve(context.Request.Url!.ToString());

            context.Response.StatusCode = response.Status;
            context.Response.ContentType = response.ContentType;
            context.Response.ContentLength64 = response.Body.Length;
            context.Response.OutputStream.Write(response.Body);
        }
        catch (Exception e)
        {
            Log.Error($"{context.Request.Url}: {e.Message}");
            context.Response.StatusCode = 500;
        }
        finally
        {
            context.Response.Close();
        }
    }
}
