/**
 * Renders a link as a tile: an image and a title, the whole of it the link.  The title, link,
 * image and image filter are each edited from the tile's context menu.
 */
Ren.CreateLinkTile = (_tabularData, visualisation) => {

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("LinkTile", {});

    const linkElement = element.querySelector(".js-ren-link-tile-link");
    const imageElement = element.querySelector(".js-ren-link-tile-image");
    const titleElement = element.querySelector(".js-ren-link-tile-title");

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let i = 0; i < cssClasses.length; i++) {

            if (cssClasses[i]) element.classList.add(cssClasses[i]);
        }
    }

    const showTile = () => {

        titleElement.textContent = visualisation.title ?? "";

        if (visualisation.url) {
            linkElement.href = Ren.HostUrls.reportUrl(visualisation.url);
        }
        else {

            linkElement.removeAttribute("href");
        }

        if (visualisation.imageUrl) {
            imageElement.src = Ren.HostUrls.imageUrl(visualisation.imageUrl);
        }
        else {

            imageElement.removeAttribute("src");
        }

        imageElement.hidden = !visualisation.imageUrl;
        imageElement.style.filter = visualisation.imageFilter ?? "";
        element.classList.toggle("ren-link-tile--without-link", !visualisation.url);
    };

    /**
     * Sets one of the tile's properties, removing it when it is cleared.
     */
    const setProperty = (propertyName, value) => {

        const trimmedValue = value.trim();

        if (trimmedValue) {
            visualisation[propertyName] = trimmedValue;
        }
        else {

            delete visualisation[propertyName];
        }

        showTile();

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const createPropertyMenuItem = (text, id, propertyName) => ({
        section: "Link tile",
        text: text,
        id: id,
        action: () => Ren.CreateOkCancelTextEditorPopupWindow(
            text.replace("...", "") + " - " + (visualisation.title ?? "link tile"),
            (value) => setProperty(propertyName, value),
            {
                initialText: visualisation[propertyName] ?? "",
                multiline: false,
                width: 400,
                height: 110
            }
        )
    });

    showTile();

    if (isEditable) {

        Ren.AddContextMenuItems(element, () => [
            createPropertyMenuItem("Edit title...", "link-tile-edit-title", "title"),
            createPropertyMenuItem("Edit link...", "link-tile-edit-url", "url"),
            createPropertyMenuItem("Edit image...", "link-tile-edit-image-url", "imageUrl"),
            createPropertyMenuItem(
                "Edit image filter...",
                "link-tile-edit-image-filter",
                "imageFilter"
            )
        ]);
    }

    return {
        element
    };
};
