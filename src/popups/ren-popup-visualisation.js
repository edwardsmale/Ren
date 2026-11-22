/**
 * Displays a single visualisation in a popup window.
 */
Ren.ShowPopupVisualisation = (visualisation, container) => {

    const renderPopupContent = (contentContainer, popup) => {

        Ren.HtmlUtils.setHTML(contentContainer, container);

        const convertToPopupButton = Ren.SmallEditButton.create("Convert to a popup", "⮝");
        convertToPopupButton.classList.add("ren-visualisation__convert-to-popup-button");
        convertToPopupButton.classList.add(
            "ren-visualisation__convert-to-popup-button--" +
            Ren.TextUtils.cleanForCssClassName(
                Ren.TextUtils.convertToKebabCase(visualisation.visualisationTypeName)
            )
        );

        contentContainer.appendChild(convertToPopupButton);

        convertToPopupButton.addEventListener("click", () => {

            Ren.TabRelativeVisualisations.freeVisualisationFromTab(visualisation);
            popup.revertPopIn();
        });
    };

    const visualisationGuid = visualisation.visualisationGuid;

    const notifyVisualisationContainerResize = () => {

        if (container.clientWidth) {

            const width = container.clientWidth;
            const height = container.clientHeight;
            Ren.Messages.Events.visualisationContainerResize.notify(visualisationGuid, width, height);
        }
    };

    Ren.FnUtils.defer(() => {

        notifyVisualisationContainerResize();
    }, 200);

    const onMoveLeft = (left) => {

        visualisation.visualisationLeft = Math.round(left);
        visualisation.popupLeft = Math.round(left);
    };

    const onMoveTop = (top) => {

        visualisation.visualisationTop = Math.round(top);
        visualisation.popupTop = Math.round(top);
    };

    const onResizeWidth = (width) => {

        if (width !== undefined) {

            visualisation.visualisationWidth = Math.round(width);
            visualisation.popupWidth = Math.round(width);
        }

        Ren.Messages.Events.columnResized.notify(); // Reposition quick links.
        notifyVisualisationContainerResize();
    };

    const onResizeHeight = (height) => {

        if (height !== undefined) {

            visualisation.visualisationHeight = Math.round(height - 16);
            visualisation.popupHeight = Math.round(height);
        }
        notifyVisualisationContainerResize();
    };

    const onZoom = (scale) => {

        visualisation.popupZoom = scale;
    };

    const onContentScaleBaseChanged = (width) => {

        if (width) {
            visualisation.popupContentScaleBaseWidth = Math.round(width);
        }
        else {

            delete visualisation.popupContentScaleBaseWidth;
        }
    };

    const onPopInChanged = (isPoppedIn) => {

        visualisation.popupIsPoppedIn = isPoppedIn;
    };

    const place = (popupWindow) => {

        Ren.PopupVisualisationPlacement.place(visualisation, popupWindow, false);
    };

    // Don't show the "Add to Report" button if the visualisation is ad hoc, since ad hoc
    // visualisations cannot be saved as part of report settings (although they are included in
    // downloaded reports) so having an "Add to Report" button is misleading.
    const showAddToReportButton = !visualisation.isAdHoc &&
        document.querySelector(".ren-web-report-page");

    const showPopoutButton = visualisation.popupShowPopoutButton ?? false;

    const defaultWindowTitle = Ren.TextUtils.addSpacesBeforeCapitals(visualisation.visualisationTypeName);
    const popupWindowTitle = visualisation.popupTitle ?? defaultWindowTitle;

    const onClose = (keepVisualisation) => {

        if (!keepVisualisation) {
            Ren.VisualisationCollection.destroyVisualisation(visualisation);
        }
    };

    const popup = Ren.PopupWindow(
        "ren-visualisation-popup",
        renderPopupContent,
        popupWindowTitle,
        {
            leftPos: Ren.StylesUtils.convertToPixels(visualisation.popupLeft),
            topPos: Ren.StylesUtils.convertToPixels(visualisation.popupTop),
            width: Ren.StylesUtils.convertToPixels(visualisation.popupWidth),
            height: Ren.StylesUtils.convertToPixels(visualisation.popupHeight),
            hasFixedWidth: visualisation.popupHasFixedWidth ?? false,
            hasFixedHeight: visualisation.popupHasFixedHeight ?? false,
            withOffset: visualisation.withOffset ?? false,
            titleBarModifier: visualisation.titleBarModifier,
            noShadow: visualisation.noShadow ?? false,
            isPoppedIn: visualisation.popupIsPoppedIn ?? false,
            title: visualisation.popupTitle,
            icon: visualisation.popupIcon,
            horizontalScrollbar: visualisation.horizontalScrollbar ?? true,
            isResizable: visualisation.isResizable ?? true,
            showTitleBarButtons: visualisation.showTitleBarButtons ?? true,
            verticalScrollbar: visualisation.verticalScrollbar,
            showAddToReportButton,
            showPopoutButton,
            onMoveLeft,
            onMoveTop,
            onResizeWidth,
            onResizeHeight,
            onZoom,
            scaleContentToFit: visualisation.scalePopupContentToFit ?? false,
            contentScaleBaseWidth:
                Ren.StylesUtils.convertToPixels(visualisation.popupContentScaleBaseWidth),
            onContentScaleBaseChanged,

            // Ctrl + wheel zooms a date/value chart's dates, and scaling its popup too confuses the
            // two.  A multi-chart's charts keep to their own periods, so it scales the popup.
            // Asked on each wheel, as the chart can be switched to or from a multi-chart.
            disableWheelZoom: () => visualisation.visualisationTypeName === "DateValueChart"
                && !Ren.DateValueChart_MultiChart.isMultiChart(visualisation),
            onPopInChanged,
            place,
            allowOffscreen: true,
            // The caps only bound fitting to content, so they would clip a restored saved size.
            initialMaxWidth: visualisation.resizeToFitContentOnLoad
                ? visualisation.initialMaxWidth
                : null,
            initialMaxHeight: visualisation.resizeToFitContentOnLoad
                ? visualisation.initialMaxHeight
                : null,
            resizeToFitContentOnLoad: visualisation.resizeToFitContentOnLoad,
            fitPopupToContentExactly: visualisation.fitPopupToContentExactly ?? false,
            raiseToFitContent: visualisation.raisePopupToFitContent ?? false,

            // A visualisation the user has just created is sized to content that may yet grow a
            // vertical scroll bar, so its popup is given room for one; one created as report
            // settings are applied is restoring a saved size and is left alone.
            allowForScrollBarInInitialWidth: !visualisation.createdByActuizer,
            isAdHoc: visualisation.isAdHoc ?? false,
            visualisationTypeName: visualisation.visualisationTypeName,
            fillAvailableSpace: visualisation.fillAvailableSpace ?? false,
            popupReuseId: visualisation.popupReuseId ?? null,
            delayOpacityMs: visualisation.popupDelayOpacityMs ?? null,
            onClose
        }
    );

    visualisation.popup = popup;

    // Expose a method to notify about container resize without updating the visualisation
    // dimensions.  This is used when loading from saved settings to ensure charts scale to fill the
    // popup.
    popup.notifyContainerResize = notifyVisualisationContainerResize;

    return popup;
};
