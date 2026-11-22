Ren.LoadSaveReportSettingsWindow_Data = (() => {

    const createReportSettingsFilesDataSource = () => {

        const dataSourceUri = "report-settings-files";

        const settingsFilesDetails = Ren.ReportSettingsFilesList.allReportSettingsFileDetails;

        const currentSettingsName = Ren.ReportSettingsUrlParameters.getReportSettingsNameFromQueryString();
        const currentSettingsIsPreset = Ren.ReportSettingsUrlParameters.getReportSettingsIsPresetFromQueryString();
        const urlNamesNoSettings = Ren.ReportSettingsUrlParameters.urlNamesNoSettings();

        settingsFilesDetails.forEach(fileDetails => {

            const namesMatch = fileDetails.Name === currentSettingsName ||
                (fileDetails.Name === null && currentSettingsName === null);

            // A URL naming no settings loads the __Default user settings on the Reporting server,
            // which the server marks, rather than the preset settings.
            const isCurrent = urlNamesNoSettings ?
                fileDetails.IsLoadedByDefault :
                namesMatch && fileDetails.IsPreset === currentSettingsIsPreset;

            Ren.ObjectUtils.insertKeyAtStart(fileDetails, " ", isCurrent);
        });

        const result = Ren.DataSources_ProduceDataSource.produceDataSourceFromArrayOfObjects(
            settingsFilesDetails,
            dataSourceUri,
            "Report Settings Files"
        );

        return result ? dataSourceUri : null; // Returns null if there are no data.
    };

    return {
        createReportSettingsFilesDataSource
    };
})();
