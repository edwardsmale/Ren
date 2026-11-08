/**
 * With enableCrossFiltering on, clicking a bar, line or slice of a split series, or a band of a
 * subdivided bar or slice, filters the settings the chart takes its filters from to the value it
 * stands for, as clicking that value's radio button in a filter module on the same settings does:
 * a click narrows the column to the value, clicking the value already filtered to alone clears the
 * filter, and Ctrl+click adds the value to the filter.  A band filters its subdividing column, and
 * anything else its series' split column.  A series that isn't split stands for no column value.
 * The chart itself isn't filtered by those columns, so it keeps showing every value to click.  A
 * click on empty space, which clears the series selected, clears the filters on them too.  Going
 * the other way, any of those filters being cleared, as from a filter module, clears the chart's
 * selection, and its split column being filtered to other values selects the series filtered to.
 */
Ren.DateValueChart_CrossFiltering = (() => {

    // The latest props of each chart's svg, which outlives the redraws that attach to it.
    const propsBySvgNode = new WeakMap();

    /**
     * Gets a split value as the column filters it.  A non-compressed column's NULL is read as an
     * empty string by the split, but filters as the sentinel.
     */
    const toSplitFilterValue = (tabularData, column, splitValue) => {

        if (splitValue !== "") return splitValue;

        const columnIndex = tabularData.columnResolver.getColumnIndex(column);

        if (columnIndex === null || columnIndex === undefined) return splitValue;

        return tabularData.IsColumnCompressed[columnIndex] ? splitValue : Ren.NullSentinel;
    };

    /**
     * Gets the split values a series stands for, or null where it isn't split or stands for the
     * values of no series drawn, which a list of values can't state.
     */
    const getSeriesSplitValues = (props, seriesIndex) => {

        const otherValue = Ren.DateValueChart_SeriesSplit.OTHER_VALUE;
        const gatheredValues = Ren.DateValueChart_OtherSeries.getSplitValues(props, seriesIndex);

        if (gatheredValues) {

            return gatheredValues.length && gatheredValues.indexOf(otherValue) === -1
                ? gatheredValues
                : null;
        }

        const splitValue =
            props.seriesSplit.splitValueBySeriesHeading?.[props.valueHeadings[seriesIndex]];

        return splitValue === undefined || splitValue === otherValue ? null : [splitValue];
    };

    /**
     * Gets the column and values a clicked element stands for, as { column, values }, or null
     * where it stands for none.
     */
    const getClickedFilter = (props, tabularData, target) => {

        const svgNode = props.svg;
        const seriesElement = target && target.closest ? target.closest("[data-series]") : null;

        if (!seriesElement || !svgNode.contains(seriesElement)) return null;

        const seriesIndex = parseInt(seriesElement.getAttribute("data-series")) - 1;

        if (isNaN(seriesIndex) || !props.valueHeadings[seriesIndex]) return null;

        const subdivision = Ren.DateValueChart_SeriesSubdivisions.getMarkSubdivision(target);

        if (subdivision) {

            const column = Ren.DateValueChart_DataPointGrid
                .getColumnIdOrHeading(tabularData, props.subdivideColumn);

            return column ? { column, values: subdivision.columnValues } : null;
        }

        const column = props.seriesSplit?.columnKey;

        if (!column) return null;

        const splitValues = getSeriesSplitValues(props, seriesIndex);

        if (!splitValues) return null;

        return {
            column,
            values: splitValues.map(value => toSplitFilterValue(tabularData, column, value))
        };
    };

    /**
     * Gets the columns a cross-filtering chart filters by, whose filters it then isn't filtered by
     * itself, as a filter module's item isn't by its own column's.  Null where it doesn't
     * cross-filter.
     */
    const getUnfilteredColumns = (visualisation, tabularData) => {

        if (visualisation.enableCrossFiltering !== true || visualisation.isAdHoc) return null;

        if (!tabularData?.columnResolver) return null;

        const columns = [];

        const splitColumn = Ren.DateValueChart_SeriesSplit.getSplitColumnKey(
            visualisation.chartDataGroupingSettings,
            tabularData.columnResolver
        );

        if (splitColumn) columns.push(splitColumn);

        const subdivideColumn = visualisation.subdivideColumn
            ? Ren.DateValueChart_DataPointGrid
                .getColumnIdOrHeading(tabularData, visualisation.subdivideColumn)
            : null;

        if (subdivideColumn && columns.indexOf(subdivideColumn) === -1) {
            columns.push(subdivideColumn);
        }

        return columns.length ? columns : null;
    };

    /**
     * Gets the live settings the chart takes its filters from, those of its filterGroup or else
     * its own group's, which other visualisations sharing them read too.
     */
    const getTargetSettings = (visualisation) =>
        Ren.DataGroupingSettingsSource.resolve(
            visualisation.filterGroup || visualisation.dataGroupingSettingsGroup,
            visualisation.sourceVisualisation,
            null,
            visualisation.dataTabIndex
        ) ?? null;

    const isSoleSelection = (shownValues, values) => {

        if (shownValues == null || shownValues.length !== values.length) return false;

        for (let i = 0; i < values.length; i++) {

            if (!Ren.ColumnValueSelection.isValueShown(shownValues, values[i])) return false;
        }

        return true;
    };

    const getUnshownValues = (shownValues, values) =>
        values.filter(value => !Ren.ColumnValueSelection.isValueShown(shownValues, value));

    /**
     * Applies a click on a value to a column's filter, by the filter module's single-select rule.
     * The filter is read and written as the values shown, so a negated column stays negated.
     */
    const applyClick = (settings, tabularData, column, values, addToSelection) => {

        const isNegated =
            Ren.FilterNegation.isNegatedColumn(settings.dataRows, tabularData, column);

        const storedValues =
            settings.dataRows?.filterSet?.[tabularData.Title]?.columnValueFilters?.[column] ?? null;

        const shownValues =
            Ren.ColumnValueSelection.toShownValues(tabularData, column, storedValues, isNegated);

        const setShownValues = (newShownValues) => settings.sortFilterGroup.setAllFilter(
            column,
            Ren.ColumnValueSelection.toStoredValues(tabularData, column, newShownValues, isNegated)
        );

        const unshownValues = shownValues == null ? [] : getUnshownValues(shownValues, values);

        if (addToSelection && unshownValues.length) {
            setShownValues(shownValues.concat(unshownValues));
        }
        else if (isSoleSelection(shownValues, values)) {

            settings.sortFilterGroup.removeColumnFilter(column);
        }
        else {

            setShownValues(values.slice());
        }
    };

    /**
     * A single click cross-filters, so the first click of a double-click, which opens the data
     * point's grid, does too.  Alt+click is left to the bars' own highlighting and Shift+click to
     * the legend's.
     */
    const onChartClicked = (svgNode, event) => {

        const props = propsBySvgNode.get(svgNode);

        if (!props || props.enableCrossFiltering !== true) return;

        if (event.button !== 0 || event.detail > 1 || event.altKey || event.shiftKey) return;

        const visualisation = props.visualisation;

        if (!visualisation || visualisation.isAdHoc) return;

        const tabularData = Ren.DataSources.getTabularData(
            visualisation.dataSourceUri,
            visualisation.dataTabIndex ?? 1,
            visualisation.dataTabGroup
        );

        if (!tabularData) return;

        const clickedFilter = getClickedFilter(
            props,
            tabularData,
            Ren.DateValueChart_Pies.getClickTarget(event.target, event.clientX, event.clientY)
        );

        if (!clickedFilter) return;

        const settings = getTargetSettings(visualisation);

        if (!settings?.sortFilterGroup) return;

        applyClick(
            settings,
            tabularData,
            clickedFilter.column,
            clickedFilter.values,
            event.ctrlKey || event.metaKey
        );

        Ren.VisualisationCrossFilterIndicators.addFilter({
            group: visualisation.filterGroup || visualisation.dataGroupingSettingsGroup,
            containingReportGuid: visualisation.containingReportGuid,
            tabTitle: tabularData.Title,
            column: clickedFilter.column,
            sourceVisualisation: visualisation,
            getSettings: () => getTargetSettings(visualisation),
            getTabularData: () => Ren.DataSources.getTabularData(
                visualisation.dataSourceUri,
                visualisation.dataTabIndex ?? 1,
                visualisation.dataTabGroup
            ),
            onCleared: () => clearLegendSelection(svgNode)
        });
    };

    /**
     * Clears the legend selection the click on the chart made, so the series clicked no longer
     * stands out once its filter is cleared.  A multi-chart's selection is in its shared legend.
     */
    const clearLegendSelection = (svgNode) => {

        const props = propsBySvgNode.get(svgNode);

        if (!props) return;

        Ren.DateValueChart_Legend.clearSelection(props.sharedLegendProps || props);
    };

    /**
     * Gets the columns a cross-filtering chart filters by that are filtered now, with the
     * settings they are filtered in, the chart's tabular data and each column's stored values, or
     * null where it doesn't cross-filter.
     */
    const getFilteredColumns = (visualisation) => {

        if (!visualisation || visualisation.isAdHoc) return null;

        const tabularData = Ren.DataSources.getTabularData(
            visualisation.dataSourceUri,
            visualisation.dataTabIndex ?? 1,
            visualisation.dataTabGroup
        );

        const columns = getUnfilteredColumns(visualisation, tabularData);
        const settings = columns ? getTargetSettings(visualisation) : null;

        if (!settings?.sortFilterGroup) return null;

        const columnValueFilters =
            settings.dataRows?.filterSet?.[tabularData.Title]?.columnValueFilters;

        return {
            settings,
            tabularData,
            columns: columns.filter(column => columnValueFilters?.[column] != null),
            columnValueFilters
        };
    };

    /**
     * Clears the filters on the columns a cross-filtering chart filters by, as a click on empty
     * space in it does along with its selection.
     */
    const clearFilters = (props) => {

        const filtered = getFilteredColumns(props.visualisation);

        if (!filtered) return;

        for (let index = 0; index < filtered.columns.length; index++) {

            filtered.settings.sortFilterGroup.removeColumnFilter(filtered.columns[index]);
        }
    };

    // The cross-filtering charts' svgs, with what each last saw its filtered columns filtered to,
    // so that a column's filter changing, by whatever means, updates the chart's selection.
    const filterSignaturesBySvgNode = new Map();

    let isFilterCheckPending = false;

    /**
     * Gets what each of the columns a chart filters by is filtered to now, by column, leaving out
     * those that aren't filtered.
     */
    const getFilterSignatures = (filtered) => {

        const signatures = {};

        if (!filtered) return signatures;

        for (let index = 0; index < filtered.columns.length; index++) {

            const column = filtered.columns[index];

            signatures[column] = JSON.stringify(filtered.columnValueFilters[column]) + "|"
                + Ren.FilterNegation.isNegatedColumn(
                    filtered.settings.dataRows,
                    filtered.tabularData,
                    column
                );
        }

        return signatures;
    };

    const isSameSeriesSelection = (seriesNums, otherSeriesNums) =>
        seriesNums.length === otherSeriesNums.length
            && seriesNums.every(seriesNum => otherSeriesNums.indexOf(seriesNum) !== -1);

    /**
     * Selects the series whose split values the split column is filtered to, as clicking them in
     * the chart would have.  A series standing for no list of values, as one gathering undrawn
     * values does, is left unselected.
     */
    const selectFilteredSeries = (props, filtered, splitColumn) => {

        const legendProps = props.sharedLegendProps || props;

        if (legendProps.seriesSplit?.columnKey !== splitColumn) return;

        const tabularData = filtered.tabularData;
        const isNegated = Ren.FilterNegation.isNegatedColumn(
            filtered.settings.dataRows,
            tabularData,
            splitColumn
        );

        const shownValues = Ren.ColumnValueSelection.toShownValues(
            tabularData,
            splitColumn,
            filtered.columnValueFilters[splitColumn],
            isNegated
        );

        const seriesNums = [];
        const valueHeadings = legendProps.valueHeadings || [];

        for (let index = 0; shownValues && index < valueHeadings.length; index++) {

            const splitValues = getSeriesSplitValues(legendProps, index);

            const isFilteredTo = !!splitValues && splitValues.every(value =>
                Ren.ColumnValueSelection.isValueShown(
                    shownValues,
                    toSplitFilterValue(tabularData, splitColumn, value)
                ));

            if (isFilteredTo) seriesNums.push(index + 1);
        }

        const Legend = Ren.DateValueChart_Legend;

        if (isSameSeriesSelection(seriesNums, Legend.getSelectedSeriesIndexes(legendProps))) return;

        if (seriesNums.length) {
            Legend.showSelection(legendProps, seriesNums);
        }
        else {

            Legend.clearSelection(legendProps);
        }
    };

    /**
     * A column the chart filters by ceasing to be filtered clears its selection, and its split
     * column being filtered to other values selects the series it is filtered to.
     */
    const checkFilteredColumns = () => {

        isFilterCheckPending = false;

        Array.from(filterSignaturesBySvgNode.keys()).forEach((svgNode) => {

            const props = propsBySvgNode.get(svgNode);

            if (!props || props.enableCrossFiltering !== true || !svgNode.isConnected
                || props.visualisation.isDestroyed) {

                filterSignaturesBySvgNode.delete(svgNode);
                return;
            }

            const previousSignatures = filterSignaturesBySvgNode.get(svgNode);
            const filtered = getFilteredColumns(props.visualisation);
            const signatures = getFilterSignatures(filtered);

            filterSignaturesBySvgNode.set(svgNode, signatures);

            const isAnyCleared = Object.keys(previousSignatures)
                .some(column => !Object.prototype.hasOwnProperty.call(signatures, column));

            const splitColumn = props.seriesSplit?.columnKey;

            const isSplitFilterChanged = !!splitColumn
                && Object.prototype.hasOwnProperty.call(signatures, splitColumn)
                && signatures[splitColumn] !== previousSignatures[splitColumn];

            if (isSplitFilterChanged) {
                selectFilteredSeries(props, filtered, splitColumn);
            }
            else if (isAnyCleared) {

                clearLegendSelection(svgNode);
            }
        });
    };

    // A filter change and the redraws it causes arrive as a burst.
    const scheduleFilterCheck = () => {

        if (isFilterCheckPending || !filterSignaturesBySvgNode.size) return;

        isFilterCheckPending = true;
        setTimeout(checkFilteredColumns, 0);
    };

    Ren.Messages.Events.filterChanged.handle(() => {

        scheduleFilterCheck();
    });

    Ren.Messages.Events.dataGroupingSettingsChanged.handle(() => {

        scheduleFilterCheck();
    });

    const attach = (props) => {

        if (!props.svg || !props.visualisation) return;

        const svgNode = props.svg;

        if (!propsBySvgNode.has(svgNode)) {
            svgNode.addEventListener("click", event => onChartClicked(svgNode, event));
        }

        propsBySvgNode.set(svgNode, props);

        if (props.enableCrossFiltering === true && !filterSignaturesBySvgNode.has(svgNode)) {

            filterSignaturesBySvgNode.set(
                svgNode,
                getFilterSignatures(getFilteredColumns(props.visualisation))
            );
        }
    };

    return {
        attach,
        clearFilters,
        getUnfilteredColumns,
        getClickedFilter,
        applyClick
    };
})();
