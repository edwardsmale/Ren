/**
 * Functions to add date value chart menu items to the context menu.
 */
Ren.ContextMenuItems_DateValueChart = (tabularData, contextMenu, visualisation, props) => {

    const InputColumns = Ren.DateValueChart_InputColumns;

    const windowsMenuItems = Ren.ContextMenuItems_Windows(visualisation, tabularData.tabularDataGuid);

    const addShowWindowsMenuItems = (element) => {

        /**
         * Gets the index of the right-clicked series, or NULL if it was outside any series.
         */
        const getClickedSeriesIndex = () => {

            // Everything a series draws sits inside that series' group, which carries the series
            // number, so the nearest ancestor holding one names the series clicked.  They are read
            // as they were on opening, as a redraw under the open menu replaces them.

            const ancestors = Ren.ContextMenuRegistry.getRightClickAncestors();
            let seriesAttribute = null;

            for (let i = 0; i < ancestors.length; i++) {

                if (ancestors[i] === element) {

                    const seriesIndex = parseInt(seriesAttribute);

                    return isNaN(seriesIndex) ? null : seriesIndex;
                }

                seriesAttribute ??= ancestors[i].getAttribute("data-series");
            }

            return null;
        };

        /**
         * Gets the indexes of the series the menu items should act on, in series order.  A
         * right-click on no series acts on every series.
         * Otherwise these are the series selected in the legend, unless the right-clicked series
         * is outside the selection, which is then acted on alone, as it is with nothing selected.
         */
        const getTargetSeriesIndexes = () => {

            // Marks the items that act on series, which the chart's settings window offers on
            // its series tabs rather than its Chart tab.
            Ren.MenuItemProbe.noteDependency("series");

            const clickedSeriesIndex = getClickedSeriesIndex();

            if (!clickedSeriesIndex) {

                const allSeriesIndexes = [];

                for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {
                    allSeriesIndexes.push(seriesIndex);
                }

                return allSeriesIndexes;
            }

            const selectedSeriesIndexes = Ren.DateValueChart_Legend.getSelectedSeriesIndexes(props);

            if (selectedSeriesIndexes.indexOf(clickedSeriesIndex) !== -1) {
                return selectedSeriesIndexes.slice().sort((a, b) => a - b);
            }

            return [clickedSeriesIndex];
        };

        /**
         * Gets the index of the first series the menu items act on, or NULL if the chart has no
         * series.
         */
        const getTargetSeriesIndex = () => getTargetSeriesIndexes()[0] ?? null;

        /**
         * Gets a value indicating whether the menu was opened on a series, rather than on the
         * chart around them.
         */
        const isSeriesClicked = () => getClickedSeriesIndex() !== null;

        // Heads the items in a submenu that act on the series clicked, naming them, and the items
        // after them that act on the whole chart.  Away from every series both act on the whole
        // chart, so neither heading is shown.
        const targetSeriesHeadingMenuItem = {

            get heading() {

                const seriesIndexes = getTargetSeriesIndexes();

                if (seriesIndexes.length > 1) return seriesIndexes.length + " series";

                const arrayIndex = seriesIndexes[0] - 1;
                const label = props.series?.[arrayIndex]?.label
                    || props.valueHeadings?.[arrayIndex];

                return label ? "Series \"" + label + "\"" : "Series";
            },
            visible: isSeriesClicked
        };

        const chartHeadingMenuItem = {
            heading: "Whole chart",
            visible: isSeriesClicked
        };

        /**
         * Gets where a series' settings are saved.  A multi-chart's are in the order of whichever
         * chart was drawn last, so they are found by column.
         */
        const getSavedSeriesArrayIndex = (seriesProps, arrayIndex) => {

            if (!Ren.DateValueChart_MultiChart.getSharedLegendProps(seriesProps)) return arrayIndex;

            const heading = seriesProps.valueHeadings?.[arrayIndex];
            const savedSeries = visualisation.series;

            for (let i = 0; i < savedSeries.length; i++) {

                if (savedSeries[i]?.column === heading) return i;
            }

            return savedSeries[arrayIndex]?.column ? savedSeries.length : arrayIndex;
        };

        /**
         * Sets a property on a series as the other charts of a multi-chart and their legend hold
         * it, so that what is read from them agrees until they are next drawn.
         */
        const writeSharedSeriesProperty = (seriesProps, seriesIndex, propertyName, value) => {

            const MultiChart = Ren.DateValueChart_MultiChart;
            const legendProps = MultiChart.getSharedLegendProps(seriesProps);

            if (!legendProps) return;

            const charts = legendProps.sharedLegendCharts;

            for (let i = 0; i <= charts.length; i++) {

                const chart = i < charts.length ? charts[i] : legendProps;
                const seriesNum = MultiChart.getChartSeriesNum(seriesProps, chart, seriesIndex);
                const series = seriesNum ? chart.series?.[seriesNum - 1] : null;

                if (series) series[propertyName] = value;
            }
        };

        /**
         * Sets a property on the series the given props number seriesIndex, creating the series if
         * it does not exist.  The change is left to the caller to commit.
         */
        const writeSeriesPropertyOn = (seriesProps, seriesIndex, propertyName, value) => {

            const arrayIndex = seriesIndex - 1;

            if (seriesProps.series && seriesProps.series[arrayIndex]) {
                seriesProps.series[arrayIndex][propertyName] = value;
            }

            writeSharedSeriesProperty(seriesProps, seriesIndex, propertyName, value);

            visualisation.series ??= [];

            const savedArrayIndex = getSavedSeriesArrayIndex(seriesProps, arrayIndex);

            visualisation.series[savedArrayIndex] ??= Object.assign(
                {
                    column: seriesProps.valueHeadings?.[arrayIndex]
                },
                seriesProps.series?.[arrayIndex]
            );

            visualisation.series[savedArrayIndex][propertyName] = value;
        };

        /**
         * Sets a property on the series at the given index, creating the series if it does not
         * exist.  The change is left to the caller to commit.
         */
        const writeSeriesPropertyAt = (seriesIndex, propertyName, value) =>
            writeSeriesPropertyOn(props, seriesIndex, propertyName, value);

        /**
         * Gets a value indicating whether the chart is split and the property is one that every
         * series split from a value column shares.
         */
        const isSharedSeriesProperty = (propertyName) => isSplitActive()
            && Ren.DateValueChart_SeriesSplit.SHARED_SERIES_PROPERTIES
                .indexOf(propertyName) !== -1;

        /**
         * Gets the given series' indexes, in series order, together with those of every series
         * split from the same value column where the property is one they share.
         */
        const getSharingSeriesIndexes = (seriesIndexes, propertyName) => {

            if (!isSharedSeriesProperty(propertyName)) return seriesIndexes;

            const sourceHeadings = [];

            for (let i = 0; i < seriesIndexes.length; i++) {
                sourceHeadings.push(getSeriesSourceHeading(seriesIndexes[i] - 1));
            }

            const sharingIndexes = [];

            for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {

                if (sourceHeadings.indexOf(getSeriesSourceHeading(seriesIndex - 1)) !== -1) {
                    sharingIndexes.push(seriesIndex);
                }
            }

            return sharingIndexes;
        };

        /**
         * Sets a shared property on the saved settings of the undrawn series split from the same
         * value columns as the given series, being those removed from the chart or whose split
         * values the data no longer holds, so that they match when drawn again.
         */
        const writeUndrawnSharingSeriesProperty = (seriesIndexes, propertyName, value) => {

            if (!isSharedSeriesProperty(propertyName)) return;

            const savedSeries = visualisation.series || [];
            const sourceHeadings = [];

            for (let i = 0; i < seriesIndexes.length; i++) {
                sourceHeadings.push(getSeriesSourceHeading(seriesIndexes[i] - 1));
            }

            for (let i = props.seriesCount; i < savedSeries.length; i++) {

                const column = savedSeries[i]?.column;

                if (!column) continue;

                const sourceHeading =
                    Ren.DateValueChart_SeriesSplit.getSourceHeading(props, column);

                if (sourceHeadings.indexOf(sourceHeading) !== -1) {
                    savedSeries[i][propertyName] = value;
                }
            }
        };

        /**
         * Sets a property on each of the series at the given indexes, and on any series sharing it
         * with them, drawn or not, creating any that do not exist, then commits the change once for
         * them all.
         */
        const setSeriesPropertyOn = (targetSeriesIndexes, propertyName, value, applyToChart) => {

            const seriesIndexes = getSharingSeriesIndexes(targetSeriesIndexes, propertyName);

            if (seriesIndexes.length === 0) return;

            for (let i = 0; i < seriesIndexes.length; i++) {
                writeSeriesPropertyAt(seriesIndexes[i], propertyName, value);
            }

            writeUndrawnSharingSeriesProperty(seriesIndexes, propertyName, value);

            const applyToSeries = () => {

                for (let i = 0; i < seriesIndexes.length; i++) {
                    applyToChart(value, seriesIndexes[i]);
                }
            };

            Ren.VisualisationSettingsSynchroniser.commitChange(
                visualisation,
                applyToChart ? applyToSeries : props.redrawChart
            );
        };

        /**
         * Sets a property on every one of the chart's series to the value given for it, then
         * commits the change once for them all.  Series that already have their value are left
         * alone, so that none is created only to be given its default.
         */
        const setSeriesPropertyOnEach = (propertyName, defaultValue, getValue) => {

            let isChanged = false;

            for (let seriesIndex = 1; seriesIndex <= props.seriesCount; seriesIndex++) {

                const value = getValue(seriesIndex);

                if (getSeriesPropertyAt(seriesIndex, propertyName, defaultValue) === value) continue;

                writeSeriesPropertyAt(seriesIndex, propertyName, value);
                isChanged = true;
            }

            if (!isChanged) return;

            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
        };

        /**
         * Gets a property from the series at the given index, returning the default value if the
         * series does not exist or the property is unset.
         */
        const getSeriesPropertyAt = (seriesIndex, propertyName, defaultValue) => {

            if (!seriesIndex || !props.series) return defaultValue;

            return props.series[seriesIndex - 1]?.[propertyName] ?? defaultValue;
        };

        /**
         * Gets a property the series at the given indexes, and any series sharing it with them,
         * have in common, taking the default value where it is unset, or undefined if they differ.
         * With no series, it is the default value.
         */
        const getCommonSeriesProperty = (targetSeriesIndexes, propertyName, defaultValue) => {

            const seriesIndexes = getSharingSeriesIndexes(targetSeriesIndexes, propertyName);

            if (seriesIndexes.length === 0) return defaultValue;

            const value = getSeriesPropertyAt(seriesIndexes[0], propertyName, defaultValue);

            for (let i = 1; i < seriesIndexes.length; i++) {

                if (getSeriesPropertyAt(seriesIndexes[i], propertyName, defaultValue) !== value) {
                    return undefined;
                }
            }

            return value;
        };

        /**
         * Sets a property on the series the menu items act on, creating any that do not exist.
         */
        const setSeriesProperty = (propertyName, value, applyToChart) =>
            setSeriesPropertyOn(getTargetSeriesIndexes(), propertyName, value, applyToChart);

        /**
         * Gets a property the series the menu items act on share, taking the default value where
         * it is unset, or undefined if they differ, so that no option is ticked for mixed series.
         */
        const getSeriesProperty = (propertyName, defaultValue) =>
            getCommonSeriesProperty(getTargetSeriesIndexes(), propertyName, defaultValue);

        /**
         * Sets several properties on the series the menu items act on, creating any that do not
         * exist, then commits the change once for them all.  applyToSeries is given each series'
         * index, or the chart is redrawn without it.
         */
        const setSeriesProperties = (properties, applyToSeries) => {

            const seriesIndexes = getTargetSeriesIndexes();

            if (seriesIndexes.length === 0) return;

            const propertyNames = Object.keys(properties);

            for (let i = 0; i < seriesIndexes.length; i++) {

                for (let j = 0; j < propertyNames.length; j++) {

                    writeSeriesPropertyAt(
                        seriesIndexes[i],
                        propertyNames[j],
                        properties[propertyNames[j]]
                    );
                }
            }

            const applyToEachSeries = () => {

                for (let i = 0; i < seriesIndexes.length; i++) {
                    applyToSeries(seriesIndexes[i]);
                }
            };

            Ren.VisualisationSettingsSynchroniser.commitChange(
                visualisation,
                applyToSeries ? applyToEachSeries : props.redrawChart
            );
        };

        /**
         * Toggles a boolean property on the series the menu items act on, creating any that do not
         * exist.  Series that differ are all turned on.
         */
        const toggleSeriesProperty = (propertyName, defaultValue, applyToChart) => {

            setSeriesProperty(
                propertyName,
                !getSeriesProperty(propertyName, defaultValue),
                applyToChart
            );
        };

        /**
         * Builds the submenu items for a per-series setting offered as a list of alternatives: one
         * item per option, setting the property when picked and ticked when it is the current one.
         *
         * @param {string} propertyName - The series property the options set.
         * @param {any} defaultValue - The value a series takes when the property is unset, so that
         *     the option matching it is ticked.
         * @param {object[]} options - The alternatives, as { text, value }.
         */
        const buildSeriesOptionItems = (propertyName, defaultValue, options) => {

            return options.map(option => ({
                text: option.text,
                action: () => setSeriesProperty(propertyName, option.value),
                ticked: () => getSeriesProperty(propertyName, defaultValue) === option.value
            }));
        };

        /**
         * Gets the value columns in the chart's input data, which are the columns the chart plots
         * and the columns its own grouping aggregates.  Detection scans every row, so the result is
         * kept until a draw replaces the input data.
         */
        let valueColumnsInputData = null;
        let valueColumns = null;

        const getValueColumnsFromData = () => {

            if (!props.rawInputData || props.rawInputData.length === 0) return [];

            if (props.rawInputData !== valueColumnsInputData) {

                // Rows limited to the plotted columns are no guide to what else could be plotted.
                if (!InputColumns.rowsHoldColumns(props.rawInputData, tabularData, null)) {

                    valueColumns = InputColumns.getValueColumns(tabularData);
                }
                else {

                    const result = Ren.AdHocDataSource_ColumnDetector.detectColumns(
                        props.rawInputData,
                        null
                    );

                    valueColumns = result.valueHeadings || [];
                }

                valueColumns = valueColumns.filter(
                    column => !InputColumns.isInternalColumn(column)
                );

                valueColumnsInputData = props.rawInputData;
            }

            return valueColumns;
        };

        /**
         * Gets a value indicating whether the chart's data are split.
         */
        const isSplitActive = () => !!props.seriesSplit;

        /**
         * Gets the column a series' values are aggregated from.
         */
        const getSeriesSourceHeading = (arrayIndex) =>
            props.seriesSourceHeadings?.[arrayIndex] ?? props.valueHeadings?.[arrayIndex];

        /**
         * Gets the value columns the chart plots, each named once however many series it is split
         * into.  These are the columns the chart's own grouping aggregates.
         */
        const getBaseValueHeadings = () => {

            const headings = props.seriesSourceHeadings || props.valueHeadings || [];
            const baseHeadings = [];

            for (let i = 0; i < headings.length; i++) {

                if (baseHeadings.indexOf(headings[i]) === -1) baseHeadings.push(headings[i]);
            }

            return baseHeadings;
        };

        /**
         * Gets the chart's rows again where they lack a column it now reads, such as a series just
         * added, as they were limited to the columns it read when they were got.
         */
        const ensureInputColumns = () => {

            if (!props.rawInputData) return;

            const columnIndexes = InputColumns.getRequiredColumnIndexes(visualisation, tabularData);

            if (InputColumns.rowsHoldColumns(props.rawInputData, tabularData, columnIndexes)) return;

            props.rawInputData = Ren.VisualisationInputDataHelper.getInputData(
                tabularData,
                visualisation,
                columnIndexes,
                Ren.DateValueChart_CrossFiltering.getUnfilteredColumns(visualisation, tabularData)
            ).inputData;
        };

        // Recompiles the chart's grouping entry from chartDataGroupingSettings, and recomputes
        // preGroupedData to match it, so that settings changes take effect immediately.
        const refreshChartGrouping = () => {

            if (!visualisation.chartDataGroupingSettings) return;

            ensureInputColumns();

            props.chartGroupingEntry = Ren.DateValueChart_GroupingApplyer.initGroupingEntry(
                visualisation.chartDataGroupingSettings,
                props.dateHeading,
                getBaseValueHeadings(),
                tabularData?.columnResolver,
                Ren.ReportInputParameters.getInputParameters(visualisation.containingReport),
                tabularData?.ColumnModelFormats
            );

            Ren.DateValueChart_MultiChart.applyChartRange(props, props.chartGroupingEntry);

            if (props.rawInputData && props.dateHeading) {

                const normalisedInput = Ren.CreateDateValueChart_PrepareData.normaliseQuarterDates(
                    props.rawInputData,
                    props.dateHeading
                );

                props.preGroupedData =
                    Ren.DateValueChart_GroupingApplyer.applyGroupingWithinPointLimit(
                        normalisedInput,
                        props.chartGroupingEntry
                    );

                if (props.otherSeries?.length > 0) {

                    props.preGroupedData =
                        Ren.DateValueChart_GroupingApplyer.addOtherSeriesColumns(
                            props.preGroupedData,
                            props.chartGroupingEntry,
                            props.otherSeries
                        );
                }

                props.previousYearGroupingEntry = props.chartGroupingEntry;
                props.previousYearInputData = normalisedInput;
                props.chartDateRange = props.chartGroupingEntry?.resolvedDateRange ?? null;
                props.binPeriod = props.chartGroupingEntry?.binPeriod;
                props.isAllTime = !!props.chartGroupingEntry?.isAllTime;
                props.allTimeExtent = props.chartGroupingEntry?.allTimeExtent ?? null;
            }
        };

        /**
         * Recompiles the chart's grouping from its settings and re-aggregates its data through it,
         * so that a change to what is plotted shows in the chart about to be drawn.
         */
        const regroupData = () => {

            refreshChartGrouping();

            if (!props.rawInputData) return;

            props.currentData = Ren.CreateDateValueChart_PrepareData.prepareData(
                props.rawInputData,
                props
            );

            // This redraw path bypasses the dataGroupingSettingsChanged/groupingsChanged
            // events that ren-base-visualisation-creator.js otherwise relies on to call
            // qaHelper.setQa, so the QA snapshot is refreshed here to match what was aggregated.
            Ren.QA.DateValueChart.setQaDateValueChart(props, props.rawInputData);
        };

        /**
         * Redraws the chart from the data it has already prepared, and saves the settings change
         * behind it.  The extents are recalculated, so the axes fit the new data not the old.
         */
        const commitRedraw = () => {

            props.skipExtentRecalculation = false;
            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
        };

        /**
         * Builds the chart again from its input data, rather than redrawing it from the data it has
         * already prepared.  Changing which columns are plotted, or how the data is split, changes
         * what the series are, so the columns have to be detected and the data aggregated afresh.
         */
        const rebuildVisualisation = () => {

            props.skipExtentRecalculation = false;
            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawVisualisation);
        };

        const subdivisionContents = Ren.DateValueChart_SeriesSubdivisions.LABEL_CONTENTS;

        const buildSubdivisionLabelsOption = (text, content) => ({
            text,
            action: () => {

                props.subdivisionLabels = content;
                visualisation.subdivisionLabels = content;

                commitRedraw();
            },
            ticked: () => Ren.DateValueChart_SeriesSubdivisions.getLabelContent(props) === content
        });

        const subdivisionPlacements = Ren.DateValueChart_SeriesSubdivisions.LABEL_PLACEMENTS;

        // Only pies' labels can go around them.
        const arePieSubdivisionsLabelled = () => Ren.DateValueChart_Pies.hasPies(props)
            && Ren.DateValueChart_SeriesSubdivisions.getLabelContent(props)
                !== subdivisionContents.None;

        // Redrawn, as the labels around the pies are drawn with them.
        const buildSubdivisionPlacementOption = (text, placement, title) => ({
            text,
            title,
            visible: arePieSubdivisionsLabelled,
            action: () => {

                props.subdivisionLabelPlacement = placement;
                visualisation.subdivisionLabelPlacement = placement;

                commitRedraw();
            },
            ticked: () =>
                Ren.DateValueChart_SeriesSubdivisions.getLabelPlacement(props) === placement
        });

        const subdivisionLabelsMenuItem = {
            text: "Subdivision labels",
            id: "subdivision-labels",
            title: "Labels each subdivision of the bars or slices with its name or value",
            visible: () => Ren.DateValueChart_SeriesSubdivisions.isActive(props),
            submenu: [
                buildSubdivisionLabelsOption("None", subdivisionContents.None),
                buildSubdivisionLabelsOption("Names", subdivisionContents.Names),
                buildSubdivisionLabelsOption("Values", subdivisionContents.Values),
                buildSubdivisionLabelsOption("Names and values", subdivisionContents.Both),
                Ren.MENU_SEPARATOR,
                buildSubdivisionPlacementOption(
                    "Inside slices",
                    subdivisionPlacements.Inside,
                    "Writes each label inside its subdivision, where it fits"
                ),
                buildSubdivisionPlacementOption(
                    "Around pies",
                    subdivisionPlacements.Around,
                    "Lists the labels either side of each pie, with lines to their subdivisions"
                )
            ]
        };

        // --- Menu-item modules ------------------------------------------------------------

        // The items live in the -appearance, -series-columns and -data-settings modules.  This is
        // what they need of the chart around them.
        const chart = {
            tabularData,
            visualisation,
            props,
            getTargetSeriesIndexes,
            getTargetSeriesIndex,
            targetSeriesHeadingMenuItem,
            chartHeadingMenuItem,
            getSeriesPropertyAt,
            getCommonSeriesProperty,
            getSharingSeriesIndexes,
            setSeriesPropertyOn,
            setSeriesPropertyOnEach,
            getSeriesProperty,
            setSeriesProperty,
            setSeriesProperties,
            toggleSeriesProperty,
            buildSeriesOptionItems,
            getValueColumnsFromData,
            isSplitActive,
            getSeriesSourceHeading,
            getBaseValueHeadings,
            regroupData,
            commitRedraw,
            rebuildVisualisation,
            subdivisionLabelsMenuItem
        };

        const {
            seriesLabelMenuItem,
            seriesColourMenuItem,
            chartTypeMenuItem,
            labelsMenuItem,
            titleMenuItem,
            subtitleMenuItem,
            legendMenuItem,
            axisVisibilityMenuItem,
            hoverMenuItem
        } = Ren.ContextMenuItems_DateValueChart_Appearance(chart);

        // The value axes' menus take nothing from the chart's, apart from this.
        props.axisVisibilityMenuItem = axisVisibilityMenuItem;

        const {
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
            dateColumnMenuItem,
            columnPickers
        } = Ren.ContextMenuItems_DateValueChart_SeriesColumns(chart);

        const {
            trendLineMenuItem,
            markExtremesMenuItem,
            previousYearMenuItem,
            runningTotalMenuItem,
            yearToDateMenuItem,
            rollingYearTotalMenuItem,
            perDayMenuItem,
            shareOfTotalMenuItem,
            indexMenuItem,
            changeMenuItem,
            yearOnYearChangeMenuItem,
            aggregationMenuItem,
            withRespectToMenuItem,
            formatMenuItem,
            changeDateGroupingMenuItem,
            estimateLastPeriodMenuItem
        } = Ren.ContextMenuItems_DateValueChart_DataSettings(chart);

        const {
            hideClickedDateMarkerMenuItem,
            dateMarkersMenuItem
        } =Ren.ContextMenuItems_DateValueChart_DateMarkers(chart);

        const {

            dateRangeMenuItem
        } = Ren.ContextMenuItems_DateValueChart_DateRange(chart);

        const {
            filterByMenuItem,
            showDateFilterMenuItem
        } = Ren.ContextMenuItems_DateValueChart_DateFilter(chart);

        const {
            multiChartMenuItem,
            periodSliderMenuItem
        } = Ren.ContextMenuItems_DateValueChart_PeriodSlider(chart);

        const {
            getClickedPeriod,
            clickedDatesMenuItem
        } = Ren.ContextMenuItems_DateValueChart_ClickedDates(chart);

        const {
            addMarkerMenuItem,
            removeMarkerMenuItem
        } = Ren.ContextMenuItems_DateValueChart_AddedMarkers(chart, getClickedPeriod);

        const { showDataMenuItem } = Ren.ContextMenuItems_DateValueChart_DataPoint(chart);

        const {
            moveSeriesEarlierMenuItem,
            moveSeriesLaterMenuItem
        } = Ren.ContextMenuItems_DateValueChart_SeriesOrder(chart);

        // Copies a menu item into another section, keeping its getters as getters so that a
        // submenu built when the menu opens is still built then.  With no section, the copy is
        // fit for a submenu, where a section would head it.
        const copyMenuItemToSection = (menuItem, section) => {

            const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(menuItem));

            copy.section = section;

            return copy;
        };

        // An "Other" series is made from the series it gathers, so has no column, aggregation or
        // format of its own, and is not all that "Remove all other data series" leaves.
        const isOtherSeriesTargeted = () => getTargetSeriesIndexes().some(
            seriesIndex => Ren.DateValueChart_OtherSeries.isOtherSeries(props, seriesIndex)
        );

        const getNotForOtherSeries = (menuItem) => {

            const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(menuItem));
            const isVisible = menuItem.visible;

            Object.defineProperty(copy, "visible", {
                value: () => !isOtherSeriesTargeted()
                    && (typeof isVisible === "function" ? isVisible() : isVisible !== false),
                enumerable: true,
                writable: true,
                configurable: true
            });

            return copy;
        };

        /**
         * Builds the submenu of what the series' values are made from and how they are formatted,
         * which on a series' menu are that series' and away from every series are every series'.
         *
         * @param {boolean} isForSeries - Whether the menu is a series' own, where the "Other"
         *     series, made from the series it gathers, has none of these.
         */
        const buildValuesMenuItem = (isForSeries) => {

            const notForOtherSeries = (menuItem) =>
                isForSeries ? getNotForOtherSeries(menuItem) : menuItem;

            return {
                section: "Chart data",
                text: "Values",
                id: "chart-values",
                submenu: [
                    targetSeriesHeadingMenuItem,
                    notForOtherSeries(dataColumnMenuItem),
                    notForOtherSeries(aggregationMenuItem),
                    notForOtherSeries(withRespectToMenuItem),
                    notForOtherSeries(formatMenuItem),
                    Ren.MENU_SEPARATOR,
                    runningTotalMenuItem,
                    yearToDateMenuItem,
                    rollingYearTotalMenuItem,
                    perDayMenuItem,
                    shareOfTotalMenuItem,
                    indexMenuItem,
                    changeMenuItem,
                    yearOnYearChangeMenuItem
                ].map(menuItem => copyMenuItemToSection(menuItem, undefined))
            };
        };

        // Read as the chart is clicked, so nothing needs drawing again.  An ad hoc chart reads
        // every row, so has no settings to filter.
        const crossFilteringMenuItem = {
            section: "Chart data",
            text: "Enable cross filtering",
            id: "enable-cross-filtering",
            visible: () => !visualisation?.isAdHoc,
            ticked: () => props.enableCrossFiltering === true,
            title: "Clicking a split series or a subdivision filters the reports sharing the "
                + "chart's filters to its value",
            action: () => {

                props.enableCrossFiltering = props.enableCrossFiltering !== true;

                if (visualisation) {
                    visualisation.enableCrossFiltering = props.enableCrossFiltering;
                }

                // The chart stops or starts being filtered by its own split and subdivide columns.
                rebuildVisualisation();
            }
        };

        // What the chart plots, then which series it draws: offered on the chart and on every
        // series alike.  A removed series has no legend entry to right-click, so it is reinstated
        // from here, and series hidden one at a time are shown again all at once.
        const buildChartDataMenuItems = (valuesMenuItem) => [
            valuesMenuItem,
            trendLineMenuItem,
            markExtremesMenuItem,
            previousYearMenuItem,
            addDataSeriesMenuItem,
            dateColumnMenuItem,
            splitDataMenuItem,
            filterByMenuItem,
            crossFilteringMenuItem,
            { section: "Chart data", text: "-" },
            showAllSeriesMenuItem,
            showOtherSeriesMenuItem,
            reinstateRemovedSeriesMenuItem,
            reinstateOtherSeriesMenuItem
        ];

        // Offered with the rest of how the chart looks rather than at the top of the menu, where
        // every visualisation's own copy sorts.  Its ID replaces that copy, so it is shown exactly
        // where that copy is: on a visualisation that is not virtual.
        const effectsMenuItem = Object.assign(
            {},
            Ren.ContextMenuItems_VisualisationEffects.getMenuItems(visualisation)[0],
            {
                section: "Appearance",
                positionAtEndOfSection: true,
                visible: () => !!visualisation.element && !visualisation.isVirtual
            }
        );

        /**
         * Recolours every series, drawn or saved for later, in a colour scheme's colours, giving up
         * any colour of its own.  The drawn series are shown in their new colours as a preview,
         * written in one go, rather than restyled series by series, which rewrites the chart's
         * stylesheet many times over for each.  The change is left to the caller to commit.
         */
        const applyColourScheme = (schemeIndex) => {

            visualisation.colourScheme = schemeIndex;

            // A multi-chart's colours run through its legend, which numbers every series.
            const schemeProps = Ren.DateValueChart_MultiChart.getSharedLegendProps(props) || props;
            const previews = [];

            for (let seriesIndex = 1; seriesIndex <= schemeProps.seriesCount; seriesIndex++) {

                const colour =
                    Ren.DateValueChart_SeriesColours.getDefaultColour(seriesIndex - 1, schemeIndex);

                writeSeriesPropertyOn(schemeProps, seriesIndex, "colour", colour);
                writeSeriesPropertyOn(schemeProps, seriesIndex, "standardColour", null);

                previews.push({
                    seriesIndex,
                    colour,
                    filter: schemeProps.series?.[seriesIndex - 1]?.colourFilter || null
                });
            }

            Ren.DateValueChart_StyleUpdater.setPreviewColours(schemeProps, previews);

            const savedSeries = visualisation.series || [];

            for (let i = schemeProps.seriesCount; i < savedSeries.length; i++) {

                if (!savedSeries[i]) continue;

                savedSeries[i].colour =
                    Ren.DateValueChart_SeriesColours.getDefaultColour(i, schemeIndex);
                savedSeries[i].standardColour = null;
            }
        };

        // Previewed as the slider moves, then redrawn once it closes, settling what is worked out
        // from the colours as the chart is drawn, such as the value labels' contrast.
        const colourSchemeMenuItem = {
            section: "Appearance",
            text: "Colours...",
            id: "chart-colour-scheme",
            positionAtEndOfSection: true,
            action: () => Ren.CreateDateValueChartColourSchemePopupWindow(
                Ren.DateValueChart_SeriesColours.getSchemeIndex(visualisation.colourScheme),
                applyColourScheme,
                hasChanged => {

                    if (hasChanged) {

                        Ren.DateValueChart_StyleUpdater.clearPreview(props);
                        Ren.VisualisationSettingsSynchroniser.commitChange(
                            visualisation,
                            props.redrawChart
                        );
                    }
                },
                Ren.LastRightClickPosition
            )
        };

        // What the series are drawn as and how they're labelled lead with the series' own items,
        // then the whole chart's, so on a series' menu they're with the rest of the series' own,
        // and away from every series with the rest of how the chart looks.  One item for both, so
        // that the settings window, which reads the chart's menu as if opened on a series, has
        // them under Series on its Individual Series tab.
        const inSeriesSectionWhenClicked = (menuItem) => {

            const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(menuItem));

            Object.defineProperty(copy, "section", {
                get: () => isSeriesClicked() ? "Series" : "Appearance",
                enumerable: true,
                configurable: true
            });

            return copy;
        };

        const drawAsMenuItem = inSeriesSectionWhenClicked(chartTypeMenuItem);
        const seriesLabelsMenuItem = inSeriesSectionWhenClicked(labelsMenuItem);

        // How the chart looks, grouped by topic rather than by what is acted on.  Read rather
        // than acted on, so after the items that change what the chart says.
        const chartLooksMenuItems = [
            titleMenuItem,
            subtitleMenuItem,
            legendMenuItem,
            axisVisibilityMenuItem,
            hoverMenuItem,
            colourSchemeMenuItem,
            effectsMenuItem
        ];

        const chartAppearanceMenuItems = [drawAsMenuItem, seriesLabelsMenuItem]
            .concat(chartLooksMenuItems);

        // What tells the series apart and how it is drawn, then hiding and removing it, last as
        // they take it out of the chart.  Its values are under the chart's data, beside the
        // chart-wide items on the same topic.
        const seriesOwnMenuItems = [
            seriesLabelMenuItem,
            seriesColourMenuItem,
            drawAsMenuItem,
            seriesLabelsMenuItem,
            assignAxisMenuItem,
            moveSeriesEarlierMenuItem,
            moveSeriesLaterMenuItem,
            { section: "Series", text: "-" },
            showHideSeriesMenuItem,
            hideOtherSeriesMenuItem,
            removeSeriesMenuItem,
            getNotForOtherSeries(removeOtherSeriesMenuItem)
        ].concat(buildChartDataMenuItems(buildValuesMenuItem(true)));

        // A series' row of hovered values is offered the legend itself too.
        const seriesMenuItems = seriesOwnMenuItems.concat([legendMenuItem]);

        // A plotted series' menu is its own, so it leads with the data point and the period
        // clicked, unsectioned so that they come before the series they belong to, and ends
        // with how the whole chart looks, as on the chart around it.  Its legend entry is offered
        // the same, the data point and period items hiding as there is neither under the pointer.
        const plottedSeriesMenuItems = [showDataMenuItem, clickedDatesMenuItem, addMarkerMenuItem]
            .concat(seriesOwnMenuItems)
            .concat(chartLooksMenuItems);

        /**
         * Adds the series items to everything drawn for a series - its bars, line or points, its
         * legend entry and its row of hovered values - each of which sits in an element carrying
         * the series number.  The bars, line or points and the legend entries take nothing from
         * the chart's menu.  The chart draws these afresh on every redraw, so it calls this again
         * then.
         */
        const addSeriesMenuItems = () => {

            const seriesElements = element.querySelectorAll("[data-series]");
            const chartGroupNode = props.chartGroup || null;

            for (let i = 0; i < seriesElements.length; i++) {

                // Only the outermost, as the bars inside a series' group carry its number too.
                if (seriesElements[i].parentElement.closest("[data-series]")) continue;

                const isPlotted = chartGroupNode && seriesElements[i].parentNode === chartGroupNode;

                if (isPlotted || seriesElements[i].classList.contains("ren-legend-item")) {

                    Ren.IsolateContextMenu(seriesElements[i]);
                    Ren.AddContextMenuItems(seriesElements[i], plottedSeriesMenuItems);
                    continue;
                }

                Ren.AddContextMenuItems(seriesElements[i], seriesMenuItems);
            }

            // Redrawn with the series, as a change to what is plotted redraws them.
            Ren.DateValueChart_ColumnPickers.render(visualisation, props, columnPickers);
        };

        props.addSeriesMenuItems = addSeriesMenuItems;

        // For the settings window's Individual Series tab, as a series' items are only on its
        // own menu.
        props.seriesMenuItems = seriesMenuItems;
        addSeriesMenuItems();

        // Shows what the image will hold while the pointer rests over an item that makes one.
        const addImageAreaHandlers = (menuItem) => {

            menuItem.onmouseenter = () =>
                Ren.DateValueChart_ImageExport.setImageAreaShaded(props, true);

            menuItem.onmouseleave = () =>
                Ren.DateValueChart_ImageExport.setImageAreaShaded(props, false);

            return menuItem;
        };

        // The pointer leaves this item for its submenu, so those items shade the area as well.
        const downloadImageMenuItem = addImageAreaHandlers({
            section: "Other",
            text: "Download image",
            id: "chart-download-image",
            visible: () => !!props.svg,
            submenu: [
                addImageAreaHandlers({
                    text: "SVG",
                    id: "chart-download-image-svg",
                    action: () => Ren.DateValueChart_ImageExport.downloadSvg(props)
                }),
                addImageAreaHandlers({
                    text: "PNG",
                    id: "chart-download-image-png",
                    action: () => Ren.DateValueChart_ImageExport.downloadPng(props)
                })
            ]
        });

        const copyImageMenuItem = addImageAreaHandlers({
            section: "Other",
            text: "Copy image",
            id: "chart-copy-image",
            visible: () => !!props.svg && Ren.DateValueChart_ImageExport.canCopyImage(),
            action: () => Ren.DateValueChart_ImageExport.copyPng(props)
                .catch(error => Ren.Log.error(
                    "DateValueChartCopyImage",
                    null,
                    null,
                    null,
                    { error: String(error) }
                ))
        });

        const downloadDataMenuItem = {
            section: "Other",
            text: "Download data",
            id: "chart-download-data",
            visible: () => (props.plottedData || []).length > 0,
            submenu: [
                {
                    text: "CSV",
                    id: "chart-download-data-csv",
                    action: () => Ren.DateValueChart_DataExport.downloadCsv(props)
                },
                {
                    text: "Excel",
                    id: "chart-download-data-xlsx",
                    visible: () => Ren.DateValueChart_DataExport.canDownloadExcel(),
                    action: () => Ren.DateValueChart_DataExport.downloadExcel(props)
                }
            ]
        };

        const copyDataMenuItem = {
            section: "Other",
            text: "Copy data",
            id: "chart-copy-data",
            title: "Copies the values plotted, for pasting into a spreadsheet",
            visible: () => (props.plottedData || []).length > 0
                && Ren.DateValueChart_DataExport.canCopyText(),
            action: () => Ren.DateValueChart_DataExport.copyTsv(props)
                .catch(error => Ren.Log.error(
                    "DateValueChartCopyData",
                    null,
                    null,
                    null,
                    { error: String(error) }
                ))
        };

        // The chart's own items lead with what was clicked, unsectioned, then are grouped by
        // topic: what the chart plots, then the dates it covers, then how it all looks, and last
        // the windows every visualisation offers.  Away from every series, the series' items act
        // on them all.  A colour, an axis, or hiding or removing are left out, as the same for
        // every series they would leave nothing to tell the series apart or nothing drawn.  The
        // label shows only where the chart has one series.  Within a section the written order is
        // what shows, since the sort is stable.
        const menuItems = [
            clickedDatesMenuItem,
            addMarkerMenuItem,
            hideClickedDateMarkerMenuItem,
            removeMarkerMenuItem,
            copyMenuItemToSection(seriesLabelMenuItem, "Chart data")
        ].concat(buildChartDataMenuItems(buildValuesMenuItem(false))).concat([

            // Everything the date axis decides, kept together so that there is one place to look
            // for a date: how the dates are binned, which of them are drawn, and what they are
            // annotated with.
            changeDateGroupingMenuItem,
            dateRangeMenuItem,
            showDateFilterMenuItem,
            periodSliderMenuItem,
            multiChartMenuItem,
            dateMarkersMenuItem,
            estimateLastPeriodMenuItem
        ]).concat(chartAppearanceMenuItems).concat([
            downloadImageMenuItem,
            copyImageMenuItem,
            downloadDataMenuItem,
            copyDataMenuItem
        ]);
        const windowItems = windowsMenuItems.getMenuItems();
        Ren.ArrayUtils.pushAll(menuItems, windowItems);
        contextMenu.addMenuItems(element, menuItems);

    };

    return {
        addShowWindowsMenuItems
    };
};
