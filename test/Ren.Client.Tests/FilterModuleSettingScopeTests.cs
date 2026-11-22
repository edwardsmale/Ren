using System.Text.RegularExpressions;

namespace Ren.Client.Tests;

/// <summary>
/// Each filter module setting is held on a column of its item, and for a hierarchy which column, or
/// whether every level has its own, is stated once, in Ren.FilterModule_ItemLevels' SCOPES, for
/// the code acting on an item to follow.  A setting left out of it would leave each such piece of
/// code to guess, as the hierarchical case was often missed when it did.
/// </summary>
[TestClass]
public partial class FilterModuleSettingScopeTests
{
    private static readonly string FilterModuleDirectory =
        Path.Combine(RepoFiles.Root, "src", "visualisations", "filter-module");

    private static readonly Regex[] SettingPatterns =
    [
        ColumnOverridePropertyRegex(),
        CreatedColumnOverridePropertyRegex(),
        StoredSettingNameRegex()
    ];

    [TestMethod]
    public void EverySettingTheFilterModuleUses_HasAScope()
    {
        var scoped = ReadScopedSettingNames();
        var used = FindUsedSettingNames();

        // Guards the scans themselves, which would otherwise pass by finding nothing.
        CollectionAssert.IsSubsetOf(new[] { "valueColumn", "sortByValue", "showTotal" }, scoped.ToList());
        CollectionAssert.IsSubsetOf(new[] { "valueColumn", "sortByValue", "showTotal" }, used.ToList());

        var withoutScope = used.Except(scoped).Order().ToArray();

        CollectionAssert.AreEqual(
            Array.Empty<string>(),
            withoutScope,
            "Give these a scope in ren-filter-module-item-levels.js: " + string.Join(", ", withoutScope));
    }

    // The names in SCOPES ("name: LEAF,") and in LEVEL_SETTINGS_BY_SECTION's lists, from which
    // the rest of SCOPES is filled.
    private static HashSet<string> ReadScopedSettingNames()
    {
        var source = File.ReadAllText(Path.Combine(FilterModuleDirectory, "ren-filter-module-item-levels.js"));

        var names = ScopeEntryRegex().Matches(source).Select(match => match.Groups[1].Value).ToHashSet();

        var levelSettings = LevelSettingsRegex().Match(source);

        Assert.IsTrue(levelSettings.Success, "LEVEL_SETTINGS_BY_SECTION wasn't found.");

        names.UnionWith(QuotedNameRegex().Matches(levelSettings.Value).Select(match => match.Groups[1].Value));

        return names;
    }

    private static HashSet<string> FindUsedSettingNames()
    {
        var names = new HashSet<string>();

        foreach (var file in Directory.EnumerateFiles(FilterModuleDirectory, "*.js"))
        {
            var source = File.ReadAllText(file);

            foreach (var pattern in SettingPatterns)
            {
                names.UnionWith(pattern.Matches(source).Select(match => match.Groups[1].Value));
            }

            // Where an override is taken into "entry", so is everything read from or written to it.
            if (OverrideTakenIntoEntryRegex().IsMatch(source))
            {
                names.UnionWith(EntryPropertyRegex().Matches(source).Select(match => match.Groups[1].Value));
            }
        }

        return names;
    }

    [GeneratedRegex(@"^\s*(\w+): (?:TOP|LEAF|EACH_LEVEL),?\s*$", RegexOptions.Multiline)]
    private static partial Regex ScopeEntryRegex();

    [GeneratedRegex(@"LEVEL_SETTINGS_BY_SECTION = \{.*?\n    \};", RegexOptions.Singleline)]
    private static partial Regex LevelSettingsRegex();

    [GeneratedRegex("\"(\\w+)\"")]
    private static partial Regex QuotedNameRegex();

    // The index may itself index something, as in columnOverrides[columns[i].columnIdOrHeading].
    [GeneratedRegex(@"columnOverrides\[(?:[^\[\]]|\[[^\]]*\])+\]\??\.(\w+)")]
    private static partial Regex ColumnOverridePropertyRegex();

    [GeneratedRegex(@"getOrCreateColumnOverride\([^)]*\)\.(\w+)")]
    private static partial Regex CreatedColumnOverridePropertyRegex();

    [GeneratedRegex("(?:storeColumnSetting|setColumnFlag|setCountedColumnSetting)\\([^,]+,\\s*\"(\\w+)\"")]
    private static partial Regex StoredSettingNameRegex();

    [GeneratedRegex(@"\bentry\s*=\s*(?:\w+\.)?(?:getOrCreateColumnOverride\(|columnOverrides\[)")]
    private static partial Regex OverrideTakenIntoEntryRegex();

    [GeneratedRegex(@"\bentry\??\.(\w+)")]
    private static partial Regex EntryPropertyRegex();
}
