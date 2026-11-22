/**
 * Date markers drawn on a date/value chart from a data source of their own: a report's significant
 * dates - a search algorithm update, an acquisition, a site migration - shown as dashed vertical
 * lines with a labelled flag the reader can hover for the detail behind them.
 *
 * Where the markerLines declared on a chart annotate dates found in the chart's own rows, these
 * come from a second data source holding one row per date, which has nothing to do with what the
 * chart plots.  The chart declares it as
 *
 *     "dateMarkers": {
 *         "sqlFilename": "SignificantSearchDates",
 *         "dateColumn": "Date",              // optional; detected when left out
 *         "labelColumn": "Event",            // optional; detected when left out
 *         "colour": "lightseagreen",         // optional, as are lineStyle, lineWidth,
 *         "hidden": false                    // labelPosition and outOfRange
 *         "useReportParameters": false       // optional; with a sqlFilename, passes the report's
 *                                            // parameters (an account ref, say) to the source
 *     }
 * or, at its shortest, as the visualisation option dateMarkersDataSourceUri.  A sqlFilename can be
 * given in place of a dataSourceUri, naming the SQL file to read the dates from. Every other column
 * of a marker row becomes part of what its flag says on hover, so a data source can carry as much
 * explanation as it likes without the chart having to know the shape of it.
 *
 * The rows gain one column client-side, ahead of the source's own: the column the dates grid draws
 * its tick boxes in (TICK_COLUMN_HEADING).  Its value is the date and the label as one,
 * "2026-01-04 | Site migration", which is a marker's identity - the date column alone lists dates
 * with nothing saying what they are, and the label column labels with nothing saying when.
 *
 * The dates can be listed as a grid of their own and filtered there; the filter is held on the
 * chart as dateMarkers.filterSet, in exactly the shape the rest of Ren keeps a filter set in, and
 * is applied to the marker rows here.  The grid can hold it either way round, by exclusion
 * included, but what is saved with the report is always the dates to keep, so that the report opens
 * showing what it was saved showing.
 *
 * The data source is requested on first render and the chart redrawn when it lands, so a chart
 * whose markers come from the server draws its data first and its markers a moment later.
 */
