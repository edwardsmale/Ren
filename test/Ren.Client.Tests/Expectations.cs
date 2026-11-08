using System.Collections;
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Ren.Client.Tests;

/// <summary>
/// A test of a value, such as "to be 3", which a value passes or fails.
/// </summary>
public sealed record Matcher(string Description, Func<object?, bool> Test);

/// <summary>
/// The tests of values the expectations make.  Numbers compare by value whatever their type, and
/// "equal" compares structure, as JSON: lists item by item and objects property by property, so a
/// result read from the page as JSON equals an anonymous object or array with the same content.
/// </summary>
public static class Matchers
{
    private static readonly JsonSerializerOptions FormatOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static Matcher ToBe(object? expected) => new("to be " + Format(expected), actual => Same(actual, expected));

    public static Matcher ToEqual(object? expected) => new("to equal " + Format(expected), actual => DeepEqual(actual, expected));

    public static Matcher ToBeNull() => new("to be null", actual => actual == null || actual is JsonElement { ValueKind: JsonValueKind.Null or JsonValueKind.Undefined });

    public static Matcher ToBeTruthy() => new("to be truthy", IsTruthy);

    public static Matcher ToBeFalsy() => new("to be falsy", actual => !IsTruthy(actual));

    public static Matcher ToBeNaN() => new("to be NaN", actual => IsNumber(actual) && double.IsNaN(ToDouble(actual)));

    public static Matcher ToBeGreaterThan(double expected) => new("to be greater than " + Format(expected), actual => ToDouble(actual) > expected);

    public static Matcher ToBeGreaterThanOrEqual(double expected) => new("to be greater than or equal to " + Format(expected), actual => ToDouble(actual) >= expected);

    public static Matcher ToBeLessThan(double expected) => new("to be less than " + Format(expected), actual => ToDouble(actual) < expected);

    public static Matcher ToBeLessThanOrEqual(double expected) => new("to be less than or equal to " + Format(expected), actual => ToDouble(actual) <= expected);

    /// <summary>
    /// To be within half a unit of the given decimal place of the expected number.
    /// </summary>
    public static Matcher ToBeCloseTo(double expected, int digits = 2) =>
        new($"to be close to {Format(expected)} ({digits} digits)", actual => Math.Abs(ToDouble(actual) - expected) < Math.Pow(10, -digits) / 2);

    /// <summary>
    /// To contain the expected text, where the value is text, or else an item equal to the expected.
    /// </summary>
    public static Matcher ToContain(object? expected) => new("to contain " + Format(expected), actual => actual switch
    {
        string text => expected is string part && text.Contains(part, StringComparison.Ordinal),
        _ => Items(actual).Any(item => DeepEqual(item, expected))
    });

    public static Matcher ToHaveLength(int expected) => new("to have length " + expected, actual => actual switch
    {
        string text => text.Length == expected,
        _ => Items(actual).Count() == expected
    });

    public static Matcher ToMatch(string pattern) => ToMatch(new Regex(pattern));

    public static Matcher ToMatch(Regex pattern) => new("to match /" + pattern + "/", actual => actual is string text && pattern.IsMatch(text));

    /// <summary>
    /// Gets whether two values are the same: numbers by value, and anything else by Equals.
    /// </summary>
    public static bool Same(object? actual, object? expected)
    {
        if (IsNumber(actual) && IsNumber(expected))
        {
            var a = ToDouble(actual);
            var b = ToDouble(expected);

            return a.Equals(b);
        }

        if (actual is JsonElement or JsonNode || expected is JsonElement or JsonNode) return DeepEqual(actual, expected);

        return Equals(actual, expected);
    }

    /// <summary>
    /// Gets whether two values have the same structure and content, compared as JSON.
    /// </summary>
    public static bool DeepEqual(object? actual, object? expected) => NodesEqual(ToNode(actual), ToNode(expected));

    /// <summary>
    /// Gets a value as JSON, for comparing.
    /// </summary>
    public static JsonNode? ToNode(object? value) => value switch
    {
        null => null,
        JsonNode node => node,
        JsonElement element => element.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined ? null : WithoutReferenceIds(JsonNode.Parse(element.GetRawText())),
        _ => JsonSerializer.SerializeToNode(value, value.GetType())
    };

    // Playwright marks each object a script gives back with a "$id", for objects it refers to more
    // than once, which isn't part of the value.
    private static JsonNode? WithoutReferenceIds(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject jsonObject:

                jsonObject.Remove("$id");

                foreach (var property in jsonObject) WithoutReferenceIds(property.Value);

                break;

            case JsonArray array:

                foreach (var item in array) WithoutReferenceIds(item);

                break;
        }

