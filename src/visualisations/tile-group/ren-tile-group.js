/**
 * Renders a group of tiles under a heading, with an optional subheading after it.  The tiles are
 * the group's children (see Ren.VisualisationContainers), and the heading and subheading are each
 * edited from the context menu of their own element.  An empty subheading is shown as a
 * placeholder while the heading is hovered, so that it can be right-clicked to fill it in.
 */
Ren.CreateTileGroup = (_tabularData, visualisation) => {

    const EMPTY_CLASS_NAME = "ren-tile-group__part--empty";

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TileGroup", {});

    const headingElement = element.querySelector(".js-ren-tile-group-heading");
    const subheadingElement = element.querySelector(".js-ren-tile-group-subheading");
    const tilesElement = element.querySelector(".js-ren-tile-group-tiles");

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (!isEditable) {
        element.classList.add("ren-tile-group--read-only");
    }

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let i = 0; i < cssClasses.length; i++) {

            if (cssClasses[i]) element.classList.add(cssClasses[i]);
        }
    }

    if (visualisation.tileWidth) {
        element.style.setProperty("--ren-tile-group-tile-width", visualisation.tileWidth);
    }

    if (visualisation.tileGap) {
        element.style.setProperty("--ren-tile-group-tile-gap", visualisation.tileGap);
    }

    const showPart = (partElement, value) => {

        partElement.textContent = value ?? "";
        partElement.classList.toggle(EMPTY_CLASS_NAME, !value);
    };

    const showHeadings = () => {

        showPart(headingElement, visualisation.heading);
        showPart(subheadingElement, visualisation.subheading);
    };

    /**
     * Sets the heading or subheading, removing it when it is cleared.
     */
    const setProperty = (propertyName, value) => {

        const trimmedValue = value.trim();

        if (trimmedValue) {
            visualisation[propertyName] = trimmedValue;
        }
        else {

            delete visualisation[propertyName];
        }

        showHeadings();

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const addPropertyMenuItem = (partElement, text, id, propertyName) => {

        Ren.AddContextMenuItems(partElement, () => [{
            section: "Tile group",
            text: text,
            id: id,
            action: () => Ren.CreateOkCancelTextEditorPopupWindow(
                text.replace("...", ""),
                (value) => setProperty(propertyName, value),
                {
                    initialText: visualisation[propertyName] ?? "",
                    multiline: false,
                    width: 400,
                    height: 110
                }
            )
        }]);
    };

    showHeadings();

    if (isEditable) {

        addPropertyMenuItem(
            headingElement,
            "Edit heading...",
            "tile-group-edit-heading",
            "heading"
        );

        addPropertyMenuItem(
            subheadingElement,
            "Edit subheading...",
            "tile-group-edit-subheading",
            "subheading"
        );
    }

    Ren.VisualisationContainers.registerChildrenElement(visualisation, tilesElement);

    return {
        element
    };
};
