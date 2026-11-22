namespace Ren.Client.Tests;

/// <summary>
/// String handling the tests share.
/// </summary>
public static class Text
{
    /// <summary>
    /// Replaces the first occurrence of a string, as JavaScript's replace with a string does.
    /// </summary>
    public static string ReplaceFirst(string text, string search, string replacement)
    {
        var at = text.IndexOf(search, StringComparison.Ordinal);

        return at < 0 ? text : text[..at] + replacement + text[(at + search.Length)..];
    }

    /// <summary>
    /// Sorts strings as JavaScript's sort does without a compare function, by UTF-16 code unit.
    /// </summary>
    public static string[] Sorted(IEnumerable<string> values) => values.Order(StringComparer.Ordinal).ToArray();

    /// <summary>
    /// Splits text into its lines, dropping carriage returns.
    /// </summary>
    public static string[] Lines(string text) => text.Replace("\r", "").Split('\n');
}