        return node;
    }

    /// <summary>
    /// Gets a value as JavaScript would show it.
    /// </summary>
    public static string Format(object? value)
    {
        var node = ToNode(value);

        return node == null ? "null" : node.ToJsonString(FormatOptions);
    }

    private static bool NodesEqual(JsonNode? a, JsonNode? b)
    {
        if (a == null || b == null) return a == null && b == null;

        switch (a)
        {
            case JsonObject objectA when b is JsonObject objectB:

                var keysA = objectA.Where(property => property.Value != null).Select(property => property.Key).ToHashSet();
                var keysB = objectB.Where(property => property.Value != null).Select(property => property.Key).ToHashSet();

                return keysA.SetEquals(keysB) && keysA.All(key => NodesEqual(objectA[key], objectB[key]));

            case JsonArray arrayA when b is JsonArray arrayB:

                return arrayA.Count == arrayB.Count && arrayA.Zip(arrayB).All(pair => NodesEqual(pair.First, pair.Second));

            case JsonValue valueA when b is JsonValue valueB:

                if (valueA.GetValueKind() == JsonValueKind.Number && valueB.GetValueKind() == JsonValueKind.Number)
                {
                    return valueA.GetValue<double>().Equals(valueB.GetValue<double>());
                }

                return valueA.ToJsonString() == valueB.ToJsonString();

            default:
                return false;
        }
    }

    private static IEnumerable<object?> Items(object? value) => value switch
    {
        JsonElement { ValueKind: JsonValueKind.Array } element => element.EnumerateArray().Cast<object?>(),
        JsonArray array => array,
        IEnumerable items and not string => items.Cast<object?>(),
        _ => throw new ArgumentException("Expected a list, not " + Format(value))
    };

    private static bool IsNumber(object? value) => value is sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal
        || value is JsonElement { ValueKind: JsonValueKind.Number }
        || (value is JsonValue node && node.GetValueKind() == JsonValueKind.Number);

    private static double ToDouble(object? value) => value switch
    {
        JsonElement element => element.GetDouble(),
        JsonValue node => node.GetValue<double>(),
        IConvertible convertible => convertible.ToDouble(CultureInfo.InvariantCulture),
        _ => throw new ArgumentException("Expected a number, not " + Format(value))
    };

    private static bool IsTruthy(object? value) => value switch
    {
        null => false,
        bool flag => flag,
        string text => text.Length > 0,
        JsonElement { ValueKind: JsonValueKind.Null or JsonValueKind.Undefined or JsonValueKind.False } => false,
        JsonElement { ValueKind: JsonValueKind.String } element => element.GetString()!.Length > 0,
        _ when IsNumber(value) => ToDouble(value) is not (0 or double.NaN),
        _ => true
    };
}

/// <summary>
/// Expectations of a value, which throw where it isn't as expected.
/// </summary>
public sealed class ValueExpectation<T>(T actual, string? message = null, bool negated = false)
{
    public ValueExpectation<T> Not => new(actual, message, !negated);

    public void ToBe(object? expected) => Check(Matchers.ToBe(expected));
    public void ToEqual(object? expected) => Check(Matchers.ToEqual(expected));
    public void ToBeNull() => Check(Matchers.ToBeNull());
    public void ToBeTruthy() => Check(Matchers.ToBeTruthy());
    public void ToBeFalsy() => Check(Matchers.ToBeFalsy());
    public void ToBeNaN() => Check(Matchers.ToBeNaN());
    public void ToBeGreaterThan(double expected) => Check(Matchers.ToBeGreaterThan(expected));
    public void ToBeGreaterThanOrEqual(double expected) => Check(Matchers.ToBeGreaterThanOrEqual(expected));
    public void ToBeLessThan(double expected) => Check(Matchers.ToBeLessThan(expected));
    public void ToBeLessThanOrEqual(double expected) => Check(Matchers.ToBeLessThanOrEqual(expected));
    public void ToBeCloseTo(double expected, int digits = 2) => Check(Matchers.ToBeCloseTo(expected, digits));
    public void ToContain(object? expected) => Check(Matchers.ToContain(expected));
    public void ToHaveLength(int expected) => Check(Matchers.ToHaveLength(expected));
    public void ToMatch(string pattern) => Check(Matchers.ToMatch(pattern));
    public void ToMatch(Regex pattern) => Check(Matchers.ToMatch(pattern));

