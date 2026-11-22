namespace Ren.Build;

/// <summary>
/// Lists the files in a folder in the order they're concatenated: a folder's own files before
/// those in its subfolders, then by path in code-point order.  So a file can rely on anything
/// defined by the files in the folders above it, and on files earlier in its own folder by name.
/// </summary>
internal static class SourceOrder
{
    public static List<string> GetOrderedFiles(string directory, string extension)
    {
        if (!Directory.Exists(directory)) return [];

        var files = Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories)
            .Where(file => string.Equals(Path.GetExtension(file), extension, StringComparison.Ordinal))
            .Select(file => (File: file, Relative: Path.GetRelativePath(directory, file).Replace('\\', '/')))
            .ToList();

        // JavaScript's < on strings compares UTF-16 code units, as an ordinal comparison does.
        files.Sort((a, b) =>
        {
            var depthDifference = Depth(a.Relative) - Depth(b.Relative);

            return depthDifference != 0 ? depthDifference : string.CompareOrdinal(a.Relative, b.Relative);
        });

        return files.Select(file => file.File).ToList();
    }

    private static int Depth(string relativePath) => relativePath.Count(c => c == '/') + 1;
}
