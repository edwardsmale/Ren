/**
 * Renders a link as a tile: an image and a title, the whole of it the link.  The title, link,
 * image and image filter are each edited from the tile's context menu, which also toggles
 * opening the link in a new tab and archives the tile, moving it into its tile group's collapsed
 * "Archived" section, and restores it.
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

        if (visualisation.openInNewTab) {

            linkElement.target = "_blank";
            linkElement.rel = "noopener";
        }
        else {

            linkElement.removeAttribute("target");
            linkElement.removeAttribute("rel");
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

    const toggleOpenInNewTab = () => {

        if (visualisation.openInNewTab) {
            delete visualisation.openInNewTab;
        }
        else {

            visualisation.openInNewTab = true;
        }

        showTile();

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const isArchived = () => visualisation.containerSlot === Ren.CreateTileGroup.ARCHIVED_SLOT;

    /**
     * Moves the tile to the end of its group's archived tiles, or back to the end of the others.
     */
    const toggleArchived = () => {

        const container = Ren.VisualisationContainers.getContainer(visualisation);

        if (isArchived()) {
            delete visualisation.containerSlot;
        }
        else {

            visualisation.containerSlot = Ren.CreateTileGroup.ARCHIVED_SLOT;
        }

        const slot = Ren.VisualisationContainers.getChildSlot(visualisation);

        const lastOrder = Ren.VisualisationContainers
            .getChildren(container, slot)
            .filter(child => child !== visualisation)
            .reduce((order, child) => Math.max(order, child.containerOrder ?? 0), 0);

        visualisation.containerOrder = lastOrder + 1;

        Ren.VisualisationContainers.placeChild(visualisation);
        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    /**
     * Gets the "Archive tile" item, offered only in a container that has an archived slot.
     */
    const getArchiveMenuItems = () => {

        const container = Ren.VisualisationContainers.getContainer(visualisation);

        if (!container ||
            !Ren.VisualisationContainers.getSlots(container).includes(Ren.CreateTileGroup.ARCHIVED_SLOT)) {

            return [];
        }

        return [{
            section: "Link tile",
            text: "Archive tile",
            id: "link-tile-archive",
            positionAtEndOfSection: true,
            ticked: isArchived,
            action: toggleArchived
        }];
    };

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
            ),
            {
                section: "Link tile",
                text: "Open in new tab",
                id: "link-tile-open-in-new-tab",
                ticked: () => !!visualisation.openInNewTab,
                action: toggleOpenInNewTab
            },
            ...getArchiveMenuItems()
        ]);
    }

    return {
        element
    };
};
