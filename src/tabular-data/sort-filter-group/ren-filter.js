Ren.Filter = (() => {

    /**
     * Builds a Set of compressed values for fast filter lookup.
     */
    const compressValues = (columnFilter, compressionDictionary, columnIndex, isCompressed) => {

        if (!isCompressed) return columnFilter;

        const compressedValues = new Set();
        const compressValue = compressionDictionary.compressValue;
        const columnFilterArr = Array.from(columnFilter);

        for (let i = 0; i < columnFilterArr.length; i++) {

            if (columnFilterArr[i] == null) continue;

            // A date column's NULL sentinel compresses to null, which is what its NULLs hold.
            compressedValues.add(
                compressValue.call(compressionDictionary, columnFilterArr[i], columnIndex)
            );
        }

        return compressedValues;
    };

    const returnFalse = () => false;

    /**
     * Builds the (rowIndex) => isExcluded check for a column whose values come from a data row calc
     * function.  The verdict is memoised by compressed value, as a calc'd column typically has only
     * a handful of distinct values.
     */
    const compileTransformedColumnCheck = (
        transformedColumn, columnIndex, filterSet, isNegated, tabularData
    ) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const verdicts = new Map();

        return (rowIndex) => {

            const compressedValue = transformedColumn[rowIndex];
            let isExcluded = verdicts.get(compressedValue);

            if (isExcluded === undefined) {

                const value = decompressValue(compressedValue, columnIndex);

                isExcluded = filterSet.has(value == null ? "" : value.toString()) === isNegated;
                verdicts.set(compressedValue, isExcluded);
            }

            return isExcluded;
        };
    };

    // Gets the distinct compressed values of a column whose tabular data has no precomputed set.
    const collectDistinctColumnCVs = (columnCVs) => {

        const seen = new Set();

        for (let rowIndex = 0; rowIndex < columnCVs.length; rowIndex++) {
            seen.add(columnCVs[rowIndex]);
        }

        return Array.from(seen);
    };

    // The rows each row-filter predicate unit excludes, per tabular data and keyed on the
    // predicate.  A filter module derives a scratch settings object per item, each carrying the
    // same predicates, so keying on the settings object would pay a pass over every row per item.
    const predicateMaskCache = new WeakMap();

    // A filter module writing its selection as a predicate makes a new mask on every tick, so the
    // least recently used are evicted.
    const MAX_CACHED_PREDICATE_MASKS = 16;

    // Gets the mask of rows one predicate unit excludes, or null.  The array returned is the cached
    // one, so callers must not write to it.
    const getPredicateUnitMask = (tabularData, unit) => {

        let masksBySignature = predicateMaskCache.get(tabularData);

        if (!masksBySignature) {

            masksBySignature = new Map();
            predicateMaskCache.set(tabularData, masksBySignature);
        }

        if (masksBySignature.has(unit.signature)) {

            const cached = masksBySignature.get(unit.signature);

            // Reinserted to mark it most recently used.
            masksBySignature.delete(unit.signature);
            masksBySignature.set(unit.signature, cached);

            return cached;
        }

        const isExcluded = unit.compile();
        let mask = null;

        if (isExcluded) {

            const rowCount = tabularData.RowModels.length;
            mask = new Uint8Array(rowCount);

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                if (isExcluded(rowIndex)) mask[rowIndex] = 1;
            }
        }

        masksBySignature.set(unit.signature, mask);

        while (masksBySignature.size > MAX_CACHED_PREDICATE_MASKS) {
            masksBySignature.delete(masksBySignature.keys().next().value);
        }

        return mask;
    };

    // Gets the union of a predicate list's unit masks, or null when it excludes nothing.  The array
    // returned belongs to the caller.
    const getPredicatesExcludedRowsMask = (tabularData, predicates, paras) => {

        const units = Ren.FilterPredicates.compilePredicateUnits(predicates, tabularData, paras);
        let mask = null;

        for (let i = 0; i < units.length; i++) {

            const unitMask = getPredicateUnitMask(tabularData, units[i]);

            if (!unitMask) continue;

            // The unit's mask is the cached array, so it is copied rather than added to.
            if (!mask) {

                mask = new Uint8Array(unitMask);
                continue;
            }

            for (let rowIndex = 0; rowIndex < mask.length; rowIndex++) {

                if (unitMask[rowIndex] === 1) mask[rowIndex] = 1;
            }
        }

        return mask;
    };

    /**
     * Builds a compiled filter object, or undefined when there is nothing to filter.  Uncached;
     * callers go through createCompiledFilter.
     */
    const buildCompiledFilter = (tabularData, dataGroupingSettings) => {

        const columnValueFilters =
            Ren.DataGroupingSettings_Services_FilterAccessors.getColumnValueFilters(
                dataGroupingSettings.dataRows,
                tabularData
            );

        // Columns whose filter names the values to leave out; their test is simply flipped.
        const negatedColumns = Ren.FilterNegation.getNegatedColumnSet(
            dataGroupingSettings.dataRows,
            tabularData
        );

        const filterColumnIndexes = [];

        for (const key in columnValueFilters) {

            if (columnValueFilters[key] == null) continue;

            // An empty exclusion list excludes nothing, unlike an empty inclusion list.
            if (negatedColumns.has(key) && columnValueFilters[key].length === 0) continue;

            filterColumnIndexes.push(key);
        }

        // Row-filter predicates are ANDed with the column value filters, and may be present alone.
        const predicates =
            Ren.FilterPredicates.getPredicates(dataGroupingSettings.dataRows, tabularData);

        if (!filterColumnIndexes.length && predicates.length === 0) return;

        const isColumnCompressed = tabularData.IsColumnCompressed;
        const transformedDataColumns = dataGroupingSettings.transformedDataColumns;

        const filterMeta = filterColumnIndexes.map(columnIdOrHeading => {

            const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);
            const filterSet = new Set(columnValueFilters[columnIdOrHeading]);
            const compressed = columnIndex !== null && isColumnCompressed[columnIndex];
            const columnCVs = columnIndex !== null ? tabularData.getColumnCV(columnIndex) : null;
            const columnSettings = dataGroupingSettings.dataRows?.columns?.[columnIdOrHeading];
            const transformedColumn = (columnSettings?.calcFunction && transformedDataColumns)
                ? transformedDataColumns[columnIndex]
                : null;
            const hasCalcFunction = transformedColumn != null;
            const isNegated = negatedColumns.has(columnIdOrHeading);
            return {
                columnIndex,
                filterSet,
                compressed,
                columnCVs,
                hasCalcFunction,
                transformedColumn,
                isNegated
            };
        });

        let isExcluded;

        if (filterMeta.length === 1) { // Single column filter case.

            const {
                columnIndex,
                filterSet,
                compressed,
                columnCVs,
                hasCalcFunction,
                transformedColumn,
                isNegated
            } = filterMeta[0];

            if (columnIndex === null) {

                isExcluded = returnFalse;
            }
            else if (hasCalcFunction) {

                isExcluded = compileTransformedColumnCheck(
                    transformedColumn,
                    columnIndex,
                    filterSet,
                    isNegated,
                    tabularData
                );
            }
            else if (!compressed) {

                isExcluded = (rowIndex) => {

                    const cv = columnCVs[rowIndex];
                    // A null CV in a non-compressed column is SQL NULL, normalised to the sentinel
                    // a compressed column uses.
                    return filterSet.has(cv == null ? Ren.NullSentinel : cv.toString()) === isNegated;
                };
            }
            else {

                const compressedValues = compressValues(
                    filterSet,
                    tabularData.CompressionDictionary,
                    columnIndex,
                    compressed
                );

                isExcluded = (rowIndex) =>
                    compressedValues.has(columnCVs[rowIndex]) === isNegated;
            }
        }
        else { // Multiple columns filter case

            const exclusionChecks = filterMeta.map(({
                columnIndex,
                filterSet,
                compressed,
                columnCVs,
                hasCalcFunction,
                transformedColumn,
                isNegated
            }) => {

                if (columnIndex === null) return null;

                if (hasCalcFunction) {

                    return compileTransformedColumnCheck(
                        transformedColumn,
                        columnIndex,
                        filterSet,
                        isNegated,
                        tabularData
                    );
                }

                // getDistinctColumnCV caches for the life of the tabular data, so every filter on
                // the column shares its one pass.
                const distinctCVs = tabularData.getDistinctColumnCV?.(columnIndex)
                    ?? collectDistinctColumnCVs(columnCVs);

                const map = new Map();

                for (let i = 0; i < distinctCVs.length; i++) {

                    const cv = distinctCVs[i];

                    const value = compressed
                        ? tabularData.CompressionDictionary.decompressValue(cv, columnIndex)
                        : (cv == null ? Ren.NullSentinel : cv.toString());

                    map.set(cv, filterSet.has(value) === isNegated);
                }

                return (rowIndex) => map.get(columnCVs[rowIndex]) ?? false;
            });

            isExcluded = (rowIndex) => {

                for (let i = 0; i < exclusionChecks.length; i++) {

                    if (exclusionChecks[i] !== null && exclusionChecks[i](rowIndex)) return true;
                }

                return false;
            };
        }

        const columnValueIsExcluded = isExcluded;
        const paras = Ren.ReportInputParameters.getInputParametersForGuid(
            dataGroupingSettings.containingReportGuid
        );

        const predicateIsExcluded =
            Ren.FilterPredicates.compilePredicates(predicates, tabularData, paras);

        if (predicateIsExcluded) {

            isExcluded = (rowIndex) =>
                columnValueIsExcluded(rowIndex) || predicateIsExcluded(rowIndex);
        }

        // A lazily-built per-row exclusion mask (1 = excluded), so repeated readers scan a typed
        // array instead of re-running the closure.  Its predicate half comes from the shared
        // predicate masks, so this pass costs only the column value filters.
        let excludedRowsMask = null;

        const getExcludedRowsMask = () => {

            if (excludedRowsMask) return excludedRowsMask;

            const rowCount = tabularData.RowModels.length;

            const mask = getPredicatesExcludedRowsMask(tabularData, predicates, paras)
                ?? new Uint8Array(rowCount);

            if (filterMeta.length) {

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                    if (mask[rowIndex] === 0 && columnValueIsExcluded(rowIndex)) {
                        mask[rowIndex] = 1;
                    }
                }
            }

            excludedRowsMask = mask;
            return mask;
        };

        return {
            isExcluded,
            getExcludedRowsMask
        };
    };

    // Compiled filters per (dataGroupingSettings, tabularData), as the same filter is compiled by
    // several readers in one render and compiling scans every row.  The signature is content-based
    // because filter values are mutated in place, leaving the dataRows identity unchanged.
    const compiledFilterCache = new WeakMap();

    // Compiled filters per tabular data, keyed by what the filter says, so that settings objects
    // carrying the identical filter share one compiled filter and its mask.  A filter module
    // derives a fresh settings object per item on every render, so it never hits the cache above.
    const sharedCompiledFilterCache = new WeakMap();

    // A filter module makes a new filter on every tick, so the least recently used are evicted.
    const MAX_CACHED_COMPILED_FILTERS = 16;

    // Gets a signature of a data tab's filter definition.  An absent tab entry and an empty one
    // both mean "no filter", so both normalise to the empty string.
    const computeFilterSignature = (tabularData, dataGroupingSettings) => {

        const tabFilters = dataGroupingSettings.dataRows?.filterSet?.[tabularData.Title];

        if (!tabFilters) return "";

        const columnValueFilters = tabFilters.columnValueFilters;
        const predicates = tabFilters.rowFilter?.predicates;
        const negatedColumns = tabFilters.negatedColumns;
        const hasColumnFilters = columnValueFilters && Object.keys(columnValueFilters).length > 0;
        const hasPredicates = Array.isArray(predicates) && predicates.length > 0;

        if (!hasColumnFilters && !hasPredicates) return "";

        return JSON.stringify({ columnValueFilters, predicates, negatedColumns });
    };

    /**
     * Gets a key for the calc functions of the filtered columns, which change what a filter tests.
     * Empty where no filtered column is calc'd; null where a calc function is a function object
     * that cannot be described, so the filter is not shared.
     */
    const computeFilterCalcFunctionsKey = (tabularData, dataGroupingSettings) => {

        const dataRows = dataGroupingSettings.dataRows;
        const columnValueFilters = dataRows?.filterSet?.[tabularData.Title]?.columnValueFilters;
        const columns = dataRows?.columns;

        if (!columnValueFilters || !columns) return "";

        const parts = [];

        for (const key in columnValueFilters) {

            const calcFunction = columns[key]?.calcFunction;

            if (!calcFunction) continue;

            if (typeof calcFunction === "function") return null;

            try {

                parts.push(key + ":" + JSON.stringify(calcFunction));
            }
            catch (e) {

                return null;
            }
        }

        return parts.join(";");
    };

    /**
     * Gets a shared-cache entry, or null, dropping it when its rows or (for a calc'd column) its
     * transformed columns have since changed.
     */
    const readSharedEntry = (entriesByKey, key, tabularData, transformedDataColumns, usesCalc) => {

        const entry = entriesByKey.get(key);

        if (!entry) return null;

        if (entry.rowModels !== tabularData.RowModels
            || (usesCalc && entry.transformedDataColumns !== transformedDataColumns)) {

            entriesByKey.delete(key);
            return null;
        }

        // Reinserted to mark it most recently used.
        entriesByKey.delete(key);
        entriesByKey.set(key, entry);

        return entry;
    };

    /**
     * Gets a compiled filter, reusing one when the filter definition is unchanged, or undefined
     * when there is nothing to filter.  ignoreRowFilters is honoured here as every filter reader
     * comes through this.
     */
    const createCompiledFilter = (tabularData, dataGroupingSettings) => {

        if (dataGroupingSettings.ignoreRowFilters) return;

        let perTabCache = compiledFilterCache.get(dataGroupingSettings);

        if (!perTabCache) {

            perTabCache = new Map();
            compiledFilterCache.set(dataGroupingSettings, perTabCache);
        }

        const signature = computeFilterSignature(tabularData, dataGroupingSettings);
        const transformedDataColumns = dataGroupingSettings.transformedDataColumns;
        const cached = perTabCache.get(tabularData);

        if (cached
            && cached.signature === signature
            && cached.transformedDataColumns === transformedDataColumns) {

            return cached.compiledFilter;
        }

        // Another settings object carrying the same filter may already have compiled it.
        const calcFunctionsKey = computeFilterCalcFunctionsKey(tabularData, dataGroupingSettings);
        const sharedKey = calcFunctionsKey === null ? null : signature + "|" + calcFunctionsKey;

        let entriesByKey = null;

        if (sharedKey !== null) {

            entriesByKey = sharedCompiledFilterCache.get(tabularData);

            if (!entriesByKey) {

                entriesByKey = new Map();
                sharedCompiledFilterCache.set(tabularData, entriesByKey);
            }

            const shared = readSharedEntry(
                entriesByKey,
                sharedKey,
                tabularData,
                transformedDataColumns,
                !!calcFunctionsKey
            );

            if (shared) {

                perTabCache.set(
                    tabularData,
                    { signature, transformedDataColumns, compiledFilter: shared.compiledFilter }
                );

                return shared.compiledFilter;
            }
        }

        const compiledFilter = buildCompiledFilter(tabularData, dataGroupingSettings);

        perTabCache.set(tabularData, { signature, transformedDataColumns, compiledFilter });

        if (entriesByKey) {

            entriesByKey.set(
                sharedKey,
                { rowModels: tabularData.RowModels, transformedDataColumns, compiledFilter }
            );

            while (entriesByKey.size > MAX_CACHED_COMPILED_FILTERS) {
                entriesByKey.delete(entriesByKey.keys().next().value);
            }
        }

        return compiledFilter;
    };

    return {
        createCompiledFilter
    };
})();
