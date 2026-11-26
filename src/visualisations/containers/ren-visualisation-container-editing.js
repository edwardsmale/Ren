/**
 * Lets the user add, remove and reorder a container's children, for any container type.  A type
 * says what it accepts and how its children are laid out with containerOptions:
 *
 *   containerOptions: {
 *       flow: "Row",    // or "Column", which decides between "Move left/right" and "up/down"
 *       childTypes: [{
 *           visualisationTypeName: "TaskTile",
 *           name: "task",                      // as in "Add task" and "Remove task..."
 *           options: { taskTitle: "New task" } // given to a child added from the menu
 *       }]
 *   }
 *
 * A child is moved by its menu, or picked up by holding the mouse button down on it for half a
 * second and dropped where it is to go, in its container or another that accepts it.  Escape puts
 * it back.  Each of a container's slots is arranged on its own, and "Add ..." adds to the one that
 * was right-clicked.  None of this is offered in a downloaded report, which can't save its
 * settings.
 */
Ren.VisualisationContainerEditing = (() => {

    const HOLD_DURATION_MS = 500;
    const HOLD_MOVE_TOLERANCE_PX = 5;

    const DRAGGING_CLASS_NAME = "ren-container-child--dragging";
    const PAGE_DRAGGING_CLASS_NAME = "ren-container-child-dragging";
    const DROP_TARGET_CLASS_NAME = "ren-container-children--drop-target";
    const SHIFTING_CLASS_NAME = "ren-container-child--shifting";

    // Clicks on these go to the child itself rather than picking it up.  A link doesn't, since a
    // child can be all link (as a link tile is), and the click after a drop is swallowed anyway.
    const INTERACTIVE_SELECTOR = "button, input, select, textarea, [contenteditable]";

    const setUpChildren = new WeakSet();

    let pendingHold = null;
    let drag = null;

    const isEditable = () => !Ren.UrlContext.isDownloadedReport();

    const getContainerOptions = (container) => Ren.VisualisationTypes
        .getByTypeName(container.visualisationTypeName)
        ?.containerOptions;

    const getChildType = (container, visualisationTypeName) => {

        const childTypes = getContainerOptions(container)?.childTypes ?? [];

        return childTypes.find(childType =>
            childType.visualisationTypeName === visualisationTypeName
        );
    };

    const getChildName = (container, child) =>
        getChildType(container, child.visualisationTypeName)?.name ??
        Ren.TextUtils.addSpacesBeforeCapitals(child.visualisationTypeName).toLowerCase();

    const isColumnFlow = (container) => getContainerOptions(container)?.flow === "Column";

    /**
     * Gives the given children, in the order given, the orders 1, 2, 3 and so on in the given
     * container's slot, puts them there, and saves each one that changed.
     */
    const setChildren = (container, slot, children) => {

        for (let index = 0; index < children.length; index++) {

            const child = children[index];
            const order = index + 1;

            const isChanged = child.containerOrder !== order ||
                child.containerVisualisationId !== container.visualisationId ||
                (slot && child.containerSlot !== slot);

            child.containerVisualisationId = container.visualisationId;
            child.containerOrder = order;

            if (slot) {
                child.containerSlot = slot;
            }

            Ren.VisualisationContainers.placeChild(child);

            if (isChanged) Ren.VisualisationSettingsSynchroniser.commitChange(child);
        }
    };

    /**
     * Puts a child whose container, slot or order was set other than by a drag (by a reset, say)
     * where they now say it goes among the others in that slot, renumbering them, and the ones in
     * the slot it was in before.
     */
    const placeChildBySettings = (child, oldContainer, oldSlot) => {

        const container = Ren.VisualisationContainers.getContainer(child);

        if (!container) return;

        const slot = Ren.VisualisationContainers.getChildSlot(child);
        const children = Ren.VisualisationContainers.getChildren(container, slot)
            .filter(sibling => sibling !== child);

        const order = child.containerOrder ?? Infinity;
        const index = Math.max(0, Math.min(order - 1, children.length));

        children.splice(index, 0, child);
        setChildren(container, slot, children);

        if (oldContainer && (oldContainer !== container || oldSlot !== slot)) {

            setChildren(
                oldContainer,
                oldSlot,
                Ren.VisualisationContainers.getChildren(oldContainer, oldSlot)
            );
        }
    };

    /**
     * Gets the given child's siblings in its slot, itself included, in order.
     */
    const getSlotChildren = (child) => Ren.VisualisationContainers.getChildren(
        Ren.VisualisationContainers.getContainer(child),
        Ren.VisualisationContainers.getChildSlot(child)
    );

    const addChild = (container, slot, childType) => {

        const children = Ren.VisualisationContainers.getChildren(container, slot);

        const options = Object.assign({}, childType.options, {
            visualisationTypeName: childType.visualisationTypeName,
            containerVisualisationId: container.visualisationId,
            containerOrder: children.length + 1
        });

        if (slot) {
            options.containerSlot = slot;
        }

        const child = Ren.VisualisationCreator.createVisualisation(options);

        Ren.VisualisationSettingsSynchroniser.commitChange(child);
        Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
    };

    const moveChild = (child, offset) => {

        const container = Ren.VisualisationContainers.getContainer(child);
        const slot = Ren.VisualisationContainers.getChildSlot(child);
        const children = getSlotChildren(child);
        const index = children.indexOf(child);

        children.splice(index, 1);
        children.splice(index + offset, 0, child);

        setChildren(container, slot, children);
    };

    const removeChild = (child) => {

        const container = Ren.VisualisationContainers.getContainer(child);
        const slot = Ren.VisualisationContainers.getChildSlot(child);
        const name = getChildName(container, child);

        Ren.PopupConfirm(
            "Remove this " + name + "?",
            "Remove " + name,
            () => {

                Ren.VisualisationCollection.destroyVisualisation(child);

                setChildren(
                    container,
                    slot,
                    Ren.VisualisationContainers.getChildren(container, slot)
                );
            }
        );
    };

    /**
     * Gets the items for a child's menu, which are only for the innermost child right-clicked: a
     * child that is a container is otherwise offered "Move down" by itself to its own children.
     */
    const getChildMenuItems = (child) => {

        const container = Ren.VisualisationContainers.getContainer(child);
        const clickedChildElement = Ren.LastRightClickTarget?.closest("[data-container-order]");

        if (!container || clickedChildElement !== child.element) return [];

        const children = getSlotChildren(child);
        const index = children.indexOf(child);
        const isColumn = isColumnFlow(container);
        const items = [];

        if (index > 0) {

            items.push({
                section: "Arrange",
                text: isColumn ? "Move up" : "Move left",
                id: "container-child-move-back",
                action: () => moveChild(child, -1)
            });
        }

        if (index < children.length - 1) {

            items.push({
                section: "Arrange",
                text: isColumn ? "Move down" : "Move right",
                id: "container-child-move-forward",
                action: () => moveChild(child, 1)
            });
        }

        items.push({
            section: "Arrange",
            text: "Remove " + getChildName(container, child) + "...",
            id: "container-child-remove",
            positionAtEndOfSection: true,
            action: () => removeChild(child)
        });

        return items;
    };

    /**
     * Gets the slot of the given container that was right-clicked in, or its first if the click
     * was outside them all.
     */
    const getClickedSlot = (container) => {

        const childrenElement = Ren.LastRightClickTarget?.closest(
            "[" + Ren.VisualisationContainers.CHILDREN_ATTRIBUTE_NAME + "=\"" +
            CSS.escape(container.visualisationId) + "\"]"
        );

        return childrenElement
            ? childrenElement.getAttribute(Ren.VisualisationContainers.SLOT_ATTRIBUTE_NAME)
            : Ren.VisualisationContainers.getSlots(container)[0] ?? "";
    };

    /**
     * Called as a container registers its children element, to offer "Add ..." for each type
     * it accepts.  The same type has the same ID in every container, so the innermost offers it.
     */
    const setUpContainer = (container) => {

        if (!isEditable() || !container.element) return;

        const childTypes = getContainerOptions(container)?.childTypes ?? [];

        Ren.AddStandingContextMenuItems(container.element, "container-add", () => childTypes
            .map(childType => ({
                section: "Arrange",
                text: "Add " + childType.name,
                id: "container-add-" +
                    Ren.TextUtils.convertToKebabCase(childType.visualisationTypeName),
                action: () => addChild(container, getClickedSlot(container), childType)
            })));
    };

    /**
     * Called as a child is placed in its container, to offer moving and removing it.
     */
    const setUpChild = (child) => {

        if (!isEditable() || !child.element || setUpChildren.has(child.element)) return;

        setUpChildren.add(child.element);

        Ren.AddStandingContextMenuItems(
            child.element,
            "container-child",
            () => getChildMenuItems(child)
        );
    };

    /**
     * Gets the child whose element is the given one, or undefined.
     */
    const getChildByElement = (element) => {

        const guid = Ren.HtmlUtils.getGuidClassName(element, "ren-visualisation-");

        return guid
            ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid)
            : undefined;
    };

    /**
     * Gets the innermost children element under the given point that accepts the dragged child,
     * leaving out the child's own (which it can't be dropped into).
     */
    const getDropTarget = (clientX, clientY) => {

        const elements = document.elementsFromPoint(clientX, clientY);

        for (let index = 0; index < elements.length; index++) {

            const childrenElement = elements[index]
                .closest("[" + Ren.VisualisationContainers.CHILDREN_ATTRIBUTE_NAME + "]");

            if (!childrenElement || drag.child.element.contains(childrenElement)) continue;

            const container = Ren.VisualisationContainers.getVisualisationById(
                childrenElement.getAttribute(Ren.VisualisationContainers.CHILDREN_ATTRIBUTE_NAME)
            );

            if (container && getChildType(container, drag.child.visualisationTypeName)) {

                const slot = childrenElement
                    .getAttribute(Ren.VisualisationContainers.SLOT_ATTRIBUTE_NAME) ?? "";

                return { container, slot, childrenElement };
            }
        }

        return null;
    };

    /**
     * Gets where the given element is laid out, leaving out the translation it is sliding by, so
     * that a child sliding under the pointer doesn't change where the dragged child goes.
     */
    const getLayoutRect = (element) => {

        const rect = element.getBoundingClientRect();
        const transform = getComputedStyle(element).transform;

        if (transform === "none") return rect;

        const matrix = new DOMMatrixReadOnly(transform);

        return new DOMRect(rect.x - matrix.m41, rect.y - matrix.m42, rect.width, rect.height);
    };

    /**
     * Gets the children shown in the given children element.
     */
    const getChildElements = (childrenElement) => Array.prototype.filter.call(
        childrenElement.children,
        element => element.hasAttribute("data-container-order")
    );

    /**
     * Moves the dragged child before the given element, sliding it and the children it moves
     * from where they were shown to where they now go.
     */
    const moveDraggedChild = (childrenElement, nextElement) => {

        const element = drag.child.element;
        const oldParent = element.parentElement;

        if (oldParent === childrenElement && element.nextElementSibling === nextElement) return;

        const elements = getChildElements(oldParent);

        if (childrenElement !== oldParent) {
            Array.prototype.push.apply(elements, getChildElements(childrenElement));
        }

        const oldRects = [];

        for (let index = 0; index < elements.length; index++) {
            oldRects.push(elements[index].getBoundingClientRect());
        }

        for (let index = 0; index < elements.length; index++) {

            elements[index].classList.remove(SHIFTING_CLASS_NAME);
            elements[index].style.transform = "";
        }

        childrenElement.insertBefore(element, nextElement);

        const shiftedElements = [];

        for (let index = 0; index < elements.length; index++) {

            const newRect = elements[index].getBoundingClientRect();
            const offsetX = oldRects[index].left - newRect.left;
            const offsetY = oldRects[index].top - newRect.top;

            if (offsetX === 0 && offsetY === 0) continue;

            elements[index].style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            shiftedElements.push(elements[index]);
        }

        // Makes the browser lay them out where they were shown, so their transitions start there.
        document.body.getBoundingClientRect();

        for (let index = 0; index < shiftedElements.length; index++) {

            shiftedElements[index].classList.add(SHIFTING_CLASS_NAME);
            shiftedElements[index].style.transform = "";
        }
    };

    /**
     * Gets where in the given children the dragged child goes, by the point's position against
     * the middle of each of the others.
     */
    const getDropIndex = (container, children, clientX, clientY) => {

        const isColumn = isColumnFlow(container);

        for (let index = 0; index < children.length; index++) {

            const rect = getLayoutRect(children[index].element);

            const isBefore = isColumn
                ? clientY < rect.top + rect.height / 2
                : clientY < rect.top || (clientY < rect.bottom && clientX < rect.left + rect.width / 2);

            if (isBefore) return index;
        }

        return children.length;
    };

    const setDropTargetElement = (childrenElement) => {

        if (drag.dropTargetElement === childrenElement) return;

        drag.dropTargetElement?.classList.remove(DROP_TARGET_CLASS_NAME);
        childrenElement?.classList.add(DROP_TARGET_CLASS_NAME);
        drag.dropTargetElement = childrenElement;
    };

    /**
     * Shows the dragged child where it would go if it were dropped now.
     */
    const updateDrag = (clientX, clientY) => {

        const dropTarget = getDropTarget(clientX, clientY);

        setDropTargetElement(dropTarget?.childrenElement ?? null);

        if (!dropTarget) return;

        const children = Ren.VisualisationContainers
            .getChildren(dropTarget.container, dropTarget.slot)
            .filter(child => child !== drag.child);

        const index = getDropIndex(dropTarget.container, children, clientX, clientY);
        const nextElement = index < children.length ? children[index].element : null;

        drag.target = {
            container: dropTarget.container,
            slot: dropTarget.slot,
            children,
            index
        };

        moveDraggedChild(dropTarget.childrenElement, nextElement);
    };

    const startDrag = (child) => {

        drag = {
            child,
            originalParent: child.element.parentElement,
            originalNextSibling: child.element.nextSibling,
            dropTargetElement: null,
            target: null,
            pageElement: child.element.closest(".js-ren-report-context") || document.body
        };

        child.element.classList.add(DRAGGING_CLASS_NAME);
        drag.pageElement.classList.add(PAGE_DRAGGING_CLASS_NAME);
    };

    const endDrag = (commit) => {

        const child = drag.child;
        const target = drag.target;

        child.element.classList.remove(DRAGGING_CLASS_NAME);
        drag.pageElement.classList.remove(PAGE_DRAGGING_CLASS_NAME);
        setDropTargetElement(null);

        if (commit && target) {

            const oldContainer = Ren.VisualisationContainers.getContainer(child);
            const oldSlot = Ren.VisualisationContainers.getChildSlot(child);

            target.children.splice(target.index, 0, child);
            setChildren(target.container, target.slot, target.children);

            if (oldContainer && (oldContainer !== target.container || oldSlot !== target.slot)) {

                setChildren(
                    oldContainer,
                    oldSlot,
                    Ren.VisualisationContainers.getChildren(oldContainer, oldSlot)
                );
            }
        }
        else {

            drag.originalParent.insertBefore(child.element, drag.originalNextSibling);
        }

        drag = null;
    };

    const cancelPendingHold = () => {

        if (!pendingHold) return;

        clearTimeout(pendingHold.timer);
        pendingHold = null;
    };

    /**
     * Swallows the click that follows dropping a child, so it isn't also a click on the child.
     */
    const suppressNextClick = () => {

        const suppress = (event) => {

            event.stopPropagation();
            event.preventDefault();
            document.removeEventListener("click", suppress, true);
        };

        document.addEventListener("click", suppress, true);

        setTimeout(() => document.removeEventListener("click", suppress, true), 0);
    };

    document.addEventListener("pointerdown", (event) => {

        if (event.button !== 0 || drag || !isEditable()) return;

        if (event.target.closest?.(INTERACTIVE_SELECTOR)) return;

        const childElement = event.target.closest?.("[data-container-order]");
        const child = childElement && getChildByElement(childElement);

        if (!child || !setUpChildren.has(childElement)) return;

        cancelPendingHold();

        pendingHold = {
            startX: event.clientX,
            startY: event.clientY,
            timer: setTimeout(() => {

                pendingHold = null;
                startDrag(child);
            }, HOLD_DURATION_MS)
        };
    });

    document.addEventListener("pointermove", (event) => {

        if (pendingHold) {

            const movedX = Math.abs(event.clientX - pendingHold.startX);
            const movedY = Math.abs(event.clientY - pendingHold.startY);

            if (movedX > HOLD_MOVE_TOLERANCE_PX || movedY > HOLD_MOVE_TOLERANCE_PX) {
                cancelPendingHold();
            }

            return;
        }

        if (!drag) return;

        event.preventDefault();
        updateDrag(event.clientX, event.clientY);
    });

    document.addEventListener("pointerup", () => {

        cancelPendingHold();

        if (!drag) return;

        endDrag(true);
        suppressNextClick();
    });

    document.addEventListener("pointercancel", () => {

        cancelPendingHold();

        if (drag) {
            endDrag(false);
        }
    });

    const endShifting = (event) => {

        if (event.propertyName === "transform") {
            event.target.classList.remove(SHIFTING_CLASS_NAME);
        }
    };

    document.addEventListener("transitionend", endShifting);
    document.addEventListener("transitioncancel", endShifting);

    // Stops the browser dragging a link or image itself, which would end the pointer's events.
    document.addEventListener("dragstart", (event) => {

        if (pendingHold || drag) {
            event.preventDefault();
        }
    });

    document.addEventListener("keydown", (event) => {

        if (event.key !== "Escape" || !drag) return;

        endDrag(false);
    });

    // A button released outside the window never reaches the document, so give up on the drag.
    window.addEventListener("blur", () => {

        cancelPendingHold();

        if (drag) {
            endDrag(false);
        }
    });

    return {
        placeChildBySettings,
        setUpChild,
        setUpContainer
    };
})();
