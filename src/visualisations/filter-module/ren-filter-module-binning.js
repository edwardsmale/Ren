/**
 * Filter Module: the per-column binning function, put through an item's values before anything
 * else, so the checkboxes, totals row and compare filters all state bins.  The ticked bins are
 * written as a row-filter predicate, or expanded to the group values they cover where a grouping
 * level is filtered, as a grouping honours column value filters alone.
 */
Ren.FilterModule_Binning = (s) => {

    const { tabularData, columnOverrides, columnModels, paras } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { counts, filterTarget, itemSettings, view } = s;

    // Kept for as long as the choice behind them stands, as building one compiles a function.
    const functionsByColumn = new Map();

    // Each column's bins by value, as a click re-bins every group several times over and a date
    // bin is costly to work out.  Dropped with the function.
    const binsByColumn = new Map();

    // Gets a column's binning function as stored: a format function spec, a custom function's
    // source, or null.
    const getBinningSpec = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.binningFunction ?? null;

    const hasBinning = (columnIdOrHeading) => !!getBinningSpec(columnIdOrHeading);

    // Gets a column's compiled binning function, or null.  A function that doesn't compile leaves
    // the item showing its raw values.
    const getBinningFunction = (columnIdOrHeading) => {

        const specification = getBinningSpec(columnIdOrHeading);
        if (!specification) return null;

        if (functionsByColumn.has(columnIdOrHeading)) return functionsByColumn.get(columnIdOrHeading);

        let binningFunction = null;

        try {

            // A string is a known function's name, or a custom function's own source.
            binningFunction = Ren.FormatFunctions.createFunction(
                Ren.FormatFunctions.isFunctionName(specification)
                    ? { name: specification }
                    : specification,
                paras
            );
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError(
                "[FilterModule] Could not build binning function:",
                error
            );
        }

        functionsByColumn.set(columnIdOrHeading, binningFunction);

        return binningFunction;
    };

    // Gets a value's bin, sort key and all.  Blanks are binned too, as a grouping bins them, so a
    // bin holding blanks ticks the rows behind it.
    const binSortKey = (columnIdOrHeading, value) => {

        const binningFunction = getBinningFunction(columnIdOrHeading);

        if (!binningFunction) return value;

        let bins = binsByColumn.get(columnIdOrHeading);

        if (!bins) {

            bins = new Map();
            binsByColumn.set(columnIdOrHeading, bins);
        }

        if (bins.has(value)) return bins.get(value);

        let bin;

        try {

            const binnedValue = binningFunction(value, null, null, null, null);

            bin = binnedValue === null || binnedValue === undefined ? "" : String(binnedValue);
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError(
                "[FilterModule] Error applying binning function:",
                error
            );

            bin = value;
        }

        bins.set(value, bin);

        return bin;
    };

    // Gets a value's bin as the checkbox states it, the sort key stripped off, so a compare filter
    // tests and a tick matches what is on show.  The sort key orders the checkboxes alone.
    const binValue = (columnIdOrHeading, value) =>
        Ren.TextUtils.stripSortPrefix(binSortKey(columnIdOrHeading, value));

    // Gets the value kind a compare filter on a binned column adapts to: the kind the function's
    // OUTPUT: line names, and "text" for a custom function.
    const getCompareColumnKind = (columnIdOrHeading) => {

        const functionName = Ren.FormatFunctionUtils.getFunctionName(
            getBinningSpec(columnIdOrHeading)
        );

        return functionName ? Ren.FunctionTags.getOutputKind(functionName) : "text";
    };

    // Gets the caption the item's binning box shows.
    const getBinningLabel = (columnIdOrHeading) =>
        Ren.BinningMenuBuilder.describe(getBinningSpec(columnIdOrHeading));

    // Gets the source the "Custom..." editor opens on, or "" where the function is a listed one.
    const getCustomBinningCode = (columnIdOrHeading) => {

        const specification = getBinningSpec(columnIdOrHeading);

        return typeof specification === "string" ? specification : "";
    };

    // The counts settings group by the binned value, so they are dropped along with the function.
    const setBinningFunction = (columnIdOrHeading, specification) => {

        const entry = itemSettings.getOrCreateColumnOverride(columnIdOrHeading);

        if (specification) {
            entry.binningFunction = specification;
        }
        else {

            delete entry.binningFunction;
        }

        functionsByColumn.delete(columnIdOrHeading);
        binsByColumn.delete(columnIdOrHeading);
        groupValuesByBinByGrouping = new WeakMap();
        itemSettings.pruneColumnOverride(columnIdOrHeading);

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    const clearBinningFunction = (columnIdOrHeading) => setBinningFunction(columnIdOrHeading, null);

    // ===== The chosen selection, as a filter =====

    // Gets the single-column chain a binned selection is written over, shaped as a hierarchy's
    // chain so the predicate helpers read it the same way.
    const getBinnedChain = (columnIdOrHeading) => [{
        column: columnIdOrHeading,
        calcFunction: getBinningSpec(columnIdOrHeading)
    }];

    // Gets a value indicating whether a column's ticks are written as a row-filter predicate rather
    // than as a column value filter.
    const filtersByPredicate = (columnIdOrHeading) =>
        hasBinning(columnIdOrHeading) && filterTarget.supportsRowPredicates;

    // ===== Expanding bins to group values (a grouping-level target) =====

    // Each target grouping's group values by bin, by column.  A grouping's groups are fixed once it
    // is built, and a regroup builds new groupings, so an entry only goes stale with its function.
    let groupValuesByBinByGrouping = new WeakMap();

    // Gets the target level's group values for a column, by bin, read from the groups so the
    // expansion covers exactly the bins on offer.
    const getGroupValuesByBin = (columnIdOrHeading) => {

        const grouping = filterTarget.getTargetGrouping();
        let cachedByColumn = grouping ? groupValuesByBinByGrouping.get(grouping) : null;

        if (cachedByColumn?.has(columnIdOrHeading)) return cachedByColumn.get(columnIdOrHeading);

        const valuesByBin = new Map();
        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex == null || columnIndex < 0) return valuesByBin;

        const groupValues = counts.getDistinctGroupValuesForColumnIndex(columnIndex);

        for (let i = 0; i < groupValues.length; i++) {

            const value = groupValues[i];
            const bin = String(binValue(columnIdOrHeading, value));

            const values = valuesByBin.get(bin);

            if (values) {
                values.push(value);
            }
            else {

                valuesByBin.set(bin, [value]);
            }
        }

        if (grouping) {

            if (!cachedByColumn) {

                cachedByColumn = new Map();
                groupValuesByBinByGrouping.set(grouping, cachedByColumn);
            }

            cachedByColumn.set(columnIdOrHeading, valuesByBin);
        }

        return valuesByBin;
    };

    // Gets the group values the given bins cover.
    const expandBinnedValuesToGroupValues = (columnIdOrHeading, binnedValues) => {

        const valuesByBin = getGroupValuesByBin(columnIdOrHeading);
        const groupValues = [];

        for (let i = 0; i < binnedValues.length; i++) {

            const values = valuesByBin.get(String(binnedValues[i]));

            if (!values) continue;

            for (let j = 0; j < values.length; j++) groupValues.push(values[j]);
        }

        return groupValues;
    };

    // Gets the bins a stored column value filter selects.  A bin only partly allowed reads as
    // deselected, so ticking it selects the whole of it.
    const readBinnedValuesFromGroupValues = (columnIdOrHeading, filterValues) => {

        const allowed = new Set();

        for (let i = 0; i < filterValues.length; i++) allowed.add(String(filterValues[i]));

        const valuesByBin = getGroupValuesByBin(columnIdOrHeading);
        const binnedValues = [];

        valuesByBin.forEach((values, bin) => {

            for (let i = 0; i < values.length; i++) {
                if (!allowed.has(String(values[i]))) return;
            }

            binnedValues.push(bin);
        });

        return binnedValues;
    };

    // ===== The menu =====

    // The binning submenu for a column, shared with the grid's grouping menu.
    const buildBinningMenuItems = (item) => {

        // Read as the grid's grouping menu reads it, so a column offers the same functions wherever
        // it is binned.  A date column is offered the date functions the grid leaves to "Group by",
        // as binning a date to a period is what makes it worth filtering on.
        const columnModel = columnModels[item.columnIndex];
        const columnType = columnModel?.ColumnType;

        const isNumberColumn = columnType === "Number"
            || columnType === "Currency"
            || columnType === "Percentage";

        const isTextColumn = columnType === "Text" || columnType === "String";

        const isDateColumn = columnType === "Date"
            || columnType === "Date/Time"
            || Ren.SpreadsheetColumnFormatEnum.IsDate(columnModel?.ColumnFormat);

        return Ren.BinningMenuBuilder.buildSubmenu({
            isNumberColumn,
            isTextColumn,
            isDateColumn,
            isDateTimeColumn: columnType === "Date/Time",
            idSuffix: "-filter-module",
            noneText: "No binning",
            onNone: hasBinning(item.columnIdOrHeading)
                ? () => clearBinningFunction(item.columnIdOrHeading)
                : null,
            getCurrentCustomCode: () => getCustomBinningCode(item.columnIdOrHeading),
            onChoose: (specification) => setBinningFunction(item.columnIdOrHeading, specification)
        });
    };

    return {
        getBinningSpec,
        hasBinning,
        getBinningFunction,
        binValue,
        binSortKey,
        getCompareColumnKind,
        getBinningLabel,
        setBinningFunction,
        clearBinningFunction,
        getBinnedChain,
        filtersByPredicate,
        expandBinnedValuesToGroupValues,
        readBinnedValuesFromGroupValues,
        buildBinningMenuItems
    };
};
