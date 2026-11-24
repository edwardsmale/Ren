/**
 * Manages the generation of summary statistics in a tabular data model, to support formatting
 * options such as '% of group' and '% of total'.
 */
Ren.SummaryStats = (tabularData, dataGroupingSettings) => {

    const SUMMARY_STATS = "summaryStats";

    // Group row style functions read statistics over group rows (see getGroupRowStatsTarget), held
    // on the parent group for its child group rows, or on an outermost group for its own row.
    const CHILD_GROUP_ROW_STATS = "childGroupRowSummaryStats";
    const OWN_GROUP_ROW_STATS = "ownGroupRowSummaryStats";

    // Statistics are keyed by aggregation type name in camel case, e.g. sum and countDistinct.
    const aggregationTypeKeys = [];
    const aggregationTypesByKey = new Map();
    const aggregationTypeNames = Ren.AggregationTypeEnum.Names;

    for (let index = 0; index < aggregationTypeNames.length; index++) {

        const name = aggregationTypeNames[index];
        const key = name.charAt(0).toLowerCase() + name.slice(1);

        aggregationTypeKeys.push(key);
        aggregationTypesByKey.set(key, Ren.AggregationTypeEnum[name]);
    }

    /**
     * Adds the column ID and heading of the specified column to a column's statistics, as keys to
     * that column's statistics.
     */
    const addColumnKeys = (stats, columnIndex, columnStats) => {

        const columnModel = tabularData.ColumnModels[columnIndex];
        const keys = [columnModel.ColumnId, columnModel.Heading];

        for (let index = 0; index < keys.length; index++) {

            const key = keys[index];

            // The aggregation type keys hold the statistics themselves.
            if (key == null || aggregationTypesByKey.has(key)) continue;

            stats[key] = columnStats;
        }
    };

    /**
     * Gets a group's statistics on the specified column, creating them if need be.  Like rowVals,
     * they are also keyed by the column ID and heading of every column with statistics.
     */
    const getColumnStats = (group, columnIndex, statsPropertyName) => {

        if (!group[statsPropertyName]) group[statsPropertyName] = [];

        const allStats = group[statsPropertyName];
        let columnStats = allStats[columnIndex];

        if (columnStats) return columnStats;

        columnStats = {};
        allStats[columnIndex] = columnStats;

        for (let index = 0; index < allStats.length; index++) {

            const otherStats = allStats[index];

            if (!otherStats) continue;

            addColumnKeys(otherStats, columnIndex, columnStats);
            addColumnKeys(columnStats, index, otherStats);
        }

        return columnStats;
    };

    /**
     * Adds the numbers in a column of a group's data rows to the values to aggregate.
     *
     * @param {function(number): ?number} readNumber Reads the number for a data row index (see
     *   Ren.Aggregation's getRowNumberReader).
     */
    const addRowValues = (valuesToAggregate, group, readNumber) => {

        const buffer = group.containedRowIndexBuffer;
        const start = group.containedRowIndexStart;
        const count = group.containedRowIndexCount;

        for (let index = 0; index < count; index++) {
            valuesToAggregate.push(readNumber(buffer[start + index]));
        }
    };

    /**
     * Adds the numeric values in the specified column of group rows to the values to aggregate.
     */
    const addGroupRowValues = (valuesToAggregate, groups, columnIndex) => {

        groups.forEach(group => {

            if (!group.groupValues) return;

            const value = Ren.TextUtils.parseFloat(
                tabularData.CompressionDictionary.decompressValue(
                    group.groupValues.get(group.position, columnIndex),
                    columnIndex
                )
            );

            if (value !== null) valuesToAggregate.push(value);
        });
    };

    // The values aggregated are numbers already, rather than dictionary indexes.
    const numberAggFuncs = Ren.AggregationFns(null);

    const aggregate = (valueFormatType, aggTypeName, valuesToAggregate, columnIndex) => {

        const value = numberAggFuncs.aggFunc(valueFormatType, aggregationTypesByKey.get(aggTypeName))(
            valuesToAggregate,
            columnIndex,
            0,
            valuesToAggregate.length,
            null, // groupRowIndex
            false // isOutermostGrouping
        );

        // Stored as null rather than undefined, which would read as not yet calculated.
        return value === undefined ? null : value;
    };

    /**
     * Generates summary statistics over the values of a set of group rows (see
     * getGroupRowStatsTarget).
     */
    const populateGroupRowStats = (target, columnIndex, aggTypeName, hostColumnIndex) => {

        getColumnStats(target.statsHost, hostColumnIndex, target.statsPropertyName);

        const columnStats =
            getColumnStats(target.statsHost, columnIndex, target.statsPropertyName);

        if (columnStats[aggTypeName] !== undefined) return;

        const valuesToAggregate = [];

        addGroupRowValues(valuesToAggregate, target.groups, columnIndex);

        columnStats[aggTypeName] = aggregate(
            target.valueFormatType,
            aggTypeName,
            valuesToAggregate,
            columnIndex
        );
    };

    /**
     * Generates summary statistics, such as sum and average, for each group in the specified
     * grouping, or in each group in all groupings if the grouping parameter is null.  The host
     * column is the one whose function reads the statistics.
     */
    const populate = (grouping, columnIndex, aggTypeName, hostColumnIndex) => {

        const groupings = grouping === null
            ? dataGroupingSettings.groupings.entries
            : [grouping];

        const paras = Ren.ReportInputParameters.getInputParametersForGuid(
            dataGroupingSettings.containingReportGuid
        );

        groupings.forEach(grouping => {

            // The data rows' values as the grouping's sum of them reads them, which is what its
            // group rows show: string lengths, say, where a calc function gives those.
            const readNumber = dataGroupingSettings.aggregation.getRowNumberReader(
                columnIndex,
                grouping.columns,
                paras
            );

            const isOutermost =
                !grouping.parentGroupingIndex && grouping.parentGroupingIndex !== 0;

            grouping.groups().forEach(group => {

                // A function is passed its own column's statistics, so they must exist for it to
                // reach another column's by key.
                getColumnStats(group, hostColumnIndex, SUMMARY_STATS);

                const columnStats = getColumnStats(group, columnIndex, SUMMARY_STATS);

                // Checked against undefined, as an aggregation can come out null or "" and would
                // otherwise be recalculated on every cell rendered.
                if (columnStats[aggTypeName] !== undefined) return false;

                const valuesToAggregate = [];

                // Stats are over data rows, not child group rows, whose values are aggregations
                // themselves and need not even be numbers.
                if (!isOutermost) {
                    addRowValues(valuesToAggregate, group, readNumber);
                }
                else if (group.containedGroups.size) {

                    // The outermost group's own buffer would be built as a full-length range.
                    group.containedGroups.forEach(childGroup => {

                        addRowValues(valuesToAggregate, childGroup, readNumber);
                    });
                }
                else {

                    const rowCount = tabularData.RowModels.length;

                    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
                        valuesToAggregate.push(readNumber(rowIndex));
                    }
                }

                columnStats[aggTypeName] = aggregate(
                    grouping.valueFormatType,
                    aggTypeName,
                    valuesToAggregate,
                    columnIndex
                );
            });
        });
    };

    /**
     * Populates summary statistics for the passed grouping, or for the last grouping if overall.
     * Where a group row stats target is passed, the group statistics are populated for it instead.
     */
    const populateSummaryStats = (targetColumnIndex, hostColumnIndex, grouping, targetAggTypeName,
        overall, groupRowStatsTarget) => {

        if (!overall && groupRowStatsTarget) {

            listenForChanges();
            populateGroupRowStats(
                groupRowStatsTarget,
                targetColumnIndex,
                targetAggTypeName,
                hostColumnIndex
            );

            return;
        }

        const targetGrouping = !overall ?
            grouping :
            dataGroupingSettings.groupings.lastGrouping();

        // A grid with no groupings has no last grouping to populate.  Null still means every
        // grouping.
        if (targetGrouping === undefined) return;

        listenForChanges();

        populate(targetGrouping, targetColumnIndex, targetAggTypeName, hostColumnIndex);
    };

    const clearStats = (allStats) => {

        if (!allStats) return;

        allStats.forEach(columnStats => {

            for (let index = 0; index < aggregationTypeKeys.length; index++) {
                delete columnStats[aggregationTypeKeys[index]];
            }
        });

        allStats.length = 0;
    };

    /**
     * Sets summary statistics to zero where they exist, throughout the tabular data model.  Returns
     * a value indicating whether the statistics could be cleared.
     */
    const clearSummaryStats = () => {

        // The groupings lack groups() while undoing.

        if (dataGroupingSettings.groupings.entries.some(grouping => !grouping.groups)) return false;

        dataGroupingSettings.groupings.entries.forEach(grouping => {

            grouping.groups().forEach(group => {

                clearStats(group[SUMMARY_STATS]);
                clearStats(group[CHILD_GROUP_ROW_STATS]);
                clearStats(group[OWN_GROUP_ROW_STATS]);
            });
        });

        return true;
    };

    /**
     * Gets where a group row's style functions read their group statistics from: the values of the
     * group rows it sits among (its parent group's child groups), rather than the data rows that
     * format functions read, whose range would not span group totals.  An outermost group row
     * sits among no others, so reads its own values alone.
     *
     * @param {object} grouping - The grouping of the group row.
     * @param {object} group - The group of the group row.
     * @param {object} parentGroup - The group containing it, or null if it is outermost.
     */
    const getGroupRowStatsTarget = (grouping, group, parentGroup) => ({
        statsHost: parentGroup ?? group,
        statsPropertyName: parentGroup ? CHILD_GROUP_ROW_STATS : OWN_GROUP_ROW_STATS,
        groups: parentGroup ? parentGroup.containedGroups : [group],
        valueFormatType: grouping.valueFormatType
    });

    /**
     * Gets the group statistics populated for a group row stats target, or null if there are none.
     */
    const getGroupRowStats = (groupRowStatsTarget) =>
        groupRowStatsTarget.statsHost[groupRowStatsTarget.statsPropertyName] ?? null;

    // Matches a stats argument, then up to two property reads (.Name or ["Name"]): an aggregation
    // type name, or a column key followed by an aggregation type name.
    const summaryStatsReferenceRegex = new RegExp(
        "(groupSummaryStats|overallSummaryStats)" +
        "(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*)|\\s*\\[\\s*([\"'])(.+?)\\3\\s*\\])?" +
        "(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*)|\\s*\\[\\s*([\"'])(.+?)\\6\\s*\\])?",
        "g"
    );

    /**
     * Populates, on the specified grouping, the summary statistics the format or calc functions
     * read through 'groupSummaryStats.sum' / 'overallSummaryStats.sum' etc.  in their source,
     * including those of other columns read by key.  Hosts other than the data grid, e.g. the
     * filter module, call this directly.  A group row stats target (see getGroupRowStatsTarget)
     * has the group statistics populated for it rather than for the grouping.
     */
    const populateStatsUsedByFunctions = (formatFunctions, columnIndex, grouping,
        groupRowStatsTarget) => {

        // The argument list would otherwise read as every function reading both stats arguments.
        const code = Ren.FormatFunctions.getSourceWithoutArguments(formatFunctions);

        if (!code.includes("groupSummaryStats") && !code.includes("overallSummaryStats")) return;

        // For the group and the overall argument in turn, maps each column read to a value
        // indicating whether an aggregation type was named for it.
        const columnsRead = [new Map(), new Map()];
        let matches;

        while ((matches = summaryStatsReferenceRegex.exec(code)) !== null) {

            const argumentIndex = matches[1] === "overallSummaryStats" ? 1 : 0;
            const firstKey = matches[2] === undefined ? matches[4] : matches[2];
            let columnKey = firstKey;
            let aggTypeName = matches[5] === undefined ? matches[7] : matches[5];

            // An aggregation type name read straight off the argument is for its own column.
            if (aggregationTypesByKey.has(firstKey)) {

                columnKey = undefined;
                aggTypeName = firstKey;
            }

            const readColumnIndex = columnKey === undefined
                ? columnIndex
                : tabularData.columnResolver?.getColumnIndex(columnKey);

            // A key that is no column, e.g. .length, reads nothing to populate.
            if (readColumnIndex == null) continue;

            const argumentColumnsRead = columnsRead[argumentIndex];

            if (!aggregationTypesByKey.has(aggTypeName)) {

                if (!argumentColumnsRead.has(readColumnIndex)) {
                    argumentColumnsRead.set(readColumnIndex, false);
                }

                continue;
            }

            argumentColumnsRead.set(readColumnIndex, true);

            populateSummaryStats(
                readColumnIndex,
                columnIndex,
                grouping,
                aggTypeName,
                argumentIndex === 1,
                groupRowStatsTarget
            );
        }

        for (let argumentIndex = 0; argumentIndex < columnsRead.length; argumentIndex++) {

            populateUnindexedSummaryStats(
                columnsRead[argumentIndex],
                columnIndex,
                grouping,
                argumentIndex === 1,
                groupRowStatsTarget
            );
        }
    };

    /**
     * Populates the numeric summary statistics, which are cheap to calculate, for the columns a
     * stats argument is read for without naming the aggregation types needed, e.g. when passed
     * whole to console.log.
     */
    const populateUnindexedSummaryStats = (columnsRead, columnIndex, grouping, overall,
        groupRowStatsTarget) => {

        const aggTypeNames = ["sum", "average", "count", "countDistinct", "min", "max"];

        let anyIndexed = false;

        columnsRead.forEach((indexed) => {

            if (indexed) anyIndexed = true;
        });

        columnsRead.forEach((indexed, readColumnIndex) => {

            if (indexed) return;

            // The null guard compiled into every function names the argument bare, so its own
            // column counts as unindexed only where nothing in the function is indexed.
            if (readColumnIndex === columnIndex && anyIndexed) return;

            for (let index = 0; index < aggTypeNames.length; index++) {

                populateSummaryStats(
                    readColumnIndex,
                    columnIndex,
                    grouping,
                    aggTypeNames[index],
                    overall,
                    groupRowStatsTarget
                );
            }
        });
    };

    /**
     * Populates summary statistics for the specified column, based on the specified column format
     * function, if it contains a reference to 'groupSummaryStats' or 'overallSummaryStats'.
     */
    const lazyPopulateSummaryStats = (columnFormats, columnIndex, grouping) =>
        populateStatsUsedByFunctions(
            columnFormats.columnFormatFunctions[columnIndex],
            columnIndex,
            grouping
        );

    let lastProcessedSummaryStatsSignifier = null;
    let changeListener = null;
    let isDisposed = false;

    /**
     * The listener closes over the largest objects on the page, and there are summary stats per
     * grid, variation and filter module, so it is only registered while there are stats to clear.
     */
    const listenForChanges = () => {

        if (changeListener || isDisposed) return;

        changeListener = Ren.Messages.Events.dataGroupingSettingsChanged.handle(
            (changedDataGroupingSettings) => {

                if (changedDataGroupingSettings !== dataGroupingSettings) return;

                if (changedDataGroupingSettings.signifier === lastProcessedSummaryStatsSignifier) {
                    return;
                }

                lastProcessedSummaryStatsSignifier = changedDataGroupingSettings.signifier;

                if (!clearSummaryStats()) return;

                changeListener = null;

                return false;
            }
        );
    };

    /**
     * Removes the change listener, which would otherwise keep the settings alive after they are
     * dropped.  Derived settings need this, as no change event is ever sent for them.
     */
    const dispose = () => {

        isDisposed = true;

        Ren.Messages.removeListener(changeListener);
        changeListener = null;
    };

    return {
        dispose,
        getGroupRowStats,
        getGroupRowStatsTarget,
        lazyPopulateSummaryStats,
        populateStatsUsedByFunctions
    };
};
