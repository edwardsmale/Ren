/**
 * Opens colour picker windows just below the element each was asked for from.  A window is linked
 * to whatever opened it by its colour picker group alone, through Ren.Messages.
 */
(() => {

    // A popup's top is that of its content, with its 26px title bar drawn above it.
    const TITLE_BAR_HEIGHT = 26;

    const ANCHOR_GAP = 8;

    // colourPickerGroup -> { popup, picker }
    const openWindows = new Map();

    const openWindow = (colourPickerGroup, title, colour, anchorElement) => {

        const existing = openWindows.get(colourPickerGroup);

        if (existing) {

            existing.picker.setColour(colour);
            Ren.PopupWindowOrder.bringToFront(
                existing.popup.contentContainer.closest(".ren-report-popup-window")
            );

            return;
        }

        const picker = Ren.ColourPicker.create(colour, (pickedColour) => {

            Ren.Messages.Events.colourPicked.notify(colourPickerGroup, pickedColour);
        });

        const anchorBounds = anchorElement.getBoundingClientRect();

        const contentElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "ColourPickerWindow",
            {}
        );

        contentElement.querySelector(".js-ren-colour-picker-window-picker")
            .appendChild(picker.element);

        const popup = Ren.PopupWindow(
            "ren-colour-picker-window",
            (contentContainer) => contentContainer.appendChild(contentElement),
            title,
            {
                leftPos: anchorBounds.left + window.scrollX,
                topPos: anchorBounds.bottom + window.scrollY + ANCHOR_GAP + TITLE_BAR_HEIGHT,
                autoSized: true,
                isResizable: false,
                verticalScrollbar: false,
                horizontalScrollbar: false,
                onClose: () => {

                    openWindows.delete(colourPickerGroup);
                    Ren.Messages.Events.colourPickerWindowClosed.notify(colourPickerGroup);
                }
            }
        );

        contentElement.querySelector(".js-ren-colour-picker-window-ok-button")
            .addEventListener("click", () => popup.closeWindow());

        openWindows.set(colourPickerGroup, { popup, picker });
    };

    Ren.Messages.Requests.colourPickerWindow.handle((
        colourPickerGroup,
        title,
        colour,
        anchorElement
    ) => {

        openWindow(colourPickerGroup, title, colour, anchorElement);
    });

    Ren.Messages.Requests.showColourPickerColour.handle((colourPickerGroup, colour) => {

        openWindows.get(colourPickerGroup)?.picker.setColour(colour);
    });

    Ren.Messages.Requests.closeColourPickerWindow.handle((colourPickerGroup) => {

        openWindows.get(colourPickerGroup)?.popup.closeWindow();
    });
})();
