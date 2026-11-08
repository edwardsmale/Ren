/**
 * Double-clicking a bar, line or dot of a date/value chart opens a popup grid of the rows behind
 * that data point: the chart's data source filtered as the chart's input is, and further to the
 * point's period and, for a split series, to its split value.  A band of a subdivided bar or slice
 * opens its bar or slice's rows with a filter on the subdividing column, which is shown, so that
 * clearing the filter reveals the whole bar or slice.  Other visualisations open such a popup grid
 * of rows of their own filtering via showRowsGrid.
 */
Ren.DateValueChart_DataPointGrid = (() => {

    // Keeps each source's compare filters in slots of their own, clear of those a grouping level's
    // translated filters take (see Ren.DataGroupingSettings_Services_FilterAccessors), so that no
    // two sources' filters on one column are read as one OR group.
    const SOURCE_SLOT_STRIDE = 10000000;

    // The latest props of each chart's svg, which outlives the redraws that attach to it.
    const propsBySvgNode = new WeakMap();

    /**
     * Gets the chart row a double-clicked bar or dot is drawn for, or null where the target is
     * not one.
     */
    const getMarkRow = (props, target, svgElement) => {

        let element = target;

        while (element && element !== svgElement) {

            const datum = Ren.Svg.getDatum(element);

            if (datum && !Array.isArray(datum) && datum[props.dateHeading] instanceof Date) {
                return datum;
            }

            element = element.parentNode;
        }

        return null;
    };

    /**
     * Gets the chart row of the period a clicked line passes through at the pointer, or null where
     * the target is not a line.  The chart group carries the margins but none of the plot's
     * scaling, as Ren.DateValueChart_HoverDateLine reads the pointer.
     */
    const getLineRow = (props, target, clientX, clientY) => {

        const lineGroup = target.closest(".ren-data-series--line");
        const linePath = lineGroup && lineGroup.querySelector(".ren-data-series__line-path");
        const rows = linePath && Ren.Svg.getDatum(linePath);

        if (!Array.isArray(rows) || !props.chartGroup || !props.xScale) return null;

        const pointer = Ren.Svg.pointer({ clientX, clientY }, props.chartGroup);
        const pointerDate = props.xScale.getValue(pointer[0] / (props.scaleX || 1));

        let nearestRow = null;
        let nearestDistance = Infinity;

        for (let index = 0; index < rows.length; index++) {

            const date = rows[index][props.dateHeading];

            if (!(date instanceof Date)) continue;

            const span = Ren.DateValueChartCalculator.periodSpan(props, date);

            if (pointerDate >= span.start && pointerDate < span.end) return rows[index];

            const distance = Math.min(
                Math.abs(pointerDate - span.start),
                Math.abs(pointerDate - span.end)
            );

            if (distance < nearestDistance) {

                nearestDistance = distance;
                nearestRow = rows[index];
            }
        }

        return nearestRow;
    };

    const getValueKey = (value) => value === null || value === undefined ? null : String(value);

    const createValueMap = (values) => {

        const valueMap = new Map();

        for (let index = 0; index < values.length; index++) {
            valueMap.set(getValueKey(values[index]), values[index]);
        }

        return valueMap;
    };

    /**
     * Combines a column's filter with the one already gathered for it, so that the rows let
     * through are those both let through.
     */
    const mergeColumnFilter = (columnFilters, column, values, isNegated) => {

        const valueMap = createValueMap(values);
        const existing = columnFilters.get(column);

        if (!existing) {

            columnFilters.set(column, { valueMap, isNegated });
            return;
        }

        if (existing.isNegated && isNegated) {

            valueMap.forEach((value, key) => existing.valueMap.set(key, value));
            return;
        }

        if (existing.isNegated) {

            existing.valueMap.forEach((value, key) => valueMap.delete(key));
            columnFilters.set(column, { valueMap, isNegated: false });
            return;
        }

        if (isNegated) {

            valueMap.forEach((value, key) => existing.valueMap.delete(key));
            return;
        }

        existing.valueMap.forEach((value, key) => {

            if (!valueMap.has(key)) existing.valueMap.delete(key);
        });
    };

    const mergeColumnFilters = (
        columnFilters, columnValueFilters, negatedColumns, skippedColumns
    ) => {

        for (const column in columnValueFilters) {

            if (skippedColumns && skippedColumns.has(column)) continue;

            const values = columnValueFilters[column];

            if (!Array.isArray(values)) continue;

            mergeColumnFilter(columnFilters, column, values, negatedColumns.has(column));
        }
    };

    /**
     * Adds a source's predicates, its compare filters moved to slots of its own.
     */
    const addPredicates = (predicates, sourcePredicates, sourceNumber) => {

        if (!Array.isArray(sourcePredicates)) return;

        const slotOffset = sourceNumber * SOURCE_SLOT_STRIDE;

        for (let index = 0; index < sourcePredicates.length; index++) {

            const predicate = sourcePredicates[index];

            if (predicate?.type !== "compare") {

                predicates.push(predicate);
                continue;
            }

            const moved = Object.assign({}, predicate);

            moved.slot = Ren.FilterCompareOperators.slotOf(predicate) + slotOffset;

            if (predicate.orGroup !== null && predicate.orGroup !== undefined) {
                moved.orGroup = Number(predicate.orGroup) + slotOffset;
            }

            predicates.push(moved);
        }
    };

    /**
     * Gathers the filters of one settings source: those on its rows, but for those on the
     * unfiltered columns, and those on its grouping levels, which the chart reads as filters on its
     * rows.
     */
    const addSourceFilters = (filters, settings, tabularData, unfilteredColumns) => {

        if (!settings) return;

        filters.sourceCount++;

        const tabFilters = settings.dataRows?.filterSet?.[tabularData.Title];

        if (tabFilters) {

            mergeColumnFilters(
                filters.columnFilters,
                tabFilters.columnValueFilters ?? {},
                Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters),
                unfilteredColumns
            );

            addPredicates(filters.predicates, tabFilters.rowFilter?.predicates, filters.sourceCount);
        }

        const groupingFilters = Ren.DataGroupingSettings_Services_FilterAccessors
            .getRowFilterableGroupingColumnValueFilters(settings, tabularData);

        for (let index = 0; index < groupingFilters.length; index++) {

            filters.sourceCount++;

            mergeColumnFilters(
                filters.columnFilters,
                groupingFilters[index].columnValueFilters,
                groupingFilters[index].negatedColumns
            );

            addPredicates(
                filters.predicates,
                groupingFilters[index].rowFilterPredicates,
                filters.sourceCount
            );
        }
    };

    /**
     * Gets the filters of one settings source, as { columnFilters, predicates }.
     */
    const getSettingsFilters = (settings, tabularData) => {

        const filters = { columnFilters: new Map(), predicates: [], sourceCount: 0 };

        addSourceFilters(filters, settings, tabularData);

        return filters;
    };

    /**
     * Creates filters, as { columnFilters, predicates }, from column value filters naming the
     * values let through and from predicates.
     */
    const createFilters = (columnValueFilters, predicates) => {

        const filters = {
            columnFilters: new Map(),
            predicates: predicates.slice(),
            sourceCount: 0
        };

        mergeColumnFilters(filters.columnFilters, columnValueFilters, new Set());

        return filters;
    };

    /**
     * Gathers the filters the chart's input rows are filtered by (see
     * Ren.VisualisationInputDataHelper.getInputData): those of its own settings group and of the
     * group it follows the filters of.  An ad hoc chart reads every row.
     */
    const getChartFilters = (visualisation, tabularData) => {

        const filters = { columnFilters: new Map(), predicates: [], sourceCount: 0 };

        if (visualisation.isAdHoc) return filters;

        // Left out of the settings the chart takes its filters from, as its input rows are.
        const unfilteredColumnList =
            Ren.DateValueChart_CrossFiltering.getUnfilteredColumns(visualisation, tabularData);

        const unfilteredColumns = unfilteredColumnList ? new Set(unfilteredColumnList) : null;

        const filterGroup = visualisation.filterGroup;
        const isFilterGroupDistinct =
            !!filterGroup && filterGroup !== visualisation.dataGroupingSettingsGroup;

        addSourceFilters(
            filters,
            Ren.DataGroupingSettingsCollection.getDataGroupingSettingsTransformed(
                visualisation.dataGroupingSettingsGroup,
                tabularData,
                visualisation.sourceVisualisation?.visualisationGuid
            ),
            tabularData,
            isFilterGroupDistinct ? null : unfilteredColumns
        );

        if (isFilterGroupDistinct) {

            addSourceFilters(
                filters,
                Ren.DataGroupingSettingsCollection.getDataGroupingSettings(filterGroup),
                tabularData,
                unfilteredColumns
            );
        }

        return filters;
    };

    const getColumnIdOrHeading = (tabularData, heading) => {

        const columnIndex = tabularData.findColumnIndex(heading);
        const columnModel = columnIndex >= 0 ? tabularData.ColumnModels[columnIndex] : null;

        if (!columnModel) return null;

        return columnModel.ColumnIdOrHeading ?? columnModel.ColumnId ?? columnModel.Heading;
    };

    /**
     * Gets the period a data point covers: its bin, or the day it falls on where the chart does
     * not bin its dates.
     */
    const getPointPeriod = (props) =>
        Ren.DateValueChart_GroupingApplyer.getEffectiveBinPeriod(props) ?? Ren.DatePeriodEnum.Day;

    /**
     * Builds the filter on the date column to the data point's period.  Dates are compared by the
     * day, so a period finer than a day is widened to its day.  The chart's dates read the wall
     * clock in local time, as Ren.DateValueChartCalculator.periodSpan does.
     */
    const buildPeriodPredicate = (props, tabularData, date) => {

        const column = getColumnIdOrHeading(tabularData, props.dateHeading);

        if (!column) return null;

        // All time's one point covers the dates it was merged from.
        if (props.isAllTime) {

            return props.allTimeExtent
                ? {
                    type: "compare",
                    column,
                    operator: "dateBetween",
                    value: props.allTimeExtent.from.substring(0, 10),
                    value2: props.allTimeExtent.toExclusive.substring(0, 10)
                }
                : null;
        }

        const period = getPointPeriod(props);
        const start = Ren.DateUtils.startOfPeriod(date, period);
        const startDate = Ren.DateUtils.toSortableDate(start);
        let endDate = Ren.DateUtils.toSortableDate(Ren.DateUtils.addPeriod(start, period));

        if (endDate === startDate) {
            endDate = Ren.DateUtils.addDaysToSortableDate(startDate, 1);
        }

        return {
            type: "compare",
            column,
            operator: "dateBetween",
            value: startDate,
            value2: endDate
        };
    };

    /**
     * Builds the filter on the split column to the split value a series covers, or to the values
     * no other series covers for the series gathering them.  Null where the series isn't split.
     */
    /**
     * Builds the predicate for the rows an "Other" series gathers: those of the gathered series'
     * split values, or, where these include the split's own "(other)", those of no value whose
     * series is drawn.
     */
    const buildOtherSeriesSplitPredicate = (seriesSplit, gatheredSplitValues) => {

        const otherValue = Ren.DateValueChart_SeriesSplit.OTHER_VALUE;
        const tuples = [];

        if (gatheredSplitValues.indexOf(otherValue) === -1) {

            for (let i = 0; i < gatheredSplitValues.length; i++) {
                tuples.push([gatheredSplitValues[i]]);
            }

            return { type: "includeCombinations", columns: [seriesSplit.columnKey], tuples };
        }

        const splitValueBySeriesHeading = seriesSplit.splitValueBySeriesHeading;
        const headings = Object.keys(splitValueBySeriesHeading);
        const shownValues = new Set();

        for (let i = 0; i < headings.length; i++) {

            const value = splitValueBySeriesHeading[headings[i]];

            if (value !== otherValue && gatheredSplitValues.indexOf(value) === -1) {
                shownValues.add(value);
            }
        }

        shownValues.forEach(value => tuples.push([value]));

        return { type: "excludeCombinations", columns: [seriesSplit.columnKey], tuples };
    };

    const buildSplitPredicate = (props, seriesIndex) => {

        const seriesSplit = props.seriesSplit;

        if (!seriesSplit || !seriesSplit.columnKey) return null;

        const splitValueBySeriesHeading = seriesSplit.splitValueBySeriesHeading;
        const otherSplitValues = Ren.DateValueChart_OtherSeries.getSplitValues(props, seriesIndex);

        if (otherSplitValues) {
            return buildOtherSeriesSplitPredicate(seriesSplit, otherSplitValues);
        }

        const splitValue = splitValueBySeriesHeading?.[props.valueHeadings[seriesIndex]];

        if (splitValue === undefined) return null;

        if (splitValue !== Ren.DateValueChart_SeriesSplit.OTHER_VALUE) {

            return {
                type: "includeCombinations",
                columns: [seriesSplit.columnKey],
                tuples: [[splitValue]]
            };
        }

        const keptValues = new Set();

        for (const heading in splitValueBySeriesHeading) {

            const value = splitValueBySeriesHeading[heading];

            if (value !== Ren.DateValueChart_SeriesSplit.OTHER_VALUE) keptValues.add(value);
        }

        const tuples = [];

        keptValues.forEach(value => tuples.push([value]));

        return { type: "excludeCombinations", columns: [seriesSplit.columnKey], tuples };
    };

    const getTitle = (props, seriesIndex, date) => {

        const titlePeriod = Ren.DateValueChart_GroupingApplyer.getEffectiveBinPeriod(props)
            ?? props.datePeriod;
        const dateLabel = props.isAllTime
            ? Ren.DateValueChart_DateTickFormat.getAllTimeLabel(props)
            : Ren.DateValueChart_DateTickFormat.getTickFormat(titlePeriod)(date)
                .replace(/\n/g, " ");
        const seriesLabel = props.series[seriesIndex]?.label || props.valueHeadings[seriesIndex];

        return dateLabel + " " + seriesLabel;
    };

    const initialiseFilters = (settings, filters) => {

        // Applied before the column filters, to avoid an intermediate regroup.
        if (filters.predicates.length) {
            settings.sortFilterGroup.setRowFilterPredicates(filters.predicates);
        }

        filters.columnFilters.forEach((columnFilter, column) => {

            if (columnFilter.isNegated) {
                settings.sortFilterGroup.setColumnFilterNegated(column, true);
            }

            settings.sortFilterGroup.setAllFilter(
                column,
                Array.from(columnFilter.valueMap.values())
            );
        });

        settings.fireChangedEvent();
    };

    /**
     * Gets the URL of the page showing a data source's SQL file in a grid set, or null where the
     * data source is not a SQL file's.
     */
    const getSqlFileGridUrl = (dataSourceUri) => {

        if (!dataSourceUri || !Ren.NamedDataSources.isNamedUri(dataSourceUri)) {
            return null;
        }

        return Ren.HostUrls.reportUrl(
            "/SqlFileGrid/" +
            Ren.NamedDataSources.removeBaseUri(dataSourceUri)
        );
    };

    /**
     * Gets filters as row filters, in the form Ren.QueryParameterFilter carries them.
     */
    const getRowFilters = (tabularData, filters) => {

        const columnFilters = [];

        filters.columnFilters.forEach((columnFilter, column) => {

            columnFilters.push({
                column,
                values: Array.from(columnFilter.valueMap.values()),
                isNegated: columnFilter.isNegated
            });
        });

        return { tab: tabularData.Title, columnFilters, predicates: filters.predicates };
    };

    /**
     * Gets the URL the popup grid pops out to: its SQL file's grid page, showing the popup's tab
     * under its title, filtered by the popup's filters as they now are, and with its settings and
     * variations.  gridSet is the popup's grid set, or details of it with the same names.
     */
    const getPopOutUrl = (sqlFileGridUrl, gridSet, tabularData, getPopupFilters) => {

        const rowFilters = getRowFilters(tabularData, getPopupFilters());

        rowFilters.dataTabIndex = gridSet.dataTabIndex;
        rowFilters.dataTabGroup = gridSet.dataTabGroup;
        rowFilters.title = gridSet.popupTitle;

        rowFilters.settings =
            Ren.DataGrid_PopupVariations.getPopOutSettings(gridSet, tabularData, rowFilters);

        return Ren.QueryParameterFilter.addRowFiltersToUrl(sqlFileGridUrl, rowFilters);
    };

    /**
     * Gets the grid of a grid set's that shows a tab, or null.
     */
    const getTabDataGrid = (gridSetVisualisation, tabularData) => {

        const dataGrids = gridSetVisualisation?.instance?.dataGrids;

        if (!Array.isArray(dataGrids)) return null;

        for (let index = 0; index < dataGrids.length; index++) {

            if (dataGrids[index].tabularData?.Title === tabularData.Title) return dataGrids[index];
        }

        return null;
    };

    /**
     * Gets the data grid associated with a visualisation, or null: that of the grid it was created
     * from that shows its tab, or else the grid whose settings, those of filterGroup, it takes its
     * filters from.  A visualisation's data source URI need not match its grid's (it may leave out
     * the report's parameters), so the grid is found by its settings.
     */
    const getAssociatedDataGrid = (visualisation, tabularData, filterGroup) => {

        const sourceDataGrid = getTabDataGrid(visualisation.sourceVisualisation, tabularData);

        if (sourceDataGrid) return sourceDataGrid;

        const filterSettings =
            Ren.DataGroupingSettingsCollection.getDataGroupingSettings(filterGroup);
        const visualisations = Ren.VisualisationCollection.getVisualisations();
        let groupDataGrid = null;

        for (let index = 0; index < visualisations.length; index++) {

            const dataGrids = visualisations[index].instance?.dataGrids;

            if (visualisations[index] === visualisation || !Array.isArray(dataGrids)) continue;

            for (let gridIndex = 0; gridIndex < dataGrids.length; gridIndex++) {

                const settings = dataGrids[gridIndex].dataGroupingSettings;

                if (!settings) continue;

                if (filterSettings && settings === filterSettings) return dataGrids[gridIndex];

                if (!groupDataGrid && settings.dataGroupingSettingsGroup === filterGroup) {
                    groupDataGrid = dataGrids[gridIndex];
                }
            }
        }

        return groupDataGrid;
    };

    /**
     * Gets a function reading a column's value of a data row as a grouping groups it: derived by
     * the grouping's calc function for it, where it has one.  Null where the column is absent.
     */
    const getGroupByValueReader = (tabularData, column, calcFunctionSpecification, paras) => {

        const columnIndex = tabularData.columnResolver.getColumnIndex(column);

        if (columnIndex === null || columnIndex === undefined) return null;

        const columnCVs = tabularData.getColumnCV(columnIndex);
        const isCompressed = tabularData.IsColumnCompressed[columnIndex];
        const calcFunction = calcFunctionSpecification
            ? Ren.FormatFunctions.createFunction(
                Ren.FormatFunctions.isFunctionName(calcFunctionSpecification)
                    ? { name: calcFunctionSpecification }
                    : calcFunctionSpecification,
                paras
            )
            : null;

        const dictionary = tabularData.CompressionDictionary;

        return (rowIndex) => {

            const value = isCompressed
                ? dictionary.decompressValue(columnCVs[rowIndex], columnIndex)
                : columnCVs[rowIndex];

            if (!calcFunction) return getValueKey(value);

            // A value the calc function throws on is grouped underived, as the grouping does.
            try {
                return getValueKey(Ren.TextUtils.stripSortPrefix(String(calcFunction(value))));
            }
            catch (error) {

                return getValueKey(value);
            }
        };
    };

    /**
     * Gets a value indicating whether rows all fall in the one group of a serialised grouping's.
     */
    const isInOneGroup = (tabularData, grouping, rowIndexes, paras) => {

        const groupByColumns = grouping.groupByColumns ?? [];

        for (let index = 0; index < groupByColumns.length; index++) {

            const readValue = getGroupByValueReader(
                tabularData,
                groupByColumns[index],
                grouping.groupByCalcFunctions?.[index],
                paras
            );

            if (!readValue) return false;

            const firstValue = readValue(rowIndexes[0]);

            for (let rowIndex = 1; rowIndex < rowIndexes.length; rowIndex++) {

                if (readValue(rowIndexes[rowIndex]) !== firstValue) return false;
            }
        }

        return true;
    };

    /**
     * Gets the data row indexes of the rows a popup's settings let through.
     */
    const getIncludedRowIndexes = (tabularData, settings) => {

        const compiledFilter = settings.hasFilter()
            ? Ren.Filter.createCompiledFilter(tabularData, settings)
            : null;
        const excludedRowsMask = compiledFilter ? compiledFilter.getExcludedRowsMask() : null;
        const rowIndexes = [];

        for (let rowIndex = 0; rowIndex < tabularData.DataRowCount; rowIndex++) {

            if (!excludedRowsMask || excludedRowsMask[rowIndex] !== 1) rowIndexes.push(rowIndex);
        }

        return rowIndexes;
    };

    /**
     * Cuts serialised settings' groupings down to those inside the outermost that the popup's
     * rows don't all fall in one group of, as "Open group in new grid" cuts them to those inside
     * the group clicked, each level dropped having just the one group, which the rows stand for.
     */
    const cutGroupingsToRows = (settings, tabularData, rowIndexes, paras) => {

        const entries = settings.groupings?.entries;

        if (!Array.isArray(entries) || !entries.length || !rowIndexes.length) return;

        // The outermost grouping is the totals row, grouped by nothing.
        let levelIndex = entries.length - 1;

        while (levelIndex > 0 &&
            isInOneGroup(tabularData, entries[levelIndex - 1], rowIndexes, paras)) {

            levelIndex--;
        }

        if (levelIndex === entries.length - 1) return;

        const extractGroup = Ren.DataGrid_ExtractGroup;

        extractGroup.cutGroupingsToLevel(settings, levelIndex);

        // The dropped levels' columns were shown by their group rows, so wherever the rest blank
        // one, it takes its format at its level instead.
        const keptEntries = settings.groupings.entries;

        for (let droppedIndex = levelIndex; droppedIndex < entries.length - 1; droppedIndex++) {

            const groupByColumns = entries[droppedIndex].groupByColumns ?? [];

            for (let index = 0; index < groupByColumns.length; index++) {

                const columnKey = groupByColumns[index];
                const parentColumn = entries[droppedIndex].columns?.[columnKey];

                for (let keptIndex = 0; keptIndex < keptEntries.length; keptIndex++) {

                    extractGroup.replaceBlankFormat(
                        keptEntries[keptIndex].columns,
                        columnKey,
                        parentColumn
                    );
                }

                extractGroup.replaceBlankFormat(
                    settings.dataRows?.columns,
                    columnKey,
                    parentColumn
                );
            }
        }
    };

    /**
     * Gets the popup's Default variation from an associated grid, as { settings, gridState }: the
     * grid's settings filtered to the popup's rows, and its grid state.  Null where there is no
     * associated grid.  Its groupings are cut down to the rows' later (see cutGroupingsToRows),
     * once the popup's settings can say which rows those are.
     */
    const getAssociatedGridDefault = (dataGrid, tabularData, filters) => {

        if (!dataGrid) return null;

        const gridTabularData = dataGrid.tabularData;
        const settings = Ren.DataGroupingSettingsTransformer.transform(
            gridTabularData,
            dataGrid.dataGroupingSettings
        );

        // The popup shows its group controls even where the grid has them collapsed.
        const countMode = Ren.ObjectUtils.getEnumValue(
            Ren.GroupCtrlsCountModeEnum,
            settings.layout?.groupCtrlsCountMode
        );

        if (countMode === Ren.GroupCtrlsCountModeEnum.Collapsed) {

            settings.layout.groupCtrlsCountMode = Ren.ObjectUtils.getEnumKey(
                Ren.GroupCtrlsCountModeEnum,
                Ren.GroupCtrlsCountModeEnum.NoCounts
            );
        }

        settings.dataRows ??= {};
        settings.dataRows.filterSet = Ren.DataGrid_PopupVariations
            .getRowFiltersFilterSet(getRowFilters(tabularData, filters));

        const gridState = dataGrid.gridState
            ? Ren.GridStateTransformer.transform(gridTabularData, dataGrid.gridState)
            : null;

        // The popup's grid is laid out without row and column headings, so taking them on from
        // the grid would cover its heading row.
        if (gridState) delete gridState.showRowAndColumnHeadings;

        return {
            settings,
            gridState
        };
    };

    /**
     * Opens a popup grid of a visualisation's data source's rows that filters ({ columnFilters,
     * predicates }) let through, titled title.  The grid is laid out as dataGrid is, where one is
     * given, with columnToShow shown whether or not that layout hides it.
     */
    const showRowsGrid = (visualisation, tabularData, filters, title, dataGrid, columnToShow) => {

        const settingsGroup = Ren.RandomUtils.generateRandomClassName("data-point-grid");
        const sqlFileGridUrl = getSqlFileGridUrl(visualisation.dataSourceUri);
        const associatedGridDefault = getAssociatedGridDefault(dataGrid, tabularData, filters);

        let popupSettings = null;

        const getPopupFilters = () => {

            if (!popupSettings) return filters;

            return getSettingsFilters(popupSettings, tabularData);
        };

        const initialisePopupFilters = (settings) => {

            popupSettings = settings;
            initialiseFilters(settings, filters);

            if (associatedGridDefault) {

                cutGroupingsToRows(
                    associatedGridDefault.settings,
                    tabularData,
                    getIncludedRowIndexes(tabularData, settings),
                    Ren.ReportInputParameters.getInputParametersForGuid(
                        settings.containingReportGuid
                    )
                );
            }

            const popupTabularData =
                Ren.TabularDataPool.getByTabularDataGuid(settings.tabularDataGuid) || tabularData;

            // Default is the associated grid's layout, or else the grid as the filters leave it.
            const defaultSettings = associatedGridDefault?.settings ??
                Ren.DataGroupingSettingsTransformer.transform(popupTabularData, settings);

            Ren.DateValueChart_DataPointGrid_NumberFormats
                .applyDefaultFormats(defaultSettings, popupTabularData);

            Ren.DataGrid_PopupVariations.addVariations(
                settings,
                tabularData,
                defaultSettings,
                associatedGridDefault?.gridState,
                columnToShow
            );
        };

        const gridSet = Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "GridSet",
            dataSourceUri: visualisation.dataSourceUri,
            sqlFilename: visualisation.sqlFilename,
            tabularDataTransformers: visualisation.tabularDataTransformers,
            dataGroupingSettingsGroup: settingsGroup,
            dataTabGroup: visualisation.dataTabGroup,
            dataTabIndex: visualisation.dataTabIndex,
            excludeFromSerialization: true,
            gridStateGroup: settingsGroup,
            isPopup: true,
            maxHeight: "calc(100% - 22px)",
            maxWidth: "100%",
            popupTitle: title,
            popupShowPopoutButton: sqlFileGridUrl !== null,
            resizeToFitContentOnLoad: true,
            settingsNonSerializable: true,
            sourceVisualisation: visualisation
        });

        if (sqlFileGridUrl && gridSet?.popup) {

            Ren.SetupPopOutButton(
                gridSet.popup,
                () => getPopOutUrl(sqlFileGridUrl, gridSet, tabularData, getPopupFilters)
            );
        }

        // The grid registers its settings as it is built, which may be after the call above
        // returns, so setting the filters waits for them.
        Ren.DataGroupingSettingsCollection.waitForDataGroupingSettings(
            settingsGroup,
            gridSet?.visualisationGuid,
            (settings) => Ren.FnUtils.defer(() => initialisePopupFilters(settings))
        );
    };

    /**
     * Opens a popup grid of the rows behind the data point a series has for a chart row.  The grid
     * is laid out as the chart's associated grid is, where it has one.  A subdivision, where given,
     * adds its filter on the subdividing column.
     */
    const showDataPointGrid = (props, seriesIndex, row, subdivision) => {

        const visualisation = props.visualisation;

        const tabularData = Ren.DataSources.getTabularData(
            visualisation.dataSourceUri,
            visualisation.dataTabIndex ?? 1,
            visualisation.dataTabGroup
        );

        if (!tabularData) return;

        const date = row[props.dateHeading];
        const filters = getChartFilters(visualisation, tabularData);
        const periodPredicate = buildPeriodPredicate(props, tabularData, date);
        const splitPredicate = buildSplitPredicate(props, seriesIndex);

        if (periodPredicate) filters.predicates.push(periodPredicate);
        if (splitPredicate) filters.predicates.push(splitPredicate);

        const subdivideColumn = subdivision
            ? getColumnIdOrHeading(tabularData, props.subdivideColumn)
            : null;

        if (subdivideColumn) {

            mergeColumnFilter(
                filters.columnFilters,
                subdivideColumn,
                subdivision.columnValues,
                false
            );
        }

        showRowsGrid(
            visualisation,
            tabularData,
            filters,
            getTitle(props, seriesIndex, date),
            getAssociatedDataGrid(
                visualisation,
                tabularData,
                visualisation.filterGroup || visualisation.dataGroupingSettingsGroup
            ),
            subdivideColumn
        );
    };

    /**
     * Gets the data point of a bar, line or dot of the chart's at the pointer, as { seriesIndex,
     * row, subdivision } (the series' index from 0, its chart row and the band of it at the
     * pointer, if any), or null where the target is not one.
     */
    const getDataPoint = (props, target, clientX, clientY) => {

        const svgNode = props.svg || null;
        const seriesElement = target && target.closest ? target.closest("[data-series]") : null;

        if (!svgNode || !seriesElement || !svgNode.contains(seriesElement)) return null;

        const seriesIndex = parseInt(seriesElement.getAttribute("data-series")) - 1;

        if (isNaN(seriesIndex) || !props.valueHeadings[seriesIndex]) return null;

        const row = getMarkRow(props, target, svgNode)
            || getLineRow(props, target, clientX, clientY);

        if (!row) return null;

        return {
            seriesIndex,
            row,
            subdivision: Ren.DateValueChart_SeriesSubdivisions.getMarkSubdivision(target)
        };
    };

    /**
     * The second press of a double-click on a bar, line or dot opens its data point's grid.  The
     * press's click count is used rather than a dblclick or click event, as the first click's
     * redraw, as when it cross-filters, replaces the svg, and landing between the second press and
     * its release it sends the click outside the chart.
     */
    const onChartPressed = (svgNode, event) => {

        const props = propsBySvgNode.get(svgNode);

        if (!props || event.detail !== 2 || event.button !== 0) return;

        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

        const target =
            Ren.DateValueChart_Pies.getClickTarget(event.target, event.clientX, event.clientY);
        const dataPoint = getDataPoint(props, target, event.clientX, event.clientY);

        if (!dataPoint) return;

        event.stopPropagation();
        showDataPointGrid(props, dataPoint.seriesIndex, dataPoint.row, dataPoint.subdivision);
    };

    const attach = (props) => {

        if (!props.svg || !props.visualisation) return;

        const svgNode = props.svg;

        if (!propsBySvgNode.has(svgNode)) {
            svgNode.addEventListener("mousedown", event => onChartPressed(svgNode, event));
        }

        propsBySvgNode.set(svgNode, props);
    };

    return {
        attach,
        createFilters,
        getAssociatedDataGrid,
        getChartFilters,
        getColumnIdOrHeading,
        getDataPoint,
        getPopOutUrl,
        getSettingsFilters,
        getSqlFileGridUrl,
        showDataPointGrid,
        showRowsGrid
    };
})();
