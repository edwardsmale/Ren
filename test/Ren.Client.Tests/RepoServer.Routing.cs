using System.Net;
using System.Net.Sockets;

namespace Ren.Client.Tests;

public static partial class RepoServer
{
    private static HttpListener? listener;

    /// <summary>
    /// Starts serving the repo over HTTP at a free port on localhost, and gets the origin.  The
    /// browser fetches from it directly, which is much quicker for the built scripts than having
    /// Playwright answer each request.
    /// </summary>
    public static string Start()
    {
        var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();

        var origin = $"http://localhost:{port}";

        listener = new HttpListener();
        listener.Prefixes.Add(origin + "/");
        listener.Start();

        _ = Task.Run(async () =>
        {
            while (listener.IsListening)
            {
                HttpListenerContext context;

                try { context = await listener.GetContextAsync(); }
                catch (Exception) when (!listener.IsListening) { return; }

                _ = Task.Run(() => Answer(context));
            }
        });

        return origin;
    }

    public static void Stop() => listener?.Close();

    private static void Answer(HttpListenerContext context)
    {
        try
        {
            var response = Serve(context.Request.Url!.ToString());

            context.Response.StatusCode = response.Status;
            context.Response.ContentType = response.ContentType;
            context.Response.ContentLength64 = response.Body.Length;
            context.Response.OutputStream.Write(response.Body);
        }
        catch (Exception)
        {
            context.Response.StatusCode = 500;
        }
        finally
        {
            context.Response.Close();
        }
    }
}
