/**
 * Transforms data grouping settings ready for serialisation, such as converting column indexes to
 * IDs/headings.  The inverse is Ren.DataGroupingSettingsApplyer.
 */
Ren.DataGroupingSettingsTransformer = (() => {

    const prettifyValueFormatFunctions = groupings => {

        for (let i = 0, glen = groupings.length; i < glen; i++) {

            const grouping = groupings[i];
            const columns = grouping.columns;

            for (const columnIdOrHeading in columns) {

                const column = columns[columnIdOrHeading];

                if (column.valueFormatFunction && column.valueFormatFunction.length) {

                    for (let j = 0, vlen = column.valueFormatFunction.length; j < vlen; j++) {
                        column.valueFormatFunction[j] = Ren.FormatFunctionPrettifier.prettify(column.valueFormatFunction[j]);
                    }
                }
            }
        }
    };

    const transformFunctionArray = (column, propertyName, columnIdOrHeadingByIndex) => {

        const arr = column[propertyName];

        if (!arr) return;

        for (let v = 0, vlen = arr.length; v < vlen; v++) {

            const item = arr[v];

            if (!item || typeof item !== "object") continue;

            const params = item.parameters;

            if (params && params.columnIndex !== undefined) {

                params.column = columnIdOrHeadingByIndex[params.columnIndex];
                delete params.columnIndex;
            }
        }

        if (arr.length === 0) delete column[propertyName];
    };

    const transformEnumProperty = (obj, propertyName, enumType) => {

        if (!obj || obj[propertyName] === undefined) return;

        if (obj[propertyName] === enumType.Default) {
            delete obj[propertyName];
        }
        else {

            obj[propertyName] = Ren.ObjectUtils.getEnumKey(enumType, obj[propertyName]);
        }
    };

    const transformTotalsRow = transformedSettings => {

        transformEnumProperty(transformedSettings.totalsRow, "position", Ren.DataGridTotalsRowPositionEnum);
    };

    const transformLayout = transformedSettings => {

        transformEnumProperty(transformedSettings.layout, "groupCtrlsCountMode", Ren.GroupCtrlsCountModeEnum);

        if (transformedSettings.layout?.aggregationIndicator === Ren.AggregationIndicator.DEFAULT_MODE) {
            delete transformedSettings.layout.aggregationIndicator;
        }
    };

    /**
     * Transforms one sort level in place, whether the primary sortOrder or a "then by" level.
     */
    const transformSortLevel = (sortLevel, columnIdOrHeadingByIndex) => {

        if (sortLevel.columnIndex !== undefined) {

            sortLevel.column = columnIdOrHeadingByIndex[sortLevel.columnIndex];
            delete sortLevel.columnIndex;
        }

        delete sortLevel._compiledSortCalcFunctions;
        if (sortLevel.isDescending === false) delete sortLevel.isDescending;

        if (sortLevel.sortCalcFunction) {

            const specs = Array.isArray(sortLevel.sortCalcFunction)
                ? sortLevel.sortCalcFunction
                : [sortLevel.sortCalcFunction];

            for (let s = 0; s < specs.length; s++) {

                const spec = specs[s];

                if (Ren.ObjectUtils.isObject(spec)) {

                    const params = spec.parameters;

                    if (params && params.columnIndex !== undefined) {

                        params.column = columnIdOrHeadingByIndex[params.columnIndex];
                        delete params.columnIndex;
                    }
                }
            }
        }
        else {

            delete sortLevel.sortCalcFunction;
        }
    };

    /**
     * Transforms a sortOrder in place, or deletes it if unsorted, dropping any "then by" levels
     * lacking a valid column.
     */
    const transformSortOrder = (owner, columnIdOrHeadingByIndex) => {

        const sortOrder = owner.sortOrder;

        if (!sortOrder || sortOrder.columnIndex === undefined) return;

        if (sortOrder.columnIndex !== -1) {

            transformSortLevel(sortOrder, columnIdOrHeadingByIndex);

            if (sortOrder.thenBy && sortOrder.thenBy.length) {

                const keptLevels = [];

                for (let i = 0; i < sortOrder.thenBy.length; i++) {

                    const level = sortOrder.thenBy[i];

                    if (!level) continue;
                    if (level.columnIndex === -1 || level.columnIndex === null) continue;
                    if (level.columnIndex === undefined && level.column === undefined) continue;

                    transformSortLevel(level, columnIdOrHeadingByIndex);
                    keptLevels.push(level);
                }

                if (keptLevels.length) {
                    sortOrder.thenBy = keptLevels;
                }
                else {

                    delete sortOrder.thenBy;
                }
            }
            else {

                // Normalise the runtime's null/empty placeholder away.
                delete sortOrder.thenBy;
            }
        }
        else {

            delete owner.sortOrder;
        }
    };

    const transformGroupings = (groupings, columnIdOrHeadingByIndex) => {

        // Remove group by columns from each grouping that also appear in the next grouping,
        // keeping all parallel arrays (e.g. groupByCalcFunctions) in sync.
        for (let i = 0; i < groupings.length - 1; i++) {

            const grouping = groupings[i];
            const nextGrouping = groupings[i + 1];
            const currentIndexes = grouping.groupByColumnIndexes;
            const nextIndexes = nextGrouping.groupByColumnIndexes;

            if (!currentIndexes || !nextIndexes) continue;

            const currentCalcFunctions = grouping.groupByCalcFunctions;
            const newIndexes = [];
            const newCalcFunctions = currentCalcFunctions ? [] : null;

            for (let j = 0; j < currentIndexes.length; j++) {

                if (currentIndexes[j] === null || !nextIndexes.includes(currentIndexes[j])) {

                    newIndexes.push(currentIndexes[j]);
                    if (newCalcFunctions) newCalcFunctions.push(currentCalcFunctions[j]);
                }
            }

            grouping.groupByColumnIndexes = newIndexes;
            if (newCalcFunctions !== null) grouping.groupByCalcFunctions = newCalcFunctions;
        }

        for (let i = 0, glen = groupings.length; i < glen; i++) {

            const grouping = groupings[i];

            transformSortOrder(grouping, columnIdOrHeadingByIndex);

            if (grouping.groupByColumnIndexes !== undefined) {

                const groupByColumnIndexes = grouping.groupByColumnIndexes;
                let hasNull = false;

                for (let j = 0; j < groupByColumnIndexes.length; j++) {

                    if (groupByColumnIndexes[j] === null) { hasNull = true; break; }
                }

                if (!hasNull) {

                    const arr = new Array(groupByColumnIndexes.length);
                    for (let j = 0; j < groupByColumnIndexes.length; j++) arr[j] = columnIdOrHeadingByIndex[groupByColumnIndexes[j]];
                    grouping.groupByColumns = arr;
                }
            }

            delete grouping.groupByColumnIndexes;
            delete grouping.isGroupByColumn;

            if (grouping.groupByCalcFunctions === null ||
                (Array.isArray(grouping.groupByCalcFunctions) &&
                 grouping.groupByCalcFunctions.every(f => f === null))) {

                delete grouping.groupByCalcFunctions;
            }

            const columns = grouping.columns;

            for (const columnIdOrHeading in columns) {

                const column = columns[columnIdOrHeading];
                delete column.valueFormat;
                delete column.aggregatedValueFormat;

                if (column.aggregationType !== undefined) {
                    column.aggregationType = Ren.AggregationTypeEnum.AsString(column.aggregationType);
                }

                transformFunctionArray(column, "valueFormatFunction", columnIdOrHeadingByIndex);
                transformFunctionArray(column, "calcFunction", columnIdOrHeadingByIndex);
                transformFunctionArray(column, "cellStyleFunction", columnIdOrHeadingByIndex);
                transformFunctionArray(column, "rowStyleFunction", columnIdOrHeadingByIndex);
                transformFunctionArray(column, "cellTooltipFunction", columnIdOrHeadingByIndex);

                if (Ren.ObjectUtils.isEmptyObject(column)) {
                    delete columns[columnIdOrHeading];
                }
            }

            if (Ren.ObjectUtils.isEmptyObject(columns)) {
                delete grouping.columns;
            }
        }
    };

    const removeRecalculableGroupingProperties = groupings => {

        for (let i = 0, glen = groupings.length; i < glen; i++) {

            const grouping = groupings[i];
            delete grouping.groupingIndex;
            delete grouping.childGroupingIndex;
            delete grouping.parentGroupingIndex;
            delete grouping.isOutermostGrouping;

            // Derived from the compression dictionary each time the grouping is applied.
            delete grouping.columnsWithAppendedValues;
        }
    };

    const transformDataRows = (transformedSettings, tabularData, columnIdOrHeadingByIndex) => {

        const dataRows = transformedSettings.dataRows;

        if (dataRows) {

            if (dataRows.filter && !dataRows.filter.length) delete dataRows.filter;

            transformSortOrder(dataRows, columnIdOrHeadingByIndex);
            const filterSet = dataRows.filterSet;

            if (filterSet) {

                for (const _tableTitle in filterSet) {

                    if (!Object.prototype.hasOwnProperty.call(filterSet, _tableTitle)) continue;
                    const tabFilterSet = filterSet[_tableTitle];
                    const columnValueFilters = tabFilterSet.columnValueFilters;
                    const negatedColumns =
                        Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilterSet);

                    for (const columnIdOrHeading in columnValueFilters) {

                        if (!Object.prototype.hasOwnProperty.call(columnValueFilters, columnIdOrHeading)) continue;
                        const filterValues = columnValueFilters[columnIdOrHeading];
                        if (!filterValues) continue;

                        // A filter letting everything through is dropped: an inclusion list holding
                        // every value, or a negated one holding none.
                        if (negatedColumns.has(columnIdOrHeading)) {

                            if (filterValues.length === 0) columnValueFilters[columnIdOrHeading] = null;
                        }
                        else if (Ren.DataGroupingSettings_Services_HasFilter.columnValueFilterContainsAllDataValues(tabularData, columnValueFilters, columnIdOrHeading)) {

                            columnValueFilters[columnIdOrHeading] = null;
                        }
                    }
                }

                Ren.ObjectUtils.deleteEmptyObjectsAndArraysContainingOnlyNullOrUndefined(filterSet);
            }
        }
    };

    const transformColumnDefaults = transformedSettings => {

        const columnDefaults = transformedSettings.columnDefaults;

        if (columnDefaults) {

            const newColumns = {};

            for (const columnIdOrHeading in columnDefaults) {

                const colSettings = columnDefaults[columnIdOrHeading];
                newColumns[columnIdOrHeading] = colSettings;

                if (colSettings.aggregationType && typeof colSettings.aggregationType === "number") {
                    colSettings.aggregationType = Ren.AggregationTypeEnum.AsString(colSettings.aggregationType);
                }
            }
            transformedSettings.columns = newColumns;
        }
    };

    const removeRandomUnusedProperties = transformedSettings => {

        delete transformedSettings.containingReportGuid;
        delete transformedSettings.visualisationGuid;
        delete transformedSettings.tabularDataGuid;
        delete transformedSettings.dataSourceUri;
    };

    /**
     * Gets a copy of the settings with column indexes replaced with column IDs/headings, and some
     * properties reformatted or removed.
     */
    const transform = (tabularData, settings, pretty) => {

        const transformedSettings = {};
        const columnModels = tabularData.ColumnModels;
        const colCount = columnModels.length;
        const columnIdOrHeadingByIndex = new Array(colCount);

        for (let i = 0; i < colCount; i++) columnIdOrHeadingByIndex[i] = columnModels[i].ColumnIdOrHeading;

        if (settings.groupings && settings.groupings.entries) {

            transformedSettings.groupings = {
                entries: Ren.ObjectUtils.clone(settings.groupings.entries)
            };
            const groupings = transformedSettings.groupings.entries;
            if (pretty) prettifyValueFormatFunctions(groupings);
            transformGroupings(groupings, columnIdOrHeadingByIndex);
            removeRecalculableGroupingProperties(groupings);

            // Disabled groupings are already stored in transformed shape, so a straight clone
            // round-trips them for the editor.
            if (settings.groupings.disabledGroupings &&
                settings.groupings.disabledGroupings.length) {

                transformedSettings.groupings.disabledGroupings =
                    Ren.ObjectUtils.clone(settings.groupings.disabledGroupings);
            }
        }

        // dataRows is done separately, as its transform function takes further parameters.
        const cloneAndTransform = (key, transformFn) => {

            if (settings[key]) {

                transformedSettings[key] = Ren.ObjectUtils.clone(settings[key]);
                transformFn(transformedSettings);
            }
        };

        cloneAndTransform("totalsRow", transformTotalsRow);
        cloneAndTransform("layout", transformLayout);
        cloneAndTransform(
            "columnMenus",
            () => Ren.DataGroupingSettingsColumnMenus.transformColumnMenus(
                tabularData,
                transformedSettings.columnMenus
            )
        );

        if (settings.dataRows) {

            transformedSettings.dataRows = Ren.ObjectUtils.clone(settings.dataRows);
            transformDataRows(transformedSettings, tabularData, columnIdOrHeadingByIndex);
        }

        cloneAndTransform("columnDefaults", transformColumnDefaults);

        if (settings.signifier !== undefined) transformedSettings.signifier = settings.signifier;
        if (settings.outerFilterSet !== undefined) transformedSettings.outerFilterSet = Ren.ObjectUtils.clone(settings.outerFilterSet);
        if (settings.variationLabel !== undefined) transformedSettings.variationLabel = settings.variationLabel;
        if (settings.variationTooltip !== undefined) transformedSettings.variationTooltip = settings.variationTooltip;
        if (settings.doubleClick !== undefined) transformedSettings.doubleClick = Ren.ObjectUtils.clone(settings.doubleClick);
        if (settings.defaultRowVisualiser) transformedSettings.defaultRowVisualiser = settings.defaultRowVisualiser;

        removeRandomUnusedProperties(transformedSettings);

        Ren.ObjectUtils.deleteAllEmptyObjects(transformedSettings);

        return transformedSettings;
    };

    /**
     * Gets a copy of the settings in which each grouping's group by columns, which include those of
     * earlier groupings, are reduced to the columns it adds.
     */
    const humaniseGroupByColumns = settings => {

        const transformedSettings = Ren.ObjectUtils.clone(settings);
        const groupings = transformedSettings.groupings.entries;
        let previousGroupByColumns = null;

        for (let i = groupings.length - 1; i >= 0; i--) {

            const grouping = groupings[i];
            const groupByColumns = grouping.groupByColumns;
            const groupByCalcFunctions = grouping.groupByCalcFunctions;

            if (previousGroupByColumns && previousGroupByColumns.length > 0) {

                const columnsToRemove = groupByColumns.filter(column => previousGroupByColumns.includes(column));

                if (columnsToRemove.length > 0 && groupByCalcFunctions) {

                    const newCalcFunctions = [];
                    const newGroupByColumns = [];

                    for (let j = 0; j < groupByColumns.length; j++) {

                        if (!previousGroupByColumns.includes(groupByColumns[j])) {

                            newGroupByColumns.push(groupByColumns[j]);

                            if (groupByCalcFunctions[j]) {
                                newCalcFunctions.push(groupByCalcFunctions[j]);
                            }
                        }
                    }

                    grouping.groupByColumns = newGroupByColumns;
                    grouping.groupByCalcFunctions = newCalcFunctions.length > 0 ? newCalcFunctions : null;
                }
                else {

                    grouping.groupByColumns = groupByColumns.filter(column => !previousGroupByColumns.includes(column));
                }
            }

            previousGroupByColumns = groupByColumns;
        }
        return transformedSettings;
    };

    return {
        transform,
        humaniseGroupByColumns
    };
})();
