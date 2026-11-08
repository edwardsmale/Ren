/**
 * Filter Module: drag/drop reordering of the top-level items, through an invisible drag handle
 * spanning each item's top edge.  The items are reordered in the DOM as the pointer moves to show
 * where the dragged one would land, and the chosen order is held in visualisation.columnOrder.
 */
Ren.FilterModule_Reorder = (s) => {

    const { element, visualisation } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { itemSettings, view } = s;

    const ITEM_SELECTOR = ".ren-filter-module__item";

    // Read to tell whether a drag actually changed the order.
    let displayedKeys = [];

    let draggedElement = null;

    // Set by a drop, so the dragend that follows doesn't restore the old order.
    let dropped = false;

    // Reorders the items in place to match visualisation.columnOrder, then records the order.
    const orderReorderableItems = (items) => {

        const columnOrder = visualisation.columnOrder;

        if (columnOrder && columnOrder.length > 0) {

            const itemsByKey = {};
            for (let i = 0; i < items.length; i++) itemsByKey[items[i].key] = items[i];

            const ordered = [];
            const used = {};

            for (let i = 0; i < columnOrder.length; i++) {

                const item = itemsByKey[columnOrder[i]];
                if (!item || used[item.key]) continue;

                ordered.push(item);
                used[item.key] = true;
            }

            // Items not yet in the saved order keep their natural position.
            for (let i = 0; i < items.length; i++) {

                if (used[items[i].key]) continue;
                ordered.push(items[i]);
                used[items[i].key] = true;
            }

            items.length = 0;
            for (let i = 0; i < ordered.length; i++) items.push(ordered[i]);
        }

        displayedKeys = [];
        for (let i = 0; i < items.length; i++) displayedKeys.push(items[i].key);
    };

    // Moves a saved-order entry to another key, so an item a grouping action re-keys keeps its
    // place rather than falling to the end as an unrecognised new key.
    const retargetOrderKey = (fromKey, toKey) => {

        if (fromKey === toKey) return;

        const columnOrder = visualisation.columnOrder;
        if (!columnOrder || columnOrder.length === 0) return;

        const fromIndex = columnOrder.indexOf(fromKey);
        if (fromIndex < 0) return;

        // toKey takes over fromKey's slot, unless it already has one of its own.
        if (columnOrder.indexOf(toKey) < 0) {
            columnOrder[fromIndex] = toKey;
        }
        else {

            columnOrder.splice(fromIndex, 1);
        }
    };

    const findItemElement = (target) => {

        if (!target || !target.closest) return null;

        const itemElement = target.closest(ITEM_SELECTOR);
        return itemElement && element.contains(itemElement) ? itemElement : null;
    };

    // Runs a DOM reorder and animates the items that shifted, by the FLIP technique: capture, move,
    // then apply an inverse transform and let the CSS transition play it out.
    const animateReorder = (performMove) => {

        const before = element.querySelectorAll(ITEM_SELECTOR);
        const firstRects = new Map();

        for (let i = 0; i < before.length; i++) {
            firstRects.set(before[i], before[i].getBoundingClientRect());
        }

        performMove();

        const after = element.querySelectorAll(ITEM_SELECTOR);

        for (let i = 0; i < after.length; i++) {

            const itemElement = after[i];
            const first = firstRects.get(itemElement);
            if (!first) continue;

            const last = itemElement.getBoundingClientRect();
            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;

            if (deltaX === 0 && deltaY === 0) continue;

            itemElement.style.transition = "none";
            itemElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        }

        // Commits the pre-move positions, so the transition carries each item from there.
        element.offsetHeight;

        for (let i = 0; i < after.length; i++) {

            after[i].style.transition = "";
            after[i].style.transform = "";
        }
    };

    const moveDraggedTo = (targetElement, insertAfter) => {

        if (!draggedElement || targetElement === draggedElement) return;

        const referenceNode = insertAfter ? targetElement.nextElementSibling : targetElement;

        // Inserting before itself, or where it already sits, would change nothing.
        if (referenceNode === draggedElement) return;
        if (draggedElement.nextElementSibling === referenceNode) return;

        animateReorder(() => element.insertBefore(draggedElement, referenceNode));
    };

    const readOrderFromDom = () => {

        const items = element.querySelectorAll(ITEM_SELECTOR);
        const keys = [];

        for (let i = 0; i < items.length; i++) keys.push(items[i].dataset.reorderKey);
        return keys;
    };

    const orderMatchesDisplayed = (keys) => {

        if (keys.length !== displayedKeys.length) return false;

        for (let i = 0; i < keys.length; i++) {
            if (keys[i] !== displayedKeys[i]) return false;
        }

        return true;
    };

    const endDrag = () => {

        if (draggedElement) draggedElement._removeClass("ren-filter-module__item--dragging");

        draggedElement = null;
        element._removeClass("ren-filter-module--reordering");
    };

    const onDragStart = (event, itemElement) => {

        draggedElement = itemElement;
        dropped = false;

        // Dimmed, so it stays distinguishable as its neighbours shuffle around it.
        itemElement._addClass("ren-filter-module__item--dragging");

        event.dataTransfer.effectAllowed = "move";

        // Firefox requires some data to be set for the drag to proceed.
        event.dataTransfer.setData("text/plain", itemElement.dataset.reorderKey);

        // Suppresses the browser's drag ghost, so the in-place reordering is the only feedback.
        const ghost = document.createElement("div");
        ghost.style.cssText = "position:absolute;top:-9999px;left:-9999px";
        const ghostParent = itemElement.closest(".js-ren-report-context") || document.body;
        ghostParent.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => ghost.remove());

        element._addClass("ren-filter-module--reordering");
    };

    const onDragEnd = () => {

        // A drag ending without a drop leaves the preview order in the DOM.
        if (!dropped) view.render();
        endDrag();
    };

    const onContainerDragOver = (event) => {

        if (!draggedElement) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        const itemElement = findItemElement(event.target);
        if (!itemElement) return;

        // Items stacked into columns follow one another downwards rather than across.
        const rect = itemElement.getBoundingClientRect();
        const insertAfter = itemSettings.isColumnFlow()
            ? event.clientY > rect.top + rect.height / 2
            : event.clientX > rect.left + rect.width / 2;

        moveDraggedTo(itemElement, insertAfter);
    };

    const onContainerDrop = (event) => {

        if (!draggedElement) return;

        event.preventDefault();
        dropped = true;

        const keys = readOrderFromDom();

        if (!orderMatchesDisplayed(keys)) {

            visualisation.columnOrder = keys;
            view.render();
        }

        endDrag();
    };

    // Adds the invisible top-edge drag handle to an item and marks it a drop target.
    const decorateItemForReorder = (itemElement, key) => {

        itemElement.dataset.reorderKey = key;

        const handle = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__drag-handle", "qa-ren-filter-module-drag-handle")
            ._attr("title", "Drag to reorder");

        handle.draggable = true;

        handle.addEventListener("dragstart", (event) => onDragStart(event, itemElement));
        handle.addEventListener("dragend", onDragEnd);

        itemElement._append(handle);
    };

    // Wired once on the panel container, which persists across renders.
    element.addEventListener("dragover", onContainerDragOver);
    element.addEventListener("drop", onContainerDrop);

    return {
        orderReorderableItems,
        retargetOrderKey,
        decorateItemForReorder
    };
};
