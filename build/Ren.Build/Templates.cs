using Jint;
using Jint.Native;

namespace Ren.Build;

/// <summary>
/// Writes a script that registers the library's HTML templates and format functions, compiled,
/// through Ren.Extensions, so that the library works without the page's template and format
/// function elements.  The page's own templates and functions override these.
///
/// Each is compiled here, with Ren's own resolver and Ren.FunctionCompiler, into the function Ren
/// would otherwise compile from it on the page when it's first used.  So the library's own work on
/// a page whose content security policy doesn't allow eval.  A format function's parameters are
/// read from an argument, rather than written into its code, so it compiles the same whatever their
/// values.  The one exception is a function taking a parameter as code (custom-format), which is
/// registered as source alone, and compiled on the page.  (A page's own templates and functions,
/// and any registered as source, are compiled when they're used.)
///
/// The resolver runs in Jint, a JavaScript engine written in .NET, and so does the script's
/// assembly, so that names and sources are quoted exactly as JavaScript quotes them.
/// </summary>
internal static class Templates
{
    public static string OutputFile => Path.Combine(Repo.Generated, "ren-templates.js");

    // The scripts Ren.FunctionResolver and Ren.FunctionCompiler need, in the order ren.js has them.
    private static readonly string[] ResolverFiles =
    [
        "src/utils/ren-text-utils.js",
        "src/utils/ren-text-quote-counter.js",
        "src/functions/ren-format-function-utils.js",
        "src/functions/ren-function-compiler.js",
        "src/functions/ren-function-resolver.js",
        "src/functions/ren-function-template-parameters.js"
    ];

    // The text utilities make an element when they load, but the resolver doesn't use it.
    private const string Prelude =
        "var window = globalThis;\n" +
        "var document = { createElement: function () { return {}; } };\n" +
        "window.Ren = {};\n";

    // Takes the templates' and format functions' names and sources, in the order of their file
    // names, and gives the script.
    private const string Generator = """
        (function (templateNames, templateSources, functionNames, functionSources) {

            const resolveAtExpressions = Ren.FunctionResolver.resolveAtExpressions;

            // Ren's own compile, which tries new Function first, so the check isn't on the page's
            // terms.
            const compiles = (source) => {

                try {

                    new Function("return (" + source + "\n);");
                    return null;
                }
                catch (e) {

                    return e;
                }
            };

            const readSource = (text) => text.replace(/^﻿/, "").trim();

            const templates = {};
            const formatFunctions = {};

            for (let i = 0; i < templateNames.length; i++) {
                templates[templateNames[i]] = readSource(templateSources[i]).replace(/\r\n/g, "\n");
            }

            for (let i = 0; i < functionNames.length; i++) {
                formatFunctions[functionNames[i]] = readSource(functionSources[i]);
            }

            const compileTemplate = (name, template) => {

                const source =
                    "(parameters) => { return " + resolveAtExpressions("`" + template + "`") + "; }";

                const error = compiles(source);

                if (error) throw new Error(`HTML template "${name}" doesn't compile: ${error.message}`);

                return source;
            };

            // Gets the source a format function compiles to, or null for one taking a parameter
            // as code, which can only be compiled once its value is known.
            const compileFormatFunction = (name, body) => {

                const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(body);
                const { sources, bareNames } = Ren.FunctionCompiler.buildSources(
                    parsed.code,
                    Object.keys(parsed.parameters || {})
                );

                if (bareNames.length > 0) return null;

                let lastError = null;

                for (let i = 0; i < sources.length; i++) {

                    lastError = compiles(sources[i]);

                    if (!lastError) return sources[i];
                }

                throw new Error(`Format function "${name}" doesn't compile: ${lastError.message}`);
            };

            const compiledTemplates = [];

            for (const name in templates) {

                compiledTemplates.push("        " + JSON.stringify(name) + ": " +
                    compileTemplate(name, templates[name]));
            }

            const compiledFunctions = [];
            let sourceOnlyCount = 0;

            for (const name in formatFunctions) {

                const source = compileFormatFunction(name, formatFunctions[name]);

                if (source === null) {

                    sourceOnlyCount++;
                    continue;
                }

                compiledFunctions.push("        " + JSON.stringify(name) + ": " + source);
            }

            return {
                templateCount: Object.keys(templates).length,
                functionCount: Object.keys(formatFunctions).length,
                sourceOnlyCount,
                script:
                    "// Generated by the build from the templates folder.\n" +
                    "// Don't edit.\n" +
                    "(() => {\n\n" +
                    "    const templates = {\n" + compiledTemplates.join(",\n") + "\n    };\n\n" +
                    "    const formatFunctions = " + JSON.stringify(formatFunctions) + ";\n\n" +
                    "    const compiledFormatFunctions = {\n" + compiledFunctions.join(",\n") +
                    "\n    };\n\n" +
                    "    for (const name in templates) {\n" +
                    "        Ren.Extensions.registerHtmlTemplate(name, templates[name]);\n" +
                    "    }\n\n" +
                    "    for (const name in formatFunctions) {\n" +
                    "        Ren.Extensions.registerFormatFunction(\n" +
                    "            name, formatFunctions[name], compiledFormatFunctions[name]);\n" +
                    "    }\n" +
                    "})();\n"
            };
        })
        """;

    /// <summary>
    /// Writes the script for the templates and format functions in templates/ to
    /// .generated/ren-templates.js.
    /// </summary>
    public static void Write()
    {
        var templatesDirectory = Path.Combine(Repo.Root, "templates");
        var (templateNames, templateSources) = ReadFunctions(Path.Combine(templatesDirectory, "html"), ".html");
        var (functionNames, functionSources) = ReadFunctions(Path.Combine(templatesDirectory, "format-functions"), ".js");

        var engine = new Engine();

        engine.Execute(Prelude, "prelude");

        foreach (var file in ResolverFiles)
        {
            engine.Execute(Repo.ReadText(Path.Combine(Repo.Root, file)), file);
        }

        JsValue result;

        try
        {
            var generate = engine.Evaluate(Generator, "templates");

            result = engine.Invoke(generate,
                JsValue.FromObject(engine, templateNames), JsValue.FromObject(engine, templateSources),
                JsValue.FromObject(engine, functionNames), JsValue.FromObject(engine, functionSources));
        }
        catch (Jint.Runtime.JavaScriptException e)
        {
            throw new BuildException(e.Message);
        }

        Repo.WriteText(OutputFile, result.Get("script").AsString());

        Log.Info($"Compiled {result.Get("templateCount")} templates and {result.Get("functionCount")} format functions" +
            $" ({result.Get("sourceOnlyCount")} left to compile on the page)");
    }

    /// <summary>
    /// Gets the names and sources of the files with the specified extension in the specified
    /// folder, in the order of their names (as JavaScript's sort orders them).
    /// </summary>
    private static (string[] Names, string[] Sources) ReadFunctions(string directory, string extension)
    {
        if (!Directory.Exists(directory)) return ([], []);

        var files = Directory.GetFiles(directory)
            .Select(Path.GetFileName)
            .OfType<string>()
            .Where(name => string.Equals(Path.GetExtension(name), extension, StringComparison.Ordinal))
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        return (
            files.Select(name => name.Substring(0, name.Length - extension.Length)).ToArray(),
            files.Select(name => File.ReadAllText(Path.Combine(directory, name), Repo.Utf8)).ToArray());
    }
}
