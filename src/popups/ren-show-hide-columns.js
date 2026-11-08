/**
 * Displays a popup window allowing users to show, hide, and reorder columns in a data grid.
 */
Ren.ShowShowHideColumnsWindow = (
    tabularData,
    gridState,
    setDataGridColumnVisibility,
    triggeringElement,
    scope) => {

    const listItemClass = "ren-show-hide-columns-window__column-list-item";
    const visibleItemClass = "ren-show-hide-columns-window__column-list-item--visible";
    const draggingItemClass = "ren-show-hide-columns-window__column-list-item--dragging";

    // Where a subheading row is shown, each measure is listed as its heading and subheading
    // combined, e.g. "Weekly Searches".  Only the first of the measures beneath a ---Horizontal
    // value carries a heading, so for the rest fall back to the column's ID (which combines the
    // horizontal value with the measure name) and then to the subheading on its own.
    const getColumnLabel = (columnModel) => {

        if (tabularData.HasSubheadings && columnModel.Subheading) {

            return columnModel.Heading
                ? columnModel.Heading + " " + columnModel.Subheading
                : columnModel.ColumnIdOrHeading ?? columnModel.Subheading;
        }

        return columnModel.Heading ?? columnModel.ColumnIdOrHeading ?? "";
    };

    let columnInfo = tabularData.ColumnModels.map((columnModel, columnIndex) => {

        return {
            columnIndex: columnIndex,
            heading: getColumnLabel(columnModel),
            type: columnModel.ColumnType
        };
    });

    if (!scope) {

        columnInfo = columnInfo.filter(c => !c.heading.includes("__"));
    }
    else {

        columnInfo = columnInfo.filter(c => c.heading.startsWith(scope + "__"));
        columnInfo.forEach(c => c.heading = c.heading.replace(scope + "__", ""));
    }

    // The column order holds the display order of the visible and the hidden columns alike.  A
    // column it does not name is an auto-column such as __Count, which is listed before the columns
    // the user has arranged, in the order the data source gives them.
    const compareToDisplayOrder = (columnOrder) => (a, b) => {

        const aPosition = columnOrder.indexOf(a.columnIndex);
        const bPosition = columnOrder.indexOf(b.columnIndex);

        if (aPosition !== -1 && bPosition !== -1) return aPosition - bPosition;
        if (aPosition === -1 && bPosition === -1) return a.columnIndex - b.columnIndex;

        return aPosition === -1 ? -1 : 1;
    };

    const sortColumnInfoToDisplayOrder = () => {

        const columnOrder = gridState.columnOrder;

        if (columnOrder && columnOrder.length > 0) {

            columnInfo.sort(compareToDisplayOrder(columnOrder));
        }
    };

    sortColumnInfoToDisplayOrder();

    let content = null;
    let draggedItem = null;
    let draggedIndex = null;
    let originalIndex = null;

    const isVisible = (columnIndex) => gridState.isColumnVisible(columnIndex);

    const toggleColumnVisibility = (columnIndex) => {

        setDataGridColumnVisibility(columnIndex, !isVisible(columnIndex));
        Ren.Messages.Events.columnVisibilityChanged.notify();
    };

    const reorderColumnInfo = (fromIndex, toIndex) => {

        if (fromIndex === toIndex) return;

        const [movedItem] = columnInfo.splice(fromIndex, 1);
        columnInfo.splice(toIndex, 0, movedItem);
    };

    const getListItems = () => Array.from(content.querySelectorAll("." + listItemClass));

    const mapListItemsByColumnIndex = (items) => {

        const itemsByColumnIndex = {};

        for (let i = 0; i < items.length; i++) {

            itemsByColumnIndex[items[i].dataset.columnIndex] = items[i];
        }

        return itemsByColumnIndex;
    };

    // Appending an item that is already in the list moves it to the end, so appending them in the
    // order columnInfo now holds leaves the list in that order.
    const appendItemsInColumnInfoOrder = (itemsByColumnIndex, renumberItems) => {

        columnInfo.forEach((column, index) => {

            const item = itemsByColumnIndex[column.columnIndex];

            if (item) {

                if (renumberItems) item.dataset.index = index;
                content.appendChild(item);
            }
        });
    };

    const animateListIntoColumnInfoOrder = (renumberItems) => {

        const items = getListItems();
        const itemsByColumnIndex = mapListItemsByColumnIndex(items);

        Ren.FlipReorderAnimation.animateReorder(items, () => {

            appendItemsInColumnInfoOrder(itemsByColumnIndex, renumberItems);
        });

        return items;
    };

    const updateListItemOrder = () => animateListIntoColumnInfoOrder(false);

    const showItemAsVisibleOrHidden = (item) => {

        const checkbox = item.querySelector("input[type='checkbox']");

        if (isVisible(item.dataset.columnIndex)) {

            item._addClass(visibleItemClass);
            checkbox._attr("checked", "checked");
        }
        else {

            item._removeClass(visibleItemClass);
            checkbox.removeAttribute("checked");
        }
    };

    const updateGridStateColumnOrder = () => {

        gridState.setColumnOrder(columnInfo.map(col => col.columnIndex));

        // Notify gridStateChanged so the grid state applyer syncs the change across all grids.
        Ren.Messages.Events.gridStateChanged.notify(gridState);
    };

    const buildAllListItems = () => {

        if (content) content.innerHTML = "";

        columnInfo.forEach((columnData, index) => {

            const classNames = `${listItemClass} ` +
                `qa-ren-show-hide-columns-list-item--${columnData.heading.replace(/\s+/g, "")} ` +
                (isVisible(columnData.columnIndex) ? visibleItemClass : "");

            content.appendChild(createListItem(columnData, index, classNames));
        });
    };

    const update = () => {

        sortColumnInfoToDisplayOrder();

        if (!content || content.children.length === 0) {

            buildAllListItems();
            return;
        }

        const items = animateListIntoColumnInfoOrder(true);

        for (let i = 0; i < items.length; i++) {

            showItemAsVisibleOrHidden(items[i]);
        }
    };

    /**
     * Drags a list item up or down the list, reordering the columns as it passes each of them.
     */
    const startDraggingListItem = (listItem, mouseDownEvent) => {

        draggedItem = listItem;

        // The item's own data-index is read rather than the one it was created with, since the list
        // may have been reordered since.
        originalIndex = parseInt(listItem.dataset.index, 10);
        draggedIndex = originalIndex;
        listItem._addClass(draggingItemClass);

        const startY = mouseDownEvent.clientY;

        // The rows are all of a height and the drag doesn't change it, so it is measured once here
        // rather than on every mouse move - where reading it would force a layout, the move having
        // just reordered the list.
        const itemHeight = listItem.offsetHeight;

        const handleMouseMove = (moveEvent) => {

            const itemsMoved = Math.round((moveEvent.clientY - startY) / itemHeight);

            const newIndex = Math.max(
                0,
                Math.min(columnInfo.length - 1, originalIndex + itemsMoved)
            );

            if (newIndex !== draggedIndex) {

                reorderColumnInfo(draggedIndex, newIndex);
                draggedIndex = newIndex;
                updateListItemOrder();
            }
        };

        const handleMouseUp = () => {

            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);

            if (draggedItem) draggedItem._removeClass(draggingItemClass);

            if (originalIndex !== draggedIndex) updateGridStateColumnOrder();

            draggedItem = null;
            draggedIndex = null;
            originalIndex = null;
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    /**
     * Creates a list item element for a column in the show/hide columns window.
     */
    const createListItem = (columnData, index, classNames) => {

        const listItem = Ren.HtmlUtils.create("li", { class: classNames });
        listItem.dataset.index = index;
        listItem.dataset.columnIndex = columnData.columnIndex;

        const dragHandle = Ren.HtmlUtils.create("span")
            ._addClass("ren-show-hide-columns-window__drag-handle")
            ._attr("title", "Drag to reorder columns")
            ._text("⋮⋮⋮");

        const checkbox = Ren.HtmlUtils.create("input")
            ._attr("type", "checkbox");

        if (isVisible(columnData.columnIndex)) {
            checkbox._attr("checked", "checked");
        }

        const label = document.createTextNode(` ${columnData.heading}`);

        listItem.appendChild(checkbox);
        listItem.appendChild(label);
        listItem.appendChild(dragHandle);

        dragHandle.addEventListener("mousedown", (e) => {

            if (e.which === 3) return; // Ignore right-clicks.
            e.preventDefault();

            startDraggingListItem(listItem, e);
        });

        listItem.addEventListener("mousedown", (e) => {

            if (e.target === dragHandle) return;

            if (e.which === 3) return; // Ignore right-clicks.
            e.stopPropagation();

            toggleColumnVisibility(columnData.columnIndex);
        });

        checkbox.addEventListener("change", () => {

            toggleColumnVisibility(columnData.columnIndex);
        });

        return listItem;
    };

    const renderContent = (contentContainer) => {

        content = document.createElement("ul");
        content.classList.add("ren-show-hide-columns-window__column-list");

        Ren.HtmlUtils.setHTML(contentContainer, content);

        // Registered from here rather than up front so that they are tagged with the window's
        // content owner, and go when the window closes.  Left on the bus they would redraw a list
        // that is no longer on screen, pinning it, the grid state and the tabular data behind it.
        Ren.Messages.Events.columnVisibilityChanged.handle(update);
        Ren.Messages.Events.columnsMoved.handle(update);

        update();
    };

    // Calculate position relative to the document, not the viewport
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const triggerRect = triggeringElement.getBoundingClientRect();
    const leftPos = triggerRect.left + scrollLeft + 40;
    const topPos = triggerRect.top + scrollTop + 60;

    Ren.ClosePopupWindows(".ren-show-hide-columns-window"); // Close any existing window.

    Ren.PopupWindow(
        "ren-show-hide-columns-window qa-ren-show-hide-columns-window",
        renderContent,
        "Columns",
        {
            leftPos,
            topPos,
            autoSized: true,
            verticalScrollbar: true,
            horizontalScrollbar: false,
            initialMaxHeight: 400 // px
        }
    );
};
