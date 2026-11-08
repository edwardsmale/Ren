/**
 * Applies uploaded files group settings to the visualisations that belong to a group, re-fetching
 * them with the group's current uploaded files.
 */
Ren.UploadedFilesModuleUpdater = (() => {

    /**
     * Gets the data-bearing visualisations of an uploaded files group, excluding the modules.
     */
    const getTargetVisualisations = (group) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();
        const targets = [];

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (visualisation.uploadedFilesGroup !== group) continue;
            if (visualisation.visualisationTypeName === "UploadedFilesModule") continue;

            targets.push(visualisation);
        }

        return targets;
    };

    /**
     * Re-fetches every visualisation in a group with the group's current uploaded files settings.
     */
    const applyGroupToTargetVisualisations = (group) => {

        if (!group) return;

        const settings = Ren.UploadedFilesGroupsCollection.getGroupSettings(group);
        const targets = getTargetVisualisations(group);

        for (let i = 0; i < targets.length; i++) {

            const target = targets[i];

            if (!target.dataSourceUri) continue;

            const newDataSourceUri = Ren.DataSourcesUploadedFiles.applyGroupSettingsToUri(
                target.dataSourceUri,
                settings
            );

            if (newDataSourceUri === target.dataSourceUri) continue; // Nothing changed.

            // Keep the stored data source parameters in step so any later URI re-resolution
            // preserves the group's uploaded files.
            target.dataSourceUriParameters ??= {};
            Ren.DataSourcesUploadedFiles.applyGroupSettingsToParameters(
                target.dataSourceUriParameters,
                settings
            );

            // The visualisation renders once the new data source loads, or straight away where it
            // is already loaded.
            target.recreate(newDataSourceUri);
            Ren.DataSources.requestDataSource(newDataSourceUri);
        }
    };

    /**
     * Gets the uploaded files group that owns the visualisation with the given data source URI, or
     * null.
     */
    const findGroupForDataSourceUri = (dataSourceUri) => {

        const sortedUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);
        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < visualisations.length; index++) {

            const visualisation = visualisations[index];

            if (!visualisation.uploadedFilesGroup) continue;
            if (!visualisation.dataSourceUri) continue;

            const visualisationUri =
                Ren.UrlUtils.sortDataSourceUriParameters(visualisation.dataSourceUri);

            if (visualisationUri === sortedUri) return visualisation.uploadedFilesGroup;
        }

        return null;
    };

    /**
     * Registers the settings a report's SQL declares ('---UploadedFiles:' directives) as a group's
     * declared defaults, so markup defaults and saved report settings still take precedence.
     * Returns true when this changed the group's declared defaults.
     */
    const registerSqlDeclaredDefaults = (group, defaults) => {

        if (!group || !defaults) return false;

        const declaredDefaults = {
            uploadedFiles: defaults.uploadedFiles,
            uploadedFilesDelimiter: defaults.uploadedFilesDelimiter,
            uploadedFilesHaveHeaderRows: normaliseValue(
                "uploadedFilesHaveHeaderRows",
                defaults.uploadedFilesHaveHeaderRows
            )
        };

        const existingDefaults = Ren.UploadedFilesGroupsCollection.getGroupDefaults(group);
        const keys = Object.keys(declaredDefaults);
        let isChanged = false;

        for (let index = 0; index < keys.length; index++) {

            const key = keys[index];
            const value = declaredDefaults[key];

            if (value === undefined || value === null || value === "") continue;

            if (existingDefaults[key] !== value) isChanged = true;
        }

        if (!isChanged) return false;

        Ren.UploadedFilesGroupsCollection.registerGroupDefaults(group, declaredDefaults);

        return true;
    };

    /**
     * Sets a group's declared defaults from a data source response, for a module already on the
     * page when its data arrives.
     */
    const applyUploadedFilesDefaultsFromResponse = (dataSourceUri, tabularDataSetCollection) => {

        const defaults = tabularDataSetCollection?.UploadedFilesDefaults;

        const group = findGroupForDataSourceUri(dataSourceUri);

        if (!defaults) return; // Omitted from the response unless the SQL declared something.

        if (!group) return;

        if (registerSqlDeclaredDefaults(group, defaults)) {

            Ren.Messages.Events.uploadedFilesGroupSettingsChanged.notify(group);
        }
    };

    /**
     * Sets a group's declared defaults from the data its visualisations have already loaded, for a
     * module arriving after its data.  The reliable path, as it doesn't depend on finding the group
     * from a response's URI.  Returns true when a default was registered.
     */
    const applyUploadedFilesDefaultsFromLoadedDataSources = (group) => {

        if (!group) return false;

        const targets = getTargetVisualisations(group);
        let registered = false;

        for (let index = 0; index < targets.length; index++) {

            const target = targets[index];

            if (!target.dataSourceUri) continue;

            const dataSource = Ren.DataSources.getDataSource(target.dataSourceUri);
            const defaults = dataSource?.tabularDataSetCollection?.UploadedFilesDefaults;

            if (registerSqlDeclaredDefaults(group, defaults)) registered = true;
        }

        return registered;
    };

    /**
     * Handles a data source response reporting its uploaded files missing, recording them against
     * the owning group so its module prompts for them.  Returns true for such a response, so the
     * caller skips the normal render, which would fail with no data.
     */
    const tryHandleMissingUploadedFilesResponse = (dataSourceUri, response) => {

        // The property is omitted from every normal response, so parsing is skipped unless present.
        if (!response || response.indexOf("MissingUploadedFiles") === -1) return false;

        let parsed;

        try {
            parsed = Ren.JsonUtils.parse(response);
        }
        catch (error) {

            return false;
        }

        if (!parsed || parsed.MissingUploadedFiles === undefined ||
            parsed.MissingUploadedFiles === null) {

            return false;
        }

        // The report did not run, but its SQL-declared defaults still belong in the module's
        // prompt.
        applyUploadedFilesDefaultsFromResponse(dataSourceUri, parsed);

        const group = findGroupForDataSourceUri(dataSourceUri);

        if (group) {

            Ren.UploadedFilesGroupsCollection.setGroupMissingFiles(
                group,
                parsed.MissingUploadedFiles
            );

            Ren.Messages.Events.uploadedFilesGroupSettingsChanged.notify(group);
        }
        else {

            // With no module to prompt for the files, the visualisation would otherwise stay blank
            // without a word.
            Ren.DataSourceErrorPopup.show(dataSourceUri, {
                error: "The web server can't find (or can't read) these uploaded files:\n\n" +
                    parsed.MissingUploadedFiles.join("\n"),
                details: null,
                sqlThatFailed: null,
                isUserFacing: true
            });
        }

        // TEMPORARY HACK: with no data, everything waiting on this group's files would spin
        // forever, so all loading animations are stripped off the page.  A stop-gap for the
        // NWTTrackingReport, to be replaced with per-visualisation handling when merged with
        // Reporting_FEATUREBRANCH.
        const loadingAnimations = document.querySelectorAll(".ren-visualisation-loading-animation");

        for (let index = 0; index < loadingAnimations.length; index++) {
            loadingAnimations[index].remove();
        }

        return true;
    };

    /**
     * Normalises a setting value before it is stored, so equal values compare equal (the
     * header-rows setting is always stored as a boolean).
     */
    const normaliseValue = (key, value) => {

        if (key !== "uploadedFilesHaveHeaderRows") return value;

        if (value === undefined || value === null || value === "") return value;

        return Ren.DataSourcesUploadedFiles.booleanToParameterString(value) === "true";
    };

    /**
     * Updates a single uploaded files setting for the module's group, then updates the target
     * visualisations and any modules displaying the group.
     */
    const updateSetting = (visualisation, key, value) => {

        const group = visualisation.uploadedFilesGroup;

        // The user is changing the files, so any previously-reported missing files no longer apply;
        // a fresh request re-reports them if the new files are also missing.
        Ren.UploadedFilesGroupsCollection.clearGroupMissingFiles(group);

        Ren.UploadedFilesGroupsCollection.setGroupSetting(group, key, normaliseValue(key, value));

        applyGroupToTargetVisualisations(group);
        Ren.Messages.Events.uploadedFilesGroupSettingsChanged.notify(group);
    };

    /**
     * Updates several uploaded files settings for the module's group at once, then updates the
     * target visualisations and any modules displaying the group a single time.
     */
    const updateSettings = (visualisation, settings) => {

        const group = visualisation.uploadedFilesGroup;
        const keys = Object.keys(settings);

        Ren.UploadedFilesGroupsCollection.clearGroupMissingFiles(group);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            Ren.UploadedFilesGroupsCollection.setGroupSetting(
                group,
                key,
                normaliseValue(key, settings[key])
            );
        }

        applyGroupToTargetVisualisations(group);
        Ren.Messages.Events.uploadedFilesGroupSettingsChanged.notify(group);
    };

    /**
     * Clears an uploaded files setting for the module's group, reverting it to the group's declared
     * default.
     */
    const clearSetting = (visualisation, key) => {

        updateSetting(visualisation, key, null);
    };

    return {
        applyGroupToTargetVisualisations,
        updateSetting,
        updateSettings,
        clearSetting,
        tryHandleMissingUploadedFilesResponse,
        applyUploadedFilesDefaultsFromResponse,
        applyUploadedFilesDefaultsFromLoadedDataSources
    };
})();
