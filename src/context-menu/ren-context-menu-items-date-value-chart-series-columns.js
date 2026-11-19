/**
 * The date/value chart's context menu items for what it plots: series columns, adding and removing
 * series, axes, and splitting the data into a series per value of a column.
 */
Ren.ContextMenuItems_DateValueChart_SeriesColumns = (chart) => {

    const { tabularData, visualisation, props } = chart;

    const removedDateEntries = Ren.ContextMenuItems_DateValueChart_SeriesColumns.removedDateEntries;

    const {
        getTargetSeriesIndexes,
        getTargetSeriesIndex,
        getSeriesPropertyAt,
        setSeriesPropertyOn,
        setSeriesPropertyOnEach,
        buildSeriesOptionItems,
        getValueColumnsFromData,
        isSplitActive,
        noteActsOnSourceColumn,
        getSeriesSourceHeading,
        getBaseValueHeadings,
        regroupData,
        commitRedraw,
        rebuildVisualisation
    } = chart;

    /**
     * Adds, removes or swaps a column in the selected columns, which a split chart's series are
     * rebuilt from.
     */
    const updateSelectedColumns = (oldColumn, newColumn) => {

        visualisation.selectedColumns ??= [];

        const selectedColumns = visualisation.selectedColumns;
        const index = oldColumn == null ? -1 : selectedColumns.indexOf(oldColumn);

        if (index === -1) {

            if (newColumn != null) selectedColumns.push(newColumn);
        }
        else if (newColumn == null) {

            selectedColumns.splice(index, 1);
        }
        else {

            selectedColumns[index] = newColumn;
        }
    };

    /**
     * Keeps selectedColumns in step with a change to what an unsplit chart plots.  The columns
     * detected on a rebuild are drawn from it, so a series added only to props would come back
     * missing the next time the chart is built, such as on a filter change.  Where the chart has
     * none, its columns are detected from the data and adding one would name only that column.
     */
    const updateSelectedColumnsIfPresent = (oldColumn, newColumn) => {

        if (!visualisation.selectedColumns?.length) return;

        updateSelectedColumns(oldColumn, newColumn);
    };

    // Copies the chart's own column settings from one value column to another.
    const copyChartColumnSettings = (oldColumn, newColumn) => {

        if (!visualisation.chartDataGroupingSettings || !oldColumn || oldColumn === newColumn) {
            return;
        }

        const entry = visualisation.chartDataGroupingSettings.groupings.entries[0];

        if (!entry) return;

        entry.columns ??= {};

        const oldSettings = entry.columns[oldColumn];

        if (oldSettings) entry.columns[newColumn] = Object.assign({}, oldSettings);
    };

    // The aggregation and format a column's values are plotted with when it becomes the value
    // column, by the type of its values.
    const getDefaultValueColumnSettings = (columnFormat) => {

        const formats = Ren.SpreadsheetColumnFormatEnum;
        const aggregations = Ren.AggregationTypeEnum;

        if (columnFormat === formats.Currency) {
            return [aggregations.Sum, "currency-abbreviated-auto-dp"];
        }

        if (columnFormat === formats.Boolean || columnFormat === formats.Percentage) {
            return [aggregations.Average, "percentage-1-dp"];
        }

        if (columnFormat === formats.Integer) return [aggregations.Sum, "number-no-dp"];
        if (columnFormat === formats.Number) return [aggregations.Sum, "number-abbreviated-auto-dp"];

        return [aggregations.CountDistinct, "number-no-dp"];
    };

    const applyDefaultValueColumnSettings = (column) => {

        const entry = visualisation.chartDataGroupingSettings?.groupings?.entries?.[0];
        const columnIndex = tabularData?.columnResolver?.getColumnIndex(column);

        if (!entry || columnIndex == null) return;

        const settings = getDefaultValueColumnSettings(
            tabularData.ColumnModels[columnIndex]?.ColumnFormat
        );

        entry.columns ??= {};
        entry.columns[column] = Object.assign({}, entry.columns[column], {
            aggregationType: settings[0],
            valueFormatFunction: [{ name: settings[1] }]
        });
    };

    /**
     * Renames a split chart's series of one value column, in includedSeries and the series
     * settings, for the column switched to.  Its series keep their split values, so those removed
     * stay removed and each keeps its settings.
     */
    const renameSplitSeries = (oldColumn, newColumn) => {

        const rename = heading => Ren.DateValueChart_SeriesSplit.renameSeriesHeading(
            props,
            heading,
            oldColumn,
            newColumn
        );

        if (Array.isArray(visualisation.includedSeries)) {
            visualisation.includedSeries = visualisation.includedSeries.map(rename);
        }

        const seriesSettings = visualisation.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            if (seriesSettings[i]?.column != null) {
                seriesSettings[i].column = rename(seriesSettings[i].column);
            }
        }
    };

    const setValueColumn = (newColumn) => {

        const seriesIndex = getTargetSeriesIndex();
        if (!seriesIndex) return;
        const arrayIndex = seriesIndex - 1;

        // A split series is one value of a column, so switching its column switches it for every
        // series of that split.
        if (isSplitActive()) {

            const oldBaseColumn = getSeriesSourceHeading(arrayIndex);

            if (oldBaseColumn === newColumn) return;

            copyChartColumnSettings(oldBaseColumn, newColumn);
            updateSelectedColumns(oldBaseColumn, newColumn);
            renameSplitSeries(oldBaseColumn, newColumn);

            rebuildVisualisation();
            return;
        }

        const oldColumn = props.valueHeadings?.[arrayIndex];

        if (props.valueHeadings && props.valueHeadings[arrayIndex] !== undefined) {
            props.valueHeadings[arrayIndex] = newColumn;
        }

        if (props.seriesSourceHeadings && props.seriesSourceHeadings[arrayIndex] !== undefined) {
            props.seriesSourceHeadings[arrayIndex] = newColumn;
        }

        copyChartColumnSettings(oldColumn, newColumn);
        updateSelectedColumnsIfPresent(oldColumn, newColumn);
        Ren.DateValueChart_SeriesRemoval.renameIncludedSeries(visualisation, oldColumn, newColumn);

        regroupData();
        commitRedraw();
    };

    // Points the series of one value column at another in the saved settings, seeding those from
    // the series drawn where the chart has none saved, so that the rebuild keeps the new column.
    const renameSeriesColumn = (oldColumn, newColumn) => {

        if (!visualisation.series?.length && props.series?.length) {
            visualisation.series = props.series.map(series => Object.assign({}, series));
        }

        const seriesSettings = visualisation.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            if (seriesSettings[i]?.column === oldColumn) seriesSettings[i].column = newColumn;
        }
    };

    /**
     * Switches every series of a value column to another column and builds the chart again, which
     * redraws a multi-chart's charts alike.  The series keep their settings, but the column is
     * aggregated and formatted by the type of its values.
     */
    const switchValueColumn = (oldColumn, newColumn) => {

        if (!oldColumn || oldColumn === newColumn) return;

        applyDefaultValueColumnSettings(newColumn);

        if (isSplitActive()) {

            updateSelectedColumns(oldColumn, newColumn);
            renameSplitSeries(oldColumn, newColumn);
        }
        else {

            updateSelectedColumnsIfPresent(oldColumn, newColumn);
            renameSeriesColumn(oldColumn, newColumn);
            Ren.DateValueChart_SeriesRemoval.renameIncludedSeries(
                visualisation,
                oldColumn,
                newColumn
            );
        }

        rebuildVisualisation();
    };

    // Detecting the value columns scans the chart's data, so their submenus are built by getters
    // when the menu opens.  A submenu with no items hides the item that opens it.
    const buildValueColumnSubmenu = () => {

        const valueColumns = getValueColumnsFromData();

        if (valueColumns.length <= 1) return [];

        return valueColumns.map(column => ({
            text: column,
            action: () => setValueColumn(column),
            ticked: () => {

                const seriesIndex = getTargetSeriesIndex();
                if (!seriesIndex || !props.valueHeadings) return false;
                noteActsOnSourceColumn();
                return getSeriesSourceHeading(seriesIndex - 1) === column;
            }
        }));
    };

    /**
     * Gets a value indicating whether the series the menu items act on are all made from the one
     * column, as a split column's series are.  Series of different columns would all be switched
     * to the same column, and so become copies of one another.
     */
    const isTargetSeriesColumnShared = () => {

        const seriesIndexes = getTargetSeriesIndexes();

        if (seriesIndexes.length === 0) return false;

        const heading = getSeriesSourceHeading(seriesIndexes[0] - 1);

        for (let i = 1; i < seriesIndexes.length; i++) {

            if (getSeriesSourceHeading(seriesIndexes[i] - 1) !== heading) return false;
        }

        return true;
    };

    const dataColumnMenuItem = {
        section: "Series",
        text: "Column",
        id: "data-column",
        visible: () => isTargetSeriesColumnShared(),
        get submenu() {

            return buildValueColumnSubmenu();
        }
    };

    // Takes an unsplit chart's series of a column out of props and the visualisation, leaving the
    // chart to be regrouped and redrawn.
    const spliceSeries = (column) => {

        const index = props.valueHeadings.indexOf(column);

        if (index === -1) return;

        props.valueHeadings.splice(index, 1);

        if (props.seriesSourceHeadings) props.seriesSourceHeadings.splice(index, 1);
        if (props.series) props.series.splice(index, 1);
        if (visualisation.series) visualisation.series.splice(index, 1);
        if (props.valueColumnFormats) props.valueColumnFormats.splice(index, 1);
        if (props.valueColumnFormatFunctions) props.valueColumnFormatFunctions.splice(index, 1);

        updateSelectedColumnsIfPresent(column, null);
    };

    /**
     * Gets the headings of the removed series aggregated from a column, which are all its series
     * where it is in the chart without being drawn.
     */
    const getRemovedSeriesHeadingsOf = (column) => {

        const allHeadings = props.allValueHeadings || [];
        const allSourceHeadings = props.allSeriesSourceHeadings || [];
        const headings = [];

        for (let i = 0; i < allHeadings.length; i++) {

            if (allSourceHeadings[i] === column
                && props.valueHeadings.indexOf(allHeadings[i]) === -1) {

                headings.push(allHeadings[i]);
            }
        }

        return headings;
    };

    const addOrRemoveSeries = (column) => {

        // A column whose series have all been removed is added by reinstating them.
        const removedHeadings = getBaseValueHeadings().indexOf(column) === -1
            ? getRemovedSeriesHeadingsOf(column)
            : [];

        if (removedHeadings.length > 0) {

            Ren.DateValueChart_SeriesRemoval.reinstateSeries(props, removedHeadings);
            return;
        }

        // Where the data is split, a value column is one series per split value.
        if (isSplitActive()) {

            const baseHeadings = getBaseValueHeadings();
            const isPlotted = baseHeadings.indexOf(column) !== -1;

            if (isPlotted && baseHeadings.length <= 1) return;

            if (isPlotted) {
                updateSelectedColumns(column, null);
            }
            else {

                updateSelectedColumns(null, column);

                // The series the column is split into can't be named until they are built, so
                // they would all be left out.
                visualisation.includedSeries = null;
            }

            rebuildVisualisation();
            return;
        }

        const isPresent = props.valueHeadings && props.valueHeadings.includes(column);

        if (isPresent) {

            if (props.valueHeadings.length <= 1) return;

            spliceSeries(column);
        }
        else {

            if (!props.valueHeadings) return;

            props.valueHeadings.push(column);

            if (props.seriesSourceHeadings) props.seriesSourceHeadings.push(column);

            const newIndex = props.valueHeadings.length - 1;
            const newSeries = {
                column: column,
                valueAxis: "leftAxis",
                colour: Ren.DateValueChart_SeriesColours.getDefaultColour(
                    newIndex,
                    visualisation.colourScheme
                ),
                chartType: Ren.SeriesChartTypeEnum.Bar,
                showValueLabels: true,
                label: null,
                colourFilter: null,
                lineShape: "straight",
                lineStyle: "solid",
                lineWidth: "normal",
                dotSize: "medium",
                isEnabled: true,
                estimateLastPeriod:
                    Ren.DateValueChart_LastPeriodEstimate.getInheritedMode(props.series)
            };

            if (!props.series) props.series = [];
            props.series.splice(newIndex, 0, newSeries);

            // Ahead of the settings of any removed series, which follow those drawn.
            if (!visualisation.series) visualisation.series = [];
            visualisation.series.splice(newIndex, 0, Object.assign({}, newSeries));

            if (Array.isArray(visualisation.includedSeries)) {
                visualisation.includedSeries.push(column);
            }

            if (!props.valueColumnFormats) props.valueColumnFormats = [];
            props.valueColumnFormats.push(undefined);

            if (!props.valueColumnFormatFunctions) props.valueColumnFormatFunctions = [];
            props.valueColumnFormatFunctions.push(undefined);

            updateSelectedColumnsIfPresent(null, column);
        }

        props.seriesCount = props.valueHeadings.length;

        regroupData();
        commitRedraw();
    };

    const addDataSeriesMenuItem = {
        section: "Chart data",
        text: "Add data series",
        id: "add-data-series",
        get submenu() {

            return getValueColumnsFromData().map(column => ({
                text: column,
                action: () => addOrRemoveSeries(column),
                ticked: () => getBaseValueHeadings().indexOf(column) !== -1
            }));
        }
    };

    const assignAxisMenuItem = {
        section: "Series",
        text: "Assign axis",
        id: "assign-axis",
        visible: () => !!getTargetSeriesIndex() && props.seriesCount > 1,
        submenu: buildSeriesOptionItems("valueAxis", "leftAxis", [
            { text: "Left axis", value: "leftAxis" },
            { text: "Right axis", value: "rightAxis" },
            { text: "Hidden axis", value: "hiddenAxis" }
        ])
    };

    // A single series is named, as the item may act on the first series rather than one pointed
    // at.
    const getTargetSeriesText = (verb) => {

        const seriesIndexes = getTargetSeriesIndexes();

        if (seriesIndexes.length > 1) return verb + " " + seriesIndexes.length + " series";

        const seriesIndex = seriesIndexes[0];
        const label = props.series?.[seriesIndex - 1]?.label
            || props.valueHeadings?.[seriesIndex - 1];

        return label ? verb + " series \"" + label + "\"" : verb + " series";
    };

    /**
     * Gets a value indicating whether any of the series the menu items act on is shown, in which
     * case the item hides them all, or else shows them all.
     */
    const isAnyTargetSeriesEnabled = () => getTargetSeriesIndexes().some(
        seriesIndex => getSeriesPropertyAt(seriesIndex, "isEnabled", true) !== false
    );

    // A hidden series keeps its legend entry, which can be right-clicked to show it again.
    const showHideSeriesMenuItem = {
        section: "Series",
        text: () => getTargetSeriesText(isAnyTargetSeriesEnabled() ? "Hide" : "Show"),
        id: "show-hide-series",
        visible: () => getTargetSeriesIndexes().length > 0,
        action: () => {

            // The axes are re-fitted to the series still shown, so the extents must not be
            // skipped.
            props.skipExtentRecalculation = false;

            setSeriesPropertyOn(getTargetSeriesIndexes(), "isEnabled", !isAnyTargetSeriesEnabled());
        }
    };

    const isSeriesEnabled = seriesIndex =>
        getSeriesPropertyAt(seriesIndex, "isEnabled", true) !== false;

    // Shows or hides every series, as the given function decides for each.
    const setEachSeriesEnabled = (isEnabled) => {

        // The axes are re-fitted to the series shown, so the extents must not be skipped.
        props.skipExtentRecalculation = false;

        setSeriesPropertyOnEach("isEnabled", true, isEnabled);
    };

    /**
     * Gets a value indicating whether hiding the other series would change anything: whether any
     * series other than those kept is shown, or any of those is hidden.
     */
    const isOtherSeriesShown = () => {

        const seriesIndexes = getTargetSeriesIndexes();

        for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {

            if (isSeriesEnabled(seriesIndex) !== (seriesIndexes.indexOf(seriesIndex) !== -1)) {
                return true;
            }
        }

        return false;
    };

    // The series kept are shown too, so that what is left is exactly them.
    const hideOtherSeriesMenuItem = {
        section: "Series",
        text: "Hide all other data series",
        id: "hide-other-series",
        visible: () => getTargetSeriesIndexes().length > 0 && isOtherSeriesShown(),
        action: () => {

            const seriesIndexes = getTargetSeriesIndexes();

            setEachSeriesEnabled(seriesIndex => seriesIndexes.indexOf(seriesIndex) !== -1);
        }
    };

    const isAnySeriesHidden = () => {

        for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {
            if (!isSeriesEnabled(seriesIndex)) return true;
        }

        return false;
    };

    // With the chart's data, as it acts on every series rather than the one clicked.
    const showAllSeriesMenuItem = {
        section: "Chart data",
        text: "Show all data series",
        id: "show-all-series",
        visible: () => isAnySeriesHidden(),
        action: () => setEachSeriesEnabled(() => true)
    };

    const OtherSeries = Ren.DateValueChart_OtherSeries;

    // Offered only while an "Other" series is drawn, which is shown until hidden here or as any
    // other series is.
    const showOtherSeriesMenuItem = {
        section: "Chart data",
        text: "Show \"" + OtherSeries.LABEL + "\" series",
        id: "show-other-series",
        visible: () => (props.otherSeries?.length ?? 0) > 0,
        ticked: () => OtherSeries.isShown(props),
        action: () => {

            OtherSeries.setShown(props, !OtherSeries.isShown(props));
            commitRedraw();
        }
    };

    // Gets how many of the series drawn are not "Other" series, which are never removed.
    const getRemovableSeriesCount = () => props.seriesCount - (props.otherSeries?.length ?? 0);

    const SeriesRemoval = Ren.DateValueChart_SeriesRemoval;

    // An "Other" series can be removed alongside the rest, but is never all that is left.
    const getTargetRemovableSeriesCount = () => getTargetSeriesIndexes().filter(
        seriesIndex => !OtherSeries.isOtherSeries(props, seriesIndex)
    ).length;

    // A removed series leaves no legend entry to right-click, so is reinstated from here or from
    // the chart's own menu.  At least one series is kept.
    const removeSeriesMenuItem = {
        section: "Series",
        text: () => getTargetSeriesText("Remove"),
        id: "remove-series",
        visible: () => getTargetSeriesIndexes().length > 0
            && getRemovableSeriesCount() > getTargetRemovableSeriesCount(),
        action: () => SeriesRemoval.removeSeries(props, getTargetSeriesIndexes())
    };

    const removeOtherSeriesMenuItem = {
        section: "Series",
        text: "Remove all other data series",
        id: "remove-other-series",
        visible: () => {

            const seriesCount = getTargetSeriesIndexes().length;

            return seriesCount > 0 && getRemovableSeriesCount() > seriesCount;
        },
        action: () => SeriesRemoval.removeOtherSeries(
            props,
            getTargetSeriesIndexes()
        )
    };

    const reinstateRemovedSeriesMenuItem = {
        section: "Chart data",
        text: "Reinstate all removed data series",
        id: "reinstate-removed-series",
        visible: () => SeriesRemoval.getRemovedHeadings(props).length > 0
            || (props.removedOtherSeries?.length ?? 0) > 0,
        action: () => SeriesRemoval.reinstateSeries(props, null)
    };

    // Offered only while a removed "Other" series has removed series to gather.
    const reinstateOtherSeriesMenuItem = {
        section: "Chart data",
        text: "Reinstate \"" + OtherSeries.LABEL + "\" series",
        id: "reinstate-other-series",
        visible: () => (props.removedOtherSeries?.length ?? 0) > 0,
        action: () => SeriesRemoval.reinstateOtherSeries(props)
    };

    /**
     * Splits the chart's data by a column, or stops splitting it when passed null.  The existing
     * series are dropped rather than left to be matched against series they no longer describe.
     */
    const setSplitColumn = (columnIndex) => {

        if (!visualisation.chartDataGroupingSettings) return;

        Ren.DateValueChart_SeriesSplit.setSplitColumn(
            visualisation.chartDataGroupingSettings,
            columnIndex,
            tabularData?.columnResolver
        );

        // The series the split builds are new ones, so they take up the estimate setting the
        // series being dropped carry.  The rebuild has no other sight of them once they are gone.
        props.inheritedEstimateLastPeriod =
            Ren.DateValueChart_LastPeriodEstimate.getInheritedMode(props.series);

        // Likewise how they are drawn, so that lines stay lines rather than going back to bars.
        // Each new series takes up how the series of its own value column were drawn, and
        // failing that how most of them were.
        props.inheritedSeriesSettings =
            Ren.DateValueChart_SeriesSplit.getSharedSeriesSettings(props.series);

        props.inheritedSeriesSettingsBySource =
            Ren.DateValueChart_SeriesSplit.getSharedSeriesSettingsBySource(
                props.series,
                props.seriesSourceHeadings
            );

        visualisation.series = [];
        visualisation.includedSeries = null;

        // A limit chosen for the old split's series says nothing of the new one's, which may
        // make far more of them.
        visualisation.legendSeriesLimitChosen = undefined;

        rebuildVisualisation();
    };

    const getCurrentSplitColumnIndex = () =>
        Ren.DateValueChart_SeriesSplit.getSplitColumnIndex(
            visualisation.chartDataGroupingSettings,
            tabularData?.columnResolver
        );

    const COLUMN_TYPE_GROUP_COUNT = 2;

    // Gets a value indicating whether a column's values can split or subdivide the data: dates and
    // quantities such as revenue can't, having too many values to tell apart, though true/false
    // values, enums and IDs can.
    const isCategoryColumn = (columnFormat) => {

        const formats = Ren.SpreadsheetColumnFormatEnum;

        if (formats.IsDate(columnFormat)) return false;

        return columnFormat === formats.Boolean || !formats.IsArithmetic(columnFormat);
    };

    // Gets the group a column is listed in by the type of its values: text, then true/false
    // values.
    const getColumnTypeGroup = (columnFormat) =>
        columnFormat === Ren.SpreadsheetColumnFormatEnum.Boolean ? 1 : 0;

    const createColumnTypeGroups = () => {

        const groups = [];

        for (let index = 0; index < COLUMN_TYPE_GROUP_COUNT; index++) {
            groups.push([]);
        }

        return groups;
    };

    // Appends the items of each group of columns that has any, with a separator between groups.
    const appendColumnTypeGroups = (items, groups) => {

        let isFirstGroup = true;

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {

            const group = groups[groupIndex];

            if (group.length === 0) continue;

            if (!isFirstGroup) items.push(Ren.MENU_SEPARATOR);

            for (let index = 0; index < group.length; index++) {
                items.push(group[index]);
            }

            isFirstGroup = false;
        }
    };

    /**
     * Every category column other than the date column and the value columns can split the data,
     * listed by the type of their values.  Each is named by its heading, or by its column ID or
     * heading where useColumnIdOrHeading is set.
     */
    const buildSplitDataMenuItems = (useColumnIdOrHeading) => {

        const items = [
            {
                text: "None",
                id: "split-data-none",
                action: () => setSplitColumn(null),
                ticked: () => getCurrentSplitColumnIndex() == null
            },
            Ren.MENU_SEPARATOR
        ];

        const columnResolver = tabularData?.columnResolver;
        const baseValueHeadings = getBaseValueHeadings();
        const groups = createColumnTypeGroups();

        for (let i = 0; i < tabularData.ColumnModels.length; i++) {

            const column = tabularData.ColumnModels[i];

            if (Ren.DateValueChart_InputColumns.isInternalColumn(column)) continue;

            const columnKey = column.ColumnIdOrHeading;

            if (columnKey === props.dateHeading || columnKey === props.subdivideColumn) continue;
            if (baseValueHeadings.indexOf(columnKey) !== -1) continue;
            if (!isCategoryColumn(column.ColumnFormat)) continue;

            const columnIndex = columnResolver
                ? columnResolver.getColumnIndex(columnKey)
                : i;

            groups[getColumnTypeGroup(column.ColumnFormat)].push({
                text: () => useColumnIdOrHeading ? columnKey : column.Heading,
                action: () => setSplitColumn(columnIndex),
                ticked: () => getCurrentSplitColumnIndex() === columnIndex
            });
        }

        appendColumnTypeGroups(items, groups);

        return items;
    };

    // Getter so the columns already plotted are left out of the submenu as they change.
    const splitDataMenuItem = {
        section: "Chart data",
        text: "Split data",
        id: "split-data",
        visible: () => !!visualisation.chartDataGroupingSettings,
        get submenu() {

            return buildSplitDataMenuItems(false);
        }
    };

    /**
     * Gets the column ID or heading of the column splitting the chart's data, or null where it is
     * not split.
     */
    const getSplitColumnIdOrHeading = () => {

        const columnIndex = getCurrentSplitColumnIndex();

        if (columnIndex == null) return null;

        return tabularData?.columnResolver?.getColumnIdOrHeading(columnIndex)
            ?? tabularData?.ColumnModels?.[columnIndex]?.ColumnIdOrHeading
            ?? null;
    };

    // Matches "ID", "Customer ID", "customer_id", "CustomerId", "OrderGUID" and the like, but not
    // words merely ending in "id", such as "Paid".
    const ID_HEADING_PATTERN = new RegExp(
        "(?:^|[^A-Za-z])(?:id|Id|ID|guid|Guid|GUID)(?:$|[^A-Za-z])"
            + "|[a-z0-9](?:Id|ID|Guid|GUID)(?:$|[^a-z])"
    );

    const isCountableTextColumn = (columnKey) => ID_HEADING_PATTERN.test(columnKey ?? "");

    /**
     * Gets the columns the value column can be switched to.  Where the chart groups its data, any
     * column other than its date and split columns can be, as one of IDs is counted, though a text
     * column is offered only where its name says it holds IDs or GUIDs.  Otherwise only its numeric
     * columns can be.
     */
    const getValueColumnOptions = () => {

        const columnResolver = tabularData?.columnResolver;

        if (!visualisation.chartDataGroupingSettings || !columnResolver) {
            return getValueColumnsFromData();
        }

        const splitColumn = getSplitColumnIdOrHeading();
        const columns = [];

        for (let i = 0; i < tabularData.ColumnModels.length; i++) {

            const column = tabularData.ColumnModels[i];
            const columnKey = column.ColumnIdOrHeading;

            if (Ren.DateValueChart_InputColumns.isInternalColumn(column)) continue;
            if (Ren.SpreadsheetColumnFormatEnum.IsDate(column.ColumnFormat)) continue;
            if (columnKey === props.dateHeading || columnKey === splitColumn) continue;
            if (columnKey === props.subdivideColumn) continue;

            if (!Ren.SpreadsheetColumnFormatEnum.IsNumeric(column.ColumnFormat)
                && !isCountableTextColumn(columnKey)) {

                continue;
            }

            columns.push(columnKey);
        }

        return columns;
    };

    const setSubdivideColumn = (column) => {

        visualisation.subdivideColumn = column ?? undefined;
        props.subdivideColumn = column;

        rebuildVisualisation();
    };

    // Every category column other than the date, split and value columns can subdivide the bars or
    // slices, listed by the type of their values.
    const buildSubdivideColumnMenuItems = () => {

        const items = [
            {
                text: "None",
                id: "subdivide-column-none",
                action: () => setSubdivideColumn(null),
                ticked: () => !props.subdivideColumn
            },
            Ren.MENU_SEPARATOR
        ];

        const splitColumn = getSplitColumnIdOrHeading();
        const baseValueHeadings = getBaseValueHeadings();
        const groups = createColumnTypeGroups();

        for (let i = 0; i < tabularData.ColumnModels.length; i++) {

            const column = tabularData.ColumnModels[i];
            const columnKey = column.ColumnIdOrHeading;

            if (Ren.DateValueChart_InputColumns.isInternalColumn(column)) continue;
            if (columnKey === props.dateHeading || columnKey === splitColumn) continue;
            if (baseValueHeadings.indexOf(columnKey) !== -1) continue;
            if (!isCategoryColumn(column.ColumnFormat)) continue;

            groups[getColumnTypeGroup(column.ColumnFormat)].push({
                text: columnKey,
                action: () => setSubdivideColumn(columnKey),
                ticked: () => props.subdivideColumn === columnKey
            });
        }

        appendColumnTypeGroups(items, groups);

        if (props.subdivideColumn) {
            items.push(
                Ren.MENU_SEPARATOR,
                chart.subdivisionLimitMenuItem,
                chart.subdivisionLabelsMenuItem
            );
        }

        return items;
    };

    // Offered where the chart has bars or slices to subdivide.
    const hasSubdivideColumn = () => {

        if (!visualisation.chartDataGroupingSettings) return false;
        if (Ren.DateValueChart_Pies.hasPies(props)) return true;

        const series = props.series || [];

        for (let i = 0; i < series.length; i++) {

            const chartType = series[i].chartType ?? Ren.SeriesChartTypeEnum.Bar;

            if (series[i].isEnabled !== false && chartType === Ren.SeriesChartTypeEnum.Bar) {
                return true;
            }
        }

        return false;
    };

    // As the Subdivide by picker offers it, and so in the settings window too.  Getter so the
    // columns already used are left out of the submenu as they change.
    const subdivideDataMenuItem = {
        section: "Chart data",
        text: "Subdivide by",
        id: "subdivide-by",
        // So that the settings window keeps the column picked where it is, with the subdivision
        // labels beneath it while there are subdivisions.
        isChoiceLed: true,
        title: "The column the bars or slices are subdivided by",
        visible: hasSubdivideColumn,
        get submenu() {

            return buildSubdivideColumnMenuItems();
        }
    };

    /**
     * The chart's value column, split column and subdivide column, as the pickers at its top right
     * show and change them.  The value column is offered only where the chart plots one, and there
     * is another column to switch it to.
     */
    const columnPickers = {
        getValueColumn: () => {

            const baseHeadings = getBaseValueHeadings();

            if (baseHeadings.length !== 1 || getValueColumnOptions().length < 2) return null;

            return baseHeadings[0];
        },
        buildValueColumnMenuItems: () => getValueColumnOptions().map(column => ({
            text: column,
            action: () => switchValueColumn(getBaseValueHeadings()[0], column),
            ticked: () => column === getBaseValueHeadings()[0]
        })),
        hasSplitColumn: () => !!visualisation.chartDataGroupingSettings,
        getSplitColumn: getSplitColumnIdOrHeading,
        buildSplitColumnMenuItems: () => buildSplitDataMenuItems(true),
        hasSubdivideColumn,
        getSubdivideColumn: () => props.subdivideColumn,
        buildSubdivideColumnMenuItems
    };

    /**
     * Groups the chart by a column's dates, or by none when passed null, drawing it as an all-time
     * chart.  A chart gaining a date column is grouped as it was before it lost one, if it did and
     * the column is of days alike, or else by day, or by quarter for quarters.
     */
    const setDateColumn = (columnIndex, isQuarter) => {

        if (!visualisation.chartDataGroupingSettings) return;

        // A column of quarters offers no finer grouping, so only one of the same kind takes it on.
        const removed = removedDateEntries.get(visualisation);
        const currentColumnIndex = getCurrentDateColumnIndex();

        const removedEntry = Ren.DateValueChart_GroupingEntries.setDateColumn(
            visualisation.chartDataGroupingSettings,
            columnIndex,
            tabularData?.columnResolver,
            isQuarter ? "date-quarter-start" : "date-day-start",
            removed && removed.isQuarter === !!isQuarter ? removed.entry : null
        );

        if (removedEntry) {

            const isRemovedQuarter = Ren.DateValueChart_InputColumns.getDateColumns(tabularData)
                .some(column => column.columnIndex === currentColumnIndex && column.isQuarter);

            removedDateEntries.set(visualisation, { entry: removedEntry, isQuarter: isRemovedQuarter });
        }
        else if (columnIndex != null) {

            removedDateEntries.delete(visualisation);
        }

        rebuildVisualisation();
    };

    const getCurrentDateColumnIndex = () => props.hasDateColumn === false
        ? null
        : tabularData?.columnResolver?.getColumnIndex(props.dateHeading) ?? null;

    // Every column of dates other than the split column and the value columns.
    const buildDateColumnMenuItems = () => {

        const items = [
            {
                text: "None",
                id: "date-column-none",
                action: () => setDateColumn(null, false),
                ticked: () => getCurrentDateColumnIndex() == null
            },
            Ren.MENU_SEPARATOR
        ];

        const dateColumns = Ren.DateValueChart_InputColumns.getDateColumns(tabularData);
        const baseValueHeadings = getBaseValueHeadings();
        const splitColumnIndex = getCurrentSplitColumnIndex();

        for (let i = 0; i < dateColumns.length; i++) {

            const columnIndex = dateColumns[i].columnIndex;
            const isQuarter = dateColumns[i].isQuarter;
            const column = tabularData.ColumnModels[columnIndex];

            if (Ren.DateValueChart_InputColumns.isInternalColumn(column)) continue;
            if (columnIndex === splitColumnIndex) continue;
            if (column.ColumnIdOrHeading === props.subdivideColumn) continue;
            if (baseValueHeadings.indexOf(column.ColumnIdOrHeading) !== -1) continue;

            items.push({
                text: () => column.Heading,
                action: () => setDateColumn(columnIndex, isQuarter),
                ticked: () => getCurrentDateColumnIndex() === columnIndex
            });
        }

        return items;
    };

    const dateColumnMenuItem = {
        section: "Dates",
        text: "Date column",
        id: "date-column",
        visible: () => !!visualisation.chartDataGroupingSettings && !!tabularData?.columnResolver,
        get submenu() {

            return buildDateColumnMenuItems();
        }
    };

    return {
        dateColumnMenuItem,
        dataColumnMenuItem,
        addDataSeriesMenuItem,
        assignAxisMenuItem,
        showHideSeriesMenuItem,
        hideOtherSeriesMenuItem,
        showAllSeriesMenuItem,
        showOtherSeriesMenuItem,
        removeSeriesMenuItem,
        removeOtherSeriesMenuItem,
        reinstateOtherSeriesMenuItem,
        reinstateRemovedSeriesMenuItem,
        splitDataMenuItem,
        subdivideDataMenuItem,
        columnPickers
    };
};

// The date entry each chart last had before its date column was taken away, kept outside the menu
// items as those are built afresh on every draw.  Not saved, so lasts while the page is open.
Ren.ContextMenuItems_DateValueChart_SeriesColumns.removedDateEntries = new WeakMap();
