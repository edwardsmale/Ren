Ren.VisualisationDefaultSettingsGroups = (() => {

    /**
     * Populates the visualisation's gridStateGroup and dataGroupingSettingsGroup properties with
     * default settings groups if these values are not specified in the report settings.
     */
    const setDefaultSettingsGroups = (visualisation) => {

        const tabularDataSet = Ren.DataSources.getTabularDataSet(visualisation.dataSourceUri);

        const defaultSettingsGroup = Ren.DefaultSettingsGroupGenerator.getDefaultSettingsGroup(
            tabularDataSet,
            visualisation
        );

        visualisation.gridStateGroup = visualisation.gridStateGroup || defaultSettingsGroup;
        visualisation.dataGroupingSettingsGroup = visualisation.dataGroupingSettingsGroup || defaultSettingsGroup;

        // By default a visualisation's filterGroup is its dataGroupingSettingsGroup, so
        // visualisations that already share data grouping settings also share filters.  A
        // visualisation whose dataGroupingSettingsGroup is deliberately distinct (e.g. a date/value
        // chart begotten from a grid, which keeps its own groupings) can set filterGroup explicitly
        // to the source grid's group so that column value filters still propagate to it.
        visualisation.filterGroup = visualisation.filterGroup || visualisation.dataGroupingSettingsGroup;

        // By default, visualisation settings are shared among visualisations of the same type.
        visualisation.visualisationSettingsGroup = visualisation.visualisationSettingsGroup || visualisation.visualisationTypeName + "-None";
    };

    return {
        setDefaultSettingsGroups
    };
})();