Ren.DateValueChart_DateMarkers = (() => {

    // A chart carrying hundreds of lines is illegible, so a source resolving to more markers than
    // this within the charted range is dropped rather than drawn.  Only the markers that would
    // actually be drawn are counted, so a long list of dates still annotates a chart showing a few
    // months of it.
    const MAX_MARKERS = 60;

    // A significant date annotates the data rather than being part of it, so it is drawn as a fine
    // line in a colour of its own that no series is drawn in.
    const DEFAULT_COLOUR = "#1e50a3";

    const DEFAULT_LINE_WIDTH = "thin";

    // The heading of the column added to a marker source client-side: in the dates grid it holds a
    // tick box per row.  Named for what the reader does with it rather than for what it holds,
    // since what it holds is said by the date and label columns beside it.
    const TICK_COLUMN_HEADING = "Show";

    // The charts waiting on a marker data source, as one array of redraw callbacks per data source
    // URI.  A chart redraws several times before its markers land, and two charts can share a
    // source, so the callbacks are collected and called once the rows arrive.
    const redrawsPendingByDataSourceUri = new Map();

    Ren.Messages.Events.dataSourcesChanged.handle(() => {

        if (redrawsPendingByDataSourceUri.size === 0) return;

        redrawsPendingByDataSourceUri.forEach((redraws, dataSourceUri) => {

            if (!Ren.DataSources.getTabularDataSet(dataSourceUri)) return;

            redrawsPendingByDataSourceUri.delete(dataSourceUri);

            for (let i = 0; i < redraws.length; i++) redraws[i]();
        });
    });

    /**
     * Gets the marker configuration a visualisation declares, normalised into an object, or null
     * where it declares none.  Accepts the object form, the JSON string an element attribute can
     * carry, and the dataSourceUri-only shorthand.
     */
    const getConfig = (visualisation) => {

        if (!visualisation) return null;

        let config = visualisation.dateMarkers ?? null;

        if (typeof config === "string") {

            try {

                config = JSON.parse(config);
            }
            catch (error) {

                config = null;
            }
        }

        if (!config && visualisation.dateMarkersDataSourceUri) {
            config = { dataSourceUri: visualisation.dateMarkersDataSourceUri };
        }

        if (!config) return null;

        // A marker source of one entity's dates - an account's, say - needs the report's
        // parameters to know which, so it can ask for them with useReportParameters.  They are
        // resolved on a copy, onto a property that does not serialise, so that the URI naming this
        // report's account is never saved into the settings.
        if (config.useReportParameters && config.sqlFilename && visualisation.reportContext) {

            config = Object.assign({}, config);

            const resolvedSource = {
                sqlFilename: config.sqlFilename,
                reportContext: visualisation.reportContext,
                dataFormat: config.dataFormat
            };

            Ren.DataSourceUriResolver.resolveDataSourceUri(resolvedSource, null);

            Object.defineProperty(config, "dataSourceUri", {
                value: Ren.UrlUtils.sortDataSourceUriParameters(resolvedSource.dataSourceUri),
                enumerable: false,
                writable: true
            });

            return config;
        }

        // A marker source can be named by its SQL file alone.  The report's parameters are
        // deliberately not mixed in as they are for a visualisation's own source: a list of
        // significant dates is not a thing to narrow to the range the chart happens to be showing.
        if (!config.dataSourceUri && config.sqlFilename) {
            config.dataSourceUri = Ren.NamedDataSources.getUri(config.sqlFilename);
        }

        if (!config.dataSourceUri) return null;

        // Normalised the way the data source collection keys its entries, so a URI written with its
        // parameters in another order still finds the data source that was loaded for it.
        config.dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(config.dataSourceUri);

        return config;
    };

    /**
     * Gets the tabular data holding the marker rows, or null while the data source is still
     * loading.
     */
    const getTabularData = (config) => Ren.DataSources.getTabularData(
        config.dataSourceUri,
        config.dataTabIndex ?? 1,
        config.dataTabGroup
    );

    /**
     * Asks the server for the marker data source, and arranges for the chart to be redrawn once it
     * arrives.
     */
    const requestDataSource = (config, props) => {

        const dataSourceUri = config.dataSourceUri;

        // The chart is already drawn by the time the rows land: the markers are an annotation on
        // the data, not part of it.
        const redraws = redrawsPendingByDataSourceUri.get(dataSourceUri) ?? [];

        if (redraws.indexOf(props.redrawChart) === -1 &&
            typeof props.redrawChart === "function") {

            redraws.push(props.redrawChart);
        }

        redrawsPendingByDataSourceUri.set(dataSourceUri, redraws);

        // Ignored where the data source is already loading, and where it is one the page carries
        // rather than one the server serves (a downloaded report brings its own).
        Ren.DataSources.requestDataSource(dataSourceUri);
    };

    /**
     * One row's date and label as the single value the tick column holds.  The dates grid fills its
     * copy of the column with this too, so that the filter it writes and the rows the chart matches
     * against it read identically.
     *
     * The date leads, written yyyy-MM-dd, so that the values sort into date order wherever they are
     * listed - a filter module sorts its options as the strings they are, and dd/MM/yyyy sorts them
     * by day of the month.  A time of day follows it where there is one, so two markers on one day
     * are told apart.
     */
    const buildDateAndLabel = (dateValue, label) => {

        const date = Ren.DateUtils.parseDateTimeUniversal(dateValue);
        const dateText = date
            ? Ren.DateValueChart_MarkerLines.toSortableMarkerDate(date)
            : String(dateValue ?? "").trim();
        const labelText = String(label ?? "").trim();

        return labelText ? dateText + " | " + labelText : dateText;
    };

    // What has been read off a marker source: the columns detected in it and its rows, with the
    // tick column added.  Held per tabular data - a reloaded source is a new object, so its rows
    // are read afresh - and within that per the columns the configuration names, so that two charts
    // reading one source with different columns named do not share an answer.
    const markerDataByTabularData = new WeakMap();

    /**
     * Gets the marker rows as objects keyed by heading, unfiltered and with the tick column added,
     * together with the columns they were read with.
     */
    const getMarkerData = (config, tabularData) => {

        let markerDataByConfig = markerDataByTabularData.get(tabularData);

        if (!markerDataByConfig) {

            markerDataByConfig = new Map();
            markerDataByTabularData.set(tabularData, markerDataByConfig);
        }

        const configKey = (config.dateColumn ?? "") + " -|- " + (config.labelColumn ?? "");
        const cachedMarkerData = markerDataByConfig.get(configKey);

        if (cachedMarkerData) return cachedMarkerData;

        const rowCount = Math.min(
            tabularData.DataRowCount ?? tabularData.RowModels.length,
            tabularData.RowModels.length
        );

        // Unformatted: formatting the values means building data grouping settings for the marker
        // source, which there is no visualisation to build them from.  The dates are parsed and
        // formatted here in any case.
        const rows = Ren.TabularDataAdapter_Array.getDataArray(
            tabularData,
            null,
            null,
            false,
            true,
            0,
            rowCount
        );

        const dateColumn = rows.length ? detectDateColumn(config, rows) : null;
        const labelColumn = dateColumn ? detectLabelColumn(config, rows, dateColumn) : null;

        // Wherever there are dates at all, label or no label: a source of bare dates is as much a
        // thing to tick as any other, and is identified by its date alone.
        const tickColumn = dateColumn ? TICK_COLUMN_HEADING : null;

        if (tickColumn) {

            for (let i = 0; i < rows.length; i++) {

                const row = rows[i];

                row[tickColumn] =
                    buildDateAndLabel(row[dateColumn], labelColumn ? row[labelColumn] : null);
            }
        }

        const markerData = { dateColumn, labelColumn, tickColumn, rows };

        markerDataByConfig.set(configKey, markerData);

        return markerData;
    };

    /**
     * Gets the tabular data transformers the dates grid is built with, so that it holds the same
     * tick column the chart matches its markers against.  Empty where the source has no dates in
     * it.
     */
    const getTabularDataTransformers = (config, tabularData) => {

        const { dateColumn, labelColumn, tickColumn } = getMarkerData(config, tabularData);

        if (!tickColumn) return [];

        return [{
            tabularDataTransformerName: "AddColumn",
            parameters: {

                // First of the columns, so the reader ticks a date at the start of its row.  The
                // date and label columns are detected from the source as it arrived, before this
                // is added.
                insertBeforeColumn: 0,
                valueColumnHeading: tickColumn,
                columnFormat: Ren.SpreadsheetColumnFormatEnum.General,
                columnType: "String",
                isNewColumnCompressed: false,

                // A one-specification chain rather than the specification on its own: a lone string
                // is read as a literal to write into every cell, and only the array form compiled.
                value_or_value_function_spec: [
                    "Ren.DateValueChart_DateMarkers.buildDateAndLabel(" +
                    "rowVals[" + JSON.stringify(dateColumn) + "], " +
                    (labelColumn ? "rowVals[" + JSON.stringify(labelColumn) + "]" : "null") + ")"
                ]
            }
        }];
    };

    /**
     * Gets the marker rows as objects keyed by heading, with the chart's marker filter applied.
     *
     * The filter is kept on the chart rather than in a settings group of its own so that it is
     * saved with the chart and applied on load whether or not the dates grid was ever opened.
     */
    const getRows = (config, tabularData) => {

        const markerData = getMarkerData(config, tabularData);

        return applyFilterSet(config, tabularData, markerData.rows);
    };

    /**
     * Filters marker rows by the chart's marker filter set, which holds a data tab's filters
     * exactly as any other filter set does: the column value filters, the negation marks that make
     * one state its exclusions, and the row-filter predicates the compare filters are written as.
     */
    const applyFilterSet = (config, tabularData, rows) =>
        Ren.RowObjectFilter.filterRowsByTabFilters(rows, config.filterSet?.[tabularData.Title]);

    /**
     * One tab's marker filters with every negated column's list replaced by the values it currently
     * allows, and the negation marks dropped - the same reading of the filter as
     * Ren.FilterNegation.toInclusionValues, worked out over the marker rows rather than over a
     * tabular data's columns, since the tick column is added client-side.
     *
     * Returns the entry it was given where nothing is negated.
     */
    const toInclusionTabFilters = (tabFilters, rows) => {

        const negatedColumns = tabFilters?.negatedColumns;

        if (!Array.isArray(negatedColumns) || negatedColumns.length === 0) return tabFilters;

        const columnValueFilters = {};
        const sourceColumnValueFilters = tabFilters.columnValueFilters ?? {};

        for (const columnIdOrHeading in sourceColumnValueFilters) {

            const filterValues = sourceColumnValueFilters[columnIdOrHeading];

            if (negatedColumns.indexOf(columnIdOrHeading) === -1) {

                columnValueFilters[columnIdOrHeading] = filterValues;
                continue;
            }

            // An exclusion of nothing excludes nothing, so the column is left out altogether rather
            // than written as a list of every value there is.
            if (!Array.isArray(filterValues) || filterValues.length === 0) continue;

            const excludedSet = new Set();

            for (let i = 0; i < filterValues.length; i++) {

                const filterValue = filterValues[i];

                excludedSet.add(filterValue == null ? "" : String(filterValue));
            }

            const includedValues = [];
            const distinctValues = Ren.RowObjectFilter.getDistinctValues(rows, columnIdOrHeading);

            for (let i = 0; i < distinctValues.length; i++) {

                if (!excludedSet.has(distinctValues[i])) includedValues.push(distinctValues[i]);
            }

            columnValueFilters[columnIdOrHeading] = includedValues;
        }

        const inclusionTabFilters = Object.assign({}, tabFilters, { columnValueFilters });

        delete inclusionTabFilters.negatedColumns;

        return inclusionTabFilters;
    };

    /**
     * A marker configuration whose filter states the dates the chart is annotated with rather than
     * the dates it leaves out, for saving with the report settings.
     *
     * A grid usually holds a filter by exclusion, so that a date added to the source later
     * annotates the chart by itself.  A saved report says the opposite - the dates it was saved
     * showing are the dates it is to open showing - so the filter is resolved to the values it
     * currently allows on its way into the settings file, and the chart on the page keeps the
     * filter it has.
     *
     * The configuration is returned as it stands where nothing is negated, and where the marker
     * source is not loaded to resolve the exclusions against: a filter that cannot be read is saved
     * as it was rather than as a list of nothing.
     */
    const withoutFilterNegations = (dateMarkers) => {

        if (!dateMarkers || typeof dateMarkers !== "object" || !dateMarkers.filterSet) {
            return dateMarkers;
        }

        const config = getConfig({ dateMarkers });
        const tabularData = config ? getTabularData(config) : null;

        if (!tabularData) return dateMarkers;

        const tabFilters = dateMarkers.filterSet[tabularData.Title];

        if (!tabFilters) return dateMarkers;

        const rows = getMarkerData(config, tabularData).rows;

        if (rows.length === 0) return dateMarkers;

        const inclusionTabFilters = toInclusionTabFilters(tabFilters, rows);

        if (inclusionTabFilters === tabFilters) return dateMarkers;

        const filterSet = Object.assign({}, dateMarkers.filterSet);

        filterSet[tabularData.Title] = inclusionTabFilters;

        return Object.assign({}, dateMarkers, { filterSet });
    };

    /**
     * The column holding each row's date: the one the configuration names, else the first whose
     * values parse as dates.  A column named "Date" (or ending in it) is preferred, so a source
     * carrying several dates per row marks the one it is about.
     */
    const detectDateColumn = (config, rows) => {

        if (config.dateColumn) return config.dateColumn;

        const headings = Object.keys(rows[0]);
        const dateColumns = [];

        for (let i = 0; i < headings.length; i++) {

            const heading = headings[i];

            // The column added client-side, on rows read back after it was: it holds dates with
            // their labels, not dates.
            if (heading === TICK_COLUMN_HEADING) continue;

            let anyDates = false;
            let allDates = true;

            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {

                const value = rows[rowIndex][heading];

                if (Ren.IsNullOrEmpty(value)) continue;

                if (Ren.DateUtils.parseDateTimeUniversal(value)) {
                    anyDates = true;
                }
                else {

                    allDates = false;
                    break;
                }
            }

            if (anyDates && allDates) dateColumns.push(heading);
        }

        if (dateColumns.length === 0) return null;

        for (let i = 0; i < dateColumns.length; i++) {

            if (dateColumns[i].toLowerCase().endsWith("date")) return dateColumns[i];
        }

        return dateColumns[0];
    };

    /**
     * The column whose value labels each marker: the one the configuration names, else the first
     * text column that is not the date.  Null where the source holds nothing but its dates, in
     * which case a marker is labelled with its date.
     */
    const detectLabelColumn = (config, rows, dateColumn) => {

        if (config.labelColumn) return config.labelColumn;

        const headings = Object.keys(rows[0]);

        for (let i = 0; i < headings.length; i++) {

            const heading = headings[i];

            if (heading === dateColumn || heading === TICK_COLUMN_HEADING) continue;

            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {

                const value = rows[rowIndex][heading];

                if (!Ren.IsNullOrEmpty(value)) return heading;
            }
        }

        return null;
    };

    /**
     * A date as it is written throughout a marker: day, month and year, each padded, then its time
     * of day where it has one.
     */
    const formatMarkerDate = (date) => Ren.DateValueChart_MarkerLines.formatMarkerDate(date);

    /**
     * A cell of a marker row as it is shown in the tooltip: a date is written the way the rest of
     * the marker's dates are, and anything else as it stands.  Only a value that looks like a date
     * is put to the parser, which digs a date out of more forms than are wanted here - a bare year
     * would otherwise be shown as the first of January.
     */
    const formatTooltipValue = (value) => {

        const text = String(value).trim();

        if (!/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(text)) return value;

        const date = Ren.DateUtils.parseDateTimeUniversal(text);

        return date ? formatMarkerDate(date) : value;
    };

    /**
     * What a marker's flag says when the pointer rests on it: its date and label, then every other
     * column the row holds, one per line.
     */
    const buildTooltip = (row, date, label, dateColumn, tickColumn) => {

        const lines = [formatMarkerDate(date) + (label ? " - " + label : "")];

        for (const heading in row) {

            if (heading === dateColumn) continue;

            // The tick column is this tooltip's own first line said again: it exists to be ticked
            // and filtered on, not to be read here.
            if (heading === tickColumn) continue;

            const value = row[heading];

            if (Ren.IsNullOrEmpty(value)) continue;
            if (String(value) === label) continue;

            lines.push(heading + ": " + formatTooltipValue(value));
        }

        return lines.join("\n");
    };

    /**
     * Gets the markers the chart's marker data source resolves to, in the shape the marker-line
     * renderer draws, each additionally carrying the tooltip its flag shows on hover.  Empty where
     * the chart declares no marker source, where the source has yet to arrive (it is asked for
     * here, and the chart redrawn when it does), or where the markers are turned off.
     */
    const getMarkers = (props) => {

        const config = getConfig(props.visualisation);

        if (!config || props.isAllTime) return [];

        // Followed from here rather than only from the dates grid: a chart sharing a filter group
        // with others answers a filter set in a grid opened from any of them.  Following is by
        // guid, so a chart re-rendered replaces its own entry.
        Ren.DateValueChart_DateMarkersGrid.followChart(props.visualisation, props);

        if (config.hidden) return [];

        const tabularData = getTabularData(config);

        if (!tabularData) {

            requestDataSource(config, props);
            return [];
        }

        const { dateColumn, labelColumn, tickColumn } = getMarkerData(config, tabularData);

        if (!dateColumn) {

            return [];
        }

        const rows = getRows(config, tabularData);

        if (!rows.length) return [];

        const markers = [];

        // Unlike a declared marker line, a date outside the charted range is dropped rather than
        // pinned to the edge.  Dropped here rather than in the renderer so that it does not count
        // towards the limit below.
        const outOfRange = config.outOfRange || "hide";
        const domain = outOfRange === "hide" && props.xScale ? props.xScale.getDomain() : null;

        for (let i = 0; i < rows.length; i++) {

            const row = rows[i];
            const date = Ren.DateUtils.parseDateTimeUniversal(row[dateColumn]);

            if (!date) continue;
            if (domain && (date < domain[0] || date > domain[1])) continue;

            const label = labelColumn ? String(row[labelColumn] ?? "").trim() : "";

            markers.push({
                date,
                label: label || formatMarkerDate(date),
                // Carried so that the chart's flag text function, where it declares one, can read
                // the marker's other columns.
                row,
                // The value the marker filter holds this marker's date as, for hiding it.
                dateValue: Ren.RowObjectFilter.toValueString(row[dateColumn]),
                tooltip: buildTooltip(row, date, label, dateColumn, tickColumn),
                colour: row[config.colourColumn] || config.colour || DEFAULT_COLOUR,
                lineStyle: config.lineStyle || "dashed",
                lineWidth: config.lineWidth || DEFAULT_LINE_WIDTH,
                labelPosition: config.labelPosition || "top",
                outOfRange
            });
        }

        // Warned about rather than passed over in silence: a chart drawing none of the markers its
        // source plainly holds otherwise looks like the source never arrived.
        if (markers.length > MAX_MARKERS) {

            console.warn(
                `[DateMarkers] ${config.dataSourceUri} resolves to ${markers.length} dates in the ` +
                `charted range, more than the ${MAX_MARKERS} that can be read on one chart - ` +
                "not drawing them.  Filter them down in the chart's Dates window."
            );

            return [];
        }

        return markers;
    };

    return {
        getConfig,
        getTabularData,
        requestDataSource,
        buildDateAndLabel,
        getMarkerData,
        getTabularDataTransformers,
        getRows,
        applyFilterSet,
        withoutFilterNegations,
        detectDateColumn,
        detectLabelColumn,
        getMarkers
    };
})();
