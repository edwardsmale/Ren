/**
 * Creates div elements for the different sections of the datagrid, e.g. the frozen top section,
 * the frozen left section and the main section.
 */
Ren.DataGridSections = (gridState, viewport, className) => {

    const dataGrid = document.createElement("data-grid");
    dataGrid.style.display = "block";
    dataGrid.className = className;
    viewport.appendChild(dataGrid);

    // The section of the datagrid that is not frozen, and scrolls normally.
    const dataGridMainSection = document.createElement("div");
    dataGridMainSection.className = "ren-data-grid";
    dataGrid.appendChild(dataGridMainSection);

    // The very top-left corner, above the row headings and left of the column headings.
    const dataGridHeadingCorner = document.createElement("div");
    dataGridHeadingCorner.className = "ren-data-grid__heading-corner js-ren-heading-corner qa-ren-heading-corner";
    dataGridHeadingCorner.style.width = gridState.rowHeadingWidth + "px";
    dataGrid.appendChild(dataGridHeadingCorner);

    // The frozen section at the top left.  This never scrolls.
    const frozenTopLeftSection = document.createElement("div");
    frozenTopLeftSection.className = "ren-data-grid__frozen-top-left-section";
    dataGrid.appendChild(frozenTopLeftSection);

    // The frozen section at the top.  Scrolls horizontally but not vertically.
    const frozenTopSection_Viewport = document.createElement("div");
    frozenTopSection_Viewport.className = "ren-data-grid__frozen-top-section-viewport";
    const frozenTopSection = document.createElement("div");
    frozenTopSection.className = "ren-data-grid__frozen-top-section";
    frozenTopSection_Viewport.appendChild(frozenTopSection);
    dataGrid.appendChild(frozenTopSection_Viewport);

    // The frozen section on the left.  Scrolls vertically but not horizontally.
    const frozenLeftSection_Viewport = document.createElement("div");
    frozenLeftSection_Viewport.className = "ren-data-grid__frozen-left-section-viewport";
    const frozenLeftSection = document.createElement("div");
    frozenLeftSection.className = "ren-data-grid__frozen-left-section";
    frozenLeftSection_Viewport.appendChild(frozenLeftSection);
    dataGrid.appendChild(frozenLeftSection_Viewport);

    Ren.Messages.Events.dragStarted.handle(() => {

        dataGrid.style.userSelect = "none";
        dataGrid.style.pointerEvents = "none";
    });

    Ren.Messages.Events.dragEnded.handle(() => {

        dataGrid.style.userSelect = "auto";
        dataGrid.style.pointerEvents = "auto";
    });

    const show = () => dataGrid.style.display = "block";

    const resizeFrozenSectionsToMatchViewport = () => {

        frozenLeftSection_Viewport.style.height = (viewport.clientHeight) + "px";
        frozenTopSection_Viewport.style.width = viewport.clientWidth + "px";
    };

    return {
        dataGrid,
        dataGridMainSection,
        frozenTopLeftSection,
        frozenTopSection,
        frozenTopSection_Viewport,
        frozenLeftSection,
        frozenLeftSection_Viewport,
        resizeFrozenSectionsToMatchViewport,
        show
    };
};
