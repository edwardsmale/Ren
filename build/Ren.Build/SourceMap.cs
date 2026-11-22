using System.Text;
using System.Text.Json;

namespace Ren.Build;

/// <summary>
/// One mapping: a column of a generated line, and the place in a source it came from (when
/// Source isn't -1).
/// </summary>
internal struct Segment
{
    public int GeneratedColumn;
    public int Source;
    public int OriginalLine;
    public int OriginalColumn;
    public int Name;
}

/// <summary>
/// A version 3 source map, with its mappings decoded into lines of segments, so that maps can be
/// concatenated and chained.  It's written as JSON with its keys in the order JavaScript's
/// source-map package writes them: version, sources, names, mappings, file, sourcesContent.
/// </summary>
internal sealed class SourceMap
{
    public string? File { get; set; }

    public List<string> Sources { get; } = [];

    public List<string?> SourcesContent { get; } = [];

    public List<string> Names { get; } = [];

    /// <summary>
    /// The segments of each generated line, in column order.
    /// </summary>
    public List<List<Segment>> Lines { get; } = [];

    private const string Base64Digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /// <summary>
    /// Gets the index of the specified source, adding it (with its content) when it's new.
    /// </summary>
    public int AddSource(string source, string? content)
    {
        var index = Sources.IndexOf(source);

        if (index >= 0)
        {
            if (content != null) SourcesContent[index] = content;

            return index;
        }

        Sources.Add(source);
        SourcesContent.Add(content);

        return Sources.Count - 1;
    }

    public int AddName(string name)
    {
        var index = Names.IndexOf(name);

        if (index >= 0) return index;

        Names.Add(name);

        return Names.Count - 1;
    }

    /// <summary>
    /// Gets the segments of the specified generated line (from 0), adding empty lines up to it.
    /// </summary>
    public List<Segment> Line(int line)
    {
        while (Lines.Count <= line) Lines.Add([]);

        return Lines[line];
    }

    /// <summary>
    /// Moves every mapping down the specified number of lines, for lines put in above them.
    /// </summary>
    public void InsertLinesAtTop(int count)
    {
        for (var i = 0; i < count; i++) Lines.Insert(0, []);
    }

    /// <summary>
    /// Gets the original place the specified generated position came from: the last segment on
    /// its line at or before its column (as the source-map package's greatest lower bound
    /// lookup), or null when there isn't one, or it maps nowhere.
    /// </summary>
    public Segment? Find(int line, int column)
    {
        if (line < 0 || line >= Lines.Count) return null;

        Segment? found = null;

        foreach (var segment in Lines[line])
        {
            if (segment.GeneratedColumn > column) break;

            found = segment;
        }

        return found is { Source: >= 0 } ? found : null;
    }

    /// <summary>
    /// Gets the map that goes from this map's generated file straight to the sources of the
    /// specified map, whose generated file is this map's only source.  Mappings into places the
    /// inner map doesn't cover are dropped.
    /// </summary>
    public SourceMap ChainThrough(SourceMap inner)
    {
        var chained = new SourceMap { File = File };

        for (var line = 0; line < Lines.Count; line++)
        {
            var segments = chained.Line(line);

            foreach (var segment in Lines[line])
            {
                if (segment.Source < 0) continue;

                var original = inner.Find(segment.OriginalLine, segment.OriginalColumn);

                if (original == null) continue;

                var source = chained.AddSource(inner.Sources[original.Value.Source],
                    inner.SourcesContent.ElementAtOrDefault(original.Value.Source));

                var name = original.Value.Name >= 0 ? chained.AddName(inner.Names[original.Value.Name])
                    : segment.Name >= 0 ? chained.AddName(Names[segment.Name])
                    : -1;

                segments.Add(new Segment
                {
                    GeneratedColumn = segment.GeneratedColumn,
                    Source = source,
                    OriginalLine = original.Value.OriginalLine,
                    OriginalColumn = original.Value.OriginalColumn,
                    Name = name
                });
            }
        }

        return chained;
    }

    /// <summary>
    /// Copies the specified map's mappings into this one, with its generated line 0 at the
    /// specified line here, as concat-with-sourcemaps did.  Its sources are renamed by the
    /// specified function.
    /// </summary>
    public void Append(SourceMap other, int lineOffset, Func<string, string> renameSource)
    {
        for (var line = 0; line < other.Lines.Count; line++)
        {
            var segments = Line(lineOffset + line);

            foreach (var segment in other.Lines[line])
            {
                if (segment.Source < 0) continue;

                var copy = segment;

                copy.Source = AddSource(renameSource(other.Sources[segment.Source]),
                    other.SourcesContent.ElementAtOrDefault(segment.Source));
                copy.Name = segment.Name >= 0 ? AddName(other.Names[segment.Name]) : -1;

                segments.Add(copy);
            }
        }
    }

    public string EncodeMappings()
    {
        var builder = new StringBuilder();
        int previousSource = 0, previousOriginalLine = 0, previousOriginalColumn = 0, previousName = 0;

        for (var line = 0; line < Lines.Count; line++)
        {
            if (line > 0) builder.Append(';');

            var previousColumn = 0;
            var first = true;

            foreach (var segment in Lines[line].OrderBy(segment => segment.GeneratedColumn))
            {
                if (!first) builder.Append(',');

                first = false;

                EncodeVlq(builder, segment.GeneratedColumn - previousColumn);
                previousColumn = segment.GeneratedColumn;

                if (segment.Source < 0) continue;

                EncodeVlq(builder, segment.Source - previousSource);
                EncodeVlq(builder, segment.OriginalLine - previousOriginalLine);
                EncodeVlq(builder, segment.OriginalColumn - previousOriginalColumn);
                previousSource = segment.Source;
                previousOriginalLine = segment.OriginalLine;
                previousOriginalColumn = segment.OriginalColumn;

                if (segment.Name < 0) continue;

                EncodeVlq(builder, segment.Name - previousName);
                previousName = segment.Name;
            }
        }

        return builder.ToString();
    }

