/**
 * Renders a task board: a heading for each of its columns, and beneath them its lanes, which are
 * its children (see Ren.VisualisationContainers).  Each lane has a cell per column, so the board
 * is laid out as a grid.  A column's heading and subheading are each edited from the context menu
 * of its own element, and an empty one is shown as a placeholder while the heading is hovered, so
 * that it can be right-clicked to fill it in.
 */
Ren.CreateTaskBoard = (_tabularData, visualisation) => {

    const EMPTY_CLASS_NAME = "ren-task-board__part--empty";

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskBoard", {});

    const headerElement = element.querySelector(".js-ren-task-board-header");
    const lanesElement = element.querySelector(".js-ren-task-board-lanes");

    const columns = visualisation.columns ?? [];

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (!isEditable) {
        element.classList.add("ren-task-board--read-only");
    }

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let index = 0; index < cssClasses.length; index++) {

            if (cssClasses[index]) element.classList.add(cssClasses[index]);
        }
    }

    element.style.setProperty(
        "--ren-task-board-column-count",
        String(Math.max(columns.length, 1))
    );

    if (visualisation.columnWidth) {
        element.style.setProperty("--ren-task-board-column-width", visualisation.columnWidth);
    }

    if (visualisation.laneHeadingWidth) {

        element.style.setProperty(
            "--ren-task-board-lane-heading-width",
            visualisation.laneHeadingWidth
        );
    }

    const showPart = (partElement, value) => {

        partElement.textContent = value ?? "";
        partElement.classList.toggle(EMPTY_CLASS_NAME, !value);
    };

    /**
     * Sets a column's heading or subheading, removing it when it is cleared.
     */
    const setColumnProperty = (column, propertyName, value, partElement) => {

        const trimmedValue = value.trim();

        if (trimmedValue) {
            column[propertyName] = trimmedValue;
        }
        else {

            delete column[propertyName];
        }

        showPart(partElement, column[propertyName]);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const addColumnMenuItem = (column, partElement, text, id, propertyName) => {

        Ren.AddContextMenuItems(partElement, () => [{
            section: "Task board",
            text: text,
            id: id,
            action: () => Ren.CreateOkCancelTextEditorPopupWindow(
                text.replace("...", ""),
                (value) => setColumnProperty(column, propertyName, value, partElement),
                {
                    initialText: column[propertyName] ?? "",
                    multiline: false,
                    width: 400,
                    height: 110
                }
            )
        }]);
    };

    const addColumnHeading = (column) => {

        const columnHeadingElement =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskBoardColumnHeading", {});

        const headingElement = columnHeadingElement.querySelector(".js-ren-task-board-heading");
        const subheadingElement = columnHeadingElement.querySelector(".js-ren-task-board-subheading");

        showPart(headingElement, column.heading);
        showPart(subheadingElement, column.subheading);

        if (isEditable) {

            addColumnMenuItem(
                column,
                headingElement,
                "Edit heading...",
                "task-board-edit-heading",
                "heading"
            );

            addColumnMenuItem(
                column,
                subheadingElement,
                "Edit subheading...",
                "task-board-edit-subheading",
                "subheading"
            );
        }

        headerElement.appendChild(columnHeadingElement);
    };

    for (let index = 0; index < columns.length; index++) {
        addColumnHeading(columns[index]);
    }

    Ren.VisualisationContainers.registerChildrenElement(visualisation, lanesElement);

    return {
        element
    };
};
