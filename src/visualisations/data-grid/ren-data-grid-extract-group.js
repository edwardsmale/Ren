/**
 * A grid group row's "Open group in new grid", which opens a popup grid of only the rows in that
 * group.  The popup takes the source grid's settings from the group's level inwards, with the
 * group's own column settings on its totals row, and the source grid's state.
 */
Ren.DataGrid_ExtractGroup = (() => {

    const ROW_INDEXES_PREDICATE_TYPE = "includeRowIndexes";

    /**
     * Gets the data row indexes of the rows in a group that the source grid's filters let through.
     */
    const getIncludedRowIndexes = (tabularData, dataGroupingSettings, group) => {

        const compiledFilter = dataGroupingSettings.hasFilter()
            ? Ren.Filter.createCompiledFilter(tabularData, dataGroupingSettings)
            : null;
        const excludedRowsMask = compiledFilter ? compiledFilter.getExcludedRowsMask() : null;
        const buffer = group.containedRowIndexBuffer;
        const start = group.containedRowIndexStart;
        const rowIndexes = [];

        for (let index = 0; index < group.containedRowIndexCount; index++) {

            const rowIndex = buffer[start + index];

            if (excludedRowsMask && excludedRowsMask[rowIndex] === 1) continue;

            rowIndexes.push(rowIndex);
        }

        return rowIndexes;
    };

    /**
     * Gets a value indicating whether a column's format functions include one that blanks it.
     */
    const isBlankFormat = (valueFormatFunction) => {

        if (!Array.isArray(valueFormatFunction)) return false;

        for (let index = 0; index < valueFormatFunction.length; index++) {

            if (valueFormatFunction[index]?.name === "blank") return true;
        }

        return false;
    };

    /**
     * Gives a column that is formatted as blank the parent grouping's format for it, or Normal
     * where that is blank too.
     */
    const replaceBlankFormat = (columns, columnKey, parentColumn) => {

        const column = columns?.[columnKey];

        if (!column || !isBlankFormat(column.valueFormatFunction)) return;

        if (parentColumn?.valueFormatFunction && !isBlankFormat(parentColumn.valueFormatFunction)) {

            column.valueFormatFunction = Ren.ObjectUtils.clone(parentColumn.valueFormatFunction);
        }
        else {

            column.valueFormatFunction = [{ name: "default" }];
        }

        if (parentColumn?.valueFormat !== undefined) {
            column.valueFormat = parentColumn.valueFormat;
        }
    };

    /**
     * Cuts serialised settings' groupings down to those inside a level, the totals row taking the
     * level's column settings, as it stands for the level's group.
     */
    const cutGroupingsToLevel = (settings, levelIndex) => {

        const entries = settings.groupings.entries;
        const outermostGrouping = Ren.ObjectUtils.clone(Ren.ArrayUtils.last(entries));

        outermostGrouping.columns = Ren.ObjectUtils.clone(entries[levelIndex].columns ?? {});

        const extractedEntries = entries.slice(0, levelIndex);

        extractedEntries.push(outermostGrouping);
        settings.groupings.entries = extractedEntries;
    };

    /**
     * Gets the source grid's settings in serialised form, cut down to the groupings inside the
     * clicked one and to the given rows.
     */
    const getExtractedSettings = (
        tabularData,
        dataGroupingSettings,
        grouping,
        columnIndex,
        rowIndexes) => {

        const settings = Ren.DataGroupingSettingsTransformer.transform(
            tabularData,
            dataGroupingSettings
        );

        const levelIndex = dataGroupingSettings.groupings.entries.indexOf(grouping);
        const entries = settings.groupings.entries;

        cutGroupingsToLevel(settings, levelIndex);

        const extractedEntries = settings.groupings.entries;

        // The clicked column's values were shown by the dropped group rows, so wherever the popup
        // blanks it, it takes the clicked level's format instead.
        if (grouping.groupByColumnIndexes.indexOf(columnIndex) !== -1) {

            const columnKey = tabularData.ColumnModels[columnIndex].ColumnIdOrHeading;
            const parentColumn = entries[levelIndex].columns?.[columnKey];

            for (let index = 0; index < extractedEntries.length; index++) {
                replaceBlankFormat(extractedEntries[index].columns, columnKey, parentColumn);
            }

            replaceBlankFormat(settings.dataRows?.columns, columnKey, parentColumn);
        }

        // The rows are named outright, in place of any the Find window's Filter Rows named.
        settings.dataRows ??= {};

        const accessors = Ren.DataGroupingSettings_Services_FilterAccessors;
        const predicates = accessors
            .getRowFilterPredicates(settings.dataRows, tabularData)
            .filter((predicate) => predicate?.type !== ROW_INDEXES_PREDICATE_TYPE);

        predicates.push({ type: ROW_INDEXES_PREDICATE_TYPE, rowIndexes });
        accessors.setRowFilterPredicates(settings.dataRows, tabularData, predicates);

        settings.signifier = Ren.RandomUtils.generateRandomClassName();

        return settings;
    };

    /**
     * Gets the parent grouping of a grouping, or null for the outermost.
     */
    const getParentGrouping = (dataGroupingSettings, grouping) =>
        grouping.parentGroupingIndex || grouping.parentGroupingIndex === 0
            ? dataGroupingSettings.groupings.entries[grouping.parentGroupingIndex]
            : null;

    /**
     * Gets the popup's title: the clicked group's values in the columns it is grouped by, each
     * formatted as its cell in the group row is.
     */
    const getTitle = (tabularData, dataGroupingSettings, group, grouping) => {

        const columnIndexes = grouping.groupByColumnIndexes;
        const columnFormats = dataGroupingSettings.getColumnValueFormats(grouping.columns);
        const overallSummaryStats = dataGroupingSettings.getOverallSummaryStats();
        const parentGrouping = getParentGrouping(dataGroupingSettings, grouping);
        const groupSummaryStats = parentGrouping
            ? parentGrouping
                .getGroupContainingGroup(group.groupRowIndex - tabularData.DataRowCount)
                ?.summaryStats
            : overallSummaryStats;
        const groupRow = group.groupValues.getRow(group.position);
        const rowVals = Ren.RowValues.getRowValuesForFormatFunction(tabularData, groupRow, true);
        const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
            tabularData,
            groupRow
        );

        const values = [];

        for (let index = 0; index < columnIndexes.length; index++) {

            const columnIndex = columnIndexes[index];
            const value = tabularData.CompressionDictionary.decompressValue(
                group.groupValues.get(group.position, columnIndex),
                columnIndex
            );

            if (value == null || value === Ren.NullSentinel) {

                values.push("(blank)");
                continue;
            }

            dataGroupingSettings.summaryStats.lazyPopulateSummaryStats(
                columnFormats,
                columnIndex,
                parentGrouping
            );

            const formattedValue = Ren.DataGridCellSelection_CellValueTextualiser.textualise(
                Ren.ValueFormatter.formatValue(
                    String(value),
                    columnIndex,
                    columnFormats.columnValueFormats[columnIndex],
                    columnFormats.columnFormatFunctions[columnIndex],
                    rowVals,
                    groupSummaryStats,
                    overallSummaryStats,
                    compressedRowVals
                )
            );

            // A format that blanks the value would leave nothing to name the group by.
            values.push(formattedValue || Ren.TextUtils.stripSortPrefix(String(value)));
        }

        return values.length ? values.join(" / ") : "Extracted data";
    };

    /**
     * Builds the filter to the clicked group's rows, by its values and those of the groups it is
     * in, as rows of a grid that is not grouped as the source grid is would read them.  A binned
     * group-by column is matched on the bin each row's value falls in.
     */
    const buildGroupPathPredicate = (tabularData, dataGroupingSettings, group, grouping) => {

        const entries = dataGroupingSettings.groupings.entries;
        const columns = [];
        const calcFunctions = [];
        const tuple = [];
        let levelIndex = entries.indexOf(grouping);
        let levelGroup = group;

        // The outermost grouping is the totals row, grouped by nothing.
        while (levelGroup && levelIndex < entries.length - 1) {

            const levelGrouping = entries[levelIndex];
            const groupByColumnIndexes = levelGrouping.groupByColumnIndexes ?? [];

            for (let index = 0; index < groupByColumnIndexes.length; index++) {

                const columnIndex = groupByColumnIndexes[index];
                const calcFunction = levelGrouping.groupByCalcFunctions?.[index] ?? null;
                const value = tabularData.CompressionDictionary.decompressValue(
                    levelGroup.groupValues.get(levelGroup.position, columnIndex),
                    columnIndex
                );

                columns.push(tabularData.ColumnModels[columnIndex].ColumnIdOrHeading);
                calcFunctions.push(calcFunction);
                tuple.push(calcFunction && value != null
                    ? Ren.TextUtils.stripSortPrefix(String(value))
                    : value
                );
            }

            levelIndex++;
            levelGroup = entries[levelIndex].getGroupContainingGroup(
                levelGroup.groupRowIndex - tabularData.DataRowCount
            );
        }

        if (!columns.length) return null;

        return { type: "includeCombinations", columns, calcFunctions, tuples: [tuple] };
    };

    /**
     * Gets the URL the popup grid pops out to: its SQL file's grid page, filtered by the popup's
     * filters as they now are and to the clicked group's rows.  Its rows are named by their values
     * rather than by their indexes, which the page's own copy of the data need not share.
     */
    const getPopOutUrl = (
        sqlFileGridUrl,
        tabularData,
        settings,
        groupPathPredicate,
        popOutDetails) => {

        const dataPointGrid = Ren.DateValueChart_DataPointGrid;
        const filters = dataPointGrid.getSettingsFilters(settings, tabularData);

        filters.predicates = filters.predicates
            .filter((predicate) => predicate?.type !== ROW_INDEXES_PREDICATE_TYPE);

        if (groupPathPredicate) filters.predicates.push(groupPathPredicate);

        return dataPointGrid.getPopOutUrl(
            sqlFileGridUrl,
            popOutDetails,
            tabularData,
            () => filters
        );
    };

    /**
     * Gets a value indicating whether a group can be opened in a new grid: it must be in a
     * grouping between the leaf and outermost ones, and contain rows.
     */
    const canExtractGroup = (dataGroupingSettings, group, grouping) => {

        if (!grouping || grouping.isOutermostGrouping) return false;
        if (grouping.groupByColumnIndexes?.length === 0) return false;
        if (!group || !(group.containedRowIndexCount > 0)) return false;

        return dataGroupingSettings.groupings.entries.indexOf(grouping) !== -1;
    };

    /**
     * Opens a popup grid of the rows in a group of a grid's, grouped and laid out as they are in
     * that grid from the group's level inwards, or, as its All columns variation, ungrouped.
     */
    const extractGroup = (
        visualisation,
        tabularData,
        dataGroupingSettings,
        gridState,
        group,
        grouping,
        columnIndex) => {

        const rowIndexes = getIncludedRowIndexes(tabularData, dataGroupingSettings, group);
        const extractedSettings = getExtractedSettings(
            tabularData,
            dataGroupingSettings,
            grouping,
            columnIndex,
            rowIndexes
        );

        const gridStateTransformed = gridState
            ? Ren.GridStateTransformer.transform(tabularData, gridState)
            : null;
        const settingsGroup = Ren.RandomUtils.generateRandomClassName("extracted-group-grid");
        const dataTabIndex = tabularData.dataTabIndex ?? tabularData.DataTabIndex ?? 1;
        const title = getTitle(tabularData, dataGroupingSettings, group, grouping);
        const sqlFileGridUrl =
            Ren.DateValueChart_DataPointGrid.getSqlFileGridUrl(visualisation.dataSourceUri);
        const groupPathPredicate =
            buildGroupPathPredicate(tabularData, dataGroupingSettings, group, grouping);

        // Until the popup's own settings are registered, the source grid's stand in for them.
        let popupSettings = dataGroupingSettings;

        const gridSet = Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "GridSet",
            dataSourceUri: visualisation.dataSourceUri,
            sqlFilename: visualisation.sqlFilename,
            tabularDataTransformers: visualisation.tabularDataTransformers,
            dataGroupingSettingsGroup: settingsGroup,
            dataTabIndexes: [dataTabIndex],
            excludeFromSerialization: true,
            gridStateGroup: settingsGroup,
            isPopup: true,
            maxHeight: "calc(100% - 22px)",
            maxWidth: "100%",
            popupTitle: title,
            popupShowPopoutButton: sqlFileGridUrl !== null,
            resizeToFitContentOnLoad: true,
            settingsNonSerializable: true
        });

        if (sqlFileGridUrl && gridSet?.popup) {

            Ren.SetupPopOutButton(
                gridSet.popup,
                () => getPopOutUrl(
                    sqlFileGridUrl,
                    tabularData,
                    popupSettings,
                    groupPathPredicate,
                    {
                        dataTabIndex,
                        popupTitle: title,
                        dataGroupingSettingsGroup: settingsGroup,
                        gridStateGroup: settingsGroup,
                        visualisationGuid: gridSet.visualisationGuid
                    }
                )
            );
        }

        // The grid registers its settings as it is built, which may be after the call above
        // returns, so applying them waits for them.
        Ren.DataGroupingSettingsCollection.waitForDataGroupingSettings(
            settingsGroup,
            gridSet?.visualisationGuid,
            (settings) => Ren.FnUtils.defer(() => {

                popupSettings = settings;

                Ren.DataGrid_PopupVariations.addVariations(
                    settings,
                    tabularData,
                    extractedSettings,
                    gridStateTransformed
                );
            })
        );
    };

    return {
        canExtractGroup,
        cutGroupingsToLevel,
        extractGroup,
        replaceBlankFormat
    };
})();
