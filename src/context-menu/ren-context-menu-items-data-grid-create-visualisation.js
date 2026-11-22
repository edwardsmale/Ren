/**
 * Function to add 'create visualisation' items to the context menu.
 */
Ren.ContextMenuItems_DataGridCreateVisualisationMenuItems = (
    contextMenu,
    dataGridGuid,
    dataGridCellSelection,
    visualisation,
    tabularData) => {

    const createAdHocVisualisation = (visualisationTypeName, dataGridGuid, popupReuseId) => {

        Ren.Messages.Requests.createAdHocVisualisation.notify(
            dataGridGuid,
            visualisationTypeName,
            popupReuseId,
            {}
        );
    };

    /**
     * Adds 'create visualisation' items to the context menu for the given cell.  These items allow
     * the user to create a visualisation based on the data in the grid.
     */
    const addCreateVisualisationMenuItems = (cell) => {

        // Detect the granularity of the selected date column once, lazily, the first time a
        // Date/Value Chart submenu item asks whether it should be visible.  This is memoised for
        // the lifetime of this menu so the per-item checks don't repeat the work.
        let detectedDatePeriod;
        let detectedDatePeriodComputed = false;
        let detectedDateHeading;

        const getDetectedDatePeriod = () => {

            if (detectedDatePeriodComputed) return detectedDatePeriod;

            detectedDatePeriodComputed = true;
            detectedDatePeriod = null;

            // Detection is restricted to the selected columns whatever the selection type: a chart
            // begotten from part of a column, or from arbitrary cells, is built on just those
            // cells, so a date column elsewhere in the grid is not one it could plot.
            let selectedColumns = dataGridCellSelection.getSelectedColumnIdsOrHeadings();

            // Columns of names alone are charted by their row counts, which the detector needs
            // as a value column to find the date column beside them.
            const RowCount = Ren.DateValueChart_RowCount;

            if (RowCount.getCountedColumn(tabularData, selectedColumns) !== null) {
                selectedColumns = selectedColumns.concat(RowCount.COUNT_COLUMN);
            }

            const { inputData } = Ren.VisualisationInputDataHelper.getInputData(
                tabularData,
                visualisation
            );

            if (!inputData || inputData.length === 0) return detectedDatePeriod;

            const { dateHeading, error } =
                Ren.AdHocDataSource_ColumnDetector.detectColumns(inputData, selectedColumns);

            if (error || !dateHeading) return detectedDatePeriod;

            // The detector falls back on a column of text, which a chart is not grouped by.  The
            // column's own rows are looked at, as a grid's group rows hold no dates.
            const dateColumnIndex = tabularData.columnResolver.getColumnIndex(dateHeading);
            const dateColumns = Ren.DateValueChart_InputColumns.getDateColumns(tabularData);

            if (!dateColumns.some(dateColumn => dateColumn.columnIndex === dateColumnIndex)) {
                return detectedDatePeriod;
            }

            detectedDateHeading = dateHeading;

            const dates = Ren.CreateDateValueChart_PrepareData.getDates(inputData, dateHeading);

            if (dates.length > 0) {

                detectedDatePeriod = Ren.DatePeriodDetector.detectDatePeriod(dates).datePeriod;

                return detectedDatePeriod;
            }

            // The rows the grid is showing are grouped, and a date column aggregates to nothing on
            // a group row, so they say nothing about the granularity - which would leave every
            // option showing, including ones finer than the data (By Day over quarterly dates).
            // The column itself still holds the dates those groups were built from, and they are
            // the dates the chart will bin.
            detectedDatePeriod = Ren.DatePeriodDetector.detectDatePeriodForColumn(
                tabularData,
                dateHeading
            );

            return detectedDatePeriod;
        };

        /**
         * If the source grid's second-outermost grouping groups by the detected date column,
         * returns the calc function name it groups by (e.g. "date-month-start"), so that clicking
         * "Chart" directly produces a chart with matching granularity instead of always defaulting
         * to "By Day".
         */
        const getExistingDateGroupCalcFunction = () => {

            getDetectedDatePeriod();

            if (!detectedDateHeading) return null;

            const dateColumnIndex = tabularData.columnResolver.getColumnIndex(detectedDateHeading);

            if (dateColumnIndex == null) return null;

            const dataGroupingSettings =
                Ren.DataGroupingSettingsSource.getActiveDataGroupingSettings(visualisation);

            const secondOutermostGrouping =
                dataGroupingSettings?.groupings?.secondToLastGrouping();

            if (!secondOutermostGrouping) return null;

            const positionInGrouping =
                secondOutermostGrouping.groupByColumnIndexes.indexOf(dateColumnIndex);

            if (positionInGrouping === -1) return null;

            return secondOutermostGrouping.groupByCalcFunctions?.[positionInGrouping]?.name ?? null;
        };

        // A grouping option only makes sense if it is at, or coarser than, the data's own
        // granularity - e.g. monthly data can be grouped by month/quarter/year but not by day.
        // If the period can't be detected, fall open and show every option.
        const isDateGroupCalcFunctionApplicable = (dateGroupCalcFunction) => {

            const detectedPeriod = getDetectedDatePeriod();

            if (detectedPeriod === null) return true;

            const optionPeriod = Ren.DatePeriodDetector.getPeriodForCalcFunction(
                dateGroupCalcFunction
            );

            return optionPeriod >= detectedPeriod;
        };

        const hasDetectedDateColumn = () => {

            getDetectedDatePeriod();

            return !!detectedDateHeading;
        };

        const createDateValueChartWithPeriod = (dateGroupCalcFunction) => {

            const options = { dateGroupCalcFunction };

            if (dataGridCellSelection.selectionType() === "column") {

                Ren.CreateDateValueChartCreator.createColumnBasedDateValueChart(
                    visualisation,
                    tabularData,
                    dataGridCellSelection,
                    options
                );
            }
            else {

                Ren.Messages.Requests.createAdHocVisualisation.notify(
                    dataGridGuid,
                    "DateValueChart",
                    null,
                    options
                );
            }
        };

        const datePeriodMenuItems = [
            {
                text: "By Second",
                id: "create-visualisation-date-value-chart-second",
                visible: () => isDateGroupCalcFunctionApplicable("date-second-start"),
                action: () => createDateValueChartWithPeriod("date-second-start")
            },
            {
                text: "By Minute",
                id: "create-visualisation-date-value-chart-minute",
                visible: () => isDateGroupCalcFunctionApplicable("date-minute-start"),
                action: () => createDateValueChartWithPeriod("date-minute-start")
            },
            {
                text: "By 15 Minutes",
                id: "create-visualisation-date-value-chart-quarter-hour",
                visible: () => isDateGroupCalcFunctionApplicable("date-quarter-hour-start"),
                action: () => createDateValueChartWithPeriod("date-quarter-hour-start")
            },
            {
                text: "By Hour",
                id: "create-visualisation-date-value-chart-hour",
                visible: () => isDateGroupCalcFunctionApplicable("date-hour-start"),
                action: () => createDateValueChartWithPeriod("date-hour-start")
            },
            {
                text: "By Day",
                id: "create-visualisation-date-value-chart-day",
                visible: () => isDateGroupCalcFunctionApplicable("date-day-start"),
                action: () => createDateValueChartWithPeriod("date-day-start")
            },
            {
                text: "By Week",
                id: "create-visualisation-date-value-chart-week",
                visible: () => isDateGroupCalcFunctionApplicable("date-week-start"),
                action: () => createDateValueChartWithPeriod("date-week-start")
            },
            {
                text: "By Month",
                id: "create-visualisation-date-value-chart-month",
                visible: () => isDateGroupCalcFunctionApplicable("date-month-start"),
                action: () => createDateValueChartWithPeriod("date-month-start")
            },
            {
                text: "By Quarter",
                id: "create-visualisation-date-value-chart-quarter",
                visible: () => isDateGroupCalcFunctionApplicable("date-quarter-start"),
                action: () => createDateValueChartWithPeriod("date-quarter-start")
            },
            {
                text: "By Year",
                id: "create-visualisation-date-value-chart-year",
                visible: () => isDateGroupCalcFunctionApplicable("date-year-start"),
                action: () => createDateValueChartWithPeriod("date-year-start")
            }
        ];

        contextMenu.addMenuItems(cell, [{
            section: "Create",
            text: "Create",
            id: "create-visualisation",
            submenu: [
                {
                    text: "Chart",
                    id: "create-visualisation-date-value-chart",
                    visible: () => dataGridCellSelection.areMultipleCellsSelected(),
                    action: () => createDateValueChartWithPeriod(
                        getExistingDateGroupCalcFunction() ?? "date-day-start"
                    ),

                    // Selected columns holding no dates make an all-time chart, with no period to
                    // choose.  The renderer drops an item whose submenu is all hidden, so there is
                    // none rather than one of hidden items.
                    get submenu() {

                        return hasDetectedDateColumn() ? datePeriodMenuItems : undefined;
                    }
                },
                {
                    text: "Word Cloud",
                    id: "create-visualisation-word-cloud",
                    visible: () => dataGridCellSelection.areMultipleCellsSelected(),
                    action: () => {

                        if (dataGridCellSelection.selectionType() === "column") {

                            Ren.CreateWordCloudCreator.createColumnBasedWordCloud(
                                visualisation,
                                dataGridCellSelection
                            );
                        }
                        else {

                            createAdHocVisualisation("WordCloud", dataGridGuid, null);
                        }
                    }
                },
                {
                    text: "Grid",
                    id: "create-visualisation-grid",
                    visible: () => dataGridCellSelection.areMultipleCellsSelected(),
                    action: () => {

                        createAdHocVisualisation("GridSet", dataGridGuid, null);
                    }
                },
                {
                    text: "Key/Value Grid",
                    id: "create-visualisation-key-value-grid",
                    visible: () => dataGridCellSelection.areMultipleCellsSelected(),
                    action: () => {

                        createAdHocVisualisation("KeyValueGrid", dataGridGuid, null);
                    }
                },
                {
                    text: "Filter Module",
                    id: "create-visualisation-filter-module",
                    action: () => {

                        Ren.CreateFilterModuleCreator.createFilterModule(visualisation);
                    }
                },
                {
                    text: "Tabbed Module",
                    id: "create-visualisation-tabbed-module",
                    action: () => {

                        // Open the module's popup at the point the menu was right-clicked.
                        const clickPosition = Ren.LastRightClickPosition;

                        Ren.VisualisationCreator.createVisualisation({
                            visualisationTypeName: "TabbedModule",
                            title: "Tabbed Module",
                            isPopup: true,
                            fillAvailableSpace: true,
                            clientSide: true,
                            tabbedModuleTabId: visualisation.tabbedModuleTabId ?? null,
                            popupLeft: clickPosition ? clickPosition.x : null,
                            popupTop: clickPosition ? clickPosition.y : null,
                            tabs: [{
                                headerHtml: "<h2>Tab 1</h2>",
                                contentHtml: "",
                                tabContentGuid: Ren.RandomUtils.generateRandomClassName("tab-content")
                            }]
                        });
                    }
                }
            ]
        }]);
    };

    return {
        addCreateVisualisationMenuItems
    };
};
