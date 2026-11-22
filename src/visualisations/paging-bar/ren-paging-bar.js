/**
 * Creates a datagrid's paging bar, which moves between the pages of the second-to-last grouping's
 * groups (or data rows, without groupings) and sets how many are shown per page.
 */
Ren.CreatePagingBar = (_tabularData, visualisation) => {

    const dataGrid = visualisation.sourceVisualisation;
    const gridSetVisualisation = visualisation.gridSetVisualisation;
    const paging = dataGrid.dataGroupingSettings.paging;

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-paging-bar");

    const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("PagingBar", {});

    element.appendChild(content);

    const firstButton = content.querySelector(".js-ren-paging-bar-first");
    const previousButton = content.querySelector(".js-ren-paging-bar-previous");
    const nextButton = content.querySelector(".js-ren-paging-bar-next");
    const lastButton = content.querySelector(".js-ren-paging-bar-last");
    const pageText = content.querySelector(".js-ren-paging-bar-page");
    const pageSizeSelect = content.querySelector(".js-ren-paging-bar-page-size");

    const customOptionValue = "custom";

    const createOption = (text, value) => {

        return Ren.HtmlUtils.create("option")
            ._set("value", value)
            ._set("text", text);
    };

    const populatePageSizes = () => {

        const pageSize = paging.pageSize;
        const pageSizes = Ren.DataGridPaging.pageSizes.slice();

        // A page size set in markup or settings is offered even when it isn't a standard one.
        if (pageSize && !pageSizes.includes(pageSize)) {

            pageSizes.push(pageSize);
            pageSizes.sort((a, b) => a - b);
        }

        pageSizeSelect.innerHTML = "";

        for (let i = 0; i < pageSizes.length; i++) {
            pageSizeSelect.appendChild(createOption(String(pageSizes[i]), String(pageSizes[i])));
        }

        pageSizeSelect.appendChild(createOption("Other", customOptionValue));

        pageSizeSelect.value = String(pageSize);
    };

    const update = () => {

        if (visualisation.isDestroyed) return;

        const pageIndex = paging.pageIndex;
        const pageCount = paging.pageCount;

        pageText.textContent = `Page ${pageIndex + 1} of ${pageCount}`;

        firstButton.disabled = pageIndex === 0;
        previousButton.disabled = pageIndex === 0;
        nextButton.disabled = pageIndex >= pageCount - 1;
        lastButton.disabled = pageIndex >= pageCount - 1;

        if (paging.pageSize !== null && pageSizeSelect.value !== String(paging.pageSize)) {
            populatePageSizes();
        }
    };

    const goToPage = (pageIndex) => {

        const clampedPageIndex = Ren.NumberUtils.clamp(pageIndex, 0, paging.pageCount - 1);

        if (clampedPageIndex === paging.pageIndex) return;

        dataGrid.setPageIndex(clampedPageIndex);
    };

    const goToFirstPage = () => goToPage(0);
    const goToPreviousPage = () => goToPage(paging.pageIndex - 1);
    const goToNextPage = () => goToPage(paging.pageIndex + 1);
    const goToLastPage = () => goToPage(paging.pageCount - 1);

    // A right-click does the opposite, e.g. next goes back a page.
    const addPageButton = (button, onClick, onRightClick) => {

        button.addEventListener("click", onClick);

        Ren.SuppressContextMenu(button);

        button.addEventListener("contextmenu", (e) => {

            if (e.ctrlKey) return;

            e.preventDefault();
            onRightClick();
        });
    };

    addPageButton(firstButton, goToFirstPage, goToLastPage);
    addPageButton(previousButton, goToPreviousPage, goToNextPage);
    addPageButton(nextButton, goToNextPage, goToPreviousPage);
    addPageButton(lastButton, goToLastPage, goToFirstPage);

    pageSizeSelect.addEventListener("change", () => {

        const value = pageSizeSelect.value;

        if (value === customOptionValue) {

            // Back to the current size, so that choosing Custom...  again fires another change.
            pageSizeSelect.value = String(paging.pageSize);

            const rect = pageSizeSelect.getBoundingClientRect();

            Ren.DataGridPaging.openCustomPageSizePopup(gridSetVisualisation, {
                x: rect.left + rect.width / 2 + window.scrollX,
                y: rect.top + rect.height / 2 + window.scrollY
            });
        }
        else {

            Ren.DataGridPaging.setPageSize(gridSetVisualisation, parseInt(value, 10));
        }
    });

    dataGrid.dataGroupingSettings.sortFilterGroup.onChanged(() => {

        update();
    });

    Ren.AddContextMenuItems(
        element,
        () => Ren.ContextMenuItems_PagingBar(dataGrid, gridSetVisualisation).getMenuItems()
    );

    populatePageSizes();
    update();

    return {
        element,
        update
    };
};
