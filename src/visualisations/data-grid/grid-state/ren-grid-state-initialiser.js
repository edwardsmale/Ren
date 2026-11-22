/**
 * Initialises the grid state when the datagrid is first created.
 */
Ren.GridStateInitialiser = (() => {

    const initialiseGridState = (gridStateGroup, gridStateApplyer, tabs, tabIndex) => {

        const reportSettings = Ren.ReportSettingsReader.readReportSettingsFromPage();

        const initialGridState = Ren.GridState_Initial.getInitialGridState(
            gridStateGroup,
            reportSettings,
            tabs,
            tabIndex
        );

        if (initialGridState) {
            gridStateApplyer.applyDeserializedGridState(initialGridState);
        }
    };

    return {
        initialiseGridState
    };
})();
