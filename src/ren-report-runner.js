/**
 * Functions for making the AJAX call to the server to generate the report, based on the SQL text
 * in the editor or a SQL filename.
 */
Ren.ReportRunner = (inputReader) => {

    const fullReportTimeoutSeconds = 600;

    let previewAbortController = null;
    let downloadAbortController = null;

    const showCancelLink = () => {

        const link = document.querySelector(".js-ren-report-preview-cancel-link");
        if (link) link.style.display = "";
    };

    const hideCancelLink = () => {

        const link = document.querySelector(".js-ren-report-preview-cancel-link");
        if (link) link.style.display = "none";
    };

    /**
     * Gets the SQL editor textarea wrapper if available (only on Editor page).
     */
    const getTextareaWrapper = () => {

        const textarea = document.querySelector(".js-ren-report-editor-sql-box");
        if (!textarea) return null;

        return {
            getSelectionStartTextIndex: () => $(textarea).prop("selectionStart"),
            getSelectionEndTextIndex: () => $(textarea).prop("selectionEnd"),
            setSelection: (start, end) => {

                $(textarea).focus();
                $(textarea).prop("selectionStart", start).prop("selectionEnd", end);
            }
        };
    };

    /**
     * Gets the current selection in the SQL editor textarea, or null off the Editor page.
     */
    const saveSelection = () => {

        const textareaWrapper = getTextareaWrapper();
        if (!textareaWrapper) return null;

        return {
            start: textareaWrapper.getSelectionStartTextIndex(),
            end: textareaWrapper.getSelectionEndTextIndex()
        };
    };

    /**
     * Adds the loading animation to the preview area.
     */
    const startLoadingAnimation = () => {

        const preview = document.querySelector(".js-ren-report-preview-content");

        preview.classList.add("ren-report-editor__preview-content--loading");

        const loadingAnimation = Ren.LoadingAnimations.createHomeEditorLoadingAnimation();

        preview.appendChild(loadingAnimation);
    };

    const stopLoadingAnimation = () => {

        const preview = document.querySelector(".js-ren-report-preview-content");
        if (preview) preview.classList.remove("ren-report-editor__preview-content--loading");

        Ren.HtmlUtils.removeElements(".ren-report-loading-animation");
    };

    /**
     * If on the Editor page, deletes the 'sqlFilename' property.  If on the Home page, deletes the
     * 'sql' property.  If sqlOverride is specified and on the Editor page, sets the 'sql' property
     * to sqlOverride.
     */
    const selectCorrectSqlInput = (data, sqlOverride) => {

        if (Ren.UrlContext.onEditorPage()) {

            delete data.sqlFilename;
            if (sqlOverride) data.sql = sqlOverride;
        }
        else {

            delete data.sql;
        }
    };

    const generateNoResultsHtml = () => {

        return `<p class="ren-report-editor__preview-content_no_results qa-ren-report-preview-no-results">
                    The query ran successfully.  No results were returned.
                </p>`;
    };

    const generateNoSqlMessage = () => {

        return `<p class="ren-report-editor__preview-content_no_sql qa-ren-report-preview-no-sql-specified">
                    No SQL was specified.
                </p>`;
    };

    /**
     * Generates the report preview and renders it in the preview pane, executing sqlOverride if
     * specified, or else the SQL in the editor or the selected report SQL filename.
     */
    const generateReportPreview = (noCache, sqlOverride) => {

        const savedSelection = saveSelection();

        const data = inputReader.readInputs(true);
        selectCorrectSqlInput(data, sqlOverride);

        const preview = document.querySelector(".js-ren-report-preview-content");
        preview.textContent = "";

        if (Ren.UrlContext.onEditorPage() && !data.sql.trim()) {

            preview.innerHTML = generateNoSqlMessage();

            togglePreviewErrorClass(preview, true);
            restoreSelection(savedSelection);
            return;
        }

        Ren.Messages.Events.reportGenerating.notify();
        Ren.QA.reset();
        startLoadingAnimation();

        if (!Ren.UrlContext.onEditorPage()) {
            data.connectionGuid = Ren.DbConnectionManagement.generateConnectionGuid();
        }

        const isFullPreview = !sqlOverride;

        generatePreview(data, preview, noCache, savedSelection, isFullPreview);
    };

    /**
     * Gets a value indicating whether the content type is one of the binary data source formats.
     */
    const isBinaryContentType = (contentType) => {

        const binaryContentTypes = Ren.DataSourceFormats.getBinaryContentTypes();

        for (let index = 0; index < binaryContentTypes.length; index++) {

            if (contentType.indexOf(binaryContentTypes[index]) === 0) return true;
        }

        return false;
    };

    /**
     * Reads a binary response body into its tabular data set collection, on a worker where one is
     * available, as the data sources do.
     */
    const readBinaryCollection = async (rawResponse) => {

        const buffer = await rawResponse.arrayBuffer();

        const format = Ren.DataSourceFormats.resolveBinary(buffer);

        if (format === null) throw new Error("[ReportRunner] Unreadable binary preview response.");

        if (format.supportsWorkerParse === true &&
            await Ren.DataSourceParseWorker.isBinaryAvailable()) {

            const parsed = await Ren.DataSourceParseWorker.parseBinary(buffer);

            if (parsed !== null && parsed.lost === true) {

                throw new Error("[ReportRunner] The worker could not read the preview response.");
            }

            // A null means the worker declined and left the buffer to be read here.
            if (parsed !== null) {

                Ren.DataSourceParseWorker.unpackCollection(parsed.collection);

                return parsed.collection;
            }
        }

        return format.parseBuffer(buffer, "Preview").tabularDataSetCollection;
    };

    const togglePreviewErrorClass = (target, isError) => {

        target.classList.toggle("ren-report-editor__preview-content--error", isError);
    };

    /**
     * Generates the report preview and renders it in the target container.
     */
    const generatePreview = (data, target, noCache, savedSelection, isFullPreview) => {

        Ren.isGeneratingPreview = true;
        Ren.isGeneratingFullPreview = isFullPreview;
        previewAbortController = new AbortController();
        showCancelLink();

        const action = data.reportName || "SqlBasedReport";

        (async () => {

            try {

                const url = `/${action}?format=json`;
                const rawResponse = await Ren.FetchUtils.fetch(url, {
                    method: "POST",
                    headers: {

                        // Any binary format this client can read is named ahead of JSON, which
                        // tells the server it may answer with one.
                        "Accept": Ren.DataSourceFormats.getBinaryContentTypes()
                            .concat("application/json")
                            .join(", "),
                        "Content-Type": "application/json",
                        "Cache-Control": noCache ? "no-cache" : "max-age=3600",
                        // Re-running ren.js would reset Ren module state, orphaning visualisations
                        // created before the async reload completed.
                        "X-Ren-Scripts-Already-Loaded": "true"
                    },
                    body: JSON.stringify(data),
                    signal: previewAbortController.signal,
                    jumpQueue: true
                });

                if (!Ren.UrlContext.onEditorPage()) {
                    Ren.DbConnectionManagement.disposeConnection(data.connectionGuid);
                }

                // Other reports on the same page keep their visualisations.
                const reportContext = target.querySelector(".js-ren-report-context");

                if (reportContext) {

                    Ren.VisualisationCollection.destroyVisualisationsBelongingToReportContext(reportContext, false);
                }
                else {

                    Ren.VisualisationCollection.destroyAllVisualisations();
                }
                Ren.DataGroupingSettingsCollection.destroyAllDataGroupingSettings();
                Ren.GridStateCollection.destroyAllGridState();

                // Settings are actuized twice per preview, the first pass skipping client-side
                // popups whose "Preview" data source does not exist yet.  A lingering one from the
                // previous preview would have both passes create them, duplicating the popups.
                Ren.DataSources.removeDataSource("Preview");

                const contentType = rawResponse.headers.get("Content-Type");

                const isBinary = isBinaryContentType(contentType);

                if (isBinary || contentType.indexOf("application/json") === 0) {

                    const tabularDataSetCollection = isBinary
                        ? await readBinaryCollection(rawResponse)
                        : await rawResponse.json();

                    if (tabularDataSetCollection.NoResults) {

                        target.innerHTML = generateNoResultsHtml();
                        togglePreviewErrorClass(target, false);
                        stopLoadingAnimation();
                        Ren.Messages.Events.reportAddedToDom.notify();
                    }
                    else if (tabularDataSetCollection.Error) {

                        target.innerHTML = Ren.ReportRunner_ErrorHtmlGenerator.generateErrorHtml(
                            tabularDataSetCollection.Error,
                            tabularDataSetCollection.Details,
                            tabularDataSetCollection.SqlThatFailed
                        );

                        togglePreviewErrorClass(target, true);
                        stopLoadingAnimation();
                        Ren.Messages.Events.reportAddedToDom.notify();
                    }
                    else {

                        target.textContent = "";
                        Ren.TabularData_Services.addServicesToTabularDatas(tabularDataSetCollection);

                        // On the Editor page, settings are loaded before the grids are created, so
                        // they are available when grids initialize with embedding fallback.
                        if (Ren.UrlContext.onEditorPage()) {

                            const settingsLoadedPromise = new Promise((resolve) => {

                                const oneTimeHandler = () => {

                                    resolve();
                                    return false; // Remove handler after running once.
                                };

                                Ren.Messages.Events.reportSettingsLoaded.handle(oneTimeHandler);
                            });

                            Ren.ReportSettingsLoader.loadReportSettingsBasedOnUrlQueryParameters();

                            await settingsLoadedPromise;
                        }

                        Ren.ReportPreview.renderReportPreview(target, tabularDataSetCollection);
                        togglePreviewErrorClass(target, false);
                        stopLoadingAnimation();
                        Ren.Messages.Events.reportAddedToDom.notify();
                        Ren.PageHooks.previewRendered();
                    }
                }
                else {

                    const html = await rawResponse.text();
                    Ren.HtmlUtils.setHTML(target, html);
                    stopLoadingAnimation();
                    Ren.Messages.Events.reportAddedToDom.notify();
                }

                if (Ren.UrlContext.onHomePage()) {

                    Ren.Log.info(
                        "ReportPreview",
                        data.reportName,
                        data.reportName,
                        null,
                        { }
                    );
                }

                if (Ren.UrlContext.onEditorPage()) {
                    Ren.AllReportsLoadedMessage.notifyAllReportsLoadedOnceNoLoadingAnimationsArePresent();
                }

                restoreSelection(savedSelection);

                hideCancelLink();

                // Cleared after a delay, so that reportAddedToDom handlers can still check it.
                setTimeout(() => {

                    Ren.isGeneratingPreview = false;
                }, 100);
            }
            catch (error) {

                if (error.name === "AbortError") {

                    stopLoadingAnimation();
                    target.innerHTML =
                        `<p class="ren-report-editor__preview-cancelled">query cancelled</p>`;
                    togglePreviewErrorClass(target, false);
                    Ren.isGeneratingPreview = false;
                    hideCancelLink();
                    return;
                }

                Ren.GlobalErrorHandler.logError("[ReportRunner] Error generating preview:", error);
                Ren.isGeneratingPreview = false;
                hideCancelLink();
                throw error;
            }
        })();
    };

    /**
     * Restores the selection in the SQL editor textarea.
     */
    const restoreSelection = (selection) => {

        const textareaWrapper = getTextareaWrapper();
        if (!textareaWrapper || !selection) return;

        requestAnimationFrame(() => {

            textareaWrapper.setSelection(selection.start, selection.end);
        });
    };

    /**
     * Generates the report download(s) and presents the files as downloads, executing sqlOverride
     * if specified, or else the SQL in the editor or the selected report SQL filename.
     */
    const generateReportDownload = (noCache, sqlOverride) => {

        Ren.isGeneratingDownload = true;

        const savedSelection = saveSelection();

        const data = inputReader.readInputs(false);
        selectCorrectSqlInput(data, sqlOverride);

        const preview = document.querySelector(".js-ren-report-preview-content");
        preview.innerHTML = "";

        if (Ren.UrlContext.onEditorPage() && !data.sql.trim()) {

            preview.innerHTML = generateNoSqlMessage();

            togglePreviewErrorClass(preview, true);
            restoreSelection(savedSelection);

            Ren.isGeneratingDownload = false;
            return;
        }

        Ren.Messages.Events.reportGenerating.notify();
        Ren.QA.reset();

        startLoadingAnimation();
        downloadAbortController = new AbortController();
        showCancelLink();

        if (!Ren.UrlContext.onEditorPage()) {
            data.connectionGuid = Ren.DbConnectionManagement.generateConnectionGuid();
        }

        Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("generateReport"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": noCache ? "no-cache" : "max-age=3600"
            },
            body: JSON.stringify({
                reportName: data.reportName,
                data: JSON.stringify(data)
            }),
            timeout: 1000 * fullReportTimeoutSeconds,
            signal: downloadAbortController.signal,
            jumpQueue: true
        })
            .then(response => {

                if (!Ren.UrlContext.onEditorPage()) {
                    Ren.DbConnectionManagement.disposeConnection(data.connectionGuid);
                }

                stopLoadingAnimation();

                if (response.status === 204) {
                    preview.innerHTML = generateNoResultsHtml();
                }
                else if (response.status === 200) {

                    return response.text().then(outputPathsCsv => {

                        const outputPaths = outputPathsCsv.split(",");
                        Ren.ReportDownloads.presentFilesForDownload(outputPaths);
                    });
                }
                else {

                    return response.text().then(errorText => {

                        let errorObj = {};

                        try {

                            errorText = Ren.TextUtils.removeLeading(errorText, "ProtocolError ");

                            errorObj = JSON.parse(errorText);
                        }
                        catch {

                            // Server returned non-JSON (e.g. an HTML error page) — render it
                            // directly, matching the behaviour of the Preview button.
                            Ren.HtmlUtils.setHTML(preview, errorText);
                            togglePreviewErrorClass(preview, true);
                            return;
                        }

                        preview.innerHTML = Ren.ReportRunner_ErrorHtmlGenerator.generateErrorHtml(
                            errorObj.Error || "Error",
                            errorObj.Details || null,
                            errorObj.SqlThatFailed || null
                        );

                        togglePreviewErrorClass(preview, true);
                    });
                }
            })
            .then(() => {

                restoreSelection(savedSelection);
            })
            .catch(error => {

                stopLoadingAnimation();

                if (error.name === "AbortError") {

                    preview.innerHTML =
                        `<p class="ren-report-editor__preview-cancelled">Download cancelled.</p>`;
                    togglePreviewErrorClass(preview, false);
                }
                else {

                    preview.innerHTML = Ren.ReportRunner_ErrorHtmlGenerator.generateErrorHtml(
                        error.message || "Error",
                        error.stack,
                        null
                    );

                    togglePreviewErrorClass(preview, true);
                }

                restoreSelection(savedSelection);
            })
            .finally(() => {

                Ren.isGeneratingDownload = false;
                hideCancelLink();
            });
    };

    const cancelLink = document.querySelector(".js-ren-report-preview-cancel-link");

    if (cancelLink) {

        cancelLink.addEventListener("click", (e) => {

            e.preventDefault();
            if (previewAbortController) previewAbortController.abort();
            if (downloadAbortController) downloadAbortController.abort();
        });
    }

    return {
        generateReportDownload,
        generateReportPreview
    };
};
