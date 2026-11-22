/**
 * Code for downloading reports.
 */
Ren.ReportDownloader = (() => {

    const getDownloadFilename = () => {

        const titleElement = document.documentElement.querySelector("title");
        const reportTitle = titleElement ? titleElement.textContent : "Report";

        return Ren.TextUtils.removeNonFilenameChars(reportTitle + ".html");
    };

    // The live page as a document of its own, ready to be cut down to what is downloaded.  A report
    // that is itself a downloaded one has had its URLs converted already, so they are left alone.
    const captureReportDocument = (convertToLiveUrls) => {

        let html = document.documentElement.outerHTML;

        if (convertToLiveUrls && !Ren.UrlContext.isDownloadedReport()) html = convertUrls(html);

        return Ren.HtmlUtils.parseHTML(html);
    };

    // These are only valid in the document head, and the W3C HTML validator flags up the ones the
    // capture leaves inside <htmlfile> elements.  The download is given a head of its own below.
    const removeMetaAndTitleElements = (doc) => {

        doc.querySelectorAll("meta").forEach((meta) => { meta.remove(); });
        doc.querySelectorAll("title").forEach((title) => { title.remove(); });
    };

    const removeDataSourcesOfExcludedVisualisations = (doc) => {

        const dataSourceUrisToExclude = new Set();

        Ren.VisualisationCollection.getVisualisations().forEach(vis => {

            if (vis.excludeFromDownloadedReports && vis.dataSourceUri) {
                dataSourceUrisToExclude.add(Ren.UrlUtils.sortDataSourceUriParameters(vis.dataSourceUri));
            }
        });

        doc.querySelectorAll("script.ren-tabular-data-set-collection-json").forEach((script) => {

            const dataSourceUri = script.getAttribute("data-source-uri");

            if (dataSourceUri && dataSourceUrisToExclude.has(dataSourceUri)) script.remove();
        });
    };

    // In a full-page report the entire HTML document is the <htmlfile> element.  In a report
    // rendered on the home page the <htmlfile> element is contained within the home page, whose
    // options and furniture have no place in the download.
    const findReportContent = (doc) => doc.querySelector("htmlfile") || doc.body;

    const createDownloadDocument = (filename) => {

        const downloadHtml = document.implementation.createHTMLDocument();
        const head = downloadHtml.createElement("head");

        const charsetMeta = downloadHtml.createElement("meta");
        charsetMeta.setAttribute("charset", "UTF-8");
        head.appendChild(charsetMeta);

        const titleElement = downloadHtml.createElement("title");
        titleElement.textContent = filename.replace(".html", "");
        head.appendChild(titleElement);

        downloadHtml.documentElement.insertBefore(head, downloadHtml.body);

        return downloadHtml;
    };

    // The settings scripts the captured page carries are the wrong ones to download: they were
    // written while loading a visualisation was deferred, and the current settings are prepended in
    // their place below.  Downloading an already-downloaded report is the exception - there the
    // scripts are the report's own, and only need marking unread again
    // ("js-ren-report-settings-done" is added as each is read, so that none is processed twice) so
    // the download reads them on load.
    const resetReportSettingsScripts = (body) => {

        const isDownloadedReport = Ren.UrlContext.isDownloadedReport();

        body.querySelectorAll(".js-ren-report-settings").forEach(script => {

            if (!script.classList.contains("js-ren-downloaded-report-visualisation-script")) {
                script.remove();
            }

            if (isDownloadedReport) {
                script.classList.remove("js-ren-report-settings-done");
            }
            else {

                script.remove();
            }
        });
    };

    // Tabbed modules mark their headers done as they are initialised, so the mark is taken off for
    // the download to initialise them again when it is opened.
    const resetTabbedModules = (downloadHtml) => {

        downloadHtml.querySelectorAll(".ren-tabbed-module__tab-header").forEach((tabbedModuleHeader) => {

            tabbedModuleHeader.removeAttribute("data-tabbed-module-done");
        });
    };

    const saveHtmlAsFile = (blobParts, filename) => {

        const blob = new Blob(blobParts, { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.click();

        // Clean up the blob URL and remove the anchor element to prevent memory leaks.
        setTimeout(() => {

            URL.revokeObjectURL(url);
            link.remove();
        }, 100);
    };

    // The parts of the report that only exist on the server are written into the HTML as script
    // elements, so that the download has them without anything to fetch them from.
    const inlineServerBackedData = (downloadHtmlString, settingsObject, jsonDataSourceUris) => {

        downloadHtmlString = insertJsonDataSources(downloadHtmlString, jsonDataSourceUris);
        downloadHtmlString = insertDataSourceNames(downloadHtmlString);
        downloadHtmlString = insertEmbeddedReportResponseData(downloadHtmlString);
        downloadHtmlString = insertWebRequestCache(downloadHtmlString);

        return populateDataSourceUriParameters(downloadHtmlString, settingsObject);
    };

    // The longest string the browser can make.  A compressed download is inflated into one string
    // when it is opened, and each data source's script element is read as one.
    const MAX_STRING_LENGTH = 536870888;

    const TOO_LARGE_MESSAGE =
        "Sorry, this report is too large to download." +
        "\n\nThere is more data in it than a downloaded report can hold.  Please choose a shorter" +
        " date range and try again.";

    const createTooLargeError = () => {

        const error = new Error(TOO_LARGE_MESSAGE);

        error.isTooLarge = true;

        return error;
    };

    const getPartsLength = (parts) => {

        let length = 0;

        for (let index = 0; index < parts.length; index++) {
            length += parts[index].length;
        }

        return length;
    };

    /**
     * Resolves to the download as the parts of a Blob.  A data source that arrived in a binary
     * format goes in as its bytes rather than as JSON, and is kept out of the HTML string, which
     * for a large data source it would make longer than the longest string the browser can make.
     */
    const buildDownloadParts = async (downloadHtmlString, settingsObject) => {

        const missingDataSourceUris = getMissingDataSourceUris(downloadHtmlString);

        const jsonDataSourceUris = [];
        const binaryParts = [];

        for (let index = 0; index < missingDataSourceUris.length; index++) {

            const dataSourceUri = missingDataSourceUris[index];

            const deflatedBytes = await Ren.DataSourceBinaryResponses.getDeflatedBytes(
                dataSourceUri
            );

            if (deflatedBytes === null) {

                jsonDataSourceUris.push(dataSourceUri);
                continue;
            }

            const elementParts = Ren.DataSourcesScriptElements.createBinaryScriptElementParts(
                dataSourceUri,
                deflatedBytes
            );

            if (elementParts[1].length > MAX_STRING_LENGTH) throw createTooLargeError();

            for (let partIndex = 0; partIndex < elementParts.length; partIndex++) {
                binaryParts.push(elementParts[partIndex]);
            }
        }

        downloadHtmlString = inlineServerBackedData(
            downloadHtmlString,
            settingsObject,
            jsonDataSourceUris
        );

        if (!downloadHtmlString.startsWith("<!DOCTYPE html>")) {
            downloadHtmlString = "<!DOCTYPE html>\n" + downloadHtmlString;
        }

        const targetIndex = downloadHtmlString.lastIndexOf("</bo" + "dy>");

        return [downloadHtmlString.slice(0, targetIndex)]
            .concat(binaryParts, [downloadHtmlString.slice(targetIndex)]);
    };

    const reportDownloadFailed = (error) => {

        Ren.Messages.Events.reportDownloadFailed.notify();

        // Running out of string length is what a report too large to download comes to.
        if (error?.isTooLarge === true || error instanceof RangeError) {

            console.warn("[ReportDownloader] The report is too large to download", error);
            Ren.PopupErrorMessage(TOO_LARGE_MESSAGE);
            return;
        }

        Ren.GlobalErrorHandler.logError(
            "[ReportDownloader] The report could not be downloaded",
            error
        );

        Ren.PopupErrorMessage("Sorry, this report couldn't be downloaded.  Please try again.");
    };

    const initialise = () => {

        const downloadReport = (convertToLiveUrls, compressed) => {

            const filename = getDownloadFilename();
            const doc = captureReportDocument(convertToLiveUrls);

            removeMetaAndTitleElements(doc);
            removeDataSourcesOfExcludedVisualisations(doc);

            const downloadHtml = createDownloadDocument(filename);
            const body = downloadHtml.body;

            body.appendChild(findReportContent(doc));
            downloadHtml.documentElement.appendChild(body);

            resetReportSettingsScripts(body);

            const settingsObject = Ren.ReportSerializer.getReportSettingsObject(true);

            body.prepend(
                Ren.HtmlUtils.create("script")
                    ._addClass("js-ren-report-settings")
                    ._attr("type", "application/json")
                    ._textContent(Ren.JsonUtils.serialize(settingsObject))
            );

            resetTabbedModules(downloadHtml);

            // The visualisations themselves are rebuilt from the settings when the download is
            // opened, so the rendered ones are dropped rather than carried.
            downloadHtml.querySelectorAll(".ren-visualisation").forEach((element) => {

                element.remove();
            });

            Ren.ReportStaticsInserter.insertScripts(downloadHtml, () => {

                Ren.ReportImageInliner.inlineImages(downloadHtml)
                    .then(() => {

                        return buildDownloadParts(
                            downloadHtml.documentElement.outerHTML,
                            settingsObject
                        );
                    })
                    .then((downloadParts) => {

                        // A compressed download is inflated into one string when it is opened, so
                        // one that would be too long for that is saved uncompressed instead.
                        if (!compressed || getPartsLength(downloadParts) > MAX_STRING_LENGTH) {
                            return downloadParts;
                        }

                        return Ren.HtmlFileCompressor.compress(downloadParts)
                            .catch((error) => {

                                Ren.GlobalErrorHandler.logError(
                                    "Report compression failed; saving uncompressed",
                                    error
                                );

                                return downloadParts;
                            });
                    })
                    .then((blobParts) => {

                        saveHtmlAsFile(blobParts, filename);
                        Ren.Messages.Events.reportDownloaded.notify();
                    })
                    .catch((error) => {

                        reportDownloadFailed(error);
                    });
            });
        };

        Ren.Messages.Requests.downloadReport.handle((convertToLiveUrls, compressed) => {

            try {

                downloadReport(convertToLiveUrls, compressed);
            }
            catch (error) {

                reportDownloadFailed(error);
            }
        });
    };

    /**
     * Inserts the passed script tag just before the report's closing </body> tag.
     */
    const insertAtEndOfReport = (downloadHtml, script) => {

        const targetIndex = downloadHtml.lastIndexOf("</bo" + "dy>");

        downloadHtml = downloadHtml.slice(0, targetIndex) + script + downloadHtml.slice(targetIndex);

        return downloadHtml;
    };

    /**
     * Inserts script elements containing embedded report response data into the download HTML.
     * These are used to provide response data for embedded report responses in downloaded reports,
     * since the usual mechanism of fetching this data from the server won't work in that context.
     */
    const insertEmbeddedReportResponseData = (downloadHtml) => {

        const templateElements = Ren.EmbeddedReportResponses.getAllResponsesAsTemplateElements();

        for (let i = 0; i < templateElements.length; i++) {

            downloadHtml = insertAtEndOfReport(downloadHtml, templateElements[i]);
        }

        return downloadHtml;
    };

    /**
     * Gets the URIs of the data sources the download needs that are not already present in the
     * HTML because they were loaded via AJAX rather than as part of the page load.
     */
    const getMissingDataSourceUris = (downloadHtml) => {

        // Don't insert data sources that already exist on the page as script elements.
        const existingDataSourceUris = Ren.DataSourcesScriptElements.getExistingScriptElementDataSourceUris(downloadHtml);

        // Get all visualisations that should be included in the downloaded report.
        const visualisationsToInclude = Ren.VisualisationCollection.getVisualisations()
            .filter(vis => !vis.excludeFromDownloadedReports);

        // Get unique data source URIs from those visualisations.
        const requiredDataSourceUris = new Set();

        const addRequiredDataSourceUri = (dataSourceUri) => {

            if (!dataSourceUri) return;

            const sortedUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

            if (!existingDataSourceUris.has(sortedUri)) requiredDataSourceUris.add(sortedUri);
        };

        visualisationsToInclude.forEach(vis => {

            addRequiredDataSourceUri(vis.dataSourceUri);

            // A date/value chart's date markers are read from a data source of their own.
            addRequiredDataSourceUri(
                Ren.DateValueChart_DateMarkers.getConfig(vis)?.dataSourceUri
            );
        });

        return Array.from(requiredDataSourceUris);
    };

    /**
     * Inserts into the HTML script tags holding the JSON of the data sources with the passed URIs.
     */
    const insertJsonDataSources = (downloadHtml, dataSourceUris) => {

        for (let index = 0; index < dataSourceUris.length; index++) {

            const dataSourceUri = dataSourceUris[index];
            const dataSource = Ren.DataSources.getDataSource(dataSourceUri);

            if (!dataSource) continue;

            const scriptElement = Ren.HtmlUtils.create("script")
                ._attr("type", "application/json")
                ._addClass("ren-tabular-data-set-collection-json")
                ._attr("data-source-uri", dataSourceUri)
                ._textContent(Ren.DataSourcesScriptElements.serializeCollection(
                    dataSource.tabularDataSetCollection
                ))
                .outerHTML;

            downloadHtml = insertAtEndOfReport(downloadHtml, scriptElement);
        }

        return downloadHtml;
    };

    /**
     * Inserts into the HTML a script tag that sets the data source names.  This is required in
     * order for reports that use <ren-data-source> to work when downloaded.
     */
    const insertDataSourceNames = (downloadHtml) => {

        const className = "js-ren-data-source-names-script";

        // If the script already exists, don't insert it again.
        if (downloadHtml.indexOf('class="' + className + '"') !== -1) return downloadHtml;

        const scriptElement = Ren.HtmlUtils.create("script")
            ._addClass(className)
            ._textContent(
                Object.entries(Ren.DataSources.dataSourceNames).map((entry) => {

                    const dataSourceName = entry[0];
                    const name = entry[1];
                    return 'Ren.DataSources.setDataSourceName("' + name + '", "' + dataSourceName + '");';
                }).join("\n")
            );

        downloadHtml = insertAtEndOfReport(downloadHtml, scriptElement.outerHTML);

        return downloadHtml;
    };

    /**
     * Inserts into the HTML script tags containing cached web request responses.  This is required
     * in order for web requests to work in downloaded reports, since the usual mechanism of
     * fetching these data from the server won't work in that context.
     */
    const insertWebRequestCache = (downloadHtml) => {

        const cacheScriptElements = Ren.WebRequests.embedCacheAsScriptElements();

        for (let i = 0; i < cacheScriptElements.length; i++) {

            downloadHtml = insertAtEndOfReport(downloadHtml, cacheScriptElements[i]);
        }

        return downloadHtml;
    };

    /**
     * Replaces the root URLs embedded in the page with the live ones in ren.config's
     * links.liveRootUrls, rather than dev ones.
     */
    const convertUrls = (html) => {

        const liveRootUrls = Ren.Config.getConfig().links.liveRootUrls;
        const names = Object.keys(liveRootUrls);

        for (let i = 0; i < names.length; i++) {

            html = html.replace(
                new RegExp(names[i] + ' = ".*?"'),
                names[i] + ' = "' + liveRootUrls[names[i]] + '"'
            );
        }

        return html;
    };

    /**
     * Populates dataSourceUriParameters for each report settings script in the HTML string.
     * Handles multiple visualisations and report contexts correctly.
     * @param {string} downloadHtmlString - The HTML string to process.
     * @param {object} settingsObject - The report settings object containing visualisations.
     * @returns {string} - The updated HTML string.
     */
    const populateDataSourceUriParameters = (downloadHtmlString, settingsObject) => {

        const tempDoc = document.implementation.createHTMLDocument();
        tempDoc.documentElement.innerHTML = downloadHtmlString;

        const scripts = tempDoc.querySelectorAll("script.js-ren-report-settings");

        scripts.forEach((script) => {

            const scriptSettings = Ren.JsonUtils.parse(script.textContent);

            // A report's settings file need not have any visualisations, e.g. one that only sets
            // raiseReport.
            if (!scriptSettings.visualisations) return;

            for (let i = 0; i < scriptSettings.visualisations.length; i++) {

                const scriptVisualisation = scriptSettings.visualisations[i];

                const matching = settingsObject.visualisations.find((v) => {

                    return v.visualisationGuid === scriptVisualisation.visualisationGuid;
                });

                if (matching && matching.dataSourceUriParameters) {

                    const dataSourceUriParameters = {};
                    const dataSourceUri = new URL(matching.dataSourceUri, window.location.origin);

                    dataSourceUri.searchParams.forEach((value, key) => {

                        dataSourceUriParameters[key] = value;
                    });

                    scriptVisualisation.dataSourceUriParameters = dataSourceUriParameters;
                }
            }

            script.textContent = Ren.HtmlUtils.escapeScriptClosingTag(
                Ren.JsonUtils.serialize(scriptSettings)
            );
        });

        // Serialize back to JSON.
        return tempDoc.documentElement.innerHTML;
    };

    return {
        initialise
    };
})();
