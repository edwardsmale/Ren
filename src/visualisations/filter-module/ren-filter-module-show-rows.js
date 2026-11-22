/**
 * Filter Module: "Show rows" on an option, which opens a popup grid of the rows that have the
 * option's value and that the page's other filters let through, as the date/value chart's "Show
 * rows" does for a data point (see Ren.DateValueChart_DataPointGrid).
 */
Ren.FilterModule_ShowRows = (s) => {

    const { tabularData, visualisation, sourceGroup } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { binning, columnInfo, filtering, filterTarget } = s;

    const DataPointGrid = Ren.DateValueChart_DataPointGrid;

    /**
     * Gets a value indicating whether a flat item's option can be read as a statement about rows.
     * On a grouping level only an unbinned group-by column's can, as every other column holds an
     * aggregated figure or a bin no row holds.
     */
    const canShowOptionRows = (item) => {

        if (!filterTarget.isGroupingTarget) return true;

        const grouping = filterTarget.getTargetGrouping();

        return !!grouping
            && !binning.hasBinning(item.columnIdOrHeading)
            && Ren.DataGroupingSettings_Services_FilterAccessors
                .isRowFilterableGroupByColumn(grouping, tabularData, item.columnIdOrHeading);
    };

    // Gets the page's filters other than the item's own selection, as the item's counts read them.
    const getCrossFilter = (ownColumnIds, ownCombinationKey) =>
        filtering.buildCrossFilterSetExcludingColumns(ownColumnIds, ownCombinationKey)
            ?? { columnValueFilters: {}, predicates: [] };

    const showRows = (crossFilter, title) => {

        DataPointGrid.showRowsGrid(
            visualisation,
            tabularData,
            DataPointGrid.createFilters(crossFilter.columnValueFilters, crossFilter.predicates),
            title,
            DataPointGrid.getAssociatedDataGrid(visualisation, tabularData, sourceGroup)
        );
    };

    const showOptionRows = (item, option, optionTextElement) => {

        const columnIdOrHeading = item.columnIdOrHeading;
        const isBinnedByPredicate = binning.filtersByPredicate(columnIdOrHeading);

        const crossFilter = getCrossFilter(
            [columnIdOrHeading],
            isBinnedByPredicate
                ? filtering.columnsKeyOf(binning.getBinnedChain(columnIdOrHeading))
                : null
        );

        if (isBinnedByPredicate) {

            crossFilter.predicates.push(
                filtering.buildBinnedIncludePredicate(columnIdOrHeading, [option.value])
            );
        }
        else {

            // Intersected with any filter a grouping level holds on the same column.
            const existingValues = crossFilter.columnValueFilters[columnIdOrHeading];
            const isLetThrough = !Array.isArray(existingValues)
                || existingValues.some(value => String(value) === String(option.value));

            crossFilter.columnValueFilters[columnIdOrHeading] = isLetThrough ? [option.value] : [];
        }

        showRows(
            crossFilter,
            columnInfo.resolveHeading(item) + ": " + optionTextElement.textContent
        );
    };

    const showNodeRows = (node, hierarchyColumns, optionTextElement) => {

        const chain = columnInfo.chainOf(hierarchyColumns);

        const crossFilter = getCrossFilter(
            hierarchyColumns.map((column) => columnInfo.getDataColumnId(column)),
            filtering.columnsKeyOf(chain)
        );

        // A node's tuple key stops at its own level, so standing for every combination under it.
        crossFilter.predicates.push(filtering.buildCombinationsPredicate(
            chain,
            { keys: new Set([node.tupleKey]), isPositive: true }
        ));

        let level = hierarchyColumns[0];

        for (let index = 0; index < hierarchyColumns.length; index++) {

            if (hierarchyColumns[index].columnIdOrHeading === node.columnIdOrHeading) {
                level = hierarchyColumns[index];
            }
        }

        showRows(
            crossFilter,
            columnInfo.resolveHeading(level) + ": " + optionTextElement.textContent
        );
    };

    /**
     * Gets the "Show rows" menu item of a flat item's option.
     */
    const getOptionMenuItem = (item, option, optionTextElement) => ({
        text: "Show rows",
        id: "filter-module-show-rows",
        visible: () => canShowOptionRows(item),
        action: () => showOptionRows(item, option, optionTextElement)
    });

    /**
     * Gets the "Show rows" menu item of a hierarchy's node.  A hierarchy only ever filters data
     * rows, so it is offered only where the module does.
     */
    const getNodeMenuItem = (node, hierarchyColumns, optionTextElement) => ({
        text: "Show rows",
        id: "filter-module-show-rows",
        visible: () => filterTarget.supportsRowPredicates,
        action: () => showNodeRows(node, hierarchyColumns, optionTextElement)
    });

    return {
        getOptionMenuItem,
        getNodeMenuItem
    };
};
