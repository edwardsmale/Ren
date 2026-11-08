(function (Ren) {

    Ren.GroupingsAdder_AddGrouping = function (dataGroupingSettings, populateGroupings) {

        const serialize = arr => Array.isArray(arr) ? arr.join(",") : "";

        // A grouping is identified by the columns it groups by *and* how it groups by them: the
        // same column binned two ways (a date column by month above the same column by day) is
        // two distinct levels, and keying on the columns alone would silently drop the second.
        const serializeCalcFunctions = calcFunctions => Array.isArray(calcFunctions)
            ? calcFunctions.map(spec =>
                !spec ? "" : (typeof spec === "string" ? spec : spec.name ?? "")).join(",")
            : "";

        const keyOf = (columnIndexes, calcFunctions) =>
            serialize(columnIndexes) + "|" + serializeCalcFunctions(calcFunctions);

        /**
         * Gets the groupings to populate for the given groupings with a new one inserted, or null
         * where one of them already groups that way.
         */
        const insertGrouping = (
            groupingsEntries,
            groupByColumnIndexes,
            columns,
            insertPosition,
            groupByCalcFunctions
        ) => {

            const groupingsLen = groupingsEntries.length;

            const groupingsKeySet = new Set(
                groupingsEntries.map(g => keyOf(g.groupByColumnIndexes, g.groupByCalcFunctions))
            );

            const newKey = keyOf(groupByColumnIndexes, groupByCalcFunctions);
            if (groupingsKeySet.has(newKey)) return null;
            const position = insertPosition === undefined
                ? 0
                : Ren.NumberUtils.clamp(insertPosition, 0, groupingsLen);
            const newGroupings = new Array(groupingsLen + 1);
            let index = 0;

            for (let i = 0; i < groupingsLen + 1; i++) {

                if (i === position) {

                    newGroupings[index++] = {
                        groupByColumnIndexes,
                        columns,
                        groupByCalcFunctions
                    };
                }

                if (i < groupingsLen) {

                    const groupingsEntry = groupingsEntries[i];
                    newGroupings[index++] = Ren.GroupingsAdder_copyGroupingFlags(groupingsEntry, {
                        groupByColumnIndexes: groupingsEntry.groupByColumnIndexes,
                        columns: groupingsEntry.columns,
                        groupByCalcFunctions: groupingsEntry.groupByCalcFunctions,
                        filterSet: groupingsEntry.filterSet
                    });
                }
            }

            return newGroupings;
        };

        const addGrouping = (groupByColumnIndexes, columns, insertPosition, groupByCalcFunctions) => {

            const newGroupings = insertGrouping(
                dataGroupingSettings.groupings.entries,
                groupByColumnIndexes,
                columns,
                insertPosition,
                groupByCalcFunctions
            );

            if (newGroupings) {
                populateGroupings(newGroupings);
            }
        };

        /**
         * Gets the groupings that populating the given ones would make, in as much as inserting a
         * grouping among them reads, without grouping any data rows.
         */
        const getPopulatedForm = (newGroupings) => {

            const { combinedIndexesArr, combinedCalcFunctionsArr } =
                Ren.GroupingsAdder_combineGroupByColumns(newGroupings);

            const populated = new Array(newGroupings.length);

            for (let i = 0; i < newGroupings.length; i++) {

                const newGrouping = newGroupings[i];

                populated[i] = Ren.GroupingsAdder_copyGroupingFlags(newGrouping, {
                    groupByColumnIndexes: combinedIndexesArr[i],
                    columns: newGrouping.columns ?? {},
                    groupByCalcFunctions: combinedCalcFunctionsArr[i],
                    filterSet: newGrouping.filterSet
                });
            }

            return populated;
        };

        /**
         * Adds each of the given groupings in turn, as addGrouping would, inserting each inside
         * the last, but populates the groupings only once.  Populating groups every data row at
         * every level, so populating per grouping added cost a deep hierarchy dearly.
         */
        const addGroupings = (groupingsToAdd) => {

            let groupingsEntries = dataGroupingSettings.groupings.entries;
            let newGroupings = null;

            for (let i = 0; i < groupingsToAdd.length; i++) {

                const groupingToAdd = groupingsToAdd[i];

                const inserted = insertGrouping(
                    groupingsEntries,
                    groupingToAdd.groupByColumnIndexes,
                    groupingToAdd.columns,
                    undefined,
                    groupingToAdd.groupByCalcFunctions
                );

                if (!inserted) continue;

                newGroupings = inserted;
                groupingsEntries = getPopulatedForm(inserted);
            }

            if (newGroupings) {
                populateGroupings(newGroupings);
            }
        };

        return { addGrouping, addGroupings };
    };
})(Ren || (Ren = {}));
