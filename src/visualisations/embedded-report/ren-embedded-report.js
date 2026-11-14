Ren.CreateEmbeddedReport = (_tabularData, visualisation) => {

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-embedded-report");

    const loadingAnimation = Ren.LoadingAnimations.createVisualisationLoadingAnimation(
        visualisation
    );

    element._append(loadingAnimation);

    // Add a query parameter to the URL to indicate that the report is embedded.
    let url = Ren.UrlUtils.upsertQueryParameter(visualisation.reportUrl, "isEmbeddedReport", "true");

    if (!url.startsWith("http")) url = Ren.UrlUtils.ensureLeadingSlash(url);

    const containingReportUrl = visualisation.containingReportUrl;

    if (containingReportUrl) {

        // Add the query parameters from containingReportUrl to the URL.

        const containingReportQueryParams = Ren.UrlUtils.getAllQueryParameters(containingReportUrl);

        url = Ren.UrlUtils.addAllQueryParametersWhichAreNotInUrl(url, containingReportQueryParams);
    }

    const withResponse = (response) => {

        if (visualisation.isPopup) {

            // Wrap response in a div so that we can fix a height issue that arises when the
            // embedded report is loaded in a popup.
            response = `<div class="ren-embedded-report__response-wrapper">${response}</div>`;
        }

        Ren.HtmlUtils.setHTML(element, response);

        Ren.Messages.Events.reportAddedToDom.notify();

        visualisation.onReportLoaded?.(element);
    };

    const buildErrorDetailsHtml = (error) => {

        const escHtml = (s) => String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const withBreaks = (s) => escHtml(s).replace(/\r\n|\r|\n/g, "<br>");

        if (!error || !error.status) return escHtml(String(error));

        const parts = [`<strong>HTTP ${error.status}</strong>`];

        try {

            const parsed = JSON.parse(error.errorText || "null");

            if (Ren.ObjectUtils.isObject(parsed)) {

                if (parsed.Error) parts.push(`<strong>Error:</strong> ${withBreaks(parsed.Error)}`);
                if (parsed.Details) parts.push(`<strong>Details:</strong><br>${withBreaks(parsed.Details.substring(0, 2000))}`);

                for (const key of Object.keys(parsed)) {

                    if (key !== "Error" && key !== "Details") {
                        parts.push(`<strong>${escHtml(key)}:</strong> ${withBreaks(String(parsed[key]))}`);
                    }
                }
            }
            else {

                parts.push(withBreaks((error.errorText || "").substring(0, 2000)));
            }
        }
        catch {

            parts.push(withBreaks((error.errorText || "(no response body)").substring(0, 2000)));
        }

        return parts.join("<br><br>");
    };

    const getEmbeddedReportResponse = () => {

        const inPageResponse = Ren.EmbeddedReportResponses.getResponse(url);

        if (inPageResponse) {

            // Not until the element is returned and put in the document, as a fetched response
            // is, so that the report's scripts can find their elements by ID.
            queueMicrotask(() => withResponse(inPageResponse));
        }
        else {

            // If this URL was invalidated after a settings save, bypass the browser HTTP cache so
            // the corrected JSON is fetched from the server rather than a stale cached response.
            const forceReload = Ren.EmbeddedReportResponses.needsForceReload(url);
            const fetchOptions = forceReload ? { cache: "reload" } : undefined;

            if (forceReload) Ren.EmbeddedReportResponses.clearForceReload(url);

            Ren.FetchUtils.fetch(url, fetchOptions)
                .then(r => {

                    if (r.ok) return r.text();

                    return r.text().then(errorText => Promise.reject({
                        status: r.status,
                        errorText
                    }));
                })
                .then(response => {

                    Ren.EmbeddedReportResponses.addResponse(url, response);
                    withResponse(response);
                })
                .catch(error => {

                    const reportName = url.split("?")[0].split("/").pop();
                    const is404 = error && error.status === 404;

                    let templateName, templateParams;

                    if (is404) {

                        Ren.GlobalErrorHandler.logError(
                            `[EmbeddedReport] Report not found (404): ${reportName}`
                        );

                        templateName = "EmbeddedReportNotFound";
                        templateParams = { reportName };
                    }
                    else {

                        Ren.GlobalErrorHandler.logError(
                            `[EmbeddedReport] Error fetching report: ${reportName}`,
                            error
                        );

                        templateName = "EmbeddedReportFetchError";
                        templateParams = { reportName };
                    }

                    const templateElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
                        templateName,
                        templateParams
                    );

                    withResponse(templateElement.outerHTML);

                    Ren.FnUtils.defer(() => {

                        const closeButton = element.querySelector(".js-ren-close-popup");

                        if (closeButton && visualisation.popup) {

                            closeButton.onclick = () => {

                                visualisation.popup.closeWindow();
                            };
                        }

                        if (!is404) {

                            const detailsLink = element.querySelector(".js-ren-error-details-link");

                            if (detailsLink) {

                                const popup = document.createElement("div");
                                popup.className = "ren-embedded-report__error-details-popup";
                                popup.innerHTML = buildErrorDetailsHtml(error);
                                detailsLink.insertAdjacentElement("afterend", popup);

                                const errorPanel = detailsLink.closest(".ren-embedded-report__error-panel");

                                detailsLink.addEventListener("click", e => {

                                    e.preventDefault();
                                    popup.classList.toggle("ren-embedded-report__error-details-popup--visible");
                                    errorPanel?.classList.toggle("ren-embedded-report__error-panel--details-open");
                                });
                            }
                        }
                    }, 0);
                });
        }
    };

    getEmbeddedReportResponse();

    const getReportContextGuid = () => {

        if (!visualisation.element) return null;

        const reportContextElement = visualisation.element.querySelector(".js-ren-report-context");

        if (!reportContextElement) return null;

        const reportContextGuid = Ren.HtmlUtils.getClassName(reportContextElement, "report-context-");

        return reportContextGuid;
    };

    Ren.Messages.Events.reportUrlChanged.handle((reportContextGuid, newUrl) => {

        if (getReportContextGuid() !== reportContextGuid) return;

        // updateReportUrl reloads the page's settings once the new report is in the DOM.
        visualisation.reportUrl = newUrl;
    });

    return {
        element
    };
};
