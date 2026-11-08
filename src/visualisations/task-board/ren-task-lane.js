/**
 * Renders a lane of a task board: its heading, and a cell for each of the board's columns, each
 * one a slot of task tiles (see Ren.VisualisationContainers).  A tile goes in the cell its
 * containerSlot names by the column's ID.  The heading is edited in place, by double-clicking it
 * or from its context menu.
 */
Ren.CreateTaskLane = (_tabularData, visualisation) => {

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskLane", {});

    const headingElement = element.querySelector(".js-ren-task-lane-heading");

    const board = Ren.VisualisationContainers.getContainer(visualisation);
    const columns = board?.columns ?? [];

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let index = 0; index < cssClasses.length; index++) {

            if (cssClasses[index]) element.classList.add(cssClasses[index]);
        }
    }

    const showHeading = () => {

        headingElement.textContent = visualisation.heading ?? "";
    };

    const stopEditingHeading = (isCommitted) => {

        if (!headingElement.hasAttribute("contenteditable")) return;

        headingElement.removeAttribute("contenteditable");

        const heading = headingElement.textContent.trim();

        if (isCommitted && heading !== (visualisation.heading ?? "")) {

            if (heading) {
                visualisation.heading = heading;
            }
            else {

                delete visualisation.heading;
            }

            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        }

        showHeading();
    };

    const startEditingHeading = () => {

        if (headingElement.hasAttribute("contenteditable")) return;

        headingElement.setAttribute("contenteditable", "plaintext-only");
        headingElement.focus();

        const range = document.createRange();
        range.selectNodeContents(headingElement);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const addCell = (column) => {

        const cellElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskLaneCell", {});

        element.appendChild(cellElement);

        Ren.VisualisationContainers.registerChildrenElement(visualisation, cellElement, column?.id);
    };

    showHeading();

    if (isEditable) {

        headingElement.addEventListener("dblclick", () => startEditingHeading());
        headingElement.addEventListener("blur", () => stopEditingHeading(true));

        headingElement.addEventListener("keydown", (event) => {

            if (event.key === "Enter") {

                event.preventDefault();
                headingElement.blur();
            }
            else if (event.key === "Escape") {

                stopEditingHeading(false);
            }
        });

        Ren.AddContextMenuItems(headingElement, () => [{
            section: "Task board",
            text: "Rename lane",
            id: "task-lane-rename",
            action: () => startEditingHeading()
        }]);
    }

    // A lane outside a board, or on a board with no columns, has a single cell.
    if (columns.length === 0) {
        addCell(null);
    }

    for (let index = 0; index < columns.length; index++) {
        addCell(columns[index]);
    }

    return {
        element
    };
};
