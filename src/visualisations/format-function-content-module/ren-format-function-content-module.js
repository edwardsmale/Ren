/**
 * A visualisation module that applies a format function to each row of data and renders the
 * result as HTML.  The rows, keyed by heading, may be given in place of the tabular data, by a
 * visualisation that makes its own.
 */
Ren.CreateFormatFunctionContentModule = (tabularData, visualisation, rows) => {

    const data = rows ?? Ren.TabularDataAdapter_Array.getDataArray(
        tabularData,
        visualisation,
        null,
        false,
        false,
        undefined,
        undefined,
        true // Key values by heading too, so format functions can read columns that carry a
             // ColumnId.
    );

    const module = document.createElement("div");
    module.classList.add("ren-format-function-content-module");

    if (visualisation.moduleCssClass) {

        const split = visualisation.moduleCssClass.split(" ");
        split.forEach((cssClass) => {

            module.classList.add(cssClass);
        });
    }

    const formatFunction = Ren.ArrayUtils.ensureArray(Ren.FormatFunctions.createFunction(
        { name: visualisation.formatFunction },
        Ren.ReportInputParameters.getInputParameters(visualisation.containingReport)
    ));

    const results = [];

    for (let i = 0; i < data.length; i++) {

        const row = data[i];

        results.push(Ren.ValueFormatter.formatValue(
            "",
            Object.keys(row).length,
            Ren.SpreadsheetColumnFormatEnum.General,
            formatFunction,
            row
        ));
    }

    const n = visualisation.collapsedRowCount;
    const useShowMore = n && data.length > n * 2;

    if (useShowMore) {

        const hiddenCount = data.length - n * 2;
        const firstHtml = results.slice(0, n).join("");
        const middleHtml = results.slice(n, data.length - n).join("");
        const lastHtml = results.slice(data.length - n).join("");

        Ren.HtmlUtils.setHTML(module,
            firstHtml +
            `<div class="ren-format-function-content-module__show-more">` +
                `<div class="ren-format-function-content-module__show-more-arrow ren-format-function-content-module__show-more-arrow--up">&#9650;</div>` +
                `<a class="ren-format-function-content-module__show-more-link" href="javascript:void(0)">${hiddenCount} more</a>` +
                `<div class="ren-format-function-content-module__show-more-arrow ren-format-function-content-module__show-more-arrow--down">&#9660;</div>` +
            `</div>` +
            `<div class="ren-format-function-content-module__hidden-rows" style="display: none">${middleHtml}</div>` +
            lastHtml
        );

        const showMore = module.querySelector(".ren-format-function-content-module__show-more");
        const hiddenRows = module.querySelector(".ren-format-function-content-module__hidden-rows");

        module.querySelector(".ren-format-function-content-module__show-more-link")
            .addEventListener("click", (e) => {

                e.preventDefault();
                hiddenRows.style.display = "contents";
                showMore.style.display = "none";
            });

    }
    else {

        Ren.HtmlUtils.setHTML(module, results.join(""));
    }

    // Collapsing counts the module's laid-out rows, so it only makes sense for a grid whose
    // children are all cards - not one already broken up by the show-more markup above.
    if (visualisation.collapsedGridRowCount && !useShowMore) {

        Ren.GridRowCollapser.apply(module, visualisation.collapsedGridRowCount);
    }

    if (visualisation.maxHeight && !visualisation.fillAvailableSpace) {

        module.style.maxHeight = visualisation.maxHeight;
        module.style.overflowY = "auto";
    }

    if (visualisation.initialMaxHeight) {

        module.dataset.initialMaxHeight = visualisation.initialMaxHeight;
    }

    Ren.FnUtils.defer(() => {

        Ren.PopupReports.setupPopupReports();
    });

    return {
        element: module
    };
};
