    Ren.GroupingsAdder_PopulateGroupings = function (
        tabularData,
        dataGroupingSettings,
        setColumnValueFormats,
        applyOuterFilterToSecondToLastGrouping,
        createGrouping
    ) {

        // How many grouping structures are kept per set of data rows.  A count rather than a memory
        // budget, as an entry's arrays are the ones its groupings are using rather than copies, so
        // evicting one frees nothing while they are alive.
        const MAX_CACHED_GROUPING_STRUCTURES = 32;

        const serializeForKey = (value) => {

            try {

                return JSON.stringify(value ?? null);
            }
            catch (e) {

                return null;
            }
        };

        /**
         * Serialises a calc function spec, or an array of them, for a structure cache key.  Returns
         * null where a spec can't be described exactly, such as one given as a function object, so
         * that the caller skips caching rather than share a key between different groupings.
         */
        const serializeCalcFunctionSpecs = (calcFunction) => {

            if (!calcFunction) {
                return "";
            }

            if (typeof calcFunction === "function") {
                return null;
            }

            if (Array.isArray(calcFunction)) {

                const parts = new Array(calcFunction.length);

                for (let i = 0; i < calcFunction.length; i++) {

                    const part = serializeCalcFunctionSpecs(calcFunction[i]);

                    if (part === null) {
                        return null;
                    }

                    parts[i] = part;
                }

                return "[" + parts.join(",") + "]";
            }

            return serializeForKey(calcFunction);
        };

        /**
         * Builds the part of a structure cache key describing the data row calc functions, which
         * decide the values the first grouping groups by.  Returns null where they can't be
         * described exactly.
         */
        const getDataRowCalcFunctionsKey = () => {

            const dataRowsColumns = dataGroupingSettings.dataRows?.columns;

            if (!dataRowsColumns) {
                return "";
            }

            const columnIdsOrHeadings = Object.keys(dataRowsColumns).sort();
            const parts = [];

            for (let i = 0; i < columnIdsOrHeadings.length; i++) {

                const columnIdOrHeading = columnIdsOrHeadings[i];
                const calcFunction = dataRowsColumns[columnIdOrHeading]?.calcFunction;

                if (!calcFunction) {
                    continue;
                }

                const serialized = serializeCalcFunctionSpecs(calcFunction);

                if (serialized === null) {
                    return null;
                }

                parts.push(columnIdOrHeading + ":" + serialized);
            }

            return parts.join(";");
        };

        /**
         * Gets the structure cache for the current data rows, held on the tabular data so that
         * every visualisation's groupings share it.  Replacing or filtering the rows starts a new
         * cache.
         */
        const getStructureCache = () => {

            const rowModels = tabularData.RowModels;
            const rowCount = rowModels.length;
            let cache = tabularData._groupingStructureCache;

            if (!cache || cache.rowModels !== rowModels || cache.rowCount !== rowCount) {

                cache = {
                    rowModels,
                    rowCount,
                    entries: new Map(),
                    transformedDataColumns: new Map()
                };

                tabularData._groupingStructureCache = cache;
            }

            return cache;
        };

        /**
         * Stores an entry, moving an already-stored one to the end of the map so that the least
         * recently used entry is the one evicted.
         */
        const storeInCache = (cacheMap, key, value) => {

            cacheMap.delete(key);
            cacheMap.set(key, value);

            while (cacheMap.size > MAX_CACHED_GROUPING_STRUCTURES) {

                cacheMap.delete(cacheMap.keys().next().value);
            }
        };

        return function populateGroupings(newGroupings) {

            dataGroupingSettings.groupings.clear();

            dataGroupingSettings.transformedDataColumns = null;

            const groupCount = newGroupings.length;
            let groupLevel = groupCount - 1;
            let previousGrouping = null;
            let startGroupRowIndex = tabularData.RowModels.length;
            let startGroupId = 0;
            const { combinedIndexesArr, combinedCalcFunctionsArr } =
                Ren.GroupingsAdder_combineGroupByColumns(newGroupings);

            const groupingsAddRef = dataGroupingSettings.groupings.add;

            // Which row falls in which group depends only on the data rows and the grouping
            // definitions, never on a filter, so the structure is cached and a rebuild prompted by
            // a filter change recomputes only the aggregated values.  The key builds up level by
            // level, since a grouping's structure also depends on those beneath it.
            const dataRowCalcFunctionsKey = getDataRowCalcFunctionsKey();
            const structureCache = dataRowCalcFunctionsKey === null ? null : getStructureCache();
            const cacheEntries = structureCache ? structureCache.entries : null;

            let structureKey = tabularData.RowModels.length + "@" + dataRowCalcFunctionsKey;

            for (let groupingIndex = 0; groupingIndex < groupCount; groupingIndex++) {

                const newGrouping = newGroupings[groupingIndex];
                const groupByColumnIndexes = combinedIndexesArr[groupingIndex];

                newGrouping.groupByCalcFunctions = combinedCalcFunctionsArr[groupingIndex];

                setColumnValueFormats(previousGrouping, newGrouping);

                let structureSlot = null;

                if (cacheEntries && structureKey !== null) {

                    const calcFunctionsKey =
                        serializeCalcFunctionSpecs(newGrouping.groupByCalcFunctions);

                    if (calcFunctionsKey === null) {

                        // Every level above is keyed on this one, so nothing further is cached.
                        structureKey = null;
                    }
                    else {

                        structureKey += "|" + groupByColumnIndexes.join(",")
                            + "#" + calcFunctionsKey;

                        // Every first grouping over these rows transforms the same data columns, so
                        // one set is shared between their structures.
                        const transformedDataColumns = groupingIndex === 0
                            ? structureCache.transformedDataColumns.get(dataRowCalcFunctionsKey)
                                ?? null
                            : null;

                        structureSlot = {
                            key: structureKey,
                            structure: cacheEntries.get(structureKey) ?? null,
                            transformedDataColumns
                        };
                    }
                }

                const grouping = createGrouping(
                    groupByColumnIndexes,
                    newGrouping,
                    groupingIndex,
                    groupLevel,
                    previousGrouping,
                    startGroupRowIndex,
                    startGroupId,
                    structureSlot
                );

                Ren.GroupingsAdder_copyGroupingFlags(newGrouping, grouping);

                if (structureSlot && structureSlot.structure) {

                    storeInCache(cacheEntries, structureSlot.key, structureSlot.structure);

                    if (groupingIndex === 0 && structureSlot.transformedDataColumns) {

                        storeInCache(
                            structureCache.transformedDataColumns,
                            dataRowCalcFunctionsKey,
                            structureSlot.transformedDataColumns
                        );
                    }
                }

                applyOuterFilterToSecondToLastGrouping(grouping, groupCount, groupingIndex);
                groupingsAddRef.call(dataGroupingSettings.groupings, grouping);
                startGroupRowIndex = grouping.lastGroupRowIndex() + 1;
                startGroupId = grouping.lastGroupId() + 1;
                previousGrouping = grouping;
                groupLevel--;
            }

            if (dataGroupingSettings.groupings._groupingIndexMap) {
                dataGroupingSettings.groupings._groupingIndexMap.clear();
            }
        };
    };