    private static void EncodeVlq(StringBuilder builder, int value)
    {
        var vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;

        do
        {
            var digit = vlq & 31;

            vlq >>= 5;

            if (vlq > 0) digit |= 32;

            builder.Append(Base64Digits[digit]);
        }
        while (vlq > 0);
    }

    private static void DecodeMappings(string mappings, SourceMap map)
    {
        int line = 0, column = 0, source = 0, originalLine = 0, originalColumn = 0, name = 0;
        var position = 0;
        var fields = new List<int>(5);

        map.Line(0);

        while (position < mappings.Length)
        {
            var c = mappings[position];

            if (c == ';')
            {
                line++;
                column = 0;
                map.Line(line);
                position++;
                continue;
            }

            if (c == ',')
            {
                position++;
                continue;
            }

            fields.Clear();

            while (position < mappings.Length && mappings[position] != ',' && mappings[position] != ';')
            {
                fields.Add(DecodeVlq(mappings, ref position));
            }

            column += fields[0];

            var segment = new Segment { GeneratedColumn = column, Source = -1, Name = -1 };

            if (fields.Count >= 4)
            {
                source += fields[1];
                originalLine += fields[2];
                originalColumn += fields[3];
                segment.Source = source;
                segment.OriginalLine = originalLine;
                segment.OriginalColumn = originalColumn;

                if (fields.Count >= 5)
                {
                    name += fields[4];
                    segment.Name = name;
                }
            }

            map.Line(line).Add(segment);
        }
    }

    private static int DecodeVlq(string text, ref int position)
    {
        int result = 0, shift = 0, digit;

        do
        {
            digit = Base64Digits.IndexOf(text[position++]);

            if (digit < 0) throw new BuildException("A source map has an invalid mapping.");

            result += (digit & 31) << shift;
            shift += 5;
        }
        while ((digit & 32) != 0);

        return (result & 1) != 0 ? -(result >> 1) : result >> 1;
    }

    /// <summary>
    /// Reads a source map's JSON.  Its sources are resolved against its sourceRoot, if it has one.
    /// </summary>
    public static SourceMap Parse(string json)
    {
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;
        var map = new SourceMap();
        var sourceRoot = root.TryGetProperty("sourceRoot", out var rootElement) ? rootElement.GetString() ?? "" : "";

        if (sourceRoot.Length > 0 && !sourceRoot.EndsWith('/')) sourceRoot += "/";

        if (root.TryGetProperty("file", out var file)) map.File = file.GetString();

        var contents = root.TryGetProperty("sourcesContent", out var contentsElement)
            ? contentsElement.EnumerateArray().Select(element => element.GetString()).ToList()
            : [];

        var index = 0;

        foreach (var source in root.GetProperty("sources").EnumerateArray())
        {
            map.Sources.Add(sourceRoot + source.GetString());
            map.SourcesContent.Add(contents.ElementAtOrDefault(index++));
        }

        if (root.TryGetProperty("names", out var names))
        {
            foreach (var name in names.EnumerateArray()) map.Names.Add(name.GetString() ?? "");
        }

        DecodeMappings(root.GetProperty("mappings").GetString() ?? "", map);

        return map;
    }

    /// <summary>
    /// Writes the map as JSON, as JSON.stringify would.
    /// </summary>
    public string ToJson()
    {
        var builder = new StringBuilder();

        builder.Append("{\"version\":3,\"sources\":[");
        AppendList(builder, Sources);
        builder.Append("],\"names\":[");
        AppendList(builder, Names);
        builder.Append("],\"mappings\":");
        JsJson.AppendString(builder, EncodeMappings());

        if (File != null)
        {
            builder.Append(",\"file\":");
            JsJson.AppendString(builder, File);
        }

        builder.Append(",\"sourcesContent\":[");
        AppendList(builder, SourcesContent);
        builder.Append("]}");

        return builder.ToString();
    }

    private static void AppendList(StringBuilder builder, IEnumerable<string?> values)
    {
        var first = true;

        foreach (var value in values)
        {
            if (!first) builder.Append(',');

            first = false;

            if (value == null) builder.Append("null");
            else JsJson.AppendString(builder, value);
        }
    }
}

/// <summary>
/// Writes JSON strings exactly as JavaScript's JSON.stringify does, which escapes only quotes,
/// backslashes, control characters and lone surrogates, so that maps and manifests are written
/// exactly as JavaScript tools write them.
/// </summary>
internal static class JsJson
{
    public static string Quote(string value)
    {
        var builder = new StringBuilder(value.Length + 2);

        AppendString(builder, value);

        return builder.ToString();
    }

    public static void AppendString(StringBuilder builder, string value)
    {
        builder.Append('"');

        for (var i = 0; i < value.Length; i++)
        {
            var c = value[i];

            switch (c)
            {
                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\b': builder.Append("\\b"); break;
                case '\f': builder.Append("\\f"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (c < 0x20)
                    {
                        builder.Append("\\u").Append(((int)c).ToString("x4"));
                    }
                    else if (char.IsHighSurrogate(c) && i + 1 < value.Length && char.IsLowSurrogate(value[i + 1]))
                    {
                        builder.Append(c).Append(value[++i]);
                    }
                    else if (char.IsSurrogate(c))
                    {
                        builder.Append("\\u").Append(((int)c).ToString("x4"));
                    }
                    else
                    {
                        builder.Append(c);
                    }
                    break;
            }
        }

        builder.Append('"');
    }
}