    private void Check(Matcher matcher)
    {
        if (matcher.Test(actual) != negated) return;

        Assert.Fail(Expectations.Describe(message, actual, matcher, negated));
    }
}

/// <summary>
/// Expectations of a value read again and again until it's as expected, which throw where it isn't
/// within the timeout.  A read that throws counts as not yet as expected.
/// </summary>
public sealed class PollExpectation<T>(Func<Task<T>> read, string? message = null, int timeout = Expectations.DefaultTimeout, bool negated = false)
{
    public PollExpectation<T> Not => new(read, message, timeout, !negated);

    public Task ToBe(object? expected) => CheckAsync(Matchers.ToBe(expected));
    public Task ToEqual(object? expected) => CheckAsync(Matchers.ToEqual(expected));
    public Task ToBeNull() => CheckAsync(Matchers.ToBeNull());
    public Task ToBeTruthy() => CheckAsync(Matchers.ToBeTruthy());
    public Task ToBeFalsy() => CheckAsync(Matchers.ToBeFalsy());
    public Task ToBeGreaterThan(double expected) => CheckAsync(Matchers.ToBeGreaterThan(expected));
    public Task ToBeGreaterThanOrEqual(double expected) => CheckAsync(Matchers.ToBeGreaterThanOrEqual(expected));
    public Task ToBeLessThan(double expected) => CheckAsync(Matchers.ToBeLessThan(expected));
    public Task ToBeLessThanOrEqual(double expected) => CheckAsync(Matchers.ToBeLessThanOrEqual(expected));
    public Task ToBeCloseTo(double expected, int digits = 2) => CheckAsync(Matchers.ToBeCloseTo(expected, digits));
    public Task ToContain(object? expected) => CheckAsync(Matchers.ToContain(expected));
    public Task ToHaveLength(int expected) => CheckAsync(Matchers.ToHaveLength(expected));
    public Task ToMatch(string pattern) => CheckAsync(Matchers.ToMatch(pattern));
    public Task ToMatch(Regex pattern) => CheckAsync(Matchers.ToMatch(pattern));

    private async Task CheckAsync(Matcher matcher)
    {
        string? failure = null;

        await Expectations.RetryAsync(timeout, async () =>
        {
            T actual;

            try
            {
                actual = await read();
            }
            catch (Exception e) when (e is not AssertFailedException)
            {
                failure = Expectations.Describe(message, default(T), matcher, negated) + "\n\nReading it threw: " + e.Message;
                return false;
            }

            if (matcher.Test(actual) != negated)
            {
                failure = null;
                return true;
            }

            failure = Expectations.Describe(message, actual, matcher, negated);
            return false;
        });

        if (failure != null) Assert.Fail($"Timed out after {timeout}ms waiting for {failure}");
    }
}

/// <summary>
/// The waits expectations share.
/// </summary>
public static class Expectations
{
    /// <summary>
    /// How long an expectation waits for a value to be as expected, in milliseconds.
    /// </summary>
    public const int DefaultTimeout = 5000;

    private static readonly int[] Intervals = [100, 250, 500, 1000];

    /// <summary>
    /// Tries something until it succeeds or the timeout passes, waiting longer between each try.
    /// </summary>
    public static async Task RetryAsync(int timeout, Func<Task<bool>> attempt)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(timeout);

        for (var tries = 0; ; tries++)
        {
            if (await attempt()) return;

            if (DateTime.UtcNow >= deadline) return;

            var interval = Intervals[Math.Min(tries, Intervals.Length - 1)];

            await Task.Delay(TimeSpan.FromMilliseconds(Math.Min(interval, Math.Max(0, (deadline - DateTime.UtcNow).TotalMilliseconds))));
        }
    }

    /// <summary>
    /// Runs a block of steps and expectations until it passes, or else fails with its last failure.
    /// </summary>
    public static async Task ToPassAsync(Func<Task> block, int timeout = 30000)
    {
        Exception? failure = null;

        await RetryAsync(timeout, async () =>
        {
            try
            {
                await block();
                failure = null;
                return true;
            }
            catch (Exception e)
            {
                failure = e;
                return false;
            }
        });

        if (failure != null) Assert.Fail($"Timed out after {timeout}ms waiting for the block to pass: {failure.Message}");
    }

    internal static string Describe(string? message, object? actual, Matcher matcher, bool negated) =>
        (message != null ? message + ": " : "")
        + "expected " + Matchers.Format(actual) + (negated ? " not " : " ") + matcher.Description;
}
