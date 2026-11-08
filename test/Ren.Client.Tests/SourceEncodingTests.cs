using System.Text;

namespace Ren.Client.Tests;

/// <summary>
/// Some files were once saved in Latin-1, so the build read their "¬" as U+FFFD and it no longer
/// matched the "¬" everything else splits sort keys on.
/// </summary>
[TestClass]
public class SourceEncodingTests
{
    private static readonly string[] Directories = ["src", "templates", "styles"];

    [TestMethod]
    public void SrcTemplatesAndStyles_AreUtf8WithoutABom()
    {
        var strictUtf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
        var problems = new List<string>();

        foreach (var directory in Directories)
        {
            foreach (var file in Directory.EnumerateFiles(Path.Combine(RepoFiles.Root, directory), "*", SearchOption.AllDirectories))
            {
                var name = Path.GetRelativePath(RepoFiles.Root, file).Replace('\\', '/');
                var bytes = File.ReadAllBytes(file);

                try
                {
                    strictUtf8.GetString(bytes);
                }
                catch (DecoderFallbackException)
                {
                    problems.Add(name + " isn't UTF-8");
                }

                if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
                {
                    problems.Add(name + " has a BOM");
                }
            }
        }

        CollectionAssert.AreEqual(Array.Empty<string>(), problems, string.Join("\n", problems));
    }
}
