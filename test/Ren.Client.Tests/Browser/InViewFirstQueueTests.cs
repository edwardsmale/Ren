namespace Ren.Client.Tests.Browser;

// The queue a visualisation's redraws go through, which redraws those in view before the rest.
[TestClass]
public class InViewFirstQueueTests : BrowserTest
{
    [TestMethod("work for what's in view runs before work for what isn't, each in its own task")]
    public async Task WorkInViewRunsFirst_EachInItsOwnTask()
    {
        await Ren.OpenAsync("grid.html");

        var order = await Page.EvaluateAsync<string[]>("""
            () => new Promise(resolve => {

                const place = (css) => {

                    const element = document.createElement("div");
                    element.style.cssText = "position: fixed; width: 10px; height: 10px; " + css;
                    document.body.append(element);
                    return element;
                };

                const inView = place("top: 0; left: 0");
                const below = place("top: 200vh; left: 0");
                const hidden = place("top: 0; left: 0; display: none");

                const order = [];
                let isInTask = false;

                // Each piece of work notes whether it shares a task with the one before, which a
                // microtask, run as each task ends, would have cleared.
                const work = (name) => () => {

                    order.push(name + (isInTask ? " (shared task)" : ""));
                    isInTask = true;
                    queueMicrotask(() => { isInTask = false; });

                    if (order.length === 5) resolve(order);
                };

                const queue = window.Ren.InViewFirstQueue;

                queue.add(work("below"), below);
                queue.add(work("in view"), inView);
                queue.add(work("hidden"), hidden);
                queue.add(work("no element"));
                queue.add(work("in view 2"), inView);
            })
            """);

        CollectionAssert.AreEqual(
            new[] { "in view", "no element", "in view 2", "below", "hidden" },
            order);
    }
}
