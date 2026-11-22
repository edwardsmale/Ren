using Microsoft.Playwright;

namespace Ren.Client.Tests;

public static partial class RepoServer
{
    /// <summary>
    /// Answers every request a context makes to the origin with the repo's files.
    /// </summary>
    public static Task ServeAsync(IBrowserContext context, string origin) =>
        context.RouteAsync(origin + "/**", async route =>
        {
            var response = Serve(route.Request.Url);

            await route.FulfillAsync(new RouteFulfillOptions
            {
                Status = response.Status,
                ContentType = response.ContentType,
                BodyBytes = response.Body
            });
        });
}
