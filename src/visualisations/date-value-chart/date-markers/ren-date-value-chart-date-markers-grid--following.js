/**
 * Keeps the charts that read a dates grid's filter group in step with it: filtering the grid
 * filters their markers, and puts the grid's own tick boxes back in step too (see
 * ren-date-value-chart-date-markers-grid.js).
 */
Ren.DateValueChart_DateMarkersGrid_Following = (() => {

    const followedChartsByGroup = new Map();

    /**
     * Registers a chart to receive filter updates from its date-marker filter group.
     */
    const followChart = (visualisation, props) => {

        const filterGroup = Ren.DateValueChart_DateMarkersGrid_Context
            .getGridSettingsGroup(visualisation);

        let chartsByGuidForGroup = followedChartsByGroup.get(filterGroup);

        if (!chartsByGuidForGroup) {

            chartsByGuidForGroup = new Map();
            followedChartsByGroup.set(filterGroup, chartsByGuidForGroup);
        }

        chartsByGuidForGroup.set(visualisation.visualisationGuid, { visualisation, props });
    };

    Ren.Messages.Events.filterChanged.handle((
        _tabularDataGuid,
        dataGroupingSettingsGroup
    ) => {

        const followedCharts = followedChartsByGroup.get(dataGroupingSettingsGroup);

        if (!followedCharts) return;

        const settings = Ren.DataGroupingSettingsCollection.getDataGroupingSettings(
            dataGroupingSettingsGroup
        );

        if (!settings) return;

        followedCharts.forEach((followed, visualisationGuid) => {

            if (followed.visualisation.isDestroyed) {

                followedCharts.delete(visualisationGuid);
                return;
            }

            Ren.DateValueChart_DateMarkersGrid_FilterSet.setFilterSet(
                followed.visualisation,
                followed.props,
                Ren.DateValueChart_DateMarkersGrid_FilterSet.captureFilterSet(settings)
            );
        });

        const gridId = Ren.DateValueChart_DateMarkersGrid_Context
            .tryGetGridId(dataGroupingSettingsGroup);

        if (gridId !== undefined) {
            Ren.DateValueChart_DateMarkersGrid_Checkboxes.refreshCheckboxes(gridId);
        }
    });

    return {
        followChart
    };
})();
