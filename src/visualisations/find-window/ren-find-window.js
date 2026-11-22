/**
 * Creates the Find window, which searches the data grid the user is working in.  It broadcasts the
 * search on the message bus rather than holding a grid, so it survives tab switches and rebuilds.
 */
Ren.CreateFindWindow = (_tabularData, visualisation) => {

    // The window belongs to what the user is doing at the time, not to the report.
    visualisation.excludeFromSerialization = true;
    visualisation.isTransitive = true;

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-find-window")
        ._append(Ren.HtmlTemplateFunctions.reifyHtmlTemplate("FindWindow", {}));

    const input = element.querySelector(".js-ren-find-window-input");
    const findNextButton = element.querySelector(".js-ren-find-window-find-next-button");
    const selectRowsButton = element.querySelector(".js-ren-find-window-select-rows-button");
    const copyRowsButton = element.querySelector(".js-ren-find-window-copy-rows-button");
    const filterRowsButton = element.querySelector(".js-ren-find-window-filter-rows-button");
    const filterRowsClearButton = element.querySelector(".js-ren-find-window-filter-rows-clear-button");
    const startFromTopButton = element.querySelector(".js-ren-find-window-start-from-top-button");
    const columnsTextElement = element.querySelector(".js-ren-find-window-columns-text");
    const columnsClearButton = element.querySelector(".js-ren-find-window-columns-clear-button");
    const matchCaseCheckbox = element.querySelector(".js-ren-find-window-match-case");
    const matchWholeCellCheckbox = element.querySelector(".js-ren-find-window-match-whole-cell");
    const statusElement = element.querySelector(".js-ren-find-window-status");

    // Remembered from the last whole-column selection, as finding a cell replaces that selection.
    let restrictedColumnIndexes = null;
    let restrictedColumnHeadings = null;

    let isFindFromTop = false;

    const getActiveCellSelection = () => Ren.ActiveDataGrid.getActiveDataGrid()?.cellSelection ?? null;

    const showColumnsRestriction = () => {

        const isRestricted = !!restrictedColumnIndexes;

        columnsTextElement.textContent = isRestricted
            ? "In: " + restrictedColumnHeadings.join(", ")
            : "In: all columns";

        element.classList.toggle("ren-find-window--restricted-to-columns", isRestricted);
    };

    /**
     * Restricts the search to any whole columns selected.  Any other selection leaves the
     * restriction as it is, so that finding a cell does not undo it.
     */
    const noteAnyColumnSelection = () => {

        const cellSelection = getActiveCellSelection();

        if (!cellSelection || cellSelection.selectionType() !== "column") return;

        const columnIndexes = cellSelection.getSelectedColumnIndexes();

        if (!columnIndexes.length) return;

        restrictedColumnIndexes = columnIndexes;
        restrictedColumnHeadings = cellSelection.getSelectedColumnIdsOrHeadings();

        showColumnsRestriction();
    };

    const clearColumnsRestriction = () => {

        restrictedColumnIndexes = null;
        restrictedColumnHeadings = null;

        showColumnsRestriction();
    };

    const showStatus = (text, isFailure) => {

        statusElement.textContent = text;
        statusElement.classList.toggle("ren-find-window__status--failure", !!isFailure);
    };

    const showFindFromTop = (isFromTop) => {

        isFindFromTop = isFromTop;

        element.classList.toggle("ren-find-window--find-from-top", isFromTop);
    };

    const findNext = () => {

        const searchText = input.value;

        if (!searchText) return;

        showStatus("");

        const fromTop = isFindFromTop;

        // So that clicking again carries on from the found cell rather than restarting at the top.
        showFindFromTop(false);

        Ren.Messages.Requests.dataGridFindNext.notify(
            searchText,
            restrictedColumnIndexes,
            matchCaseCheckbox.checked,
            matchWholeCellCheckbox.checked,
            fromTop
        );
    };

    /**
     * Asks the datagrid to select every row that has a cell matching the search text.
     *
     * @param {boolean} copyRows Whether the rows selected are also copied to the clipboard.
     */
    const selectRows = (copyRows) => {

        const searchText = input.value;

        if (!searchText) return;

        showStatus("");

        Ren.Messages.Requests.dataGridSelectRowsWithText.notify(
            searchText,
            restrictedColumnIndexes,
            matchCaseCheckbox.checked,
            matchWholeCellCheckbox.checked,
            copyRows
        );
    };

    /**
     * Asks the datagrid to filter itself down to the rows that have a cell matching the search
     * text, on top of its existing filters.
     */
    const filterRows = () => {

        const searchText = input.value;

        if (!searchText) return;

        showStatus("");

        Ren.Messages.Requests.dataGridFilterRowsWithText.notify(
            searchText,
            restrictedColumnIndexes,
            matchCaseCheckbox.checked,
            matchWholeCellCheckbox.checked
        );
    };

    findNextButton.addEventListener("click", () => {

        findNext();
    });

    selectRowsButton.addEventListener("click", () => {

        selectRows(false);
    });

    copyRowsButton.addEventListener("click", () => {

        selectRows(true);
    });

    filterRowsButton.addEventListener("click", () => {

        filterRows();
    });

    filterRowsClearButton.addEventListener("click", () => {

        showStatus("");

        Ren.Messages.Requests.dataGridClearFilterRows.notify();
    });

    startFromTopButton.addEventListener("click", () => {

        showFindFromTop(true);
        input.focus();
    });

    columnsClearButton.addEventListener("click", () => {

        clearColumnsRestriction();
        input.focus();
    });

    input.addEventListener("keydown", (e) => {

        if (e.key !== "Enter") return;

        e.preventDefault();
        findNext();
    });

    // Listened for on the window rather than the page, so the keys only act while working in it.
    const accessKeyCheckboxes = {
        c: matchCaseCheckbox,
        e: matchWholeCellCheckbox
    };

    element.addEventListener("keydown", (e) => {

        if (!e.altKey || e.ctrlKey || e.shiftKey) return;

        const checkbox = accessKeyCheckboxes[e.key.toLowerCase()];

        if (!checkbox) return;

        e.preventDefault();
        checkbox.click();
    });

    input.addEventListener("input", () => {

        showStatus("");
    });

    Ren.Messages.Events.dataGridFindCompleted.handle((_dataGridGuid, found) => {

        if (visualisation.isDestroyed) return false;

        showStatus(found ? "" : "No cell found containing that text.", !found);
    });

    Ren.Messages.Events.dataGridSelectRowsCompleted.handle((_dataGridGuid, rowCount, wasCopied) => {

        if (visualisation.isDestroyed) return false;

        if (!rowCount) {

            showStatus("No rows found containing that text.", true);
            return;
        }

        const what = wasCopied ? " copied." : " selected.";

        showStatus(rowCount === 1 ? "1 row" + what : rowCount + " rows" + what);
    });

    Ren.Messages.Events.dataGridFilterRowsCompleted.handle((_dataGridGuid, rowCount) => {

        if (visualisation.isDestroyed) return false;

        if (!rowCount) {

            showStatus("No rows found containing that text.", true);
            return;
        }

        element.classList.add("ren-find-window--filter-rows-active");

        showStatus(rowCount === 1 ? "Filtered to 1 row." : "Filtered to " + rowCount + " rows.");
    });

    Ren.Messages.Events.dataGridClearFilterRowsCompleted.handle(() => {

        if (visualisation.isDestroyed) return false;

        element.classList.remove("ren-find-window--filter-rows-active");

        showStatus("");
    });

    Ren.Messages.Events.selectedValuesChanged.handle(() => {

        if (visualisation.isDestroyed) return false;

        noteAnyColumnSelection();
    });

    noteAnyColumnSelection();
    showColumnsRestriction();

    Ren.FnUtils.defer(() => {

        input.focus();
        input.select();
    });

    return {
        element
    };
};
