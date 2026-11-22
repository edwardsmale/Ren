/**
 * Sets up the 'show row and column headings' checkbox in the datagrid/gridset settings window.
 */
Ren.GridStateEditWindow_ShowRowAndColumnHeadingsCheckbox = (visualisation) => {

    const checkbox = Ren.HtmlUtils.create("input")
        ._attr("type", "checkbox");

    const setValue = (showRowAndColumnHeadings) => {

        visualisation.showRowAndColumnHeadings = showRowAndColumnHeadings;
        visualisation.recreate();
    };

    const updateCheckbox = () => {

        checkbox.checked = visualisation.showRowAndColumnHeadings;
    };

    const renderShowRowAndColumnHeadingsCheckbox = (container) => {

        const div = Ren.HtmlUtils.create("div")
            ._append(Ren.HtmlUtils.create("label")
                ._append(checkbox, Ren.HtmlUtils.create("span")
                    ._text("Show Row and Column Headings")
                    ._style("user-select", "none")
                )
            );

        container.appendChild(div);

        updateCheckbox();

        checkbox.addEventListener("change", () => {

            setValue(checkbox.checked);
        });
    };

    return {
        renderShowRowAndColumnHeadingsCheckbox
    };
};
