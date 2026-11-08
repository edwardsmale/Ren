/**
 * Pure mutation helpers for the data grouping settings editor: they read and edit the per-column
 * aggregation/formatting/calculation settings and group-by calc functions on a grouping object
 * passed in.  Being free of editor state, they live here as a standalone module the editor
 * destructures at construction time.
 */
Ren.DataGroupingSettingsEditorColumnMutations = (() => {

    const ensureColumnSettings = (grouping, columnKey) => {

        grouping.columns ??= {};
        grouping.columns[columnKey] ??= {};
        return grouping.columns[columnKey];
    };

    const cleanupColumnSettings = (grouping, columnKey) => {

        const columnSettings = grouping.columns?.[columnKey];

        if (columnSettings && Ren.ObjectUtils.isEmptyObject(columnSettings)) {
            delete grouping.columns[columnKey];
        }
    };

    // Cumulative group-by columns visible at a grouping level: its own columns plus those of every
    // inner grouping (entries are ordered innermost-first). These are not aggregated at this level.
    const getCumulativeGroupByColumns = (groupings, entryIndex) => {

        const columnKeys = new Set();

        for (let k = entryIndex; k < groupings.length; k++) {

            const groupByColumns = groupings[k].groupByColumns;
            if (!groupByColumns) continue;
            for (let j = 0; j < groupByColumns.length; j++) columnKeys.add(groupByColumns[j]);
        }

        return columnKeys;
    };

    const ensureGroupByCalcFunctions = (grouping) => {

        const length = grouping.groupByColumns ? grouping.groupByColumns.length : 0;

        if (!grouping.groupByCalcFunctions) {

            grouping.groupByCalcFunctions = new Array(length).fill(null);
        }
        else {

            while (grouping.groupByCalcFunctions.length < length) {
                grouping.groupByCalcFunctions.push(null);
            }
        }

        return grouping.groupByCalcFunctions;
    };

    const removeGroupByCalcFunctionsIfEmpty = (grouping) => {

        if (grouping.groupByCalcFunctions &&
            grouping.groupByCalcFunctions.every(fn => fn == null)) {

            delete grouping.groupByCalcFunctions;
        }
    };

    const resetBlankColumnFormats = (columns, columnKeys) => {

        if (!columns) return;

        for (let i = 0; i < columnKeys.length; i++) {

            const valueFormatFunction = columns[columnKeys[i]]?.valueFormatFunction;
            if (!valueFormatFunction) continue;

            for (let k = 0; k < valueFormatFunction.length; k++) {

                const spec = valueFormatFunction[k];
                if (spec && spec.name === "blank") valueFormatFunction[k] = { name: "default" };
            }
        }
    };

    // Called once the grouping at entryIndex has been taken out of entries.  Levels inside it blank
    // its group-by columns because its group rows show them, so they are reset to the default
    // format there, or the values would be shown nowhere - unless an outer grouping still shows
    // them.  getGroupByColumnKeys suits runtime settings, whose groupings hold column indexes.
    const resetBlankFormatsOfRemovedGroupByColumns = (
        entries,
        dataRows,
        entryIndex,
        removedColumnKeys,
        getGroupByColumnKeys = grouping => grouping.groupByColumns || []
    ) => {

        const stillGrouped = new Set();

        const addGroupByColumns = (grouping) => {

            const columnKeys = getGroupByColumnKeys(grouping);
            for (let j = 0; j < columnKeys.length; j++) stillGrouped.add(columnKeys[j]);
        };

        const getColumnKeysToReset = () =>
            removedColumnKeys.filter(columnKey => !stillGrouped.has(columnKey));

        for (let k = entryIndex; k < entries.length; k++) addGroupByColumns(entries[k]);

        for (let k = Math.min(entryIndex, entries.length) - 1; k >= 0; k--) {

            resetBlankColumnFormats(entries[k].columns, getColumnKeysToReset());
            addGroupByColumns(entries[k]);
        }

        resetBlankColumnFormats(dataRows?.columns, getColumnKeysToReset());
    };

    // Moves a transformed settings' grouping entry aside into disabledGroupings, as
    // { index, grouping } where index is the entry position to restore it to.  dataRows is the
    // transformed settings' dataRows, if any.
    const disableGroupingEntry = (groupings, entryIndex, dataRows) => {

        const entries = groupings.entries;

        const [grouping] = entries.splice(entryIndex, 1);

        resetBlankFormatsOfRemovedGroupByColumns(
            entries,
            dataRows,
            entryIndex,
            grouping.groupByColumns || []
        );

        groupings.disabledGroupings ??= [];
        groupings.disabledGroupings.push({ index: entryIndex, grouping });
    };

    // The outermost grouping is always the last entry, so a restored grouping is kept inside it.
    const getRestoreIndex = (groupings, disabledEntry) =>
        Math.min(disabledEntry.index, Math.max(groupings.entries.length - 1, 0));

    const enableDisabledGroupingEntry = (groupings, disabledEntry) => {

        const disabledGroupings = groupings.disabledGroupings || [];
        const position = disabledGroupings.indexOf(disabledEntry);
        if (position !== -1) disabledGroupings.splice(position, 1);

        const insertIndex = getRestoreIndex(groupings, disabledEntry);

        groupings.entries.splice(insertIndex, 0, disabledEntry.grouping);
    };

    return {
        ensureColumnSettings,
        cleanupColumnSettings,
        getCumulativeGroupByColumns,
        ensureGroupByCalcFunctions,
        removeGroupByCalcFunctionsIfEmpty,
        resetBlankFormatsOfRemovedGroupByColumns,
        disableGroupingEntry,
        getRestoreIndex,
        enableDisabledGroupingEntry
    };
})();
