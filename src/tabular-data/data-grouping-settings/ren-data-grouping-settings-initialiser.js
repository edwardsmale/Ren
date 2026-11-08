/**
 * Initialises data grouping settings for a visualisation based on report settings.
 */
Ren.DataGroupingSettingsInitialiser = (() => {

    const initialiseDataGroupingSettings = (
        visualisation,
        dataGroupingSettingsApplyer,
        dataGroupingSettingsGroup,
        tabs,
        tabIndex) => {

        const reportSettings = Ren.ReportSettingsReader.readReportSettingsFromPage();

        const initialDataGroupingSettings = Ren.DataGroupingSettings_Initial.getInitialDataGroupingSettings(
            dataGroupingSettingsGroup ?? visualisation.dataGroupingSettingsGroup,
            reportSettings,
            tabs,
            tabIndex
        );

        // A visualisation that does its own grouping (e.g. a date/value chart, which bins by date)
        // wants the data rows, so where it has no settings of its own the SQL's ---GroupBy
        // directives must not group them into group rows on its behalf.
        dataGroupingSettingsApplyer.applyDataGroupingSettings(
            initialDataGroupingSettings,
            { ignoreSqlGroupByDirectives: visualisation.ignoreSqlGroupByDirectives === true }
        );
    };

    return {
        initialiseDataGroupingSettings
    };
})();
