/**
 * Renders a task as a tile: its ID, title, size and text, the tasks it waits for, and its status.
 * Each is edited from the context menu of its own element, and the status is set from the menu of
 * the tile's status button.  An empty ID, size or prerequisites list is shown as a placeholder
 * while the tile is hovered, so that it can be right-clicked to fill it in.  The tile itself can be
 * removed from its context menu.
 */
Ren.CreateTaskTile = (_tabularData, visualisation) => {

    const statuses = [
        { name: "NotStarted", text: "Not started" },
        { name: "Tentative", text: "Tentative" },
        { name: "InProgress", text: "In progress" },
        { name: "AwaitingInput", text: "Awaiting input" },
        { name: "OnHold", text: "On hold" },
        { name: "InReview", text: "In review" },
        { name: "Complete", text: "Complete" },
        { name: "NotDoing", text: "Not doing" }
    ];

    const sizes = ["XS", "S", "M", "L", "XL"];

    const EMPTY_CLASS_NAME = "ren-task-tile__part--empty";
    const SIZE_CLASS_NAME_PREFIX = "ren-task-tile__size--";

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskTile", {});

    const idElement = element.querySelector(".js-ren-task-tile-id");
    const titleElement = element.querySelector(".js-ren-task-tile-title");
    const sizeElement = element.querySelector(".js-ren-task-tile-size");
    const textElement = element.querySelector(".js-ren-task-tile-text");
    const prerequisitesLineElement = element.querySelector(".js-ren-task-tile-prerequisites-line");
    const prerequisitesElement = element.querySelector(".js-ren-task-tile-prerequisites");
    const statusButton = element.querySelector(".js-ren-task-tile-status");

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (!isEditable) {
        element.classList.add("ren-task-tile--read-only");
    }

    const getStatus = () => {

        for (let i = 0; i < statuses.length; i++) {

            if (statuses[i].name === visualisation.taskStatus) return statuses[i];
        }

        return statuses[0];
    };

    const getStatusModifier = (status) =>
        "ren-task-tile--" + Ren.TextUtils.convertToKebabCase(status.name);

    const showStatus = () => {

        const status = getStatus();

        for (let i = 0; i < statuses.length; i++) {

            element.classList.toggle(getStatusModifier(statuses[i]), statuses[i] === status);
        }

        statusButton.textContent = status.text;
    };

    const showText = () => {

        Ren.HtmlUtils.setHTML(textElement, visualisation.contentHtml);

        Ren.ShowDataLinks.setUpElements(textElement);
    };

    /**
     * Shows a value in its element, or marks the element as an empty part, whose placeholder the
     * stylesheet supplies.
     */
    const showPart = (partElement, valueElement, value) => {

        valueElement.textContent = value ?? "";
        partElement.classList.toggle(EMPTY_CLASS_NAME, !value);
    };

    const showSize = () => {

        const size = visualisation.taskSize;

        for (let i = 0; i < sizes.length; i++) {

            sizeElement.classList.remove(SIZE_CLASS_NAME_PREFIX + sizes[i].toLowerCase());
        }

        if (size) {
            sizeElement.classList.add(SIZE_CLASS_NAME_PREFIX + size.toLowerCase());
        }

        showPart(sizeElement, sizeElement, size);
    };

    const showDetails = () => {

        showPart(idElement, idElement, visualisation.taskId);
        titleElement.textContent = visualisation.taskTitle ?? "";
        showSize();
        showPart(prerequisitesLineElement, prerequisitesElement, visualisation.taskPrerequisites);
    };

    const notifyChanged = () => {

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const setStatus = (status) => {

        visualisation.taskStatus = status.name;

        showStatus();
        notifyChanged();
    };

    /**
     * Sets one of the task's text properties, removing it when it is cleared.
     */
    const setProperty = (propertyName, value) => {

        const trimmedValue = value.trim();

        if (trimmedValue) {
            visualisation[propertyName] = trimmedValue;
        }
        else {

            delete visualisation[propertyName];
        }

        showDetails();
        notifyChanged();
    };

    const setSize = (size) => {

        visualisation.taskSize = size;

        showSize();
        notifyChanged();
    };

    const applyText = (html) => {

        visualisation.contentHtml = html;

        showText();
        notifyChanged();
    };

    const getPopupTitle = (title) =>
        title + " - " + (visualisation.taskId ?? visualisation.taskTitle ?? "task");

    const openPropertyEditor = (title, propertyName) => {

        Ren.CreateOkCancelTextEditorPopupWindow(
            getPopupTitle(title),
            (value) => setProperty(propertyName, value),
            {
                initialText: visualisation[propertyName] ?? "",
                multiline: false,
                width: 400,
                height: 110
            }
        );
    };

    const openTextEditor = () => {

        Ren.CreateTextEditorPopupWindow(
            getPopupTitle("Edit text"),
            visualisation.contentHtml ?? "",
            applyText,
            {
                width: 640,
                height: 320
            }
        );
    };

    const removeTile = () => {

        Ren.PopupConfirm(
            "Remove this task from the board?",
            getPopupTitle("Remove task"),
            () => Ren.VisualisationCollection.destroyVisualisation(visualisation)
        );
    };

    const addPropertyMenuItem = (partElement, text, id, propertyName) => {

        Ren.AddContextMenuItems(partElement, () => [{
            section: "Task",
            text: text,
            id: id,
            action: () => openPropertyEditor(text.replace("...", ""), propertyName)
        }]);
    };

    const createSizeMenuItem = (size) => ({
        section: "Size",
        text: size,
        id: "task-tile-size-" + size.toLowerCase(),
        ticked: () => visualisation.taskSize === size,
        action: () => setSize(size)
    });

    const createStatusMenuItem = (status) => ({
        text: status.text,
        id: "task-tile-status-" + Ren.TextUtils.convertToKebabCase(status.name),
        ticked: () => getStatus() === status,
        action: () => setStatus(status)
    });

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let i = 0; i < cssClasses.length; i++) {

            if (cssClasses[i]) element.classList.add(cssClasses[i]);
        }
    }

    showDetails();
    showText();
    showStatus();

    if (isEditable) {

        addPropertyMenuItem(idElement, "Edit code...", "task-tile-edit-code", "taskId");
        addPropertyMenuItem(titleElement, "Edit title...", "task-tile-edit-title", "taskTitle");

        addPropertyMenuItem(
            prerequisitesLineElement,
            "Edit \"after\"...",
            "task-tile-edit-prerequisites",
            "taskPrerequisites"
        );

        Ren.AddContextMenuItems(sizeElement, () => sizes.map(createSizeMenuItem));

        Ren.AddContextMenuItems(textElement, () => [{
            section: "Task",
            text: "Edit text...",
            id: "task-tile-edit-text",
            action: () => openTextEditor()
        }]);

        Ren.AddButtonMenuItems(statusButton, () => statuses.map(createStatusMenuItem));

        // In a container, the container's own "Remove task..." takes this one's place.
        if (!visualisation.containerVisualisationId) {

            Ren.AddContextMenuItems(element, () => [{
                section: "Task",
                text: "Remove task...",
                id: "task-tile-remove",
                action: () => removeTile()
            }]);
        }
    }
    else {

        statusButton.disabled = true;
    }

    return {
        element
    };
};
