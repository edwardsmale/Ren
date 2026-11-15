/**
 * Splitting a date/value chart's data into a series per value of a column.
 *
 * The chart's own dataGroupingSettings normally hold two entries: the date grouping (innermost) and
 * the empty outermost one.  A third entry between them, or innermost where there is no date
 * grouping, splits the data further: each distinct value of its group-by column becomes a series
 * of its own, treated as an ordinary value column.  Where the entry has a topValueCount, only the
 * values with the largest totals have a series of their own and the rest share an "(other)" one.
 */
Ren.DateValueChart_SeriesSplit = (() => {

    // A column with hundreds of distinct values would draw a chart nobody could read, so past this
    // many a split draws only its top series unless the user has chosen a limit.
    const MAX_SERIES = 24;

    // Separates the value column from the split value where both are named in a series heading.
    const SEPARATOR = " – ";

    // The split value the values outside the top ones are gathered under, and what its series is
    // called.  No column holds the control character, so it never meets a value of the data.
    const OTHER_VALUE = "\u0001other";
    const OTHER_LABEL = "(other)";

    // A series totalling less than this share of the largest series' total is minor: it would only
    // crowd the foot of the chart.
    const MINOR_SERIES_SHARE = 0.05;

    // How a value column is drawn, which every series it is split into shares, unlike what tells
    // the series apart, such as its colour and label.
    const SHARED_SERIES_PROPERTIES = [
        "chartType",
        "valueAxis",
        "showValueLabels",
        "showNameInBars",
        "lineStyle",
        "lineWidth",
        "curved",
        "lineShape",
        "dotSize",
        "estimateLastPeriod",
        "runningTotal",
        "yearToDate",
        "rollingYearTotal"
    ];

    /**
     * Gets the entry that splits the data, or null where the settings hold no such entry. It is the
     * first entry that groups by something other than a date.
     */
    const getSplitEntry = (chartDataGroupingSettings) => {

        const entries = chartDataGroupingSettings?.groupings?.entries;

        if (!entries) return null;

        for (let i = 0; i < entries.length; i++) {

            const entry = entries[i];

            // Saved settings name the column alone, until its index is rebuilt from the name.
            if (!entry.groupByColumnIndexes?.length && !entry.groupByColumns?.length) continue;

            if (Ren.DateValueChart_GroupingEntries.isDateEntry(entry)) continue;

            return entry;
        }

        return null;
    };

    /**
     * Gets the column the data is split by, named as the rows are keyed - by column ID or heading -
     * or null where it is not split.
     *
     * The column is read by name rather than index, since a column added to the query shifts every
     * index after it.  Where the named column is no longer in the data the split is dropped.
     * Settings written before the name was stored hold an index alone, and are read by it.
     */
    const getSplitColumnKey = (chartDataGroupingSettings, columnResolver) => {

        const entry = getSplitEntry(chartDataGroupingSettings);

        if (!entry) return null;

        const namedColumn = entry.groupByColumns?.[0];

        if (namedColumn) {

            if (!columnResolver) return namedColumn;

            const columnIndex = columnResolver.getColumnIndex(namedColumn);

            if (columnIndex == null) return null;

            // Keep the index the name resolves to, so readers of the entry that go by index (and
            // the settings it is next saved as) follow the column rather than its old position.
            entry.groupByColumnIndexes = [columnIndex];

            return columnResolver.getColumnIdOrHeading(columnIndex) ?? namedColumn;
        }

        const savedIndex = entry.groupByColumnIndexes?.[0];

        if (savedIndex == null || !columnResolver) return null;

        return columnResolver.getColumnIdOrHeading(savedIndex) ?? null;
    };

    /**
     * Gets the index of the column the data is split by, or null where it is not split.
     * Resolved from the column's name where the entry carries one (see getSplitColumnKey).
     */
    const getSplitColumnIndex = (chartDataGroupingSettings, columnResolver) => {

        const entry = getSplitEntry(chartDataGroupingSettings);

        if (!entry) return null;

        if (entry.groupByColumns?.[0] && columnResolver) {

            return columnResolver.getColumnIndex(entry.groupByColumns[0]);
        }

        return entry.groupByColumnIndexes?.[0] ?? null;
    };

    /**
     * Splits the data by the given column, or stops splitting it when passed null.  The entry is
     * added just outside the date grouping, so that the date grouping stays the innermost one, or
     * innermost where there is no date grouping.  The column is named as well as indexed.
     */
    const setSplitColumn = (chartDataGroupingSettings, columnIndex, columnResolver) => {

        const entries = chartDataGroupingSettings?.groupings?.entries;

        if (!entries) return;

        const GroupingEntries = Ren.DateValueChart_GroupingEntries;
        const existingEntry = getSplitEntry(chartDataGroupingSettings);

        if (existingEntry) GroupingEntries.removeEntry(chartDataGroupingSettings, existingEntry);

        if (columnIndex == null) return;

        const dateEntry = GroupingEntries.getDateEntry(chartDataGroupingSettings);
        const insertAt = dateEntry ? entries.indexOf(dateEntry) + 1 : 0;

        const entry = { groupByColumnIndexes: [columnIndex] };
        const columnKey = columnResolver?.getColumnIdOrHeading(columnIndex);

        if (columnKey) entry.groupByColumns = [columnKey];

        GroupingEntries.insertEntry(chartDataGroupingSettings, insertAt, entry);
    };

    /**
     * Gets the first of a new chart's selected columns to split its data by: one that is neither
     * its date column nor a value column, as it holds a value that is not a number and its grouping
     * settings, from getColumnSettings, neither aggregate nor calculate it into one.  Gets null
     * where there is none.
     */
    const getInitialSplitColumn = (rows, selectedColumns, dateHeading, getColumnSettings) => {

        for (let c = 0; c < selectedColumns.length; c++) {

            const column = selectedColumns[c];
            const columnSettings = getColumnSettings(column);

            if (column === dateHeading) continue;
            if (columnSettings?.aggregationType != null) continue;
            if (columnSettings?.calcFunction != null) continue;

            for (let r = 0; r < rows.length; r++) {

                const value = rows[r][column];

                if (Ren.IsNullOrEmpty(value)) continue;
                if (!Ren.AdHocDataSource_ColumnDetector.isNumericValue(value)) return column;
            }
        }

        return null;
    };

    /**
     * Gets how many of the split's values have a series of their own, the rest being gathered into
     * one, or null where every value has its own.
     */
    const getTopValueCount = (chartDataGroupingSettings) =>
        getSplitEntry(chartDataGroupingSettings)?.topValueCount || null;

    /**
     * A row's split value, as the string it is grouped and named by.  Where only the top values
     * are kept, any other value reads as OTHER_VALUE.
     */
    const readSplitValue = (row, splitColumnKey, keptValues) => {

        const value = row[splitColumnKey];
        const splitValue = (value === null || value === undefined) ? "" : String(value);

        return (keptValues && !keptValues.has(splitValue)) ? OTHER_VALUE : splitValue;
    };

    /**
     * Gets the split values with the largest totals of the ranking column, or null where there are
     * no more values than are kept.
     */
    const getTopValues = (rows, splitColumnKey, rankingHeading, topValueCount) => {

        const totals = new Map();

        for (let i = 0; i < rows.length; i++) {

            const splitValue = readSplitValue(rows[i], splitColumnKey, null);
            const number = Ren.TextUtils.parseFloat(rows[i][rankingHeading]);
            const total = totals.get(splitValue) || 0;

            totals.set(splitValue, (number === null || isNaN(number)) ? total : total + number);
        }

        if (totals.size <= topValueCount) return null;

        const values = Array.from(totals.keys());

        values.sort((a, b) =>
            (totals.get(b) - totals.get(a)) || Ren.ArrayUtils.compareOrdinal(a, b)
        );

        return new Set(values.slice(0, topValueCount));
    };

    /**
     * Collects the distinct values of the split column, numerically where they are all numbers,
     * alphabetically otherwise, which settles the order of series reaching the same height.
     * Values gathered as OTHER_VALUE come last.
     */
    const collectValues = (rows, splitColumnKey, keptValues) => {

        const distinctValues = new Set();

        for (let i = 0; i < rows.length; i++) {
            distinctValues.add(readSplitValue(rows[i], splitColumnKey, keptValues));
        }

        const hasOtherValue = distinctValues.delete(OTHER_VALUE);
        const values = Array.from(distinctValues);

        let areAllNumeric = values.length > 0;

        for (let i = 0; i < values.length; i++) {

            const number = Ren.TextUtils.parseFloat(values[i]);

            if (number === null || isNaN(number)) {

                areAllNumeric = false;
                break;
            }
        }

        values.sort(areAllNumeric
            ? (a, b) => Ren.TextUtils.parseFloat(a) - Ren.TextUtils.parseFloat(b)
            : Ren.ArrayUtils.compareOrdinal);

        if (hasOtherValue) values.push(OTHER_VALUE);

        return values;
    };

    /**
     * Gets what a split value is called in its series' name.  A blank or NULL value is named as
     * the filters caption it.  A Boolean or number means little alone, so where the split column,
     * as { heading, format }, is of either it is named too, as "IsBusiness = True", a Boolean's 1
     * and 0 read as True and False.
     */
    const getSplitValueLabel = (splitValue, splitColumn) => {

        if (splitValue === OTHER_VALUE) return OTHER_LABEL;

        const label = Ren.ValueDisplayLabel(splitValue);
        const format = splitColumn?.format;

        if (!splitColumn?.heading || !Ren.SpreadsheetColumnFormatEnum.IsNumeric(format)) {
            return label;
        }

        let valueText = label;

        if (format === Ren.SpreadsheetColumnFormatEnum.Boolean) {

            const lowerCase = splitValue.toLowerCase();

            if (lowerCase === "1" || lowerCase === "true") {
                valueText = "True";
            }
            else if (lowerCase === "0" || lowerCase === "false") {

                valueText = "False";
            }
        }

        return `${splitColumn.heading} = ${valueText}`;
    };

    /**
     * Makes the heading a series is known by, given the value column it aggregates and the split
     * value it covers. Where there is a single value column the split value alone names the series;
     * where there are several, the value column is named too.
     *
     * usedHeadings holds the headings already taken, so that a series never takes a name another
     * column in the row is already keyed by.
     */
    const makeSeriesHeading = (
        valueHeading,
        splitValue,
        splitColumn,
        isSingleValueColumn,
        usedHeadings
    ) => {

        const label = getSplitValueLabel(splitValue, splitColumn);
        const qualifiedHeading = valueHeading + SEPARATOR + label;

        if (isSingleValueColumn && !usedHeadings.has(label)) return label;
        if (!usedHeadings.has(qualifiedHeading)) return qualifiedHeading;

        let suffix = 2;
        let heading = qualifiedHeading + " (" + suffix + ")";

        while (usedHeadings.has(heading)) {

            suffix++;
            heading = qualifiedHeading + " (" + suffix + ")";
        }

        return heading;
    };

    /**
     * Gets the value column a split chart's series heading was made from, even for a series that
     * is removed or whose split value the data no longer holds, or null where it cannot be told.
     */
    const getSourceHeading = (props, heading) => {

        const allHeadings = props.allValueHeadings || [];
        const allSourceHeadings = props.allSeriesSourceHeadings || [];
        const index = allHeadings.indexOf(heading);

        if (index !== -1) return allSourceHeadings[index];

        const sourceHeadings = [];

        for (let i = 0; i < allSourceHeadings.length; i++) {

            if (sourceHeadings.indexOf(allSourceHeadings[i]) === -1) {
                sourceHeadings.push(allSourceHeadings[i]);
            }
        }

        // A lone value column's series are named by their split value alone.
        if (sourceHeadings.length === 1) return sourceHeadings[0];

        let sourceHeading = null;

        for (let i = 0; i < sourceHeadings.length; i++) {

            const isPrefix = heading.indexOf(sourceHeadings[i] + SEPARATOR) === 0;

            if (isPrefix && (!sourceHeading || sourceHeadings[i].length > sourceHeading.length)) {
                sourceHeading = sourceHeadings[i];
            }
        }

        return sourceHeading;
    };

    /**
     * Gets the heading a split series of one value column takes once the column is switched for
     * another, which is the heading as it is for a series of another column, or one named by its
     * split value alone.
     */
    const renameSeriesHeading = (props, heading, oldValueHeading, newValueHeading) => {

        if (getSourceHeading(props, heading) !== oldValueHeading) return heading;
        if (heading.indexOf(oldValueHeading + SEPARATOR) !== 0) return heading;

        return newValueHeading + heading.slice(oldValueHeading.length);
    };

    /**
     * The series the split stands for: one per value column per split value, each carrying the
     * heading its values are written out under, the value column it aggregates and the split value
     * it covers.  The split column, as { heading, format }, names a Boolean or numeric value.
     */
    const buildSeriesColumns = (valueHeadings, splitValues, reservedHeading, splitColumn) => {

        const isSingleValueColumn = valueHeadings.length === 1;
        const usedHeadings = new Set();
        const seriesColumns = [];

        if (reservedHeading) usedHeadings.add(reservedHeading);

        for (let v = 0; v < valueHeadings.length; v++) {

            for (let s = 0; s < splitValues.length; s++) {

                const heading = makeSeriesHeading(
                    valueHeadings[v],
                    splitValues[s],
                    splitColumn,
                    isSingleValueColumn,
                    usedHeadings
                );

                usedHeadings.add(heading);

                seriesColumns.push({
                    heading,
                    valueHeading: valueHeadings[v],
                    splitValue: splitValues[s]
                });
            }
        }

        return seriesColumns;
    };

    /**
     * Gets the most each series reaches over the given aggregated rows, by series heading.
     */
    const getSeriesMaxes = (rows, seriesColumns) => {

        const maxes = new Map();

        for (let c = 0; c < seriesColumns.length; c++) {

            const heading = seriesColumns[c].heading;
            let max = -Infinity;

            for (let r = 0; r < rows.length; r++) {

                const number = Ren.TextUtils.parseFloat(rows[r][heading]);

                if (number !== null && number > max) max = number;
            }

            maxes.set(heading, max);
        }

        return maxes;
    };

    /**
     * Orders split series headings highest first by the most each reaches, from getSeriesMaxes.
     * The series of each value column stay together, in the order of the value columns, and the
     * "(other)" series stays last among them.  Series reaching the same height keep the order they
     * are given in.
     */
    const orderHeadingsByMax = (headings, seriesColumns, seriesMaxes) => {

        const valueColumnOrder = new Map();
        const seriesColumnByHeading = new Map();

        for (let c = 0; c < seriesColumns.length; c++) {

            const seriesColumn = seriesColumns[c];

            if (!valueColumnOrder.has(seriesColumn.valueHeading)) {
                valueColumnOrder.set(seriesColumn.valueHeading, valueColumnOrder.size);
            }

            seriesColumnByHeading.set(seriesColumn.heading, seriesColumn);
        }

        const keys = new Array(headings.length);

        for (let h = 0; h < headings.length; h++) {

            const seriesColumn = seriesColumnByHeading.get(headings[h]);
            const max = seriesMaxes.has(headings[h]) ? seriesMaxes.get(headings[h]) : -Infinity;

            keys[h] = {
                heading: headings[h],
                position: h,
                valueColumn: seriesColumn ? valueColumnOrder.get(seriesColumn.valueHeading) : 0,
                isOther: seriesColumn ? seriesColumn.splitValue === OTHER_VALUE : false,
                max
            };
        }

        keys.sort((a, b) =>
            (a.valueColumn - b.valueColumn) ||
            (a.isOther - b.isOther) ||
            (b.max > a.max ? 1 : b.max < a.max ? -1 : 0) ||
            (a.position - b.position)
        );

        const ordered = new Array(keys.length);

        for (let k = 0; k < keys.length; k++) ordered[k] = keys[k].heading;

        return ordered;
    };

    /**
     * Gets the headings of the minor series: those whose totals over the given aggregated rows fall
     * below MINOR_SERIES_SHARE of the largest series' total.
     */
    const getMinorSeriesHeadings = (rows, headings) => {

        const totals = new Array(headings.length).fill(0);
        let largestTotal = 0;

        for (let h = 0; h < headings.length; h++) {

            for (let r = 0; r < rows.length; r++) {

                const number = Ren.TextUtils.parseFloat(rows[r][headings[h]]);

                if (number !== null && !isNaN(number)) totals[h] += number;
            }

            largestTotal = Math.max(largestTotal, totals[h]);
        }

        const minorHeadings = new Set();

        for (let h = 0; h < headings.length; h++) {

            if (totals[h] < largestTotal * MINOR_SERIES_SHARE) minorHeadings.add(headings[h]);
        }

        return minorHeadings;
    };

    /**
     * Gets how most of the given series are drawn, as the most common value of each of the shared
     * series properties, for the series a change of split replaces them with to take up.
     */
    const getSharedSeriesSettings = (series) => {

        const settings = {};

        if (!series?.length) return settings;

        for (let p = 0; p < SHARED_SERIES_PROPERTIES.length; p++) {

            const property = SHARED_SERIES_PROPERTIES[p];
            const counts = new Map();
            let highestCount = 0;

            for (let i = 0; i < series.length; i++) {

                const value = series[i]?.[property];

                if (value === undefined) continue;

                const count = (counts.get(value) ?? 0) + 1;

                counts.set(value, count);

                if (count > highestCount) {

                    highestCount = count;
                    settings[property] = value;
                }
            }
        }

        return settings;
    };

    return {
        getSharedSeriesSettings,
        MAX_SERIES,
        OTHER_VALUE,
        OTHER_LABEL,
        SHARED_SERIES_PROPERTIES,
        getSplitEntry,
        getSplitColumnKey,
        getSplitColumnIndex,
        getInitialSplitColumn,
        setSplitColumn,
        getTopValueCount,
        readSplitValue,
        getTopValues,
        collectValues,
        getSourceHeading,
        renameSeriesHeading,
        buildSeriesColumns,
        getSplitValueLabel,
        getSeriesMaxes,
        orderHeadingsByMax,
        getMinorSeriesHeadings
    };
})();
