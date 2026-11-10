/**
 * Finds script and style elements which reference JS and CSS files, as opposed to inline scripts
 * and styles, gets the contents of those files, minifies them and outputs them as script and style
 * elements, so that they are present in the HTML file when it is downloaded.
 */
Ren.ReportStaticsInserter = (() => {

    // Matches ren.js and the bundles that extend it, such as a host application's, by file name
    // (ren.js, ren.editor.js, ren-homepage.js), wherever the host serves them from.
    const renScriptPattern = /(^|\/)ren([.-][^/]*)?\.js$/;

    const isRenScript = (src) => renScriptPattern.test(src.split("?")[0]);

    // ren.js and its extensions are the bulk of a downloaded report, so they go in minified.
    const minifyRenScript = (contents) => {

        try {

            return Ren.JsMinifier.minify(contents);
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError(
                "[ReportStaticsInserter] Error minifying a Ren script:",
                error
            );

            return contents;
        }
    };

    const insertScripts = (html, allDone) => {

        const scripts = Array.from(html.querySelectorAll("script")).filter(element => {

            const src = element.getAttribute("src");
            return src && !src.startsWith("http");
        });

        const stylesheets = Array.from(html.querySelectorAll("link[rel='stylesheet']")).filter(element => {

            const href = element.getAttribute("href");
            return href && !href.startsWith("http");
        });

        (async () => {

            const scriptFetches = scripts.map(element => {

                const src = element.getAttribute("src");
                return Ren.FetchUtils.fetch(src)
                    .then(r => r.ok ? r.text() : Promise.reject("Failed to fetch script: " + src))
                    .then((contents) => {

                        if (isRenScript(src)) contents = minifyRenScript(contents);

                        // Use _textContent so any closing-script-tag sequence in the file (e.g. in
                        // a comment, string or regex) is escaped; otherwise it would terminate this
                        // inlined script early when the downloaded report is reopened.
                        const script = Ren.HtmlUtils.create("script")._textContent(contents);
                        element.replaceWith(script);
                    })
                    .catch(error => {

                        Ren.GlobalErrorHandler.logError(
                            "[ReportStaticsInserter] Error fetching script:",
                            error
                        );

                        Ren.PopupErrorMessage?.(error);
                        return Promise.resolve();
                    });
            });

            const stylesheetFetches = stylesheets.map(element => {

                const href = element.getAttribute("href");
                return Ren.FetchUtils.fetch(href)
                    .then(r => r.ok ? r.text() : Promise.reject("Failed to fetch stylesheet: " + href))
                    .then((contents) => {

                        const style = document.createElement("style");
                        style.textContent = contents;
                        element.replaceWith(style);
                    })
                    .catch(error => {

                        Ren.GlobalErrorHandler.logError(
                            "[ReportStaticsInserter] Error fetching stylesheet:",
                            error
                        );

                        Ren.PopupErrorMessage?.(error);
                        return Promise.resolve();
                    });
            });

            await Promise.all(scriptFetches).then(() => {

                return Promise.all(stylesheetFetches);
            }).then(() => {

                allDone();
            }).catch((error) => {

                Ren.GlobalErrorHandler.logError(
                    "[ReportStaticsInserter] Unexpected error in insertScripts:",
                    error
                );

                allDone();
            });
        })();
    };

    return {
        insertScripts
    };
})();
