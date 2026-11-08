/**
 * Creates visualisations on the page dynamically.
 */
Ren.VisualisationCreator = (() => {

    const createVisualisation = (options) => {

        Ren.VisualisationCreator_RequiredOptions.validateOptions(options);

        const dataSourceUri = options.dataSourceUri;
        const sqlFilename = options.sqlFilename;
        const tabularDataTransformers = options.tabularDataTransformers ?? [];

        const visualisationGuid = options.visualisationGuid ?? Ren.RandomUtils.generateRandomClassName("ren-visualisation");
        const visualisationContainer = Ren.HtmlUtils.create("div")
            ._addClass(
                visualisationGuid,
                "ren-visualisation",
                "ren-visualisation--" + Ren.TextUtils.convertToKebabCase(options.visualisationTypeName),
                "qa-ren-visualisation--" + Ren.TextUtils.convertToKebabCase(options.visualisationTypeName)
            );

        const visualisationType = Ren.VisualisationTypes.getByTypeName(options.visualisationTypeName);

        Ren.ObjectUtils.applyDefaultOptions(options, visualisationType.defaultOptions);

        const visualisation = {
            dataSourceUri,
            sqlFilename,
            tabularDataTransformers,
            visualisationGuid,
            element: visualisationContainer
        };

        Object.assign(visualisation, options);

        // Set clientSide to true if not explicitly set.  This allows:
        // - Actuizer to set it to false for visualisations from serialized settings
        // - User-created visualisations to default to true (should be saved)
        // - Child visualisations to inherit appropriate value from parent
        if (visualisation.clientSide === undefined) {
            visualisation.clientSide = true;
        }

        if (!visualisation.tabbedModuleTabId && visualisation.sourceVisualisation) {

            visualisation.tabbedModuleTabId = visualisation.sourceVisualisation.tabbedModuleTabId;
        }

        if (!visualisation.reportContext && !visualisation.isIndependentOfReportContext) {

            const container = Ren.VisualisationContainers.getContainer(visualisation);

            if (visualisation.sourceVisualisation?.reportContext) {
                visualisation.reportContext = visualisation.sourceVisualisation.reportContext;
            }
            else if (container?.reportContext) {

                visualisation.reportContext = container.reportContext;
            }
            else {

                const reportContextElement = document.querySelector(".js-ren-report-context");

                if (reportContextElement) {

                    visualisation.reportContext =
                        Ren.ReportContextCreator.createReportContext(reportContextElement);
                }
            }
        }

        visualisation.showRowAndColumnHeadings = visualisation.showRowAndColumnHeadings ?? true;
        visualisation.showTabTitles = visualisation.showTabTitles ?? true;

        if (visualisation.isChildVisualisation) {
            visualisation.isAlreadyCreated = true;
        }

        Ren.VisualisationCollection.addVisualisation(visualisation);

        if (visualisation.isPopup) {

            if (!visualisation.fillAvailableSpace) {

                if (visualisation.popupWidth) {

                    visualisationContainer.style.width =
                        Ren.StylesUtils.toCssDimension(visualisation.popupWidth);
                }

                if (visualisation.popupHeight) {

                    visualisationContainer.style.height =
                        Ren.StylesUtils.toCssDimension(visualisation.popupHeight);
                }
            }

            visualisationContainer.classList.add("ren-report-popup-window__content");

            visualisation.popupTitle = visualisation.popupTitle ?? visualisation.title;

            // Popup containing just a single visualisation (as opposed to a popup report).
            const popupWindow = Ren.ShowPopupVisualisation(visualisation, visualisationContainer);

            visualisation.isInsidePopup = true;

            // The saved position is relative to wherever the window is put, so it is restored after
            // popping in, which may move the window into its popup report.  Moving stores the
            // position it moved to, so the saved one is read first.
            const savedLeft = visualisation.popupLeft;
            const savedTop = visualisation.popupTop;
            const savedRight = visualisation.popupRight;

            if (visualisation.popupIsPoppedIn) popupWindow.popIn();

            // Set popup window size from saved settings.  Pass true to skip the resize callback,
            // since we're restoring saved dimensions and don't want to recalculate/modify them.  A
            // reused popup window keeps the size it has, until it is fitted to its new content.
            if (!popupWindow.isReused) {

                if (visualisation.popupWidth) popupWindow.setWidth(visualisation.popupWidth, true);

                if (visualisation.popupHeight) {
                    popupWindow.setHeight(visualisation.popupHeight, true);
                }
            }

            // A withOffset popup has already placed itself at popupLeft / popupTop, shifted clear
            // of any popup already open there (see Ren.PopupPositioning), so putting the saved
            // position back here would undo that shift and stack the popups on top of each other.
            if (!visualisation.withOffset) {

                if (Ren.StylesUtils.isDimensionSet(savedLeft)) popupWindow.setLeftPos(savedLeft);
                if (Ren.StylesUtils.isDimensionSet(savedTop)) popupWindow.setTopPos(savedTop);
            }

            if (Ren.StylesUtils.isDimensionSet(savedRight)) popupWindow.setRightPos(savedRight);
            if (visualisation.popupZoom) popupWindow.setZoom(visualisation.popupZoom);

            popupWindow.horizontalScrollbar = visualisation.horizontalScrollbar ?? false;
            popupWindow.verticalScrollbar = visualisation.verticalScrollbar ?? false;

            if (!visualisationType.isVirtual) {

                visualisationContainer.append(
                    Ren.LoadingAnimations.createVisualisationLoadingAnimation(visualisation)
                );

                if (visualisation.tabbedModuleTabId) {

                    // RODO: More structured way of setting the class on the popup.
                    const popup = popupWindow.contentContainer.closest(".ren-report-popup-window");

                    const existingTabbedModuleClass =
                        Ren.HtmlUtils.getClassName(popup, "ren-tabbed-module-tab-id-");

                    if (existingTabbedModuleClass) {
                        popup.classList.remove(existingTabbedModuleClass);
                    }

                    popup.classList.add(
                        "ren-tabbed-module-tab-id-" + visualisation.tabbedModuleTabId
                    );
                }
            }

            if (visualisation.visualisationTypeName === "EmbeddedReport") {

                const getPopupReportRequestUrl = () => {

                    if (!visualisation.element) return "";

                    const reportContext = visualisation.element.querySelector(".js-ren-report-context");

                    if (!reportContext) return "";

                    let url = reportContext.getAttribute("data-request-url");

                    // The server strips settingsName and isPreset from data-request-url (they are
                    // "system" params, not data params).  Restore them from the original popup URL
                    // so the popped-out tab opens with the same settings preset.
                    const settingsName = Ren.UrlUtils.getParameterValue(visualisation.reportUrl, "settingsName");

                    if (settingsName) {
                        url = Ren.UrlUtils.upsertQueryParameter(url, "settingsName", settingsName);
                    }

                    const isPreset = Ren.UrlUtils.getParameterValue(visualisation.reportUrl, "isPreset");

                    if (isPreset != null) {
                        url = Ren.UrlUtils.upsertQueryParameter(url, "isPreset", isPreset);
                    }

                    return url;
                };

                Ren.SetupPopOutButton(visualisation.popup, getPopupReportRequestUrl);
            }
        }
        else if (visualisation.targetElement) {

            visualisation.targetElement.appendChild(visualisationContainer);
        }
        else if (visualisation.containerVisualisationId) {

            // Held out of the page until its container has rendered, if it hasn't.
            Ren.VisualisationContainers.placeChild(visualisation);
        }
        else {

            const targetSelector = visualisation.targetSelector || ".ren-web-report-page";
            const target = document.querySelector(targetSelector);
            target.appendChild(visualisationContainer);
        }

        Ren.VisualisationCollection.setupFocus(visualisation);

        // Trigger scanify for visualisations created by user interaction or programmatically (like
        // popup reports), but NOT for visualisations created from serialized settings by the
        // actuizer.  This prevents infinite loops where:
        // 1.  Scanify processes nested elements and creates settings scripts
        // 2.  Actuizer creates visualisations from those settings
        // 3.  Those visualisations trigger scanify again
        // 4.  Scanify finds the same elements again (infinite loop)
        //
        // The actuizer marks visualisations it creates with createdByActuizer: true, so we can
        // safely skip triggering scanify for those.
        if (!visualisation.createdByActuizer) {
            Ren.Messages.Events.reportAddedToDom.notify();
        }

        return visualisation;
    };

    return {
        createVisualisation
    };
})();
