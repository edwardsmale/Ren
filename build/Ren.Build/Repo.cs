using System.Text;

namespace Ren.Build;

/// <summary>
/// The repo's folders and files, and reading and writing text: UTF-8 without a byte order mark,
/// and with any byte order mark taken off what's read.
/// </summary>
internal static class Repo
{
    public static readonly string Root = FindRoot();

    public static string Dist => Path.Combine(Root, "dist");

    public static string Generated => Path.Combine(Root, ".generated");

    public const string SchemaFileName = "ren.config.schema.json";

    public static readonly UTF8Encoding Utf8 = new(encoderShouldEmitUTF8Identifier: false);

    /// <summary>
    /// The repo's folder: the nearest one above this program (or the working folder) with a
    /// src/ren----init.js in it.
    /// </summary>
    private static string FindRoot()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var directory = new DirectoryInfo(start); directory != null; directory = directory.Parent)
            {
                if (File.Exists(Path.Combine(directory.FullName, "src", "ren----init.js")))
                {
                    return directory.FullName;
                }
            }
        }

        throw new BuildException("Can't find the Ren repo (a folder with src/ren----init.js) above " +
            AppContext.BaseDirectory + ".");
    }

    public static string ReadText(string path)
    {
        var text = RetryWhileLocked(() => File.ReadAllText(path, Utf8));

        return text.Length > 0 && text[0] == '﻿' ? text.Substring(1) : text;
    }

    public static void WriteText(string path, string text)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        RetryWhileLocked(() => { File.WriteAllText(path, text, Utf8); return true; });
    }

    public static void CopyFile(string sourcePath, string destinationPath) =>
        RetryWhileLocked(() => { File.Copy(sourcePath, destinationPath, overwrite: true); return true; });

    private const int LockedFileAttempts = 30;
    private const int LockedFileRetryDelayMs = 100;

    /// <summary>
    /// Reads or writes a file, trying again for a few seconds while another process has it open,
    /// as an editor or a virus scanner may for a moment, such as when VS Code opens the folder.
    /// </summary>
    private static T RetryWhileLocked<T>(Func<T> access)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return access();
            }
            catch (IOException e) when (IsLocked(e) && attempt < LockedFileAttempts)
            {
                Thread.Sleep(LockedFileRetryDelayMs);
            }
        }
    }

    // ERROR_SHARING_VIOLATION or ERROR_LOCK_VIOLATION.
    private static bool IsLocked(IOException e) => (e.HResult & 0xFFFF) is 32 or 33;

    /// <summary>
    /// The path of the specified file relative to the repo, with forward slashes.
    /// </summary>
    public static string Relative(string path) =>
        Path.GetRelativePath(Root, path).Replace('\\', '/');

    /// <summary>
    /// The version in VERSION, which every built file names.
    /// </summary>
    public static string ReadVersion()
    {
        var version = ReadText(Path.Combine(Root, "VERSION")).Trim();

        return version.Length > 0 ? version : throw new BuildException("VERSION is empty.");
    }
}

/// <summary>
/// A build failure with a message that says what's wrong, which is shown without a stack trace.
/// </summary>
internal sealed class BuildException(string message) : Exception(message);
