/**
 * The variations of a popup grid of rows taken from elsewhere, such as a group row's "Extract
 * data": Default, laid out as where the rows were taken from, and All columns, the same but with
 * every column shown.  Both keep the popup's rows to those it was opened with.
 */
Ren.DataGrid_PopupVariations = (() => {

    // The leading "!" sorts Default first and is left out of its label.
    const DEFAULT_VARIATION_NAME = "!Default";
    const ALL_COLUMNS_VARIATION_NAME = "All columns";

    /**
     * Gets the default grid state with every column shown: its columns in its order, any it hides
     * shown, then any it leaves out in data source order.
     */
    const getAllColumnsGridState = (tabularData, defaultGridState) => {

        const gridState = Ren.ObjectUtils.clone(defaultGridState ?? {});
        const columns = gridState.columns ?? [];
        const listedColumns = {};

        for (let index = 0; index < columns.length; index++) {

            delete columns[index].visible;
            listedColumns[columns[index].column] = true;
        }

        for (let index = 0; index < tabularData.ColumnModels.length; index++) {

            const column = tabularData.ColumnModels[index].ColumnIdOrHeading;

            if (!listedColumns[column]) columns.push({ column });
        }

        gridState.columns = columns;

        return gridState;
    };

    /**
     * Gets a copy of a grid state with a column shown, at the position it holds if it has one, or
     * else last.
     */
    const getGridStateWithColumnShown = (gridState, column) => {

        const shownGridState = Ren.ObjectUtils.clone(gridState);
        const columns = shownGridState.columns ?? [];

        for (let index = 0; index < columns.length; index++) {

            if (columns[index].column === column) {

                delete columns[index].visible;

                return shownGridState;
            }
        }

        columns.push({ column });
        shownGridState.columns = columns;

        return shownGridState;
    };

    /**
     * Gets a copy of the default settings, with its own signifier so that it is applied.
     */
    const getAllColumnsSettings = (defaultSettings) => {

        const settings = Ren.ObjectUtils.clone(defaultSettings);

        settings.signifier = Ren.RandomUtils.generateRandomClassName();

        return settings;
    };

    /**
     * Adds the Default and All columns variations to a popup grid, and applies Default.  Default
     * is the given settings and grid state, or the popup's own as they now are where not given,
     * with columnToShow, where given, shown.
     */
    const addVariations = (
        popupSettings,
        tabularData,
        defaultSettings,
        defaultGridState,
        columnToShow
    ) => {

        const settingsGroup = popupSettings.dataGroupingSettingsGroup;
        const visualisation = Ren.VisualisationCollection
            .getVisualisationByVisualisationGuid(popupSettings.visualisationGuid);
        const gridStateGroup = visualisation?.gridStateGroup ?? settingsGroup;
        const popupTabularData =
            Ren.TabularDataPool.getByTabularDataGuid(popupSettings.tabularDataGuid) || tabularData;

        defaultSettings = Ren.ObjectUtils.clone(defaultSettings ??
            Ren.DataGroupingSettingsTransformer.transform(popupTabularData, popupSettings));

        // A settings signifier the grid already has is taken as applied, so each has its own.
        defaultSettings.signifier = Ren.RandomUtils.generateRandomClassName();

        defaultGridState = defaultGridState ??
            Ren.GridStateCollection.getGridStateTransformed(
                gridStateGroup,
                popupSettings.visualisationGuid,
                popupTabularData
            ) ??
            getAllColumnsGridState(popupTabularData, null);

        if (columnToShow) {
            defaultGridState = getGridStateWithColumnShown(defaultGridState, columnToShow);
        }

        const allDataGroupingSettings =
            Ren.ReportSettings_DataGroupingSettingsCollection.allDataGroupingSettings;
        const allGridState = Ren.ReportSettings_GridStateCollection.allGridState;

        allDataGroupingSettings[settingsGroup + "__" + DEFAULT_VARIATION_NAME] = defaultSettings;
        allDataGroupingSettings[settingsGroup + "__" + ALL_COLUMNS_VARIATION_NAME] =
            getAllColumnsSettings(defaultSettings);
        allGridState[gridStateGroup + "__" + DEFAULT_VARIATION_NAME] = defaultGridState;
        allGridState[gridStateGroup + "__" + ALL_COLUMNS_VARIATION_NAME] =
            getAllColumnsGridState(popupTabularData, defaultGridState);

        Ren.Messages.Requests.applyVariation.notify(
            settingsGroup,
            gridStateGroup,
            DEFAULT_VARIATION_NAME,
            popupSettings.containingReportGuid
        );
    };

    /**
     * Gets a filter set holding row filters in the form Ren.QueryParameterFilter carries them, as
     * a pop-out's in place of the popup's own, which can name its rows by indexes the page's data
     * need not share.
     */
    const getRowFiltersFilterSet = (rowFilters) => {

        const accessors = Ren.DataGroupingSettings_Services_FilterAccessors;
        const filterSetParent = {};
        const tab = { Title: rowFilters.tab };
        const columnFilters = rowFilters.columnFilters ?? [];
        const columnValueFilters = {};
        const negatedColumns = [];

        for (let index = 0; index < columnFilters.length; index++) {

            columnValueFilters[columnFilters[index].column] = columnFilters[index].values;

            if (columnFilters[index].isNegated) negatedColumns.push(columnFilters[index].column);
        }

        accessors.setColumnValueFilters(filterSetParent, tab, columnValueFilters);
        accessors.setNegatedFilterColumns(filterSetParent, tab, negatedColumns);
        accessors.setRowFilterPredicates(filterSetParent, tab, rowFilters.predicates ?? []);

        return filterSetParent.filterSet ?? {};
    };

    const getPopOutDataGroupingSettings = (settings, filterSet) => {

        if (!settings) return null;

        settings = Ren.ObjectUtils.clone(settings);
        settings.dataRows ??= {};
        settings.dataRows.filterSet = Ren.ObjectUtils.clone(filterSet);
        settings.signifier = Ren.RandomUtils.generateRandomClassName();

        return settings;
    };

    // The page decides for itself whether to show row and column headings.
    const getPopOutGridState = (gridState) => {

        if (!gridState) return null;

        gridState = Ren.ObjectUtils.clone(gridState);
        delete gridState.showRowAndColumnHeadings;

        return gridState;
    };

    /**
     * Gets a popup grid's settings and grid state as they now are, and its variations, filtered to
     * a pop-out's row filters, as { current, variations }, each { dataGroupingSettings, gridState }
     * and each variation also its name.  popOutDetails names the popup's settings groups and its
     * visualisationGuid.
     */
    const getPopOutSettings = (popOutDetails, tabularData, rowFilters) => {

        const settingsGroup = popOutDetails.dataGroupingSettingsGroup;
        const gridStateGroup = popOutDetails.gridStateGroup ?? settingsGroup;

        if (!settingsGroup) return null;

        const filterSet = getRowFiltersFilterSet(rowFilters);
        const variationNames = [DEFAULT_VARIATION_NAME, ALL_COLUMNS_VARIATION_NAME];
        const variations = [];

        for (let index = 0; index < variationNames.length; index++) {

            const name = variationNames[index];
            const dataGroupingSettings = Ren.ReportSettings_DataGroupingSettingsCollection
                .allDataGroupingSettings[settingsGroup + "__" + name];

            if (!dataGroupingSettings) continue;

            variations.push({
                name,
                dataGroupingSettings: getPopOutDataGroupingSettings(dataGroupingSettings, filterSet),
                gridState: getPopOutGridState(
                    Ren.ReportSettings_GridStateCollection.allGridState[gridStateGroup + "__" + name]
                )
            });
        }

        return {
            current: {
                dataGroupingSettings: getPopOutDataGroupingSettings(
                    Ren.DataGroupingSettingsCollection.getDataGroupingSettingsTransformed(
                        settingsGroup,
                        tabularData,
                        popOutDetails.visualisationGuid
                    ),
                    filterSet
                ),
                gridState: getPopOutGridState(
                    Ren.GridStateCollection.getGridStateTransformed(
                        gridStateGroup,
                        popOutDetails.visualisationGuid,
                        tabularData
                    )
                )
            },
            variations
        };
    };

    /**
     * Gets report settings giving a popped-out grid's settings group the settings and variations
     * the popup had (see getPopOutSettings), for a ".js-ren-report-settings" script element read
     * before the grid is built.
     */
    const getPopOutReportSettings = (settingsGroup, popOutSettings) => {

        const reportSettings = { dataGroupingSettings: {}, gridState: {} };

        const add = (key, settings) => {

            if (settings.dataGroupingSettings) {
                reportSettings.dataGroupingSettings[key] = settings.dataGroupingSettings;
            }

            if (settings.gridState) reportSettings.gridState[key] = settings.gridState;
        };

        if (popOutSettings.current) add(settingsGroup, popOutSettings.current);

        const variations = popOutSettings.variations ?? [];

        for (let index = 0; index < variations.length; index++) {
            add(settingsGroup + "__" + variations[index].name, variations[index]);
        }

        return reportSettings;
    };

    return {
        addVariations,
        getRowFiltersFilterSet,
        getPopOutSettings,
        getPopOutReportSettings
    };
})();
