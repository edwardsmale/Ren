using Ren.Build;

// Builds Ren's client library into dist/ (ren.js, ren.esm.js and ren.css, their minified
// versions, a source map beside each, a copy of the schema and ren.manifest.json), and tests,
// serves, releases, packs and exports it.
//
//   build                     Builds once.
//   watch                     Builds, then rebuilds whenever a source file changes.
//   scripts | styles          Builds just the scripts or the styles.
//   ... --statics <dir>       Also copies the built files into a host's folder for them.  Give it
//                             more than once, or separate the folders with semicolons, to copy
//                             them into several hosts.  A host in a git repo only gets them
//                             while its branch has the same name as Ren's (see Publisher.cs).
//
//   test [--minified] [<dotnet test arguments>]
//                             Builds, then runs the client tests (on the minified build, with
//                             --minified).  Arguments such as --filter go to dotnet test.
//   ci                        Builds and runs every test, as CI does.
//   serve [<port>]            Serves the repo at http://localhost:8080/ (or the port given).
//   release <version>         Releases the version (see Releaser.cs).
//   pack <version>            Builds a released version from its tag and packs it, with the .NET
//                             library, as the NuGet package, in packages/ (see Exporter.cs).
//   export <version> <dir>[;<dir>...] [<dir>...]
//                             Builds a released version from its tag and copies it into each
//                             folder (see Exporter.cs).

try
{
    var command = args.Length > 0 && !args[0].StartsWith("--", StringComparison.Ordinal) ? args[0] : "build";
    var commandArgs = args.Skip(1).ToArray();
    var publisher = command is "build" or "watch" or "scripts" or "styles"
        ? new Publisher(GetStaticsDirectories(args))
        : new Publisher([]);

    switch (command)
    {
        case "build":
            await Builder.BuildAsync(publisher);
            break;

        case "scripts":
            await Scripts.BuildAsync(BuildIdentity.Get(), publisher);
            break;

        case "styles":
            await Styles.BuildAsync(BuildIdentity.Get(), publisher);
            break;

        case "watch":
            await Watcher.RunAsync(publisher);
            break;

        case "test":
            await Builder.BuildAsync(publisher);
            await Testing.RunClientTestsAsync(
                commandArgs.Contains("--minified"),
                commandArgs.Where(arg => arg != "--minified"));
            break;

        case "ci":
            await Testing.RunCiAsync(publisher);
            break;

        case "serve":
            await Server.RunAsync(commandArgs.Length > 0 && int.TryParse(commandArgs[0], out var port) ? port : 8080);
            break;

        case "release":
            await Releaser.RunAsync(commandArgs.FirstOrDefault(), publisher);
            break;

        case "pack":
            await Exporter.PackAsync(commandArgs.FirstOrDefault());
            break;

        case "export":
            await Exporter.RunAsync(commandArgs.FirstOrDefault(), SplitDirectories(commandArgs.Skip(1)));
            break;

        default:
            Console.Error.WriteLine($"Unknown command \"{command}\".  Use build, watch, scripts, styles, test, ci, serve, release, pack or export.");
            return 2;
    }

    return 0;
}
catch (BuildException e)
{
    Log.Error(e.Message);
    return 1;
}

// Gets the folders given with --statics.
static List<string> GetStaticsDirectories(string[] args)
{
    var values = new List<string>();

    for (var i = 0; i < args.Length - 1; i++)
    {
        if (args[i] == "--statics") values.Add(args[i + 1]);
    }

    return SplitDirectories(values);
}

// Gets the folders given, each split at semicolons.  A folder that isn't absolute (such as one
// that's lost its backslashes in a Unix shell) would otherwise be built into a new folder inside
// this repo, so it's refused.
static List<string> SplitDirectories(IEnumerable<string> values)
{
    var directories = new List<string>();

    foreach (var value in values)
    {
        foreach (var part in value.Split(';'))
        {
            var directory = part.Trim();

            if (directory.Length == 0) continue;

            if (!Path.IsPathFullyQualified(directory))
            {
                throw new BuildException($"The folder must be an absolute path, but it's \"{directory}\".");
            }

            directories.Add(directory);
        }
    }

    return directories;
}

