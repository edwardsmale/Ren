/**
 * Filter Module: column metadata, and the headings, captions and formatted values shown, honouring
 * the user's per-column overrides.
 */
Ren.FilterModule_Columns = (s) => {

    const {
        tabularData,
        visualisation,
        paras,
        sourceGroup,
        columnOverrides,
        columnModels,
        countColumnIndex,
        COUNT_COLUMN_HEADING,
        DEFAULT_ALL_LABEL,
        DEFAULT_BOTH_LABEL,
        AGGREGATION_TITLE_LABELS,
        BOOLEAN_OPTIONS,
        DERIVED_DATE_LEVELS,
        DERIVED_LEVEL_SEPARATOR
    } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { binning, counts, filterTarget, itemSettings } = s;

    // The data tab is named too, as a grid set's tabs all share one settings group.
    const getSourceDataGroupingSettings = () =>
        Ren.DataGroupingSettingsSource.resolve(
            sourceGroup,
            visualisation.sourceVisualisation,
            visualisation.sourceDataGroupingSettings,
            visualisation.dataTabIndex
        );

    const getGridState = () =>
        Ren.GridStateCollection.getGridState(
            visualisation.sourceVisualisation?.gridStateGroup ?? sourceGroup
        );

    // Gets the heading shown without a HeadingOverride: the grid's own override, or the heading.
    const getFallbackHeading = (columnModel, columnIndex) => {

        const gridOverride = getGridState()?.getDisplayHeadingOverride?.(columnIndex);
        return gridOverride ?? columnModel.Heading;
    };

    // ===== Hierarchy levels =====
    //
    // A level can be derived from a column by a calc function (a date column's Month), stored as
    // { column, calcFunction }.  Its columnIdOrHeading is a level key, so its settings never
    // collide with the raw column's; anything addressing the data uses getDataColumnId instead.

    // A parent grouping entry is a column identifier or { column, calcFunction }.
    const getEntryColumnIdOrHeading = (parentGrouping) =>
        typeof parentGrouping === "string" ? parentGrouping : parentGrouping?.column ?? null;

    const getEntryCalcFunction = (parentGrouping) =>
        typeof parentGrouping === "string" ? null : parentGrouping?.calcFunction ?? null;

    // Gets the column a hierarchy's settings are keyed on, which for a plain item is its own.
    const getLeafColumnIdOrHeading = (item) =>
        item.groupByLeafColumnIdOrHeading ?? item.columnIdOrHeading;

    const getLevelKey = (columnIdOrHeading, calcFunction) =>
        calcFunction ? columnIdOrHeading + DERIVED_LEVEL_SEPARATOR + calcFunction : columnIdOrHeading;

    // Gets the calc function a level key names, or null for a plain column.
    const getLevelCalcFunction = (columnIdOrHeading) => {

        const index = columnIdOrHeading?.indexOf(DERIVED_LEVEL_SEPARATOR) ?? -1;
        return index < 0 ? null : columnIdOrHeading.slice(index + DERIVED_LEVEL_SEPARATOR.length);
    };

    // Gets the real column a level key addresses.
    const getSourceColumnIdOrHeading = (columnIdOrHeading) => {

        const index = columnIdOrHeading?.indexOf(DERIVED_LEVEL_SEPARATOR) ?? -1;
        return index < 0 ? columnIdOrHeading : columnIdOrHeading.slice(0, index);
    };

    // Gets the column identifier a level addresses in the data, rather than its level key.
    const getDataColumnId = (column) =>
        column.sourceColumnIdOrHeading ?? column.columnIdOrHeading;

    // Shaped like an eligible column, so everything reading one works on it unchanged.
    const createDerivedLevel = (column, calcFunction) => {

        const levelName = DERIVED_DATE_LEVELS[calcFunction]?.name ?? calcFunction;

        return {
            columnIdOrHeading: getLevelKey(column.columnIdOrHeading, calcFunction),
            sourceColumnIdOrHeading: column.columnIdOrHeading,
            calcFunction,
            columnIndex: column.columnIndex,
            columnModel: column.columnModel,
            isEnum: false,
            isBoolean: false,
            distinctValues: null,
            fallbackHeading: column.fallbackHeading + " (" + levelName + ")"
        };
    };

    // Gets a hierarchy's chain of parent grouping entries, top first, which identifies its own
    // combination filter.
    const chainOf = (hierarchyColumns) => hierarchyColumns.map((column) =>
        column.calcFunction
            ? { column: getDataColumnId(column), calcFunction: column.calcFunction }
            : column.columnIdOrHeading);

    // Takes a display item or an eligible column.
    const resolveHeading = (item) =>
        columnOverrides[item.columnIdOrHeading]?.HeadingOverride || item.fallbackHeading;

    const resolveOptionText = (columnIdOrHeading, columnIndex, option) =>
        columnOverrides[columnIdOrHeading]?.ValueOverrides?.[option.value]
        ?? resolveDisplayText(columnIdOrHeading, columnIndex, option.value, option.baseText);

    // Gets "Both" when there are exactly two options, otherwise "All".
    const getDefaultAllLabel = (optionCount) =>
        optionCount === 2 ? DEFAULT_BOTH_LABEL : DEFAULT_ALL_LABEL;

    const resolveAllLabel = (columnIdOrHeading, optionCount) =>
        columnOverrides[columnIdOrHeading]?.AllLabelOverride || getDefaultAllLabel(optionCount);

    const getValueFormatFunctionSpecs = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.valueFormatFunction ?? null;

    // Gets a column's "Value format" functions, or null.  Compilation is cached per spec, so the
    // counts module reading them too costs nothing.
    const getValueFormatFunctions = (columnIdOrHeading) => {

        const specs = getValueFormatFunctionSpecs(columnIdOrHeading);
        if (!specs) return null;

        return specs.map((spec) => Ren.FormatFunctions.createFunction(spec, paras));
    };

    // summaryStats holds the { group, overall } stats "Show as" formats are relative to, or null.
    const formatDisplayValue = (columnIdOrHeading, aggregatedValue, summaryStats) => {

        const valueFormatFunctions = getValueFormatFunctions(columnIdOrHeading);
        if (!valueFormatFunctions) return aggregatedValue;

        // The value is the value column's aggregation, so the stats are read by its index.
        const valueColumnIndex = getValueColumnIndex(columnIdOrHeading);

        return Ren.ValueFormatter.formatValue(
            aggregatedValue,
            valueColumnIndex,
            Ren.SpreadsheetColumnFormatEnum.Number,
            valueFormatFunctions,
            null,
            summaryStats?.group,
            summaryStats?.overall
        );
    };

    // A format function can return HTML, detected as the data grid's cell renderer does.
    const setFormattedText = (element, text) => {

        if (typeof text === "string" && text.includes("<")) {
            element.innerHTML = text;
        }
        else {

            element.textContent = text;
        }
    };

    const isEnumColumn = (columnModel) =>
        Ren.ObjectUtils.isObject(columnModel.EnumValues)
        && Object.keys(columnModel.EnumValues).length > 0;

    const isBooleanColumn = (columnModel) =>
        columnModel.ColumnFormat === Ren.SpreadsheetColumnFormatEnum.Boolean;

    // Gets a column's distinct leaf values.  A null CV is normalised to the NULL sentinel the
    // filter matches on; an empty string is a value of its own, which the sentinel wouldn't match.
    const getDistinctColumnValues = (columnIndex) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const rowModels = tabularData.RowModels;
        const seen = new Set();
        const values = [];

        for (let rowIndex = 0; rowIndex < rowModels.length; rowIndex++) {

            if (tabularData.isGroupRow(rowIndex)) continue;

            let cellValue = decompressValue(rowModels[rowIndex].CV[columnIndex], columnIndex);

            if (cellValue === null || cellValue === undefined) cellValue = Ren.NullSentinel;

            const key = String(cellValue);
            const sizeBeforeAdd = seen.size;

            seen.add(key);

            if (seen.size !== sizeBeforeAdd) values.push(cellValue);
        }

        return values;
    };

    // Moves NULL entries to the front of a sorted array in place, as the sentinel would otherwise
    // sort wherever its character falls.
    const moveNullEntriesFirst = (array, valueSelector) => {

        let insertIndex = 0;

        for (let i = 0; i < array.length; i++) {

            if (!Ren.IsNull(valueSelector(array[i]))) continue;

            if (i !== insertIndex) array.splice(insertIndex, 0, array.splice(i, 1)[0]);
            insertIndex++;
        }
    };

    const sortDistinctValues = (values) => {

        values.sort((a, b) => {

            const isNullA = Ren.IsNull(a);
            const isNullB = Ren.IsNull(b);

            if (isNullA || isNullB) return isNullA === isNullB ? 0 : (isNullA ? -1 : 1);

            const numberA = Number(a);
            const numberB = Number(b);

            if (!isNaN(numberA) && !isNaN(numberB)) return numberA - numberB;
            return Ren.ArrayUtils.compareOrdinal(String(a), String(b));
        });

        return values;
    };

    // Scanned lazily, as most columns offered in "Add filter" are never added.
    const getDistinctValuesForColumn = (column) => {

        if (column.distinctValues) return column.distinctValues;

        column.distinctValues = sortDistinctValues(getDistinctColumnValues(column.columnIndex));
        return column.distinctValues;
    };

    // Gets the enum integer behind each label, as an enum column's cells hold its labels.
    const getEnumOrderByLabel = (column) => {

        if (column.enumOrderByLabel) return column.enumOrderByLabel;

        const enumValues = column.columnModel.EnumValues;
        const keys = Object.keys(enumValues);
        const enumOrder = new Map();

        for (let i = 0; i < keys.length; i++) {
            enumOrder.set(String(enumValues[keys[i]]), parseInt(keys[i], 10));
        }

        column.enumOrderByLabel = enumOrder;
        return enumOrder;
    };

    // The "Default" sort's key: the value itself, except that an enum sorts on its integers, as its
    // labels' alphabetical order means nothing.  A value the enum no longer holds sorts last, as a
    // non-number key would turn the whole sort alphabetical.
    const createValueSortKeyResolver = (column) => {

        if (!column?.isEnum) return (value) => value;

        const enumOrder = getEnumOrderByLabel(column);

        return (value) => enumOrder.get(String(value)) ?? Number.MAX_SAFE_INTEGER;
    };

    // Gets the index of the "Value column", or of the row-count column when none is chosen.
    const getValueColumnIndex = (columnIdOrHeading) => {

        const valueColumn = itemSettings.getValueConfig(columnIdOrHeading).column;

        return valueColumn
            ? tabularData.columnResolver.getColumnIndex(valueColumn)
            : countColumnIndex;
    };

    // Gets a sortable column's heading, falling back to its identifier.
    const getSortableColumnHeading = (columnIdOrHeading) => {

        const sortableColumns = s.sortableColumns;

        for (let i = 0; i < sortableColumns.length; i++) {

            if (sortableColumns[i].columnIdOrHeading === columnIdOrHeading) {
                return sortableColumns[i].heading;
            }
        }

        return columnIdOrHeading;
    };

    // Gets an option value's tooltip, such as "Distinct count of Order IDs".  A summed column is
    // named on its own, as summing is how a value reads by default.
    const getValueTitle = (columnIdOrHeading) => {

        const valueConfig = itemSettings.getValueConfig(columnIdOrHeading);

        if (!valueConfig.column) {

            return counts.countsGroupsForColumn(columnIdOrHeading)
                ? "Number of groups with this value"
                : "Number of rows with this value";
        }

        const heading = getSortableColumnHeading(valueConfig.column);

        if (!valueConfig.aggregationType || valueConfig.aggregationType === "Sum") return heading;

        const label = AGGREGATION_TITLE_LABELS[valueConfig.aggregationType] ?? valueConfig.aggregationType;

        return label + " of " + heading;
    };

    // Gets the totals-row tooltip.  A hierarchy takes its value from the top column and its
    // aggregation from the leaf, so the two are named separately.
    const getTotalValueTitle = (columnIdOrHeading, aggregationColumnIdOrHeading) => {

        // A group-counting item has no column behind its total to aggregate.
        if (counts.countsGroupsForColumn(columnIdOrHeading)) return "Total number of groups";

        const valueConfig = itemSettings.getValueConfig(columnIdOrHeading);
        const aggregationType = itemSettings.getTotalAggregationType(
            aggregationColumnIdOrHeading ?? columnIdOrHeading
        );

        const heading = valueConfig.column
            ? getSortableColumnHeading(valueConfig.column)
            : "rows with each value";

        if (aggregationType === "Sum") {
            return valueConfig.column ? "Total " + heading : "Total number of rows";
        }

        const label = AGGREGATION_TITLE_LABELS[aggregationType] ?? aggregationType;

        return label + " of " + heading;
    };

    // A derived level resolves to its source column, so its menus suit that column's type.
    const findEligibleColumn = (columnIdOrHeading) => {

        const eligibleColumns = s.eligibleColumns;
        const sourceColumnIdOrHeading = getSourceColumnIdOrHeading(columnIdOrHeading);

        for (let i = 0; i < eligibleColumns.length; i++) {

            if (eligibleColumns[i].columnIdOrHeading === sourceColumnIdOrHeading) {
                return eligibleColumns[i];
            }
        }

        return null;
    };

    // Gets a value indicating whether the target level's group rows hold the column's raw value,
    // which is only so of a column it groups by without a calc function.
    const isTargetGroupedByRawValue = (columnIndex) => {

        const grouping = filterTarget.getTargetGrouping();

        if (!grouping) return false;

        const indexInGrouping = (grouping.groupByColumnIndexes ?? []).indexOf(columnIndex);

        return indexInGrouping !== -1 && !grouping.groupByCalcFunctions?.[indexInGrouping];
    };

    // Gets the name of the auto menu (e.g. "brand") an item's values are given, or null.  A bin, a
    // derived level's value or a group row's aggregate isn't one of the column's own values, so
    // none is given one.
    const getAutoMenuName = (columnIdOrHeading) => {

        if (getLevelCalcFunction(columnIdOrHeading) || binning.hasBinning(columnIdOrHeading)) {
            return null;
        }

        const column = findEligibleColumn(columnIdOrHeading);

        if (!column) return null;

        if (filterTarget.isGroupingTarget && !isTargetGroupedByRawValue(column.columnIndex)) {
            return null;
        }

        return Ren.AutoMenu.getMenuNameForColumn(column.columnModel);
    };

    // Gets the "Label format" specs, or null.  A date-period level defaults to its period's format
    // ("Jan 2026"), as its values are period start dates.
    const getLabelFormatFunctionSpecs = (columnIdOrHeading) => {

        const specs = columnOverrides[columnIdOrHeading]?.labelFormatFunction;
        if (specs) return specs;

        const labelFormatFunction =
            DERIVED_DATE_LEVELS[getLevelCalcFunction(columnIdOrHeading)]?.labelFormatFunction;

        return labelFormatFunction ? [{ name: labelFormatFunction }] : null;
    };

    // Gets the label calc function specs applied before the label format, or null.
    const getLabelCalcFunctionSpecs = (columnIdOrHeading) => {

        const specs = columnOverrides[columnIdOrHeading]?.labelCalcFunction;

        return specs?.length ? specs : null;
    };

    // A checkbox stands for a value rather than a row, so @rowVals holds only its own column,
    // keyed by heading and column ID.  A function reading another column reads undefined.
    const setLabelRowValue = (rowValues, column, value) => {

        const columnModel = column?.columnModel;

        if (columnModel?.Heading != null) rowValues[columnModel.Heading] = value;
        if (columnModel?.ColumnId != null) rowValues[columnModel.ColumnId] = value;

        return rowValues;
    };

    const buildLabelRowValues = (column, value) => setLabelRowValue({}, column, value);

    // Leaves the calculated value in rowValues for the label format.  A function that throws leaves
    // the raw value, which still filters correctly.
    const applyLabelCalcFunctions = (specs, rowValues, column, rawValue) => {

        let value = rawValue;

        for (let i = 0; i < specs.length; i++) {

            try {

                const calcFunction = Ren.FormatFunctions.createFunction(specs[i], paras);
                value = calcFunction(value, rowValues, null, null, null);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[FilterModule] Error applying label calc function:",
                    e
                );

                return rawValue;
            }
        }

        setLabelRowValue(rowValues, column, value);

        return value;
    };

    // Formats a value through its column's format, as a grid cell does (8.79, not
    // 8.790000000000001).  A Boolean's or NULL's caption is shown as it stands.
    const formatBaseText = (column, columnFormat, rawValue, fallbackText) => {

        if (column?.isBoolean || Ren.IsNullOrEmpty(rawValue)) return fallbackText;

        return Ren.ValueFormatter.formatValueSimple(rawValue, columnFormat);
    };

    // Applies the label calc function and label format.  With no label format the value is shown
    // through the column's own format, as a grid cell is.
    const resolveDisplayText = (columnIdOrHeading, columnIndex, rawValue, fallbackText) => {

        // Bins ("0 - 10") are captions, which the column's own format would turn to nonsense.
        if (binning.hasBinning(columnIdOrHeading)) return fallbackText;

        const calcFunctionSpecs = getLabelCalcFunctionSpecs(columnIdOrHeading);
        const specs = getLabelFormatFunctionSpecs(columnIdOrHeading);

        const column = findEligibleColumn(columnIdOrHeading);
        const columnFormat = column?.columnModel?.ColumnFormat ?? Ren.SpreadsheetColumnFormatEnum.General;

        if (!calcFunctionSpecs && !specs) {
            return formatBaseText(column, columnFormat, rawValue, fallbackText);
        }

        const rowValues = buildLabelRowValues(column, rawValue);

        const value = calcFunctionSpecs
            ? applyLabelCalcFunctions(calcFunctionSpecs, rowValues, column, rawValue)
            : rawValue;

        if (!specs) return Ren.ValueFormatter.formatValueSimple(value, columnFormat);

        const labelFormatFunctions =
            specs.map((spec) => Ren.FormatFunctions.createFunction(spec, paras));

        return Ren.ValueFormatter.formatValue(
            value,
            columnIndex,
            columnFormat,
            labelFormatFunctions,
            rowValues
        );
    };

    // Not carried to labels: "default" (a reset), "blank" (leaves checkboxes captionless) and the
    // "Show as" formats, which have no summary stats behind a label to read.
    const isCarriedFunctionSpec = (spec) => {

        const name = spec?.name;

        if (name === undefined) return true;

        return name !== "default"
            && name !== "blank"
            && name.indexOf("percentage-of-") !== 0
            && name.indexOf("difference-from-") !== 0;
    };

    // Gets the column state of the rows the checkboxes are built from, and no wider, as a
    // grouping's cells inherit nothing from the data rows.
    const getSourceColumnState = (columnIdOrHeading) => {

        const settings = getSourceDataGroupingSettings();
        if (!settings) return null;

        const columns = filterTarget.isGroupingTarget
            ? filterTarget.getTargetGrouping()?.columns
            : settings.dataRows?.columns;

        return columns?.[columnIdOrHeading] ?? null;
    };

    // Gets the source column's specs under a property worth carrying over, or null.
    const getSourceColumnFunctionSpecs = (columnIdOrHeading, propertyName) => {

        const specs = Ren.ArrayUtils
            .ensureArray(getSourceColumnState(columnIdOrHeading)?.[propertyName])
            .filter((spec) => isCarriedFunctionSpec(spec));

        return specs.length ? specs : null;
    };

    // Gets a value indicating whether calc function specs are a single named binning function.
    const isBinningCalcFunction = (specs) =>
        specs.length === 1
        && typeof specs[0]?.name === "string"
        && Ren.FunctionTags.hasTag(specs[0].name, "binning");

    // Copies the grid column's functions to a new item's labels, so values read as in the grid.
    // An item with a choice of its own, "None" included, is left alone.
    const initialiseLabelFunctionsFromSourceColumn = (column, entry) => {

        if (entry.labelFormatFunction === undefined) {

            const specs = getSourceColumnFunctionSpecs(
                column.columnIdOrHeading,
                "valueFormatFunction"
            );

            if (specs) entry.labelFormatFunction = Ren.ObjectUtils.clone(specs);
        }

        // A group row arrives with its calc function already applied; data rows arrive raw.
        if (!filterTarget.isGroupingTarget && entry.labelCalcFunction === undefined) {

            const specs = getSourceColumnFunctionSpecs(column.columnIdOrHeading, "calcFunction");

            if (!specs) return;

            // A binning calc function (bin-lifecycle) maps many values to one, so it bins the
            // checkboxes rather than only relabelling one checkbox per raw value.
            if (isBinningCalcFunction(specs)) {

                if (entry.binningFunction === undefined) {

                    entry.binningFunction = Ren.ObjectUtils.clone(specs[0]);

                    // Not yet wired while a new popup initialises its items, with nothing cached.
                    counts.invalidateCountsForColumn?.(column.columnIdOrHeading);
                }

                return;
            }

            entry.labelCalcFunction = Ren.ObjectUtils.clone(specs);
        }
    };

    // A new item for a number, date or enum column sorts by value, as it is only navigable in that
    // order.  Booleans read as "Yes"/"No" captions, so are left alone, as is an existing choice.
    const initialiseNaturalOrderSortForColumn = (column, entry) => {

        if (entry.sortByValue !== undefined || column.isBoolean) return;

        const columnFormat = column.columnModel?.ColumnFormat;

        const isOrdered = column.isEnum
            || Ren.SpreadsheetColumnFormatEnum.IsNumeric(columnFormat)
            || Ren.SpreadsheetColumnFormatEnum.IsDate(columnFormat);

        if (isOrdered) entry.sortByValue = true;
    };

    // Initialises the column a "Column Filter..." popup is created showing.  Only where the creator
    // asks, so a reopened saved report reads exactly as it was saved.
    const initialiseNewItemSettingsForIncludedColumns = () => {

        if (!visualisation.initLabelFunctionsFromSource) return;

        const eligibleColumns = s.eligibleColumns;

        for (let i = 0; i < eligibleColumns.length; i++) {

            const entry = columnOverrides[eligibleColumns[i].columnIdOrHeading];
            if (entry?.included !== true) continue;

            initialiseLabelFunctionsFromSourceColumn(eligibleColumns[i], entry);
            initialiseNaturalOrderSortForColumn(eligibleColumns[i], entry);
        }
    };

    // Enum columns need no mapping, as their cells already hold the label.
    const resolveBaseText = (columnIdOrHeading, rawValue) => {

        const column = findEligibleColumn(columnIdOrHeading);

        if (column?.isBoolean) {

            const valueString = String(rawValue);

            for (let i = 0; i < BOOLEAN_OPTIONS.length; i++) {
                if (BOOLEAN_OPTIONS[i].value === valueString) return BOOLEAN_OPTIONS[i].text;
            }
        }

        return Ren.ValueDisplayLabel(rawValue);
    };

    // A node's value comes from the hierarchy's grouping, so its base text needs deriving.
    const resolveNodeText = (node) =>
        resolveOptionText(node.columnIdOrHeading, node.columnIndex, {
            value: node.valueString,
            baseText: resolveBaseText(node.columnIdOrHeading, node.value)
        });

    // Stores the columns offered in "Add filter", and those offered in "Sort by" and "Value column"
    // (which include __Count as "Row Count"), on the shared context.
    const initColumnMetadata = () => {

        const eligibleColumns = [];

        for (let columnIndex = 0; columnIndex < columnModels.length; columnIndex++) {

            const columnModel = columnModels[columnIndex];

            // Skip internal helper columns (e.g. __Count).
            if (columnModel.Heading && columnModel.Heading.includes("__")) continue;

            const columnIsEnum = isEnumColumn(columnModel);
            const columnIsBoolean = !columnIsEnum && isBooleanColumn(columnModel);

            const columnIdOrHeading =
                columnModel.ColumnIdOrHeading ?? columnModel.ColumnId ?? columnModel.Heading;

            // A grouping level only offers the columns its group rows carry.
            if (!filterTarget.isColumnFilterable(columnIndex, columnIdOrHeading)) continue;

            eligibleColumns.push({
                columnIdOrHeading,
                columnIndex,
                columnModel,
                isEnum: columnIsEnum,
                isBoolean: columnIsBoolean,
                distinctValues: null,
                fallbackHeading: getFallbackHeading(columnModel, columnIndex)
            });
        }

        const sortableColumns = [];

        for (let columnIndex = 0; columnIndex < columnModels.length; columnIndex++) {

            const columnModel = columnModels[columnIndex];

            if (columnIndex === countColumnIndex) {

                sortableColumns.push({
                    columnIdOrHeading: COUNT_COLUMN_HEADING,
                    columnIndex,
                    heading: "Row Count"
                });
                continue;
            }

            if (columnModel.Heading && columnModel.Heading.includes("__")) continue;

            sortableColumns.push({
                columnIdOrHeading:
                    columnModel.ColumnIdOrHeading ?? columnModel.ColumnId ?? columnModel.Heading,
                columnIndex,
                heading: getFallbackHeading(columnModel, columnIndex)
            });
        }

        s.eligibleColumns = eligibleColumns;
        s.sortableColumns = sortableColumns;
    };

    return {
        getSourceDataGroupingSettings,
        getEntryColumnIdOrHeading,
        getEntryCalcFunction,
        getLeafColumnIdOrHeading,
        getLevelKey,
        getLevelCalcFunction,
        getDataColumnId,
        createDerivedLevel,
        chainOf,
        resolveHeading,
        resolveOptionText,
        getDefaultAllLabel,
        resolveAllLabel,
        setFormattedText,
        moveNullEntriesFirst,
        getDistinctValuesForColumn,
        createValueSortKeyResolver,
        getValueColumnIndex,
        getValueTitle,
        getTotalValueTitle,
        findEligibleColumn,
        getAutoMenuName,
        initialiseLabelFunctionsFromSourceColumn,
        initialiseNaturalOrderSortForColumn,
        initialiseNewItemSettingsForIncludedColumns,
        getValueFormatFunctionSpecs,
        getValueFormatFunctions,
        getLabelFormatFunctionSpecs,
        formatDisplayValue,
        resolveDisplayText,
        resolveBaseText,
        resolveNodeText,
        initColumnMetadata
    };
};
