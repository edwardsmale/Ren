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
    const QUESTION_CLASS_NAME = "ren-task-tile__question";
    const QUESTION_MARKER = "(?)";

    // The elements that start a new line of the text, as well as a <br>.
    const BLOCK_TAG_NAMES = new Set([
        "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIGURE", "FOOTER",
        "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "OL", "P", "PRE", "SECTION",
        "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "UL"
    ]);

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

    /**
     * Gets the visualisationId of the task board the tile is on, or "task-board" for a tile on
     * none.
     */
    const getBoardKey = () => {

        let container = Ren.VisualisationContainers.getContainer(visualisation);

        while (container) {

            if (container.visualisationTypeName === "TaskBoard") return container.visualisationId;

            container = Ren.VisualisationContainers.getContainer(container);
        }

        return "task-board";
    };

    const goToTile = (taskId) => Ren.TaskBoardHighlights.goToTile(getBoardKey(), taskId);

    const showHoveredTiles = (taskIds) =>
        Ren.TaskBoardHighlights.showHoveredTiles(getBoardKey(), taskIds);

    /**
     * Highlights the tiles named in the prerequisites list while the mouse is over it.
     */
    const addPrerequisitesHover = () => {

        prerequisitesElement.addEventListener("mouseenter", () => {

            const taskIds = (visualisation.taskPrerequisites ?? "").match(/\b[A-Z][A-Z0-9]?\b/g);

            showHoveredTiles(taskIds ?? []);
        });

        prerequisitesElement.addEventListener("mouseleave", () => showHoveredTiles([]));
    };

    /**
     * Replaces each match of the given pattern in a text node, whose first group is a tile ID, with
     * an element of the given class showing the ID, which goes to that tile when clicked and, if
     * isHoverHighlighted, highlights it while the mouse is over it.
     */
    const showTileReferencesInTextNode = (textNode, pattern, className, isHoverHighlighted) => {

        const text = textNode.nodeValue;

        let match = pattern.exec(text);

        if (!match) return;

        const fragment = document.createDocumentFragment();
        let position = 0;

        while (match) {

            if (match.index > position) {

                const precedingText = text.substring(position, match.index);
                fragment.appendChild(document.createTextNode(precedingText));
            }

            const taskId = match[1];
            const referenceElement = document.createElement("span");

            referenceElement.className = className;
            referenceElement.textContent = taskId;

            // For the copy of a question line on the board (see Ren.CreateTaskBoard).
            referenceElement.setAttribute("data-task-id", taskId);
            referenceElement.addEventListener("click", () => goToTile(taskId));

            if (isHoverHighlighted) {

                referenceElement.addEventListener("mouseenter", () => showHoveredTiles([taskId]));
                referenceElement.addEventListener("mouseleave", () => showHoveredTiles([]));
            }

            fragment.appendChild(referenceElement);

            position = match.index + match[0].length;
            match = pattern.exec(text);
        }

        if (position < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(position)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
    };

    /**
     * Shows each tile ID in square brackets in the given element's text, such as "[B]", as a badge
     * styled like a tile's own ID.
     */
    const showTileReferences = (parentElement) => {

        const textNodes = [];
        const walker = document.createTreeWalker(parentElement, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        for (let i = 0; i < textNodes.length; i++) {

            showTileReferencesInTextNode(
                textNodes[i],
                /\[([A-Z][A-Z0-9]?)\]/g,
                "ren-task-tile__reference",
                true
            );
        }
    };

    /**
     * Makes each tile ID in the prerequisites list, such as "C, E, P", go to that tile when
     * clicked.
     */
    const showPrerequisiteReferences = () => {

        const textNode = prerequisitesElement.firstChild;

        if (!textNode) return;

        showTileReferencesInTextNode(
            textNode,
            /\b([A-Z][A-Z0-9]?)\b/g,
            "ren-task-tile__prerequisite",
            false
        );
    };

    const isLineBreak = (node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        (node.tagName === "BR" || BLOCK_TAG_NAMES.has(node.tagName));

    /**
     * Marks the line of text the given text node is in as a task question: the run of nodes
     * around it in its block, up to a line break or another block either side.
     */
    const markQuestionLine = (textNode) => {

        let lineNode = textNode;

        while (lineNode.parentNode !== textElement && !isLineBreak(lineNode.parentNode)) {
            lineNode = lineNode.parentNode;
        }

        let firstNode = lineNode;
        let lastNode = lineNode;

        while (firstNode.previousSibling && !isLineBreak(firstNode.previousSibling)) {
            firstNode = firstNode.previousSibling;
        }

        while (lastNode.nextSibling && !isLineBreak(lastNode.nextSibling)) {
            lastNode = lastNode.nextSibling;
        }

        const questionElement = document.createElement("span");
        questionElement.className = QUESTION_CLASS_NAME;

        lineNode.parentNode.insertBefore(questionElement, firstNode);

        let node = firstNode;

        while (node) {

            const nextNode = node === lastNode ? null : node.nextSibling;

            questionElement.appendChild(node);
            node = nextNode;
        }
    };

    /**
     * Removes each "(?)" from the shown text, with the space before it.  It stays in the text
     * edited.
     */
    const removeQuestionMarkers = (textNodes) => {

        for (let i = 0; i < textNodes.length; i++) {
            textNodes[i].nodeValue = textNodes[i].nodeValue.replace(/\s*\(\?\)/g, "");
        }
    };

    /**
     * Marks each line of the text with "(?)" in it as a task question, which the board lists.
     */
    const markQuestionLines = () => {

        const textNodes = [];
        const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {

            if (walker.currentNode.nodeValue.indexOf(QUESTION_MARKER) !== -1) {
                textNodes.push(walker.currentNode);
            }
        }

        for (let i = 0; i < textNodes.length; i++) {

            // Already in the line of an earlier one.
            if (textNodes[i].parentElement.closest("." + QUESTION_CLASS_NAME)) continue;

            markQuestionLine(textNodes[i]);
        }

        removeQuestionMarkers(textNodes);
    };

    const showText = () => {

        Ren.HtmlUtils.setHTML(textElement, visualisation.contentHtml);
        showTileReferences(textElement);
        markQuestionLines();

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

        if (visualisation.taskId) {
            element.id = Ren.TaskBoardHighlights.getAnchorId(getBoardKey(), visualisation.taskId);
        }
        else {

            element.removeAttribute("id");
        }

        titleElement.textContent = visualisation.taskTitle ?? "";
        showTileReferences(titleElement);
        showSize();
        showPart(prerequisitesLineElement, prerequisitesElement, visualisation.taskPrerequisites);
        showPrerequisiteReferences();
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
    addPrerequisitesHover();

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
