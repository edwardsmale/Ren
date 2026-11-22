Ren.CreateDateValueChart_PrepareData = (() => {

    // The most points the chart will draw.  Binned data is coarsened to fit (see
    // Ren.DateValueChart_GroupingApplyer.applyGroupingWithinPointLimit); unbinned data that
    // overruns it is refused instead.
    const MAX_DATA_POINTS = 5000;

    // Each prepared row's row before preparing: an aggregated row, or a row of the source data.
    const unpreparedRows = new WeakMap();

    /**
     * Gets the row a prepared row was made from, or undefined for a row prepareData did not make.
     */
    const getUnpreparedRow = (preparedRow) => unpreparedRows.get(preparedRow);

    /**
     * Gets the start of a quarter-format value (e.g. "Q1 2024") as a sortable date, or null.
     */
    const quarterValueToSortableDate = (value) => {

        if (typeof value !== "string" || value.indexOf("Q") === -1) return null;

        const date = Ren.DateUtils.parseDateTimeUniversal(value);

        return date ? Ren.DateUtils.toSortableDate(date) : null;
    };

    /**
     * Gets the rows with their quarter-format dates rewritten, which is what
     * normaliseQuarterDates holds.
     */
    const buildNormalisedQuarterDates = (inputData, dateHeading) => {

        const result = new Array(inputData.length);

        for (let i = 0, len = inputData.length; i < len; i++) {

            const row = inputData[i];
            const sortableDate = quarterValueToSortableDate(row[dateHeading]);

            if (sortableDate !== null) {

                const newRow = Object.assign({}, row);
                newRow[dateHeading] = sortableDate;
                result[i] = newRow;
            }
            else {

                result[i] = row;
            }
        }

        return result;
    };

    /**
     * Converts quarter-format dates to sortable dates before grouping, so downstream binning and
     * parsing treat quarters like any other date.  Rewritten rows are copied, not mutated.
     *
     * Held against the rows it was given, both because a redraw would otherwise copy them all
     * again and because the bins beneath are keyed by the array this returns, which must be the
     * same one from draw to draw for them to be found (see Ren.DateValueChart_DataCache).
     */
    const normaliseQuarterDates = (inputData, dateHeading) =>
        Ren.DateValueChart_DataCache.readOrBuild(
            inputData,
            "normalisedRows",
            dateHeading,
            () => buildNormalisedQuarterDates(inputData, dateHeading)
        );

    /**
     * Gets the chart's rows of parsed date and value(s), sorted by date, dropping rows with blanks.
     */
    const prepareData = (inputData, props) => {

        const dateHeading = props.dateHeading;

        let workingData;

        if (props.preGroupedData) {

            workingData = props.preGroupedData;
        }
        else {

            workingData = normaliseQuarterDates(inputData, dateHeading);
            props.chartDateRange = null;

            if (props.chartGroupingEntry) {

                workingData = Ren.DateValueChart_GroupingApplyer.applyGroupingWithinPointLimit(
                    workingData,
                    props.chartGroupingEntry
                );

                props.chartDateRange = props.chartGroupingEntry.resolvedDateRange;
                props.binPeriod = props.chartGroupingEntry.binPeriod;
                props.isAllTime = !!props.chartGroupingEntry.isAllTime;
                props.allTimeExtent = props.chartGroupingEntry.allTimeExtent;
            }
        }

        // Worked out from the rows before binning, which loses sight of how much of a period the
        // data fills, then held to the chart's own date range so the axis ends where it does.
        // The coverage is of all the rows, so it stands whatever the chart's range, and is held
        // rather than scanned again on the redraw a pan or a zoom brings.
        const dataDateCoverage = Ren.DateValueChart_DataCache.readOrBuild(
            inputData,
            "dateCoverage",
            dateHeading + "|" + props.binPeriod,
            () => getDataDateCoverage(inputData, dateHeading, props.binPeriod)
        );

        // All time draws its one point across the whole axis, whatever dates it covers.
        props.dataDateCoverage = props.isAllTime
            ? null
            : Ren.DateValueChart_DateRange.clampCoverage(dataDateCoverage, props.chartDateRange);

        const isMultiColumn = props.valueHeadings && Array.isArray(props.valueHeadings);
        const valueHeadings = isMultiColumn ? props.valueHeadings : [props.valueHeading];
        const parseDate = Ren.DateUtils.parseDateTimeUniversal;
        const parseFloat = Ren.TextUtils.parseFloat;
        const result = [];

        // In a split series a missing value means that series contributed nothing, and dropping the
        // period would take every other series' point with it.
        const treatMissingValuesAsZero = !!props.seriesSplit;

        for (let i = 0, len = workingData.length; i < len; i++) {

            const row = workingData[i];
            const dateVal = row[dateHeading];

            let hasAllValues = true;
            const parsedValues = {};

            for (let j = 0; j < valueHeadings.length; j++) {

                const valueHeading = valueHeadings[j];
                const valueVal = row[valueHeading];

                if (Ren.IsNull(valueVal)) {

                    if (!treatMissingValuesAsZero) {

                        hasAllValues = false;
                        break;
                    }

                    parsedValues[valueHeading] = 0;
                    continue;
                }

                const parsedValue = parseFloat(valueVal);

                if (isNaN(parsedValue) || (treatMissingValuesAsZero && parsedValue === null)) {

                    if (!treatMissingValuesAsZero) {

                        hasAllValues = false;
                        break;
                    }

                    parsedValues[valueHeading] = 0;
                    continue;
                }

                parsedValues[valueHeading] = parsedValue;
            }

            if (!Ren.IsNull(dateVal) && hasAllValues) {

                const parsedDate = parseDate(dateVal, true);
                const resultRow = { [dateHeading]: parsedDate };
                Object.assign(resultRow, parsedValues);
                unpreparedRows.set(resultRow, row);
                result.push(resultRow);
            }
        }

        // Binned rows needn't arrive in date order, so an insertion sort could make thousands of
        // passes over them.  Rows of the same date keep their order, as the sort is stable.
        result.sort((a, b) => a[dateHeading] - b[dateHeading]);

        return result;
    };

    const getDates = (inputData, dateHeading) => {

        const parseDate = Ren.DateUtils.parseDateTimeUniversal;
        const dates = [];

        for (let i = 0, len = inputData.length; i < len; i++) {

            const date = inputData[i][dateHeading];

            if (!Ren.IsNull(date)) {

                // Group and totals rows don't parse.
                const parsedDate = parseDate(date, true);

                if (parsedDate) dates.push(parsedDate);
            }
        }

        return dates;
    };

    /**
     * Gets the time the data covers, as { start, end } with an exclusive end, or null.  It runs to
     * the ends of the source rows' periods, so a partly filled bin is drawn only across its data.
     * Times of day count only under bins finer than a day, so a day's bin is drawn whole.
     */
    const getDataDateCoverage = (inputData, dateHeading, binPeriod) => {

        const periodAndExtent = Ren.DatePeriodDetector.detectDatePeriodAndExtentForRows(
            inputData,
            dateHeading
        );

        if (!periodAndExtent) return null;

        const finestPeriod = Math.min(binPeriod ?? Ren.DatePeriodEnum.Day, Ren.DatePeriodEnum.Day);
        const sourcePeriod = Math.max(periodAndExtent.datePeriod, finestPeriod);
        const firstStart = Ren.DateUtils.startOfPeriod(periodAndExtent.minDate, sourcePeriod) || periodAndExtent.minDate;
        const lastStart = Ren.DateUtils.startOfPeriod(periodAndExtent.maxDate, sourcePeriod) || periodAndExtent.maxDate;

        return { start: firstStart, end: Ren.DateUtils.addPeriod(lastStart, sourcePeriod) };
    };

    const validateInputDataVolume = (inputData) => {

        if (inputData && inputData.length > MAX_DATA_POINTS) {
            return `Too many data points (${inputData.length}).<br /><br />The chart can display a maximum of ${MAX_DATA_POINTS} points.`;
        }

        return null;
    };

    return {
        MAX_DATA_POINTS,
        prepareData,
        getUnpreparedRow,
        getDates,
        getDataDateCoverage,
        validateInputDataVolume,
        normaliseQuarterDates
    };
})();
