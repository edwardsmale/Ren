/**
 * Shows the popups displayed when a data source request fails.
 *
 * End users get a short, plain message naming the visualisation whose data couldn't be fetched -
 * or, where the server could say what was wrong in terms they can act on, that message instead.
 * A "Technical details" link closes that popup and opens a second one carrying the request URL,
 * the error message and stack trace from the server, and - where the failure was a SQL one - the
 * SQL that failed.
 *
 * Failed data source requests share one popup, which requests failing while it is open are added
 * to.  It lists each distinct error message once; the technical details follow each with the
 * data sources it came back for.
 *
 * Other failed requests (saving the report settings, say) can show the same popups with a message
 * of their own in place of the apology.
 */
Ren.DataSourceErrorPopup = (() => {

    // The failed data source requests on show in an open popup, which further failures are added
    // to rather than each opening a popup of its own.  Null while no such popup is open.
    let openRequestFailures = null;

    // The technical details popup's width, which it is widened from where its content is wider.
    const technicalDetailsMinimumWidth = 800;

    /**
     * Adds a failed request to the failures, which hold one entry per error message along with
     * every data source that message came back for.
     */
    const addFailure = (failures, dataSourceUri, errorDetails) => {

        for (let index = 0; index < failures.length; index++) {

            const failure = failures[index];

            if (failure.errorDetails.error !== errorDetails.error) continue;

            if (failure.dataSourceUris.indexOf(dataSourceUri) === -1) {

                failure.dataSourceUris.push(dataSourceUri);
            }

            return;
        }

        failures.push({ errorDetails, dataSourceUris: [dataSourceUri] });
    };

    /**
     * Gets a value indicating whether the failure's message was written for whoever ran the
     * report.
     */
    const isUserFacing = (failure) => {

        const errorDetails = failure.errorDetails;

        return !!(errorDetails && errorDetails.isUserFacing && errorDetails.error);
    };

    /**
     * Gets the data source URIs of the failures, optionally leaving out those whose message was
     * written for whoever ran the report.
     */
    const getDataSourceUris = (failures, excludeUserFacing) => {

        const dataSourceUris = [];

        for (let index = 0; index < failures.length; index++) {

            if (excludeUserFacing && isUserFacing(failures[index])) continue;

            const failureUris = failures[index].dataSourceUris;

            for (let uriIndex = 0; uriIndex < failureUris.length; uriIndex++) {

                dataSourceUris.push(failureUris[uriIndex]);
            }
        }

        return dataSourceUris;
    };

    /**
     * Refits an open popup to content that has grown, keeping it centred on where it was.
     */
    const refitPopupToContent = (contentContainer, popup) => {

        const _window = contentContainer.parentElement;

        const oldRect = _window.getBoundingClientRect();

        _window.style.width = "auto";
        _window.style.height = "auto";

        const newRect = _window.getBoundingClientRect();

        popup.setHeight(newRect.height);

        const left = parseFloat(_window.style.left);
        const top = parseFloat(_window.style.top);

        if (isNaN(left) || isNaN(top)) return;

        const scrollOffsets = Ren.PopupPositioning.getScrollOffsets();

        popup.setLeftPos(Math.max(left - (newRect.width - oldRect.width) / 2, scrollOffsets.left));
        popup.setTopPos(Math.max(top - (newRect.height - oldRect.height) / 2, scrollOffsets.top));
    };

    /**
     * Decodes the character references in text, such as the &#39; ASP.NET writes for an
     * apostrophe.  A textarea's content is never parsed as markup, so the angle brackets in a
     * stack trace's compiler-generated names (<>c, say) are left alone.
     */
    const decodeHtmlEntities = (text) => {

        const textarea = document.createElement("textarea");

        textarea.innerHTML = text;

        return textarea.value;
    };

    /**
     * Gets the text following a bold label in an ASP.NET error page ("Description:", say), up to
     * the line break that ends it.  Returns null if the page has no such label.
     */
    const getLabelledText = (page, label) => {

        const labels = page.querySelectorAll("b");

        for (let index = 0; index < labels.length; index++) {

            if (labels[index].textContent.trim() !== label) continue;

            let text = "";
            let node = labels[index].nextSibling;

            while (node && node.nodeName !== "BR" && node.nodeName !== "B") {

                text += node.textContent;
                node = node.nextSibling;
            }

            return text.replace(/\s+/g, " ").trim() || null;
        }

        return null;
    };

    /**
     * Picks the error out of an ASP.NET "yellow screen of death" error page, which is what comes
     * back for a request that fails before reaching the global exception filter (one for an
     * action that doesn't exist, say).  Returns null if the body isn't one.
     */
    const readYellowScreenOfDeath = (body) => {

        if (body.indexOf("Server Error in '") === -1) return null;

        const page = new DOMParser().parseFromString(body, "text/html");

        const heading = page.querySelector("h2");
        const headingText = heading ? heading.textContent.replace(/\s+/g, " ").trim() : null;
        const description = getLabelledText(page, "Description:");
        const requestedUrl = getLabelledText(page, "Requested URL:");

        // The exception and its stack trace are written, HTML-encoded, into a comment at the end
        // of the page.
        const commentMatch = /<!--\s*(\[[^\]]+\]:[\s\S]*?)\s*-->/.exec(body);
        const exception = commentMatch ? decodeHtmlEntities(commentMatch[1]) : null;
        const exceptionMessageMatch = exception ? /^\[[^\]]+\]:\s*(.*)/.exec(exception) : null;

        const detailLines = [];

        if (headingText) detailLines.push(headingText);
        if (description) detailLines.push("Description: " + description);
        if (requestedUrl) detailLines.push("Requested URL: " + requestedUrl);

        if (exception) {

            if (detailLines.length > 0) detailLines.push("");

            detailLines.push(exception);
        }

        return {
            error: (exceptionMessageMatch && exceptionMessageMatch[1].trim()) ||
                description ||
                headingText,
            details: detailLines.length > 0 ? detailLines.join("\n") : null
        };
    };

    /**
     * Reads a failed data source response, returning its error details.  The server's global
     * exception filter sends these back as JSON, since the data source request asks for JSON.  An
     * ASP.NET error page has its error picked out of it, and anything else (an IIS error page,
     * say) is kept as raw text so it can still be shown.
     */
    const readErrorResponse = async (response) => {

        const errorDetails = {
            error: null,
            details: null,
            sqlThatFailed: null,
            isUserFacing: false
        };

        let body = null;

        try {

            body = await response.text();
        }
        catch (error) {

            // The body couldn't be read.  The status code below is still worth reporting.
        }

        if (body) {

            let parsed = null;

            try {

                parsed = JSON.parse(body);
            }
            catch (error) {

                // Not JSON, so it may be an error page, which is dealt with below.
            }

            // Only a Ren endpoint's error JSON has an Error.  Any other body is shown as it is.
            if (parsed && parsed.Error) {

                errorDetails.error = parsed.Error;
                errorDetails.details = parsed.Details;
                errorDetails.sqlThatFailed = parsed.SqlThatFailed;

                // Set by the server for a message written for whoever ran the report - an
                // uploaded file whose columns don't match what the report's SQL asks for, say -
                // which is shown in place of the apology below.
                errorDetails.isUserFacing = parsed.IsUserFacing === true;
            }
            else {

                const yellowScreen = readYellowScreenOfDeath(body);

                if (yellowScreen) {

                    errorDetails.error = yellowScreen.error;
                    errorDetails.details = yellowScreen.details;
                }
                else {

                    errorDetails.details = body;
                }
            }
        }

        if (!errorDetails.error) {

            errorDetails.error =
                `The server responded with ${response.status} ${response.statusText}`.trim() + ".";
        }

        return errorDetails;
    };

    /**
     * Normalises whatever was thrown while requesting a data source into the error details shape
     * returned by readErrorResponse.
     */
    const getErrorDetails = (error) => {

        if (Ren.ObjectUtils.isObject(error) && "sqlThatFailed" in error) return error;

        if (error instanceof Error) {

            return {
                error: error.message,
                details: error.stack ?? null,
                sqlThatFailed: null,
                isUserFacing: false
            };
        }

        return {
            error: error ? error.toString() : "Sorry, there was an error.",
            details: null,
            sqlThatFailed: null,
            isUserFacing: false
        };
    };

    /**
     * Gets a friendly name for the visualisations waiting on the specified data sources, for
     * example "Data Grid" or "Data Grid and Pie Chart".  Returns null if none can be identified.
     */
    const getVisualisationName = (dataSourceUris) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        const names = [];

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (dataSourceUris.indexOf(visualisation.dataSourceUri) === -1) continue;
            if (!visualisation.visualisationTypeName) continue;

            // A gridset is presented as just a "Grid", as it is in popup window title bars.
            const name = Ren.TextUtils.addSpacesBeforeCapitals(
                visualisation.visualisationTypeName.replace("GridSet", "Grid")
            );

            if (names.indexOf(name) === -1) names.push(name);
        }

        if (names.length === 0) return null;
        if (names.length === 1) return names[0];

        return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    };

    /**
     * Gets a description of what couldn't be fetched, for example "the data for the Data Grid".
     */
    const getDataDescription = (visualisationName) => {

        return visualisationName ?
            `the data for the ${visualisationName}` :
            "the data for part of this report";
    };

    /**
     * Gets the message shown to end users, which apologises.
     */
    const getApologeticMessage = (visualisationName) => {

        return `Sorry, an error occurred retrieving ${getDataDescription(visualisationName)}.`;
    };

    /**
     * Gets the message summarising the failure at the top of the technical details popup, which
     * doesn't apologise.
     */
    const getFriendlyMessage = (visualisationName) => {

        return `An error occurred retrieving ${getDataDescription(visualisationName)}.`;
    };

    /**
     * Creates the OK button row, using the classes the popup window wires up to close itself.
     */
    const createOkButtons = () => {

        const buttons = Ren.HtmlUtils.create("div")
            ._addClass("ren-popup-message__buttons");

        buttons._append(
            Ren.HtmlUtils.create("button")
                ._addClass("ren-popup-message__button", "js-ren-popup-message-ok-button")
                ._text("OK")
        );

        return buttons;
    };

    /**
     * Creates a heading for a block in the technical details popup.
     */
    const createSectionHeading = (heading) => {

        return Ren.HtmlUtils.create("h4")
            ._addClass("ren-data-source-error__section-heading")
            ._text(heading);
    };

    /**
     * Creates a headed block of preformatted text for the technical details popup.
     */
    const createSection = (heading, text) => {

        const section = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-source-error__section");

        section._append(createSectionHeading(heading));

        section._append(
            Ren.HtmlUtils.create("pre")
                ._addClass("ren-data-source-error__section-content")
                ._textContent(text)
        );

        return section;
    };

    /**
     * Creates the SQL block, syntax highlighted with Ren's own Prism (see
     * ren-function-editor-highlighting.js), or shown as plain text should it lack the SQL grammar.
     */
    const createSqlSection = (sqlThatFailed) => {

        const prism = Prism;

        if (!prism.languages || !prism.languages.sql) {

            return createSection("SQL that failed", sqlThatFailed);
        }

        const section = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-source-error__section");

        section._append(createSectionHeading("SQL that failed"));

        section._append(
            Ren.HtmlUtils.create("pre")
                ._addClass("ren-data-source-error__section-content", "ren-data-source-error__sql")
                ._html(prism.highlight(sqlThatFailed, prism.languages.sql, "sql"))
        );

        return section;
    };

    /**
     * Creates the block holding the stack trace, collapsed behind a link.  SQL Server errors
     * repeat their message in the trace, and the frames below it are rarely what's wanted, so
     * they stay out of the way until asked for.
     */
    const createDetailsSection = (details) => {

        const section = Ren.HtmlUtils.create("details")
            ._addClass("ren-data-source-error__collapsible", "qa-ren-data-source-error-details");

        // The details are usually a .NET exception, but can be whatever a non-JSON response held,
        // so the link only promises a stack trace when there is one.
        const summaryText = /\n\s+at\s/.test(details) ? "Stack trace" : "Details";

        section._append(
            Ren.HtmlUtils.create("summary")
                ._addClass("ren-data-source-error__collapsible-summary")
                ._text(summaryText)
        );

        section._append(
            Ren.HtmlUtils.create("pre")
                ._addClass("ren-data-source-error__section-content")
                ._textContent(details)
        );

        return section;
    };

    /**
     * Removes lines repeated within an error message.  SQL Server reports the same problem once
     * per statement it appears in, so a mistyped column name comes back three or four times over.
     */
    const removeRepeatedLines = (text) => {

        if (!text) return text;

        const lines = text.split("\n");
        const keptLines = [];

        for (let i = 0; i < lines.length; i++) {

            if (keptLines.indexOf(lines[i]) === -1 || lines[i].trim() === "") {

                keptLines.push(lines[i]);
            }
        }

        return keptLines.join("\n");
    };

    /**
     * Makes a data source URI absolute where the page declares report URLs (it doesn't in a
     * downloaded report, say).
     */
    const makeUrlAbsolute = (dataSourceUri) => {

        try {

            return Ren.HostUrls.reportUrl(dataSourceUri);
        }
        catch (error) {

            return dataSourceUri;
        }
    };

    /**
     * Creates a URL, with a small Copy button inline at the end of the URL itself.
     */
    const createUrlElement = (dataSourceUri) => {

        const url = makeUrlAbsolute(dataSourceUri);

        const urlContainer = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-source-error__section-content");

        urlContainer._append(
            Ren.HtmlUtils.create("span")
                ._addClass("qa-ren-data-source-error-url")
                ._textContent(url)
        );

        const copyButton = Ren.HtmlUtils.create("button")
            ._addClass("ren-data-source-error__copy-button", "qa-ren-data-source-error-copy-button")
            ._attr("type", "button")
            ._attr("title", "Copy the URL to the clipboard")
            ._text("Copy");

        copyButton.addEventListener("click", () => {

            // The clipboard API is unavailable on insecure origins, and can be refused, so the
            // button reports what happened rather than failing silently.
            if (!navigator.clipboard) {

                copyButton._text("Can't copy");
                return;
            }

            navigator.clipboard.writeText(url).then(
                () => {

                    copyButton._text("Copied");

                    setTimeout(() => copyButton._text("Copy"), 1500);
                },
                () => {

                    copyButton._text("Can't copy");
                }
            );
        });

        urlContainer._append(copyButton);

        return urlContainer;
    };

    /**
     * Creates the URL block, listing every data source the error came back for.
     */
    const createUrlSection = (dataSourceUris) => {

        const section = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-source-error__section");

        section._append(createSectionHeading(dataSourceUris.length === 1 ? "URL" : "URLs"));

        for (let index = 0; index < dataSourceUris.length; index++) {

            section._append(createUrlElement(dataSourceUris[index]));
        }

        return section;
    };

    /**
     * Fills the body of the technical details popup, with a block per error message.
     */
    const renderTechnicalDetails = (body, failures) => {

        body.innerHTML = "";

        body._append(
            Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error__summary")
                ._text(
                    failures[0].message ||
                    getFriendlyMessage(getVisualisationName(getDataSourceUris(failures)))
                )
        );

        for (let index = 0; index < failures.length; index++) {

            const errorDetails = failures[index].errorDetails;

            const failureElement = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error__technical-failure");

            failureElement._append(
                createSection("Error", removeRepeatedLines(errorDetails.error))
            );

            failureElement._append(createUrlSection(failures[index].dataSourceUris));

            // The SQL comes before the stack trace: for a failed query it's what identifies the
            // problem, whereas the trace only says how the query came to be run.  Where several
            // data sources failed with the same message, both are the first one's.
            if (errorDetails.sqlThatFailed) {
                failureElement._append(createSqlSection(errorDetails.sqlThatFailed));
            }

            if (errorDetails.details) {
                failureElement._append(createDetailsSection(errorDetails.details));
            }

            body._append(failureElement);
        }
    };

    /**
     * Widens the technical details popup, as far as the viewport allows, so that its longest line
     * (a URL or a line of SQL, typically) needn't wrap.  It is never narrowed, and stays centred on
     * where it was.
     */
    const widenPopupToFitContent = (body, popup) => {

        const oldWidth = popup.getWidth();

        // The window's borders, along with the body's scroll bar if it has one.
        const widthAroundBody = oldWidth - body.clientWidth;

        body.style.width = "max-content";

        const unwrappedWidth = body.getBoundingClientRect().width;

        body.style.width = "";

        const maximumWidth = Math.max(window.innerWidth - 40, technicalDetailsMinimumWidth);

        const newWidth = Math.min(
            unwrappedWidth + widthAroundBody + Ren.DataGridConstants.scrollBarWidth + 2,
            maximumWidth
        );

        if (newWidth <= oldWidth) return;

        popup.setWidth(newWidth);

        const left = parseFloat(body.closest(".ren-report-popup-window").style.left);

        // A window only just opened has yet to be centred, which takes its new width into account.
        if (isNaN(left)) return;

        const scrollOffsets = Ren.PopupPositioning.getScrollOffsets();

        popup.setLeftPos(Math.max(left - (newWidth - oldWidth) / 2, scrollOffsets.left));
    };

    /**
     * Shows the technical details popup: everything a developer needs to diagnose the failures
     * without having to open the browser's network tab.  The details scroll within the popup,
     * leaving the OK button always visible in a bar along the bottom.
     */
    const showTechnicalDetails = (failures, isForRequests) => {

        const openFailures = { failures, refresh: null };

        let body = null;

        const renderContent = (contentContainer, popup) => {

            const content = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error", "qa-ren-data-source-error-technical-details");

            body = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error__body");

            renderTechnicalDetails(body, failures);

            // The window keeps its height and the body scrolls, so only the width is refitted.
            openFailures.refresh = () => {

                renderTechnicalDetails(body, failures);
                widenPopupToFitContent(body, popup);
            };

            const footer = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error__footer");

            footer._append(createOkButtons());

            content._append(body);
            content._append(footer);

            contentContainer.appendChild(content);
        };

        // Deliberately not a "ren-popup-message" window: that class centres and gaps its content,
        // which fights the scrolling body and fixed footer laid out below.
        const popup = Ren.PopupWindow(
            "ren-data-source-error-popup",
            renderContent,
            "Error details",
            {
                titleBarModifier: "Error",
                centred: true,
                width: technicalDetailsMinimumWidth,
                height: 500,
                // The body scrolls itself, so that the footer stays put; the popup's own scrollbar
                // would scroll the footer out of sight along with everything else.
                fillAvailableSpace: true,
                verticalScrollbar: false,
                horizontalScrollbar: false,
                isResizable: true,
                closeWhenFocusLost: false,
                onClose: () => {

                    if (openRequestFailures === openFailures) openRequestFailures = null;
                }
            }
        );

        // Done before the window is centred, which waits for the next frame.
        widenPopupToFitContent(body, popup);

        if (isForRequests) openRequestFailures = openFailures;

        return popup;
    };

    /**
     * Fills the end-user-facing popup's list of failed requests with each distinct error message.
     * The data sources each came back for are left to the technical details.
     */
    const renderRequestFailures = (list, failures) => {

        list.innerHTML = "";

        // Messages the server wrote for whoever ran the report stand on their own.  Any others
        // are technical, so an apology goes in ahead of them.
        const dataSourceUrisToApologiseFor = getDataSourceUris(failures, true);

        if (dataSourceUrisToApologiseFor.length > 0) {

            list._append(
                Ren.HtmlUtils.create("div")
                    ._addClass("qa-ren-data-source-error-apology")
                    ._text(getApologeticMessage(
                        getVisualisationName(dataSourceUrisToApologiseFor)
                    ))
            );
        }

        for (let index = 0; index < failures.length; index++) {

            list._append(
                Ren.HtmlUtils.create("div")
                    ._addClass("ren-data-source-error__user-message", "qa-ren-data-source-error-message")
                    ._textContent(removeRepeatedLines(failures[index].errorDetails.error))
            );
        }
    };

    /**
     * Fills the end-user-facing popup with the message for a single failure that didn't come
     * from a data source request.
     */
    const renderSingleFailure = (list, failure) => {

        // A message the server wrote for whoever ran the report says more than the apology
        // does, and says what to change, so it takes its place.  It can run to a few
        // paragraphs, which the user-message class keeps the line breaks of.
        const message = Ren.HtmlUtils.create("div")
            ._addClass("qa-ren-data-source-error-message");

        if (isUserFacing(failure)) {

            message._addClass("ren-data-source-error__user-message");
            message._textContent(failure.errorDetails.error);
        }
        else {

            message._text(
                failure.message ||
                getApologeticMessage(getVisualisationName(failure.dataSourceUris))
            );
        }

        list._append(message);
    };

    /**
     * Shows the end-user-facing popup for the failures, with a link through to the technical
     * details.
     */
    const showFailures = (failures, isForRequests) => {

        const openFailures = { failures, refresh: null };

        const renderContent = (contentContainer, popup) => {

            const content = Ren.HtmlUtils.create("div")
                ._addClass("ren-popup-message__content", "js-ren-popup-message-content",
                    "qa-ren-popup-message-content");

            const list = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-source-error__failures");

            if (isForRequests) {

                renderRequestFailures(list, failures);
            }
            else {

                renderSingleFailure(list, failures[0]);
            }

            openFailures.refresh = () => {

                renderRequestFailures(list, failures);
                refitPopupToContent(contentContainer, popup);
            };

            content._append(list);

            const detailsLink = Ren.HtmlUtils.create("a")
                ._addClass("ren-data-source-error__details-link", "qa-ren-data-source-error-details-link")
                ._attr("href", "#")
                ._text("Tech details");

            detailsLink.addEventListener("click", (event) => {

                event.preventDefault();

                popup.closeWindow(false);

                showTechnicalDetails(failures, isForRequests);
            });

            content._append(detailsLink);
            content._append(createOkButtons());

            contentContainer.appendChild(content);
        };

        const popup = Ren.PopupWindow(
            "ren-popup-message ren-popup-message--Error",
            renderContent,
            "Error",
            {
                titleBarModifier: "Error",
                centred: true,
                autoSized: true,
                verticalScrollbar: false,
                horizontalScrollbar: false,
                isResizable: false,
                closeWhenFocusLost: false,
                onClose: () => {

                    if (openRequestFailures === openFailures) openRequestFailures = null;
                }
            }
        );

        if (isForRequests) openRequestFailures = openFailures;

        return popup;
    };

    /**
     * Shows a popup of its own for a failure that didn't come from a data source request.  The
     * optional message is shown in place of the apology for failing to retrieve data.
     */
    const show = (dataSourceUri, errorDetails, message) => {

        return showFailures([{ errorDetails, dataSourceUris: [dataSourceUri], message }], false);
    };

    /**
     * Shows the popup for a failed data source request.  While a popup for an earlier failed
     * request is still open - whether the end-user-facing one or its technical details - the
     * failure is added to that popup instead, so that a run of failures doesn't open a popup each.
     */
    const showForRequest = (dataSourceUri, errorDetails) => {

        if (openRequestFailures) {

            addFailure(openRequestFailures.failures, dataSourceUri, errorDetails);
            openRequestFailures.refresh();

            return;
        }

        const failures = [];

        addFailure(failures, dataSourceUri, errorDetails);
        showFailures(failures, true);
    };

    return {
        getErrorDetails,
        readErrorResponse,
        show,
        showForRequest
    };
})();
