Ren.SortFilterGroup_Applyer = (tabularData, dataGroupingSettings, expandedGroups) => {

    const INDEX_OF__COUNT_COLUMN = 0;
    const onChangedCallbacks = [];

    // The data-row filter for the pass currently being applied, resolved once in doApplySettings
    // rather than per leaf group, since both are costly to work out and neither can change part-way
    // through a pass.
    let passHasFilter = false;
    let passCompiledFilter = null;

    // Scratch settings, built only to read aggregated values, are never rendered and so hold no
    // rowYs array to write positions into.  Writing to one anyway would turn it into a sparse
    // (dictionary mode) array, which costs far more than the rowYs it was meant to save.
    let passTracksRowDisplay = true;

    // The compiled group-level predicate check of each grouping for the pass currently being
    // applied, keyed by the grouping, so each level is compiled at most once per pass.
    let passGroupPredicateChecks = new Map();

    // Likewise each grouping's compiled column value filter check, as a binned level's filter
    // lists every raw value its bins cover and scanning it once per group froze the page.
    let passGroupColumnValueChecks = new Map();

    // The page size for the pass currently being applied, or 0 where the rows are not paged.
    let passPageSize = 0;

    const onChanged = callback => { onChangedCallbacks.push(callback); };

    const compileSortCalcFunctionSpecs = specs => {

        const arr = Array.isArray(specs) ? specs : [specs];
        const compiled = [];

        for (let i = 0; i < arr.length; i++) {

            try {

                const fn = Ren.FormatFunctions.createFunction(
                    arr[i],
                    Ren.ReportInputParameters.getInputParametersForGuid(
                        dataGroupingSettings.containingReportGuid
                    )
                );

                if (fn) compiled.push(fn);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[SortFilterGroupApplyer] Error creating sortCalcFunction:",
                    e
                );
            }
        }

        return compiled.length ? compiled : null;
    };

    const applyCompiledSortCalcFunctions = (value, compiledFunctions) => {

        let v = value;

        for (let i = 0; i < compiledFunctions.length; i++) {

            try {

                v = compiledFunctions[i](v, null, null, null, null);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[SortFilterGroupApplyer] Error applying sortCalcFunction:",
                    e
                );
            }
        }

        return v;
    };

    /**
     * Returns the compiled sortCalcFunctions for a sortOrder, compiling and caching on first use.
     * Returns null if no sortCalcFunction is specified.
     */
    const getCompiledSortCalcFunctions = sortOrder => {

        if (!sortOrder.sortCalcFunction) return null;

        if (sortOrder._compiledSortCalcFunctions === undefined) {
            sortOrder._compiledSortCalcFunctions = compileSortCalcFunctionSpecs(sortOrder.sortCalcFunction);
        }

        return sortOrder._compiledSortCalcFunctions;
    };

    /**
     * Updates rowYs to reflect the sort, filter and group settings.
     */
    const applySettings = () => {

        const rowYs = dataGroupingSettings.rowYs;
        const headingCount = tabularData.HeadingCount;
        const len = rowYs.length;

        for (let rowIndex = 0; rowIndex < len; rowIndex++) {
            rowYs[rowIndex] = rowIndex < headingCount ? rowIndex : -1;
        }

        doApplySettings(tabularData, dataGroupingSettings);

        // Before the callbacks, as a grid reads the rows in view from it to render them.
        dataGroupingSettings.updateRowYIndexes();

        Ren.Messages.Events.columnsMoved.notify();

        // Copy callbacks in case the array is modified during iteration
        for (let i = 0, l = onChangedCallbacks.length; i < l; i++) {
            onChangedCallbacks[i]();
        }
    };

    /**
     * Sorts the groupOrder entries in place by the sort column's compressed values as they stand,
     * and returns whether it could.
     *
     * The server sorts the compression dictionary ordinally, so ordering the indexes numerically
     * orders the values they stand for.  This fails for a column holding a value the client
     * derived, which is appended to the dictionary unsorted, or one the dictionary never held.  A
     * date column's values are milliseconds rather than indexes, which order themselves.
     */
    const sortGroupOrderByCompressedIndex = (
        groupOrder, sortColumnIndex, isDescending, columnsWithAppendedValues
    ) => {

        if (!tabularData.IsColumnCompressed?.[sortColumnIndex]) return false;
        if (columnsWithAppendedValues?.[sortColumnIndex]) return false;

        const isEpochColumn = tabularData.CompressionDictionary.isEpochColumn(sortColumnIndex);

        const sortedDictionarySize = isEpochColumn
            ? Infinity
            : tabularData.CompressionDictionary.sortedDictionarySize;

        // A date before 1970 is negative, so a NULL is put below every date there can be.
        const nullValue = isEpochColumn ? Number.MIN_SAFE_INTEGER : -1;

        for (let i = 0; i < groupOrder.length; i++) {

            const group = groupOrder[i].group;
            const compressed = group.groupValues.get(group.position, sortColumnIndex);

            // A group with no value for the column sorts ahead of every value in it, which is
            // where the NULL it stands for sits: the sentinel is dictionary index 0, ahead of
            // everything else (see CompressionDictionary's firstOrdinalIndex).
            if (compressed == null) {

                groupOrder[i].value = nullValue;
                continue;
            }

            if (typeof compressed !== "number" || compressed >= sortedDictionarySize) return false;

            groupOrder[i].value = compressed;
        }

        Ren.ArrayUtils.sortNumeric(groupOrder, r => r.value, isDescending);

        return true;
    };

    /**
     * Gets the functions placing a value in each named order - day order, then the config's
     * custom sort orders - each returning -1 for a value outside its order.
     */
    const getNamedOrderIndexGetters = () => {

        const customGetters = Ren.CustomSortOrders.getIndexGetters();
        const getters = [Ren.ArrayUtils.getDayOfWeekIndex];

        for (let i = 0; i < customGetters.length; i++) {
            getters.push(customGetters[i]);
        }

        return getters;
    };

    /**
     * Sorts the groupOrder entries in place into a named order (such as day order, Monday first),
     * where getOrderIndex places every group's value for the sort column, and returns whether it
     * could.  getOrderIndex returns -1 for a value outside the order. Decorating stops at the first
     * such value, so any other column costs next to nothing to rule out.
     */
    const sortGroupOrderByNamedOrder = (groupOrder, decorate, getOrderIndex, isDescending) => {

        let foundName = false;

        for (let i = 0; i < groupOrder.length; i++) {

            const value = decorate(groupOrder[i]);

            if (value === null || value === "" || value === Ren.NullSentinel) continue;

            if (getOrderIndex(value) === -1) return false;

            foundName = true;
        }

        if (!foundName) return false;

        Ren.ArrayUtils.sortNumeric(groupOrder, r => getOrderIndex(r.value), isDescending);

        return true;
    };

    /**
     * Sorts the groupOrder entries in place by a single sort level (a sortOrder-shaped object:
     * columnIndex, isDescending, optional sortCalcFunction).  The underlying sorts are stable, so
     * successive passes can layer sort levels on top of each other.
     */
    const sortGroupOrderByLevel = (groupOrder, sortLevel, columnsWithAppendedValues) => {

        const sortColumnIndex = sortLevel.columnIndex;
        const compiledSortCalcFunctions = getCompiledSortCalcFunctions(sortLevel);
        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        // A group's values are compressed where possible, so decompress before sorting.
        const decorate = (entry) => {

            const group = entry.group;

            let value = decompressValue(
                group.groupValues.get(group.position, sortColumnIndex),
                sortColumnIndex
            );

            if (compiledSortCalcFunctions) {
                value = applyCompiledSortCalcFunctions(value ?? "", compiledSortCalcFunctions);
            }

            entry.value = value;
            return value;
        };

        // Check if all values are numeric or null (JS null or NullSentinel), so we can sort
        // numerically even when some groups have no data.  Aggregated numerics come back as strings
        // (e.g. "9"), so parseFloat is used rather than typeof.  The check stops at the first value
        // that settles it.
        let allNumericOrNull = true;

        for (let i = 0; i < groupOrder.length; i++) {

            const v = decorate(groupOrder[i]);
            if (v === null || v === Ren.NullSentinel) continue;
            if (typeof v === "number") continue;
            if (!isNaN(parseFloat(v)) && isFinite(v)) continue;
            allNumericOrNull = false;
            break;
        }

        if (allNumericOrNull) {

            Ren.ArrayUtils.sortNumeric(
                groupOrder,
                r => {

                    const v = r.value;
                    if (v === null || v === Ren.NullSentinel) return -Infinity;
                    return typeof v === "number" ? v : parseFloat(v);
                },
                sortLevel.isDescending
            );

            return;
        }

        // Day names read as a week, so they sort Monday first rather than by where the dictionary
        // put them, which is what the compressed-index sort below would give.  Values making up
        // one of the config's custom sort orders likewise sort in that order.
        const namedOrders = getNamedOrderIndexGetters();

        for (let i = 0; i < namedOrders.length; i++) {

            if (sortGroupOrderByNamedOrder(
                groupOrder,
                decorate,
                namedOrders[i],
                sortLevel.isDescending
            )) {

                return;
            }
        }

        // A sortCalcFunction's result is a value of its own rather than the column's, so a level
        // that has one is sorted by that result and not by where the column's value sits in the
        // dictionary.
        if (!compiledSortCalcFunctions &&
            sortGroupOrderByCompressedIndex(
                groupOrder,
                sortColumnIndex,
                sortLevel.isDescending,
                columnsWithAppendedValues
            )) {

            return;
        }

        // Decorating stopped where the numeric check settled, and the attempt above may have
        // overwritten some entries with indexes, so every entry is decorated again from the start.
        for (let i = 0; i < groupOrder.length; i++) {
            decorate(groupOrder[i]);
        }

        Ren.ArrayUtils.sortAuto(groupOrder, r => r.value ?? "", sortLevel.isDescending);
    };

    /**
     * Sorts the groups based on the sort order specified in the grouping, and returns an array of
     * group indexes in the order they should be displayed.  Supports multi-level sorting: the
     * primary sortOrder plus any additional levels in sortOrder.thenBy.
     */
    const sort = (groups, grouping) => {

        const sortOrder = grouping.sortOrder;
        const sortColumnIndex = sortOrder.columnIndex;

        if (sortColumnIndex === -1) {

            // Return the group indexes in their natural order.
            return Array.from(groups.keys());
        }

        // The sort levels in priority order: the primary sort, then each "then by" level.
        const sortLevels = [sortOrder];
        const thenBy = sortOrder.thenBy;

        if (thenBy) {

            for (let i = 0; i < thenBy.length; i++) {

                const level = thenBy[i];

                if (level && level.columnIndex != null && level.columnIndex !== -1) {
                    sortLevels.push(level);
                }
            }
        }

        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        const groupOrder = [];
        groups.forEach((group, groupIndex) => {

            // Only include groups that will be shown (have non-zero count)
            const count = decompressValue(
                group.groupValues.get(group.position, INDEX_OF__COUNT_COLUMN),
                INDEX_OF__COUNT_COLUMN
            );

            if (count === "0") return;

            groupOrder.push({ groupIndex, group, value: null });
        });

        if (groupOrder.length === 0) {
            return [];
        }

        // Sort by the least significant level first: each pass is stable, so more significant
        // levels applied later dominate while later levels survive as tie-breaks.
        for (let i = sortLevels.length - 1; i >= 0; i--) {
            sortGroupOrderByLevel(groupOrder, sortLevels[i], grouping.columnsWithAppendedValues);
        }

        const sortedGroupIndexes = new Array(groupOrder.length);

        for (let i = 0, l = groupOrder.length; i < l; i++) {
            sortedGroupIndexes[i] = groupOrder[i].groupIndex;
        }
        return sortedGroupIndexes;
    };

    /**
     * Derives the sort value for a single data row on a given sort column, matching the per-row
     * logic used by each sort level: a calc'd column uses its transformed value (numeric strings
     * parsed to numbers so they compare numerically), otherwise the original CV, and any
     * sortCalcFunction is applied last.
     */
    const deriveDataRowSortValue = (
        rowIndex, sortColumnIndex, compiledSortCalcFunctions, rowModels, transformedDataColumns
    ) => {

        let value;

        if (transformedDataColumns) {

            const transformedColumn = transformedDataColumns[sortColumnIndex];

            // A transformed value may have been appended to the dictionary out of its sorted order,
            // so it is sorted by the value itself.  The source column's CV is left compressed.
            value = transformedColumn
                ? tabularData.CompressionDictionary.decompressValue(
                    transformedColumn[rowIndex],
                    sortColumnIndex
                )
                : rowModels[rowIndex].CV[sortColumnIndex];

            if (typeof value === "string" && value !== "" && !isNaN(value)) {
                value = parseFloat(value);
            }
        }
        else if (compiledSortCalcFunctions) {

            // sortCalcFunction needs a decompressed value as input.
            value = tabularData.CompressionDictionary.decompressValue(
                rowModels[rowIndex].CV[sortColumnIndex],
                sortColumnIndex
            );
        }
        else {

            value = rowModels[rowIndex].CV[sortColumnIndex];
        }

        if (compiledSortCalcFunctions) {
            value = applyCompiledSortCalcFunctions(value ?? "", compiledSortCalcFunctions);
        }

        return value;
    };

    /**
     * Gets a value indicating whether every row's derived sort value is a number, an empty value or
     * a null.  Aggregated and calculated values come back as strings ("9"), so each is read through
     * parseFloat rather than by its type.
     */
    const areDataRowSortValuesNumeric = (rowIndexes, deriveValue) => {

        for (let i = 0; i < rowIndexes.length; i++) {

            const value = deriveValue(rowIndexes[i]);

            if (value === null || value === "" || value === Ren.NullSentinel) continue;
            if (typeof value === "number") continue;
            if (!isNaN(parseFloat(value)) && isFinite(value)) continue;

            return false;
        }

        return true;
    };

    /**
     * Sorts a row-index array in place into a named order (such as day order, Monday first), where
     * getOrderIndex places every row's value for the sort column, and returns whether it could.
     * The values are compressed, so each distinct one is decompressed once, stopping at the first
     * that getOrderIndex gives -1 for.
     */
    const sortDataRowsByNamedOrder = (
        rowIndexes, sortColumnIndex, deriveValue, getOrderIndex, isDescending
    ) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const orderIndexesByValue = new Map();

        for (let i = 0; i < rowIndexes.length; i++) {

            const value = deriveValue(rowIndexes[i]);

            if (value === null || value === "" || value === Ren.NullSentinel) continue;
            if (orderIndexesByValue.has(value)) continue;

            const orderIndex = getOrderIndex(decompressValue(value, sortColumnIndex));

            if (orderIndex === -1) return false;

            orderIndexesByValue.set(value, orderIndex);
        }

        if (orderIndexesByValue.size === 0) return false;

        Ren.ArrayUtils.sortNumeric(
            rowIndexes,
            rowIndex => {

                const orderIndex = orderIndexesByValue.get(deriveValue(rowIndex));

                return orderIndex === undefined ? -1 : orderIndex;
            },
            isDescending
        );

        return true;
    };

    /**
     * Sorts a row-index array in place by a single sort level (a sortOrder-shaped object:
     * columnIndex, isDescending, optional sortCalcFunction).  The underlying sort is stable, so
     * successive passes layer sort levels on top of each other.
     */
    const sortDataRowsByLevel =(rowIndexes, sortLevel, rowModels, transformedDataColumns) => {

        const sortColumnIndex = sortLevel.columnIndex;
        const compiledSortCalcFunctions = getCompiledSortCalcFunctions(sortLevel);

        const deriveValue = (rowIndex) => deriveDataRowSortValue(
            rowIndex,
            sortColumnIndex,
            compiledSortCalcFunctions,
            rowModels,
            transformedDataColumns
        );

        // A column with no calc function of its own and no sortCalcFunction sorts by its compressed
        // values, which are numbers, so it goes straight to the numeric sort.  A derived value can
        // be anything the function returns, so those are checked first.
        const hasDerivedValues = !!compiledSortCalcFunctions
            || !!(transformedDataColumns && transformedDataColumns[sortColumnIndex]);

        if (hasDerivedValues && !areDataRowSortValuesNumeric(rowIndexes, deriveValue)) {

            // Sortable derived values ("<sort key>¬<display text>") are sorted as they stand.
            // Everything is handed over as a string, since sortAuto compares non-numeric values
            // ordinally.
            Ren.ArrayUtils.sortAuto(
                rowIndexes,
                rowIndex => {

                    const value = deriveValue(rowIndex);

                    return (value === null || value === Ren.NullSentinel) ? "" : String(value);
                },
                sortLevel.isDescending
            );

            return;
        }

        // Day names read as a week, so they sort Monday first rather than by where the dictionary
        // put them, and values making up one of the config's custom sort orders sort in that
        // order.  Derived values are left out, since a numeric one would decompress into an
        // unrelated dictionary entry.
        if (!hasDerivedValues) {

            const namedOrders = getNamedOrderIndexGetters();

            for (let i = 0; i < namedOrders.length; i++) {

                if (sortDataRowsByNamedOrder(
                    rowIndexes,
                    sortColumnIndex,
                    deriveValue,
                    namedOrders[i],
                    sortLevel.isDescending
                )) {

                    return;
                }
            }
        }

        Ren.ArrayUtils.sortNumeric(
            rowIndexes,
            rowIndex => {

                const value = deriveValue(rowIndex);

                return (value === null || value === Ren.NullSentinel) ? -Infinity : value;
            },
            sortLevel.isDescending
        );
    };

    /**
     * Builds the data-rows sort levels in priority order: the primary sortOrder (when sorted) plus
     * each valid "then by" level.  Returns an empty array when the data rows are unsorted.
     */
    const resolveDataRowsSortLevels = sortOrder => {

        const sortLevels = [];

        if (sortOrder.columnIndex !== -1) sortLevels.push(sortOrder);

        const thenBy = sortOrder.thenBy;

        if (thenBy) {

            for (let i = 0; i < thenBy.length; i++) {

                const level = thenBy[i];

                if (level && level.columnIndex != null && level.columnIndex !== -1) {
                    sortLevels.push(level);
                }
            }
        }

        return sortLevels;
    };

    /**
     * Process the leaf data rows and update RowYs to reflect their position according to the sort,
     * filter and group settings.  Supports multi-level sorting: the primary sortOrder plus any
     * additional levels in sortOrder.thenBy.
     */
    const doDataRows = (y, rowYs, rowModels, group, isPaged) => {

        const containedRowIndexBuffer = group.containedRowIndexBuffer;
        const containedRowIndexStart = group.containedRowIndexStart;
        const containedRowIndexCount = group.containedRowIndexCount;
        const headingCount = tabularData.HeadingCount;
        const dataRowsSortOrder = dataGroupingSettings.dataRows.sortOrder;
        const hasFilter = passHasFilter;

        const transformedDataColumns = dataGroupingSettings.transformedDataColumns;

        // Outer filters live on the second-to-last grouping's filterSet, so there is no separate
        // outer filter for the outermost grouping.

        // Settings that render nothing have no row display to update, so the rows need only be
        // counted - keeping y correct for the active row count - with no sort and no rowY writes.
        if (!passTracksRowDisplay) {

            if (!hasFilter) {

                y += containedRowIndexCount;
            }
            else {

                const excludedMask = passCompiledFilter.getExcludedRowsMask();

                for (let i = 0; i < containedRowIndexCount; i++) {

                    const rowIndex = containedRowIndexBuffer[containedRowIndexStart + i];

                    if (excludedMask[rowIndex] === 0) y++;
                }
            }

            if (dataGroupingSettings.groupings.numGroupings() >= 3) y++; // Add a gap row.

            return y;
        }

        // The sort levels in priority order: the primary sort, then each valid "then by" level.
        const sortLevels = resolveDataRowsSortLevels(dataRowsSortOrder);
        const isSorted = sortLevels.length > 0;

        // Fast path: no sort, no filter.  Paged rows take the collecting path, to be counted.
        if (!isSorted && !hasFilter && !isPaged) {

            for (let i = 0; i < containedRowIndexCount; i++) {
                rowYs[containedRowIndexBuffer[containedRowIndexStart + i] + headingCount] = y++;
            }
        }
        else if (!isSorted && !isPaged) {

            // Filtered but unsorted: the rows keep the order they are already in, so each one can
            // be placed as it is read rather than collected into an array first.
            const excludedMask = passCompiledFilter.getExcludedRowsMask();

            for (let i = 0; i < containedRowIndexCount; i++) {

                const rowIndex = containedRowIndexBuffer[containedRowIndexStart + i];

                if (excludedMask[rowIndex] === 1) continue;

                rowYs[rowIndex + headingCount] = y++;
            }
        }
        else {

            // Collect the rows to sort as bare row indexes in a dense Int32Array, dropping any
            // filtered-out rows in the same pass.
            let rowIndexes = new Int32Array(containedRowIndexCount);
            let count = 0;

            if (hasFilter) {

                const excludedMask = passCompiledFilter.getExcludedRowsMask();

                for (let i = 0; i < containedRowIndexCount; i++) {

                    const rowIndex = containedRowIndexBuffer[containedRowIndexStart + i];

                    if (excludedMask[rowIndex] === 1) continue;

                    rowIndexes[count++] = rowIndex;
                }

                // A view onto the same buffer, so the excluded rows' slots cost nothing further.
                if (count !== containedRowIndexCount) rowIndexes = rowIndexes.subarray(0, count);
            }
            else {

                for (let i = 0; i < containedRowIndexCount; i++) {
                    rowIndexes[count++] = containedRowIndexBuffer[containedRowIndexStart + i];
                }
            }

            // Sort by the least significant level first: each pass is stable, so more significant
            // levels applied later dominate while later levels survive as tie-breaks.
            for (let level = sortLevels.length - 1; level >= 0; level--) {
                sortDataRowsByLevel(rowIndexes, sortLevels[level], rowModels, transformedDataColumns);
            }

            let start = 0;
            let end = rowIndexes.length;

            // Only the current page's rows are placed; the rest keep applySettings' -1.
            if (isPaged) {

                setPageCount(rowIndexes.length);

                start = dataGroupingSettings.paging.pageIndex * passPageSize;
                end = Math.min(end, start + passPageSize);
            }

            // Assign rowYs for the sorted and filtered rows.
            for (let i = start; i < end; i++) {
                rowYs[rowIndexes[i] + headingCount] = y++;
            }
        }

        if (dataGroupingSettings.groupings.numGroupings() >= 3) y++; // Add a gap row.

        return y;
    };

    /**
     * Gets the compiled (group) => isExcluded check for one grouping's own row-filter predicates,
     * or null where it carries none.  They are tested against the level's group rows.  Compiled
     * once per grouping per pass.
     */
    const getGroupPredicateCheck = (grouping, tabFilters) => {

        const predicates = tabFilters.rowFilter?.predicates;

        if (!Array.isArray(predicates) || predicates.length === 0) return null;

        if (passGroupPredicateChecks.has(grouping)) return passGroupPredicateChecks.get(grouping);

        // The level's groups, which a ranking operator (top / bottom N) ranks against one another.
        const groups = [];

        grouping.groups().forEach(group => groups.push(group));

        const check = Ren.FilterPredicates.compileGroupPredicates(
            predicates,
            tabularData,
            groups,
            Ren.ReportInputParameters.getInputParametersForGuid(
                dataGroupingSettings.containingReportGuid
            )
        );

        passGroupPredicateChecks.set(grouping, check);

        return check;
    };

    /**
     * Checks if a group matches the filterSet of its grouping.  Returns true if no filterSet is
     * defined, or if the group's value passes the filter.
     */
    const groupMatchesGroupingFilter = (group, grouping, tabularData) => {

        if (!grouping?.filterSet) return true;

        const filterSet = grouping.filterSet;
        const tabTitle = tabularData.Title;
        const tabFilters = filterSet[tabTitle];

        if (!tabFilters) return true;

        // The level's own compare filters, which state the group's values rather than its rows' and
        // are ANDed with the column value filters below, exactly as the two are on the data rows.
        const predicateCheck = getGroupPredicateCheck(grouping, tabFilters);

        if (predicateCheck && predicateCheck(group)) return false;

        if (!tabFilters.columnValueFilters) return true;

        let columnValueCheck = passGroupColumnValueChecks.get(grouping);

        if (!columnValueCheck) {

            columnValueCheck = compileGroupColumnValueCheck(tabFilters, tabularData);
            passGroupColumnValueChecks.set(grouping, columnValueCheck);
        }

        if (columnValueCheck.letsNoGroupThrough) return false;

        const { columnIndexes, matchers } = columnValueCheck;

        for (let i = 0; i < columnIndexes.length; i++) {

            const columnIndex = columnIndexes[i];

            const groupValue = tabularData.CompressionDictionary.decompressValue(
                group.groupValues.get(group.position, columnIndex),
                columnIndex
            );

            // A numeric column's NULL is null, which filters as the sentinel.
            const groupValueAsString = groupValue == null ? Ren.NullSentinel : String(groupValue);

            if (!matchers[i](groupValueAsString)) {
                return false; // Group doesn't match this column's filter
            }
        }

        return true; // Group matches all filters
    };

    /**
     * Compiles one grouping's column value filters into the columns to test and a value matcher
     * for each.
     */
    const compileGroupColumnValueCheck = (tabFilters, tabularData) => {

        const columnValueFilters = tabFilters.columnValueFilters;

        // The columns whose listed values are the excluded ones rather than the allowed ones (see
        // Ren.FilterNegation).
        const negatedColumns = Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters);

        const columnIndexes = [];
        const matchers = [];

        for (const columnIdOrHeading in columnValueFilters) {

            const filterValues = columnValueFilters[columnIdOrHeading];

            // Anything that isn't a list of values isn't a filter, and lets every group through.
            if (!Array.isArray(filterValues)) continue;

            const isNegated = negatedColumns.has(columnIdOrHeading);

            // A filter allowing no values lets no group through, as an empty data-row filter lets
            // no row through.  A negative filter excluding no values lets every group through.
            if (filterValues.length === 0) {

                if (isNegated) continue;

                return { letsNoGroupThrough: true, columnIndexes, matchers };
            }

            const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);
            if (columnIndex == null) continue;

            columnIndexes.push(columnIndex);
            matchers.push(Ren.FilterNegation.createValueMatcher(filterValues, isNegated));
        }

        return { letsNoGroupThrough: false, columnIndexes, matchers };
    };

    /**
     * Returns a value indicating whether the specified group contains any rows that are not
     * filtered out.  Uses the __Count column to determine this.  Also returns false if the group
     * is excluded by the outerFilterSet.
     */
    const showGroup = (group, grouping) => {

        // Hide groups excluded by outerFilterSet.
        if (group.excludedByOuterFilter) return false;

        // Check if group matches the grouping's filterSet
        if (!groupMatchesGroupingFilter(group, grouping, tabularData)) return false;

        return tabularData.CompressionDictionary.decompressValue(
            group.groupValues.get(group.position, INDEX_OF__COUNT_COLUMN),
            INDEX_OF__COUNT_COLUMN
        ) !== "0";
    };

    /**
     * Works out the page count from the number of shown groups or rows being paged, bringing the
     * page index back within range.
     */
    const setPageCount = (groupCount) => {

        const paging = dataGroupingSettings.paging;

        paging.groupCount = groupCount;
        paging.pageCount = Math.max(1, Math.ceil(groupCount / passPageSize));
        paging.pageIndex = Ren.NumberUtils.clamp(paging.pageIndex || 0, 0, paging.pageCount - 1);
    };

    /**
     * Counts the shown groups among the sorted child groups, and sets the page count from that.
     */
    const updatePaging = (group, childGrouping, groupIndexes) => {

        let groupCount = 0;

        for (let i = 0, l = groupIndexes.length; i < l; i++) {

            if (showGroup(group.containedGroups.get(groupIndexes[i]), childGrouping)) {
                groupCount++;
            }
        }

        setPageCount(groupCount);
    };

    /**
     * Recursively drill through nested groups down to data rows, and update RowYs to reflect their
     * position according to the sort, filter and group settings.
     */
    const doGroup = (y, rowYs, rowModels, grouping, group) => {

        if (!showGroup(group, grouping)) return null;

        const isGroupExpanded = Ren.DataGrid_ExpandCollapse.isGroupExpanded(
            tabularData,
            expandedGroups,
            grouping,
            group
        );

        if (!isGroupExpanded) return y;

        if (group.containedGroups.size > 0) {

            const childGroupingIndex = grouping.childGroupingIndex;
            const childGrouping = dataGroupingSettings.groupings.entries[childGroupingIndex];
            const groupIndexes = sort(group.containedGroups, childGrouping);

            // The totals row's child groups are the second-to-last grouping's, which are paged.
            const isPaged = passPageSize > 0 &&
                grouping === dataGroupingSettings.groupings.totalsRowGrouping();

            let pageStart = 0;
            let pageEnd = 0;
            let shownGroupOrdinal = 0;

            if (isPaged) {

                updatePaging(group, childGrouping, groupIndexes);

                pageStart = dataGroupingSettings.paging.pageIndex * passPageSize;
                pageEnd = pageStart + passPageSize;
            }

            for (let i = 0, l = groupIndexes.length; i < l; i++) {

                const groupIndex = groupIndexes[i];
                const childGroup = group.containedGroups.get(groupIndex);

                // Skip groups excluded by outerFilterSet
                if (childGroup.excludedByOuterFilter) {

                    if (passTracksRowDisplay) {
                        rowYs[childGroup.groupRowIndex + tabularData.HeadingCount] = -1;
                    }

                    continue;
                }

                // A group off the current page is left hidden, as are all the rows within it,
                // which applySettings has already hidden.  Hidden groups take no place on a page.
                if (isPaged && showGroup(childGroup, childGrouping)) {

                    const isOnPage = shownGroupOrdinal >= pageStart && shownGroupOrdinal < pageEnd;

                    shownGroupOrdinal++;

                    if (!isOnPage) {

                        rowYs[childGroup.groupRowIndex + tabularData.HeadingCount] = -1;
                        continue;
                    }
                }

                if (passTracksRowDisplay) {
                    rowYs[childGroup.groupRowIndex + tabularData.HeadingCount] = y;
                }

                const newY = doGroup(y + 1, rowYs, rowModels, childGrouping, childGroup);

                if (newY !== null) {

                    y = newY;
                }
                else if (passTracksRowDisplay) {

                    rowYs[childGroup.groupRowIndex + tabularData.HeadingCount] = -1;
                }
            }
        }
        else {

            // Without groupings the data rows sit directly beneath the totals row, and are paged.
            const isPaged = passPageSize > 0 &&
                grouping === dataGroupingSettings.groupings.totalsRowGrouping();

            y = doDataRows(y, rowYs, rowModels, group, isPaged);
        }

        return y;
    };

    /**
     * Updates rowYs to reflect the sort, filter and group settings, and sets the active row count.
     */
    const doApplySettings = (tabularData, dataGroupingSettings) => {

        const rowModels = tabularData.RowModels;
        const rowYs = dataGroupingSettings.rowYs;

        // Resolve the pass's data-row filter once, for every leaf group to share.  A filter that
        // compiles to nothing (no filter columns and no predicates) filters no rows, so it counts
        // as no filter at all.
        passCompiledFilter = dataGroupingSettings.hasFilter()
            ? Ren.Filter.createCompiledFilter(tabularData, dataGroupingSettings)
            : null;

        passHasFilter = !!passCompiledFilter;

        passTracksRowDisplay = dataGroupingSettings.tracksRowDisplay !== false;

        // The group-level predicate checks are compiled against the group figures as they stand, so
        // each pass starts with none of the last pass's.
        passGroupPredicateChecks = new Map();
        passGroupColumnValueChecks = new Map();

        // Scratch settings have no rows on screen to page.
        const paging = dataGroupingSettings.paging;
        passPageSize = (passTracksRowDisplay && paging?.pageSize > 0) ? paging.pageSize : 0;

        // Left as a single page unless the pass finds groups to page.
        if (paging) {

            paging.pageCount = 1;
            paging.groupCount = 0;
        }

        const totalsRowGrouping = dataGroupingSettings.groupings.totalsRowGrouping();
        const totalsRowGroup = dataGroupingSettings.groupings.totalsRowGroup();

        let y = tabularData.HeadingCount;

        if (totalsRowGroup) {

            const totalsRowPosition = dataGroupingSettings.totalsRow.position;
            const HeadingCount = tabularData.HeadingCount;

            if (totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.Top ||
                totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.TopFixed) {

                if (passTracksRowDisplay) {
                    rowYs[totalsRowGroup.groupRowIndex + HeadingCount] = y;
                }

                y++;
            }

            const newY = doGroup(y, rowYs, rowModels, totalsRowGrouping, totalsRowGroup);

            if (newY !== null) {

                y = newY;
            }
            else if (passTracksRowDisplay) {

                rowYs[totalsRowGroup.groupRowIndex + HeadingCount] = -1;
            }

            if (totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.Bottom ||
                totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.BottomFixed) {

                if (passTracksRowDisplay) {
                    rowYs[totalsRowGroup.groupRowIndex + HeadingCount] = y;
                }

                y++;
            }
        }

        dataGroupingSettings.setActiveRowCount(y);
    };

    return {
        applySettings,
        onChanged
    };
};
