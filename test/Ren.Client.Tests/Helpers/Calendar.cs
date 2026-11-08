namespace Ren.Client.Tests;

/// <summary>
/// Helpers for Ren's calendar.  They act on the showing calendar: the last one shown on the page,
/// which is the one most recently opened where one is open over another.
/// </summary>
public static class Calendar
{
    private const string ShowingCalendar = """
        const calendars = Array.from(document.querySelectorAll(".qa-ren-calendar"))
            .filter(calendar => calendar.offsetParent !== null);
        const calendar = calendars[calendars.length - 1];
        """;

    /// <summary>
    /// Dispatches an event at an element of the showing calendar, failing until there is one.
    /// </summary>
    public static async Task DispatchAsync(RenContext ren, string selector, string eventType, object? options = null)
    {
        await new PollExpectation<bool>(
            () => ren.Page.EvaluateAsync<bool>($$"""
                ([elementSelector, type, eventOptions]) => {

                    {{ShowingCalendar}}
                    const element = calendar ? calendar.querySelector(elementSelector) : null;

                    if (!element) {
                        return false;
                    }

                    const init = Object.assign({ bubbles: true, cancelable: true }, eventOptions);

                    element.dispatchEvent(type === "wheel"
                        ? new WheelEvent(type, Object.assign({ deltaMode: WheelEvent.DOM_DELTA_PIXEL }, init))
                        : new MouseEvent(type, init));

                    return true;
                }
                """, new object[] { selector, eventType, options ?? new { } }),
            "the showing calendar's " + selector)
            .ToBe(true);

        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Gets the dates (yyyy-MM-dd) of the days the showing calendar draws, in the order drawn, or
    /// none when no calendar is showing.
    /// </summary>
    public static Task<string[]> DayDatesAsync(RenContext ren) => ren.Page.EvaluateAsync<string[]>($$"""
        () => {

            {{ShowingCalendar}}

            return calendar
                ? Array.from(calendar.querySelectorAll(".js-ren-calendar-day"))
                    .map(day => day.getAttribute("data-date"))
                : [];
        }
        """);

    /// <summary>
    /// Clicks a day of the showing calendar.  The first click of a range picks its start and the
    /// second its end, while a Shift + click extends the range picked so far.
    /// </summary>
    public static Task ClickDayAsync(RenContext ren, string date, bool shiftKey = false) =>
        DispatchAsync(ren, $".js-ren-calendar-day[data-date='{date}']", "click", new { shiftKey });

    /// <summary>
    /// Closes the popup window the showing calendar is in.
    /// </summary>
    public static async Task CloseShowingAsync(RenContext ren)
    {
        var closed = await ren.Page.EvaluateAsync<bool>($$"""
            () => {

                {{ShowingCalendar}}
                const popup = calendar ? calendar.closest(".ren-report-popup-window") : null;

                if (!popup) {
                    return false;
                }

                popup.querySelector(".ren-report-popup-window__close-button").click();
                return true;
            }
            """);

        new ValueExpectation<bool>(closed, "a calendar popup showing").ToBe(true);

        await new PollExpectation<string[]>(() => DayDatesAsync(ren)).ToEqual(Array.Empty<string>());
    }
}
