/**
 * Sets up and provides a collection of data sources.
 */
Ren.DataSources = (() => {

    // The URIs a visualisation has declared as ones to fetch, against the name of the format each
    // is to be read as, or null where the response is to speak for itself.  A named data source
    // needs no entry: it is fetchable by its URI alone.
    const fetchableDataSourceFormatNames = {};

    /**
     * Declares a data source URI as one to fetch from the server, and names the format its response
     * is to be read as.
     */
    const registerFetchableDataSource = (dataSourceUri, formatName) => {

        if (!dataSourceUri) return;

        const sortedUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        fetchableDataSourceFormatNames[sortedUri] = formatName ?? null;
    };

    /**
     * Gets the name of the format a data source's response is to be read as, or null when nothing
     * has named one and it is to be worked out from the response itself.
     */
    const getDataSourceFormatName = (dataSourceUri) => {

        if (!dataSourceUri) return null;

        const sortedUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        return fetchableDataSourceFormatNames[sortedUri] ?? null;
    };

    /**
     * Gets a value indicating whether the specified data source is a server-side data source, i.e.
     * needs to be requested from the server as opposed to being created in the browser.
     *
     * A named data source qualifies by its URI; anything else by having been declared as a fetch
     * URI.
     */
    const isServerSideDataSource = (dataSourceUri) => {

        if (!dataSourceUri) return false;

        if (Ren.NamedDataSources.isNamedUri(dataSourceUri)) return true;

        const sortedUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        return fetchableDataSourceFormatNames[sortedUri] !== undefined;
    };

    // Gets the root data sources, which are TabularDataSets.
    const dataSources = {};

    const getDataSource = (dataSourceUri) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);
        return dataSources[dataSourceUri];
    };

    const getTabularDataSet = (dataSourceUri) => dataSources[dataSourceUri]?.tabularDataSet;
    const getDataSources = () => Object.values(dataSources);

    const getDataSourceEntries = () => Object.entries(dataSources);

    /**
     * Gets the tabular data corresponding to a visualisation.
     */
    const getTabularDataForVisualisation = (visualisation) => {

        // Get the data tab index from the visualisation; default to 1 if not present.
        let dataTabIndex = 1;

        if (visualisation.dataTabIndex) dataTabIndex = visualisation.dataTabIndex;
        if (visualisation.dataTabIndexes) dataTabIndex = visualisation.dataTabIndexes[0];

        const tabularData = Ren.DataSources.getTabularData(
            visualisation.dataSourceUri,
            dataTabIndex,
            visualisation.dataTabGroup
        );

        return tabularData;
    };

    /**
     * Creates a clone of the tabular data corresponding to a visualisation, runs the tabular data
     * transformers specified in the visualisation, and returns the cloned tabular data.  If there
     * are no transformers specified, returns the original tabular data object.
     */
    const cloneTabularDataAndApplyTransformationsForVisualisation = (visualisation) => {

        const tabularData = getTabularDataForVisualisation(visualisation);

        if (!tabularData) return null; // e.g. statBar visualisation

        // Visualisations frequently specify a single dataTabIndex or nothing, and the
        // TabularDataPool expects an array.
        let dataTabIndexes = visualisation.dataTabIndexes;

        if (!dataTabIndexes) {

            if (visualisation.dataTabIndex !== undefined && visualisation.dataTabIndex !== null) {
                dataTabIndexes = [visualisation.dataTabIndex];
            }
            else {

                dataTabIndexes = [1];
            }
        }

        return cloneTabularDataAndApplyTransformations(
            tabularData,
            visualisation.dataSourceUri,
            dataTabIndexes,
            visualisation.dataTabGroup,
            visualisation.dataGroupingSettingsGroup,
            visualisation.tabularDataTransformers
        );
    };

    /**
     * Creates a clone of the tabular data, runs the tabular data transformers specified, and
     * returns the cloned tabular data.  If no transformers are passed, returns the original
     * tabular data object.
     */
    const cloneTabularDataAndApplyTransformations = (
        tabularData,
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers
    ) => {

        // If no transformers are specified, return the original tabular data.
        if (tabularDataTransformers === undefined || tabularDataTransformers.length === 0) {

            return tabularData;
        }

        const clonedTabularData = Ren.TabularDataPool.provideClone(
            tabularData,
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        );

        return clonedTabularData;
    };

    const getTabularData = (dataSourceUri, dataTabIndex, dataTabGroup) => {

        if (!dataSourceUri) return null;

        const tabularDataSet = getTabularDataSet(dataSourceUri);

        if (!tabularDataSet) return null;

        if (dataTabGroup) {

            const tabularData = tabularDataSet.TabularDatas
                .find(td => td.dataTabGroup === dataTabGroup);

            if (!tabularData) {

                const availableDataTabGroups = tabularDataSet.TabularDatas.map(td => td.dataTabGroup);

                Ren.GlobalErrorHandler.logError(
                    `[DataSources] getTabularData: No tabular data found for dataTabGroup = ` +
                    `${dataTabGroup} in data source ${dataSourceUri}.  Available dataTabGroups: ` +
                    `["${availableDataTabGroups.join("\", \"")}]".`
                );
            }

            return tabularData;
        }
        else {

            const tabularData = tabularDataSet.TabularDatas[
                Ren.ArrayUtils.convertToZeroBased(dataTabIndex)
            ];

            if (!tabularData) {

                Ren.GlobalErrorHandler.logError(
                    `[DataSources] getTabularData: No tabular data found for dataTabIndex = ` +
                    `${dataTabIndex} in data source ${dataSourceUri}. Available dataTabIndexes: ` +
                    `[${tabularDataSet.TabularDatas.map((td, i) => i + 1).join(", ")}].`
                );
            }

            return tabularData;
        }
    };

    const dataSourceNames = {};

    const upsertDataSource = (dataSourceUri, tabularDataSetCollection) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        removeDataSource(dataSourceUri);
        addDataSource(dataSourceUri, tabularDataSetCollection);
    };

    const addDataSource = (dataSourceUri, tabularDataSetCollection) => {

        if (!dataSourceUri) {

            console.warn("Ren.DataSources.addDataSource called with dataSourceUri = " + addDataSource);
            return;
        }

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        // If the data source is already loaded or loading, don't load it.
        if (dataSources[dataSourceUri] !== undefined &&
            dataSources[dataSourceUri] !== "PENDING") return;

        const queryParameters = Ren.UrlUtils.getAllQueryParameters(dataSourceUri);

        const tabularDataSet = tabularDataSetCollection.TabularDataSets[0];

        tabularDataSet.SqlFilename = tabularDataSetCollection.SqlFilename;
        tabularDataSet.DataSourceUri = tabularDataSetCollection.DataSourceUri;
        tabularDataSet.CompressionDictionary = tabularDataSetCollection.CompressionDictionary;

        // Set defaults for some of the tabular data properties.
        tabularDataSet.TabularDatas.forEach((tabularData) => {

            tabularData.FreezePanesColumnIndex ??= 0;
            tabularData.GroupByColumnIndexes ??= [];
        });

        dataSources[dataSourceUri] = {
            dataSourceUri,
            queryParameters,
            tabularDataSet,
            tabularDataSetCollection,
            isVirtualDataSource: tabularDataSetCollection.IsVirtualDataSource ?? false
        };

        Ren.Messages.Events.dataSourcesChanged.notify();
        Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
    };

    /**
     * Gets the name of the report on the page, for logging.
     */
    const getReportName = () =>
        document.querySelector(".js-ren-report-context--on-page")?.getAttribute("data-report-name") || "";

    /**
     * Gets the error details for a response that couldn't be read, showing the start of it.
     */
    const getResponseErrorDetails = (error, response) => {

        const MAX_DETAILS_LENGTH = 1000;

        return {
            error,
            details: response.substring(0, MAX_DETAILS_LENGTH),
            sqlThatFailed: null,
            isUserFacing: false
        };
    };

    /**
     * Gets the error details for a response that no data source format recognises.
     */
    const getUnrecognisedResponseErrorDetails = (contentType, response) =>
        getResponseErrorDetails(
            "The response isn't in a data format Ren recognises" +
            (contentType ? ` (its content type is ${contentType})` : "") + ".  " +
            "Name its format with a data-format attribute, one of: " +
            Ren.DataSourceFormats.getNames().join(", ") + ".",
            response
        );

    /**
     * Reports a data source script element whose JSON can't be parsed, and takes it off the page so
     * that later scans don't keep finding it.  Content that is present but incomplete means the
     * response was cut short, so the user is told to run the report again.
     */

    const reportUnparseableDataSourceJson = (dataSourceUri, element, json) => {

        // There is no element when the JSON came straight from a fetch rather than off the page.
        element?.remove();
        delete dataSources[dataSourceUri];

        const message =
            "Sorry, this report's data couldn't be read." +
            "\n\nIt arrived incomplete, which usually means the response was cut short on its way" +
            " from the server.  Please try running the report again." +
            `\n\nData source: ${dataSourceUri}`;

        // Logged to the console only: the failure is shown to the user in the popup
        // below and recorded in RenLog, so its indicator would only repeat that.
        console.error(
            `[DataSources] Unparseable JSON for ${dataSourceUri}`,
            json
        );

        Ren.Log.error(
            "DataSourceUnparseable",
            getReportName(),
            Ren.NamedDataSources.removeBaseUri(dataSourceUri),
            Ren.RandomUtils.generateRandomClassName("i"),
            { contentLength: json ? json.length : 0 }
        );

        Ren.PopupErrorMessage(message);
    };

    /**
     * Prepares a parsed tabular data set collection and adds it to the collection.
     */
    const prepareAndAddDataSource = (dataSourceUri, tabularDataSetCollection, newlinesApplied) => {

        // Replace escaped newlines with literal newlines in all string values, unless a worker has
        // done so already.
        if (newlinesApplied !== true) {

            tabularDataSetCollection = Ren.Perf.time("main.replaceEscapedNewlines", () =>
                Ren.DataSourceDecoding.replaceEscapedNewlinesInCollection(tabularDataSetCollection)
            );
        }

        Ren.Perf.time("main.addServices", () =>
            Ren.TabularData_Services.addServicesToTabularDatas(tabularDataSetCollection));

        Ren.Perf.time("main.addDataSource", () =>
            addDataSource(dataSourceUri, tabularDataSetCollection));
    };

    /**
     * Puts a data source fetched from the server in place, and leaves its JSON on the page as a
     * script element, which is what a downloaded report reads its data sources from.  A format that
     * produced the collection from something other than JSON has the JSON made here.
     *
     * A binary format gets no element: serialising its collection would cost the very thing the
     * format saved.  Its bytes are kept instead, for the downloader to write one from.
     */
    const addFetchedDataSource = (
        dataSourceUri,
        format,
        adapted,
        newlinesApplied,
        binaryBuffer
    ) => {

        prepareAndAddDataSource(
            dataSourceUri,
            adapted.tabularDataSetCollection,
            newlinesApplied
        );

        // Let any uploaded files module on the page pick up the uploaded files settings the
        // report's SQL declares for itself, so it shows the format the report expects.
        Ren.UploadedFilesModuleUpdater?.applyUploadedFilesDefaultsFromResponse(
            dataSourceUri,
            adapted.tabularDataSetCollection
        );

        if (format.isBinary === true) {

            if (binaryBuffer) Ren.DataSourceBinaryResponses.retain(dataSourceUri, binaryBuffer);

            return;
        }

        Ren.DataSourcesScriptElements.addDataSourceScriptElement(
            dataSourceUri,
            adapted.json ?? Ren.DataSourcesScriptElements.serializeCollection(
                adapted.tabularDataSetCollection
            )
        );
    };

    // The data sources whose binary script elements are being read, which takes more than one turn.
    const binaryScriptElementLoads = new Set();

    /**
     * Reads a script element holding a data source's binary response, as a downloaded report of a
     * large data source has.  The data source is pending until it is read, so that nothing tries
     * to fetch it in the meantime.
     */
    const loadBinaryScriptElement = async (dataSourceUri, element) => {

        if (binaryScriptElementLoads.has(dataSourceUri)) return;

        binaryScriptElementLoads.add(dataSourceUri);
        dataSources[dataSourceUri] = "PENDING";

        try {

            const buffer = await Ren.DataSourcesScriptElements.readBinaryScriptElement(element);

            const format = Ren.DataSourceFormats.resolveBinary(buffer);

            if (format === null) throw new Error("Not a binary data source.");

            const adapted = format.parseBuffer(buffer, dataSourceUri);

            prepareAndAddDataSource(dataSourceUri, adapted.tabularDataSetCollection);
        }
        catch {

            reportUnparseableDataSourceJson(dataSourceUri, element, null);
        }
        finally {

            binaryScriptElementLoads.delete(dataSourceUri);
        }
    };

    /**
     * Scans the document for elements with class "ren-tabular-data-set-collection-json" (which
     * contain the JSON representation of TabularDataSetCollections) and adds them to the
     * collection.  An element whose data source is already loaded is skipped.
     */
    const scanPageForTabularDataSetCollectionsJson = () => {

        const tabularDataScriptElements =
            Ren.DataSourcesScriptElements.getAllTabularDataSourceScriptElements();

        tabularDataScriptElements.forEach((element) => {

            // dataSourceUri is a named data source's URI, with any parameters, or some other
            // generated value such as 'user-report-settings-data-source'.

            // It should uniquely identify the data source (including any parameters).

            const dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(
                element.getAttribute("data-source-uri")
            );

            // Skip if already loaded — avoids expensive JSON.parse on every scan when only a
            // popup subset of the page has changed (e.g. popup date selector reload).
            if (dataSources[dataSourceUri] !== undefined &&
                dataSources[dataSourceUri] !== "PENDING") {

                return;
            }

            if (Ren.DataSourcesScriptElements.isBinaryScriptElement(element)) {

                loadBinaryScriptElement(dataSourceUri, element);
                return;
            }

            const json = element.textContent;

            // An empty element is one whose data source came back with nothing and has already been
            // reported, so it is just taken off the page.
            if (Ren.TextUtils.isNullOrWhitespace(json)) {

                element.remove();
                return;
            }

            let tabularDataSetCollection = null;

            try {

                tabularDataSetCollection = JSON.parse(json);
            }
            catch {

                // Report this one and carry on with the rest of the page's data sources, rather
                // than throwing out of the scan and leaving them all unloaded.
                reportUnparseableDataSourceJson(dataSourceUri, element, json);
                return;
            }

            prepareAndAddDataSource(dataSourceUri, tabularDataSetCollection);
        });
    };

    Ren.Messages.Requests.scanPageForDataSources.handle((callback) => {

        scanPageForTabularDataSetCollectionsJson();

        if (callback) callback();
    });

    const queueJumpingDataSourceUris = new Set();

    const setDataSourceUriToJumpQueue = (dataSourceUri) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        queueJumpingDataSourceUris.add(dataSourceUri);
    };

    // Counts the responses that came back with an empty body, per data source URI.  A request
    // cancelled part way through can resolve with no body, so one empty response is retried, but a
    // data source that keeps coming back empty is reported to the user.
    const emptyResponseCounts = {};

    const MAX_EMPTY_RESPONSE_RETRIES = 1;

    /**
     * Deals with a data source request that returned an empty body: clears the pending marker (so
     * nothing waits on a data source that is never going to arrive), retries it once, and tells the
     * user if it is still empty after that.
     */
    const handleEmptyDataSourceResponse = (dataSourceUri, reportName, requestGuid) => {

        delete dataSources[dataSourceUri];

        const attempts = (emptyResponseCounts[dataSourceUri] ?? 0) + 1;

        emptyResponseCounts[dataSourceUri] = attempts;

        console.warn(
            `[DataSources] Empty response for data source: ${dataSourceUri} (attempt ${attempts}).`
        );

        Ren.Log.error(
            "DataSourceEmptyResponse",
            reportName,
            Ren.NamedDataSources.removeBaseUri(dataSourceUri),
            requestGuid,
            { attempts }
        );

        if (attempts <= MAX_EMPTY_RESPONSE_RETRIES) {

            requestDataSource(dataSourceUri);
            return;
        }

        const message =
            "Sorry, no data came back for part of this report." +
            "\n\nThe server returned an empty response for it, so there is nothing to show." +
            "  Please try running the report again." +
            `\n\nData source: ${dataSourceUri}`;

        // Reported as an error, since still empty after a retry is a genuine failure.  Logged to
        // the console only, since the popup below and RenLog above already record it.
        console.error("[DataSources] " + message);

        // A data source the page polls in the background is the page's business, not the user's.
        if (Ren.NamedDataSources.getOptions(dataSourceUri).quiet) return;

        Ren.PopupErrorMessage(message);
    };

    /**
     * Requests the data source with the specified URI from the server, unless it is already loaded
     * or loading.  Ignores calls with no dataSourceUri or a non-server-side dataSourceUri.
     */
    const requestDataSource = async (dataSourceUri) => {

        if (!dataSourceUri) return; // Not all visualisations have a data source.
        if (!isServerSideDataSource(dataSourceUri)) return;

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        if (dataSources[dataSourceUri]) {

            return;
        }

        if (dataSources[dataSourceUri] === "PENDING") {

            return;
        }

        dataSources[dataSourceUri] = "PENDING";

        // Asking for JSON makes the server send back error details as JSON rather than as an HTML
        // error page.  Any binary format this client can read is named ahead of it, which tells the
        // server it may answer with one.  Anything else is accepted last, so that an endpoint
        // serving another format answers rather than refusing with a 406.
        const headers = {
            "Accept": Ren.DataSourceFormats.getBinaryContentTypes()
                .concat("application/json", "*/*;q=0.1")
                .join(", ")
        };

        const isCacheEnabled = document.querySelector(".js-ren-is-cache-enabled")?.value === "True";

        if (!isCacheEnabled || Ren.NamedDataSources.getOptions(dataSourceUri).noCache) {
            headers["Cache-Control"] = "no-cache";
        }

        if (Ren.UrlContext.isDownloadedReport()) {

            // In a downloaded report, requestDataSource shouldn't be called, since all the data
            // sources referenced by the report settings should be present on the page.  If we do
            // end up here, then the data source must be missing.

            const availableDataSources = getDataSources();

            const message =
                "Downloaded report should contain the data source: " + dataSourceUri + "." +
                "\n\nAvailable data sources:" +
                `\n\n${availableDataSources.map(ds => ds.dataSourceUri).join("\n")}`;

            console.warn("[DataSources] " + message);
            return;
        }

        const requestTime = new Date();

        // Use the same guid for the request and response log entries, so they can be correlated.
        const requestGuid = Ren.RandomUtils.generateRandomClassName("i");

        const reportName = getReportName();

        try {

            Ren.Log.info(
                "DataSourceRequest",
                reportName,
                Ren.NamedDataSources.removeBaseUri(dataSourceUri),
                requestGuid,
                { }
            );

            const jumpQueue = queueJumpingDataSourceUris.has(dataSourceUri);

            const options = await Ren.DataSourceRequests.getOptions(
                dataSourceUri,
                { method: "GET", headers, jumpQueue }
            );

            const r = await Ren.FetchUtils.fetch(dataSourceUri, options);

            // Some named data sources are virtual, so a 404 from one is no error, but one from
            // any other endpoint is.
            if (r.status === 404 && Ren.NamedDataSources.isNamedUri(dataSourceUri)) {

                Ren.Log.error(
                    "DataSourceNotFound",
                    reportName,
                    Ren.NamedDataSources.removeBaseUri(dataSourceUri),
                    requestGuid,
                    { }
                );

                return;
            }

            if (!r.ok) throw await Ren.DataSourceErrorPopup.readErrorResponse(r);

            // The body is read as bytes before anything decides what it is: a binary response says
            // so in its first few, and a text one is handed to a worker where it can be, so that
            // neither the UTF-8 decode nor the JSON.parse happens on this thread.  The worker hands
            // the text back too, since the script element added further down still needs it.
            let response = null;
            let workerCollection = null;
            let binaryCollection = null;
            let binaryBuffer = null;

            // A worker reads a response as a tabular data set collection, the only format it knows.
            // A data source that has asked for a different one is read here instead.
            const declaredFormatName = getDataSourceFormatName(dataSourceUri);

            const canUseWorker =
                declaredFormatName === null ||
                declaredFormatName === Ren.DataSourceFormats.DEFAULT_FORMAT_NAME;

            const buffer = await Ren.Perf.timeAsync("main.readBody", () => r.arrayBuffer());

            // A binary response is recognised by its own first bytes, before anything would need it
            // decoded.
            const binaryFormat = Ren.DataSourceFormats.resolveBinary(buffer);

            if (binaryFormat !== null) {

                // Decoding it walks every string of its dictionary and every column of its rows, so
                // it is moved off this thread; what comes back is transferred rather than copied.
                if (binaryFormat.supportsWorkerParse === true &&
                    await Ren.DataSourceParseWorker.isBinaryAvailable()) {

                    const parsed = await Ren.DataSourceParseWorker.parseBinary(buffer);

                    if (parsed !== null && parsed.lost === true) {

                        // The bytes were transferred to a worker that could not read them, so this
                        // response is gone.  Reported like any other unreadable one.
                        reportUnparseableDataSourceJson(dataSourceUri, null, null);
                        return;
                    }

                    // A null means the worker declined the work and did not take the bytes, which
                    // leaves them to be read below exactly as they were before there was a worker.
                    if (parsed !== null) {

                        binaryCollection = parsed.collection;
                        binaryBuffer = parsed.buffer ?? null;
                    }
                }

                // Otherwise it is read below, which leaves the bytes where they are.
                if (binaryCollection === null) binaryBuffer = buffer;
            }
            else {

                if (canUseWorker && await Ren.DataSourceParseWorker.isAvailable()) {

                    const parsed = await Ren.DataSourceParseWorker.parse(buffer);

                    if (parsed === null) {

                        // The worker declined the work and did not take the bytes, so decode them
                        // here.
                        response = Ren.Perf.time("main.decodeBody", () =>
                            new TextDecoder("utf-8").decode(new Uint8Array(buffer)));
                    }
                    else if (parsed.lost === true) {

                        // The bytes were transferred to a worker that then died, so this response
                        // is gone, and it is reported as an incomplete one is.
                        reportUnparseableDataSourceJson(dataSourceUri, null, null);
                        return;
                    }
                    else {

                        response = parsed.text;
                        workerCollection = parsed.collection ?? null;
                    }
                }
                else {

                    response = Ren.Perf.time("main.decodeBody", () =>
                        new TextDecoder("utf-8").decode(new Uint8Array(buffer)));
                }

                if (response === null) return; // 404: do nothing

                // Where the data source's uploaded files are missing, the uploaded files module
                // prompts the user for them.  Clear the pending marker so that a later upload
                // re-requests it, and stop short of a render that would fail.
                if (Ren.UploadedFilesModuleUpdater?.tryHandleMissingUploadedFilesResponse(
                    dataSourceUri,
                    response
                )) {

                    delete dataSources[dataSourceUri];
                    return;
                }

                // An empty body means no data source came back at all, so deal with it here, where
                // a retry is still possible, rather than put an empty script element on the page.
                if (Ren.TextUtils.isNullOrWhitespace(response)) {

                    handleEmptyDataSourceResponse(dataSourceUri, reportName, requestGuid);
                    return;
                }
            }

            delete emptyResponseCounts[dataSourceUri];

            // The format the response is read as: the binary one it turned out to be, else the one
            // the visualisation asked for, else the one the response itself shows.  A worker only
            // ever reads a tabular data set collection.
            const format = binaryFormat ?? (workerCollection !== null
                ? Ren.DataSourceFormats.getByName(Ren.DataSourceFormats.DEFAULT_FORMAT_NAME)
                : Ren.DataSourceFormats.resolve(
                    declaredFormatName,
                    r.headers.get("Content-Type"),
                    response
                ));

            if (format === null) {
                throw getUnrecognisedResponseErrorDetails(r.headers.get("Content-Type"), response);
            }

            // A format that puts its own data source in place - a response that is already a script
            // element - leaves nothing more to do here: the scan it asks for picks it up.
            if (format.handleResponse) {

                format.handleResponse(response, dataSourceUri);
            }
            else {

                // The response is parsed here rather than read back out of the script element it is
                // put on the page in, unless a worker has already parsed it, in which case only its
                // packed rows need rebuilding.
                let adapted = null;

                if (binaryCollection !== null) {

                    // A worker read the binary response, so all that is left is rebuilding the
                    // dictionary and rows it packed for the journey.
                    Ren.DataSourceParseWorker.unpackCollection(binaryCollection);

                    adapted = { tabularDataSetCollection: binaryCollection, json: null };
                }
                else if (workerCollection !== null) {

                    Ren.DataSourceParseWorker.unpackCollection(workerCollection);

                    adapted = { tabularDataSetCollection: workerCollection, json: response };
                }
                else {

                    try {

                        adapted = Ren.Perf.time("main.parseAndAdapt", () =>
                            format.isBinary === true
                                ? format.parseBuffer(buffer, dataSourceUri)
                                : format.parse(response, dataSourceUri));
                    }
                    catch (error) {

                        // Anything but unparseable JSON is a complete response that isn't as its
                        // format says, such as a row short of a value, and the error says so.
                        if (!(error instanceof SyntaxError) && error && error.message) {
                            throw getResponseErrorDetails(error.message, response);
                        }

                        reportUnparseableDataSourceJson(dataSourceUri, null, response);
                        return;
                    }
                }

                addFetchedDataSource(
                    dataSourceUri,
                    format,
                    adapted,
                    workerCollection !== null,
                    binaryBuffer
                );
            }

            const data = {
                duration: new Date() - requestTime
            };

            const contentLengthHeader = r.headers.get("Content-Length");

            if (contentLengthHeader) {

                const contentLength = Ren.TextUtils.parseInt(contentLengthHeader);

                if (contentLength) data.contentLength = contentLength;
            }

            Ren.Log.info(
                "DataSourceResponse",
                reportName,
                Ren.NamedDataSources.removeBaseUri(dataSourceUri),
                requestGuid,
                data
            );
        }
        catch (error) {

            // Only show error if it's not a swallowed 404.

            if (error !== null) {

                const errorDetails = Ren.DataSourceErrorPopup.getErrorDetails(error);

                const errorMessage =
                    `An error occurred requesting data source:` +
                    `\n\nURL: ${dataSourceUri}` +
                    `\n\n${errorDetails.error}` +
                    (errorDetails.details ? `\n\n${errorDetails.details}` : "") +
                    (errorDetails.sqlThatFailed ? `\n\nSQL:\n${errorDetails.sqlThatFailed}` : "");

                // Logged to the console only: the failure is shown to the user in the
                // popup below and recorded in RenLog, so its indicator would only repeat that.
                console.error(
                    `[DataSources] ${errorMessage}`
                );

                // A data source the page polls in the background is the page's business, not the
                // user's.
                if (!Ren.NamedDataSources.getOptions(dataSourceUri).quiet) {

                    Ren.DataSourceErrorPopup.showForRequest(dataSourceUri, errorDetails);
                }

                Ren.LoadingAnimations.removeLoadingAnimationsForDataSource(dataSourceUri);

                // The SQL and stack trace are left out of the log entry: the server logs both
                // already, and they would swamp the log.
                const data = {
                    duration: new Date() - requestTime,
                    errorMessage: errorDetails.error
                };

                Ren.Log.error(
                    "DataSourceError",
                    reportName,
                    Ren.NamedDataSources.removeBaseUri(dataSourceUri),
                    requestGuid,
                    data
                );
            }
        }
    };

    /**
     * Returns a value indicating whether the data source with the specified URI is loaded.
     */
    const isDataSourceLoaded = (dataSourceUri) => {

        if (!dataSourceUri) {

            return false;
        }

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        return dataSources[dataSourceUri] !== undefined &&
            dataSources[dataSourceUri] !== "PENDING";
    };

    /**
     * Checks if there are any data sources that are still pending loading.
     */
    const anyPendingDataSources = () => {

        for (const dataSourceUri in dataSources) {
            if (dataSources[dataSourceUri] === "PENDING") return true;
        }

        return false;
    };

    /**
     * Sets the name of a data source.
     */
    const setDataSourceName = (dataSourceUri, name) => { dataSourceNames[name] = dataSourceUri; };

    /**
     * Gets the data source that has the specified name.
     */
    const getDataSourceByName = (name) => getDataSource(dataSourceNames[name]);

    /**
     * Returns a value indicating whether the data source with the specified name is loaded.
     */
    const isNamedDataSourceLoaded = (dataSourceName) => {

        return isDataSourceLoaded(dataSourceNames[dataSourceName]);
    };

    /**
     * Gets the tabular data corresponding to the specified tabularDataGuid.
     */
    const getTabularDataByTabularDataGuid = (tabularDataGuid) => {

        for (const dataSourceUri in dataSources) {

            const tabularDataSet = dataSources[dataSourceUri].tabularDataSet;

            if (tabularDataSet) {

                const tabularData = tabularDataSet.TabularDatas
                    .find(td => td.tabularDataGuid === tabularDataGuid);

                if (tabularData) return tabularData;
            }
        }

        return null;
    };

    // Handle user requests to add a data source.
    Ren.Messages.Requests.addDataSource.handle((sqlFilename) => {

        requestDataSource(Ren.NamedDataSources.getUri(sqlFilename));
    });

    /**
     * Adds the passed data source to the page and then loads the data source.  The data source is
     * either the script element itself or its HTML, which is parsed into one (a copy of what can be
     * a large amount of data).
     */
    const initialiseNewDataSource = (tabularDataSetScript) => {

        const scriptElement = typeof tabularDataSetScript === "string"
            ? Ren.HtmlUtils.create(tabularDataSetScript)
            : tabularDataSetScript;

        Ren.HtmlUtils.getBody().appendChild(scriptElement);

        Ren.Messages.Requests.scanPageForDataSources.notify(null);
    };

    /**
     * Removes the data source with the specified URI from the collection.  If a script element
     * exists for the data source, removes it from the DOM.
     */
    const removeDataSource = (dataSourceUri) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        const dataSource = dataSources[dataSourceUri];

        if (dataSource === undefined || dataSource === "PENDING") return;

        const tabularDataSets = dataSource.tabularDataSetCollection.TabularDataSets;

        tabularDataSets.forEach((tabularDataSet) => {

            tabularDataSet.isDestroyed = true;

            tabularDataSet.TabularDatas.forEach((tabularData) => {

                tabularData.isDestroyed = true;
            });
        });

        dataSource.isDestroyed = true;

        delete dataSources[dataSourceUri];
        delete dataSourceNames[dataSourceUri];

        Ren.DataSourcesScriptElements.removeDataSourceScriptElement(dataSourceUri);
        Ren.DataSourceBinaryResponses.forget(dataSourceUri);

        Ren.Messages.Events.dataSourceRemoved.notify(dataSourceUri);
        Ren.Messages.Events.dataSourcesChanged.notify();
    };

    return {
        addDataSource,
        anyPendingDataSources,
        cloneTabularDataAndApplyTransformationsForVisualisation,
        cloneTabularDataAndApplyTransformations,
        dataSourceNames,
        getDataSource,
        getDataSourceByName,
        getDataSourceEntries,
        getDataSourceFormatName,
        getDataSources,
        getTabularData,
        getTabularDataByTabularDataGuid,
        getTabularDataForVisualisation,
        getTabularDataSet,
        initialiseNewDataSource,
        isDataSourceLoaded,
        isNamedDataSourceLoaded,
        isServerSideDataSource,
        registerFetchableDataSource,
        removeDataSource,
        requestDataSource,
        setDataSourceName,
        setDataSourceUriToJumpQueue,
        upsertDataSource
    };
})();
