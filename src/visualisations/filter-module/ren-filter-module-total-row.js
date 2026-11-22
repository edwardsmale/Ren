/**
 * Filter Module: the totals row shown beneath an item's values - a caption with the aggregated
 * figure pushed to the right.  Shared by the flat and hierarchy views, so the two cannot drift
 * apart and stop looking like the same row.
 */
Ren.FilterModule_TotalRow = (s) => {

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { columnInfo } = s;

    const buildTotalRow = (label, formattedTotal, totalTitle) => {

        const totalRow = Ren.HtmlUtils.create("div")._addClass("ren-filter-module__total-row");

        totalRow._append(
            Ren.HtmlUtils.create("span")
                ._addClass("ren-filter-module__total-label")
                ._textContent(label)
                ._attr("title", totalTitle)
        );

        const totalValueElement = Ren.HtmlUtils.create("span")
            ._addClass("ren-filter-module__total-value")
            ._attr("title", totalTitle);

        columnInfo.setFormattedText(totalValueElement, `${formattedTotal}`);

        totalRow._append(totalValueElement);

        return totalRow;
    };

    return {
        buildTotalRow
    };
};
