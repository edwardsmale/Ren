using System.Globalization;

namespace Ren.Client.Tests;

/// <summary>
/// JavaScript's ways with values, for comparing with what a page gives.
/// </summary>
public static class Js
{
    /// <summary>
    /// Gets a number as String(number) gives it.
    /// </summary>
    public static string NumberToString(double value)
    {
        if (double.IsNaN(value)) return "NaN";

        if (double.IsInfinity(value)) return value > 0 ? "Infinity" : "-Infinity";

        var text = value.ToString("R", CultureInfo.InvariantCulture);
        var exponentAt = text.IndexOf('E');

        if (exponentAt < 0) return text;

        var exponent = int.Parse(text[(exponentAt + 1)..], CultureInfo.InvariantCulture);

        return text[..exponentAt] + "e" + (exponent < 0 ? "-" : "+") + Math.Abs(exponent);
    }
}
