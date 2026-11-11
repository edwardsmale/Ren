Ren.ReportSerializer = (() => {

    const settingsVersion = "Fox"; // Animals in alphabetical order.

    /**
     * Gets a value indicating whether a variation key's settings group is used only by
     * visualisations that are excluded from serialization.
     */
    const isUnsavedGridsVariation = (key, visualisations) => {

        const settingsGroup = Ren.TextUtils.getTextBeforeDoubleUnderscore(key);
        let isUsedByUnsaved = false;

        for (let index = 0; index < visualisations.length; index++) {

            const vis = visualisations[index];

            if (vis.dataGroupingSettingsGroup !== settingsGroup &&
                vis.gridStateGroup !== settingsGroup) {

                continue;
            }

            if (!vis.excludeFromSerialization) return false;

            isUsedByUnsaved = true;
        }

        return isUsedByUnsaved;
    };

    /**
     * Gets a value indicating whether the settings with the passed key should be serialized.
     */
    const shouldSettingsKeyBeSerialized = (key) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        // Variations are kept whether or not a grid shows them, except those of grids, such as
        // popups, that are not saved.
        if (key.includes("__")) {
            return !isUnsavedGridsVariation(key, visualisations);
        }

        return visualisations.some(vis => {

            if (vis.excludeFromSerialization) return false;

            if (vis.dataGroupingSettingsGroup === key || vis.gridStateGroup === key) return true;

            if (vis.filterGroup === key) return true;

            if (vis.visualisationTypeName === "GridSet" && vis.instance?.dataGroupingSettings) {

                const isGridSettingsGroup = vis.instance.dataGroupingSettings.some(
                    dgs => dgs.dataGroupingSettingsGroup === key
                );

                if (isGridSettingsGroup) return true;
            }

            if (vis.visualisationTypeName === "GridSet" && vis.instance?.gridState) {
                return vis.instance.gridState.some(gs => gs.gridStateGroup === key);
            }

            return false;
        });
    };

    /**
     * Sets the settings of each filterGroup that no grid owns to just its filters as they stand on
     * the page, as nothing renders the rest.
     */
    const setFilterGroupOnlySettings = (allDataGroupingSettings, visualisations) => {

        const entries = Ren.DataGroupingSettingsCollection.entries;

        for (let i = 0; i < entries.length; i++) {

            const settings = entries[i];

            if (!settings.isFilterGroupOnly || settings.isDestroyed) continue;

            const settingsGroup = settings.dataGroupingSettingsGroup;
            const visualisation = visualisations.find(
                vis => vis.filterGroup === settingsGroup && !vis.excludeFromSerialization
            );

            if (!visualisation) continue;

            allDataGroupingSettings[settingsGroup] = {};

            if (!settings.dataRows?.filterSet) continue;

            const tabularData =
                Ren.DataSources.cloneTabularDataAndApplyTransformationsForVisualisation(
                    visualisation
                );

            if (tabularData == null) continue;

            const filterSet = Ren.DataGroupingSettingsTransformer.transform(tabularData, settings)
                .dataRows?.filterSet;

            if (filterSet) allDataGroupingSettings[settingsGroup].dataRows = { filterSet };
        }
    };

    /**
     * Merges the settings from the collection into the settings object, if the settings key is not
     * already present and qualifies for serialization.
     */
    const mergeSettings = (settings, collection) => {

        for (const key in collection) {

            const setting = collection[key];

            if (settings[key] && Object.keys(settings[key]).length > 0) {

                continue;
            }

            settings[key] = setting;
        }
    };

    /**
     * Removes from the settings object any keys that do not correspond to a current visualisation's
     * settings group, preventing stale or orphaned groups from accumulating across saves.
     */
    const removeNonSerializableKeys = (settings) => {

        const keysToCheck = Object.keys(settings);

        for (let i = 0; i < keysToCheck.length; i++) {

            if (!shouldSettingsKeyBeSerialized(keysToCheck[i])) delete settings[keysToCheck[i]];
        }
    };

    /**
     * Generates an object containing the transformed data grouping settings and grid state for all
     * visualisations that qualify for serialization.
     */
    const getReportSettings = () => {

        const reportSettings = {

            settingsVersion
        };

        // The currently-active settings go in first, taking precedence over the collections'.
        const visualisations = Ren.VisualisationCollection.getVisualisations();
        reportSettings.dataGroupingSettings = Ren.DataGroupingSettingsTransformer_All.transform(visualisations);
        reportSettings.gridState = Ren.GridStateTransformer_All.transform(visualisations);

        mergeSettings(
            reportSettings.dataGroupingSettings,
            Ren.ReportSettings_DataGroupingSettingsCollection.allDataGroupingSettings
        );

        mergeSettings(
            reportSettings.gridState,
            Ren.ReportSettings_GridStateCollection.allGridState
        );

        setFilterGroupOnlySettings(reportSettings.dataGroupingSettings, visualisations);

        if (Ren.GlobalReportSettingsCollection) {

            const globalSettings = Ren.GlobalReportSettingsCollection.getAllGlobalSettings();
            Object.assign(reportSettings, globalSettings);
        }

        removeNonSerializableKeys(reportSettings.dataGroupingSettings);
        removeNonSerializableKeys(reportSettings.gridState);

        Ren.PageHooks.settingsSerialised(reportSettings, visualisations);

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover.removeDuplicateQueryEmbeddings(
            reportSettings
        );

        const uploadedFilesGroups = Ren.UploadedFilesGroupsCollection.getSettingsForSerialization();

        if (Object.keys(uploadedFilesGroups).length) {
            reportSettings.uploadedFilesGroups = uploadedFilesGroups;
        }

        Ren.ObjectUtils.deleteAllEmptyObjects(reportSettings);

        // Sorted to reduce churn, to a depth of 2 so that the children of dataGroupingSettings and
        // gridState are sorted, but not their children.
        return Ren.ObjectUtils.sortKeys(reportSettings, 2, "settingsVersion");
    };

    /**
     * Gets an object containing the settings to serialize to the report settings file or to
     * include in a downloaded report.
     */
    const getReportSettingsObject = (isForDownloadedReport) => {

        const reportSettings = getReportSettings();

        // A visualisation not written as one in its own right (e.g. one declared as markup) still
        // has its settings serialized, its type's persisted properties under
        // visualisationProperties.
        const isSerializedAsVisualisation = (vis) => isForDownloadedReport
            ? !vis.isInsideEmbeddedReport && !vis.excludeFromDownloadedReports
            : vis.clientSide && !vis.isAdHoc && (!vis.doNotSerializeIfPopup || !vis.isInsidePopup);

        const serializableVisualisations =
            Ren.VisualisationCollection.getVisualisationsToSerialize();

        const includedVisualisations = [];
        const excludedVisualisations = [];

        for (let i = 0; i < serializableVisualisations.length; i++) {

            const visualisation = serializableVisualisations[i];

            if (isSerializedAsVisualisation(visualisation)) {
                includedVisualisations.push(visualisation);
            }
            else {

                excludedVisualisations.push(visualisation);
            }
        }

        reportSettings.visualisations = Ren.VisualisationsTransformer.transform(
            isForDownloadedReport,
            includedVisualisations
        );

        const visualisationProperties =
            Ren.VisualisationPropertiesTransformer.transform(excludedVisualisations);

        if (Object.keys(visualisationProperties).length) {
            reportSettings.visualisationProperties = visualisationProperties;
        }

        if (!reportSettings.visualisations.length) delete reportSettings.visualisations;

        // Not written to the settings file since version "Dragonfly".
        delete reportSettings.dataSources;

        return reportSettings;
    };

    /**
     * Serializes the report settings to a JSON string.
     */
    const serializeReportSettings = () => {

        const reportSettings = getReportSettingsObject(false);

        // Filters set while reading the report are left out, keeping only those the report states
        // as its own.  Done here since captured preview settings and downloaded reports keep all.
        if (reportSettings.dataGroupingSettings) {

            reportSettings.dataGroupingSettings = Ren.ReportSettings_IncludedFilters
                .withoutUnmarkedFilters(reportSettings.dataGroupingSettings);

            // A filterGroup's settings hold only filters, so are empty where none was marked.
            Ren.ObjectUtils.deleteAllEmptyObjects(reportSettings.dataGroupingSettings);
        }

        return Ren.JsonUtils.serialize(reportSettings, 4);
    };

    return {
        getReportSettingsObject,
        serializeReportSettings
    };
})();