namespace Ren.Build
{
    internal static class Builder
    {
        /// <summary>
        /// Builds the scripts, the styles and the schema, at the same time.
        /// </summary>
        public static async Task BuildAsync(Publisher publisher)
        {
            var started = DateTime.Now;
            var identity = BuildIdentity.Get();

            Log.Info($"Building Ren {identity.Version}");

            await Task.WhenAll(
                Task.Run(() => Scripts.BuildAsync(identity, publisher)),
                Task.Run(() => Styles.BuildAsync(identity, publisher)),
                Task.Run(() => CopySchema(identity, publisher)));

            Log.Info($"Built Ren {identity.Version} in {(DateTime.Now - started).TotalSeconds:0.0}s");
        }

        public static void CopySchema(BuildIdentity identity, Publisher publisher)
        {
            Directory.CreateDirectory(Repo.Dist);
            Repo.CopyFile(Path.Combine(Repo.Root, Repo.SchemaFileName), Path.Combine(Repo.Dist, Repo.SchemaFileName));
            publisher.Publish(identity, Repo.SchemaFileName, hasSourceMap: false);
        }
    }

    /// <summary>
    /// Builds once, then rebuilds the part of the build whose sources change: the scripts for
    /// src/, vendor/ and templates/, the styles for styles/ and the schema for itself.  When the
    /// version has changed since the last build (a commit, say, or the first change on top of
    /// one), it rebuilds everything instead, so that every built file and the manifest name one
    /// version.  It keeps watching when a build fails, whatever the reason, and builds everything
    /// again on the next change, as a failure can leave the built files from different versions.
    /// </summary>
    internal static class Watcher
    {
        private enum Part { Scripts, Styles, Schema }

        public static async Task RunAsync(Publisher publisher)
        {
            string? builtVersion = null;
            var pending = new HashSet<Part>();
            var signal = new SemaphoreSlim(0);
            var pendingLock = new object();

            async Task RunRecordingVersion(Func<BuildIdentity, Task> build)
            {
                try
                {
                    var identity = BuildIdentity.Get();

                    await build(identity);
                    builtVersion = identity.Version;
                }
                catch (Exception e)
                {
                    builtVersion = null;

                    // A BuildException's message says what's wrong; anything else (a file another
                    // process has locked, say) is unexpected, so says what it was too.
                    var message = e is BuildException ? e.Message : $"{e.GetType().Name}: {e.Message}";

                    Log.Error($"The build failed: {message}");
                    Log.Info("The next change builds everything again");
                }
            }

            var watchers = new List<FileSystemWatcher>();

            void Watch(string directory, string filter, Part part, bool subdirectories = true)
            {
                var watcher = new FileSystemWatcher(directory, filter)
                {
                    IncludeSubdirectories = subdirectories,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size
                };

                void OnChange(object sender, FileSystemEventArgs e)
                {
                    lock (pendingLock) pending.Add(part);

                    signal.Release();
                }

                watcher.Changed += OnChange;
                watcher.Created += OnChange;
                watcher.Deleted += OnChange;
                watcher.Renamed += (sender, e) => OnChange(sender, e);
                watcher.EnableRaisingEvents = true;
                watchers.Add(watcher);
            }

            Watch(Path.Combine(Repo.Root, "src"), "*.js", Part.Scripts);
            Watch(Path.Combine(Repo.Root, "vendor"), "*.js", Part.Scripts);
            Watch(Path.Combine(Repo.Root, "templates"), "*", Part.Scripts);
            Watch(Path.Combine(Repo.Root, "styles"), "*.scss", Part.Styles);
            Watch(Repo.Root, Repo.SchemaFileName, Part.Schema, subdirectories: false);

            await RunRecordingVersion(_ => Builder.BuildAsync(publisher));

            Log.Info("Watching for changes");

            while (true)
            {
                await signal.WaitAsync();

                // Lets a burst of changes (an editor saving several files, a checkout) settle.
                await Task.Delay(200);

                while (signal.CurrentCount > 0) await signal.WaitAsync();

                Part[] parts;

                lock (pendingLock)
                {
                    parts = pending.ToArray();
                    pending.Clear();
                }

                if (parts.Length == 0) continue;

                await RunRecordingVersion(async identity =>
                {
                    if (identity.Version != builtVersion)
                    {
                        await Builder.BuildAsync(publisher);
                        return;
                    }

                    var tasks = new List<Task>();

                    if (parts.Contains(Part.Scripts)) tasks.Add(Scripts.BuildAsync(identity, publisher));
                    if (parts.Contains(Part.Styles)) tasks.Add(Styles.BuildAsync(identity, publisher));
                    if (parts.Contains(Part.Schema)) tasks.Add(Task.Run(() => Builder.CopySchema(identity, publisher)));

                    await Task.WhenAll(tasks);
                });
            }
        }
    }
}
