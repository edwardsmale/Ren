/**
 * Maintains the current settings for each uploaded files group on the page, a group tying together
 * the visualisations that share one set of uploaded files.  A group's settings start out as its
 * markup-declared defaults, then overridden by serialized report settings and by user edits.
 */
Ren.UploadedFilesGroupsCollection = (() => {

    // Mirrors Ren.DataSourcesUploadedFiles.groupSettingKeys, declared locally to avoid depending on
    // bundle load order across folders.
    const settingKeys = [
        "uploadedFiles",
        "uploadedFilesDelimiter",
        "uploadedFilesHaveHeaderRows",
        "uploadedFilesColumnHeadings"
    ];

    const groupSettings = {};

    const groupDefaults = {};

    // The uploaded files each group's data request last reported as missing.  An empty array means
    // the report ran without any uploaded files; no key means nothing is missing.
    const groupMissingFiles = {};

    /**
     * Gets a copy of the passed settings containing only the recognised, populated keys.
     */
    const pickSettings = (settings) => {

        const result = {};

        if (!settings) return result;

        for (let i = 0; i < settingKeys.length; i++) {

            const key = settingKeys[i];
            const value = settings[key];

            if (value !== undefined && value !== null && value !== "") {
                result[key] = value;
            }
        }

        return result;
    };

    /**
     * Registers a module's markup-declared default settings for a group, and initialises the
     * group's settings from them where not already set (e.g. by serialized report settings).
     */
    const registerGroupDefaults = (group, defaults) => {

        if (!group) return;

        // Merged so that several modules sharing a group each contribute their declared defaults.
        groupDefaults[group] = Object.assign({}, groupDefaults[group] || {}, pickSettings(defaults));
        groupSettings[group] ??= {};

        for (let i = 0; i < settingKeys.length; i++) {

            const key = settingKeys[i];

            if (groupSettings[group][key] === undefined && groupDefaults[group][key] !== undefined) {
                groupSettings[group][key] = groupDefaults[group][key];
            }
        }
    };

    /**
     * Gets the effective current settings for a group, falling back to its declared defaults.
     */
    const getGroupSettings = (group) => {

        return Object.assign({}, groupDefaults[group] || {}, groupSettings[group] || {});
    };

    /**
     * Gets a group's declared default settings.
     */
    const getGroupDefaults = (group) => Object.assign({}, groupDefaults[group] || {});

    /**
     * Sets a single uploaded files setting for a group.  A null/empty value falls back to the
     * group's declared default, if any.
     */
    const setGroupSetting = (group, key, value) => {

        if (!group || !settingKeys.includes(key)) return;

        groupSettings[group] ??= {};

        if (value === undefined || value === null || value === "") {

            if (groupDefaults[group] && groupDefaults[group][key] !== undefined) {
                groupSettings[group][key] = groupDefaults[group][key];
            }
            else {

                delete groupSettings[group][key];
            }
        }
        else {

            groupSettings[group][key] = value;
        }
    };

    /**
     * Records the uploaded files a group's data request reported as missing, which the module
     * prompts for in place of the filenames.
     */
    const setGroupMissingFiles = (group, missingFiles) => {

        if (!group) return;

        groupMissingFiles[group] = missingFiles || [];
    };

    /**
     * Clears any recorded missing uploaded files for a group.
     */
    const clearGroupMissingFiles = (group) => {

        if (!group) return;

        delete groupMissingFiles[group];
    };

    /**
     * Gets the uploaded files a group's data request reported as missing, or undefined when none
     * are.
     */
    const getGroupMissingFiles = (group) => groupMissingFiles[group];

    /**
     * Sets several uploaded files settings for a group at once.
     */
    const setGroupSettings = (group, settings) => {

        if (!group || !settings) return;

        for (let i = 0; i < settingKeys.length; i++) {

            const key = settingKeys[i];

            if (settings[key] !== undefined) {
                setGroupSetting(group, key, settings[key]);
            }
        }
    };

    /**
     * Merges the uploaded files group settings from a report settings object without updating any
     * rendered visualisations, for use before the target visualisations have been created.
     */
    const addFromReportSettings = (reportSettings) => {

        const groups = reportSettings?.uploadedFilesGroups;

        if (!groups) return;

        for (const group in groups) {
            setGroupSettings(group, groups[group]);
        }
    };

    /**
     * Applies the uploaded files group settings from a report settings object and updates the
     * rendered visualisations in each group.
     */
    const applyReportSettings = (reportSettings) => {

        const groups = reportSettings?.uploadedFilesGroups;

        if (!groups) return;

        for (const group in groups) {

            setGroupSettings(group, groups[group]);

            Ren.UploadedFilesModuleUpdater.applyGroupToTargetVisualisations(group);
            Ren.Messages.Events.uploadedFilesGroupSettingsChanged.notify(group);
        }
    };

    /**
     * Gets the uploaded files group settings to serialize: those of groups with an uploaded files
     * module on the page, and only where they differ from the group's declared defaults.
     */
    const getSettingsForSerialization = () => {

        const result = {};

        // The uploaded files module is the only module that edits a group's settings.
        const modules = Ren.VisualisationCollection.getVisualisations("UploadedFilesModule");
        const activeGroups = {};

        for (let i = 0; i < modules.length; i++) {

            if (modules[i].uploadedFilesGroup) {
                activeGroups[modules[i].uploadedFilesGroup] = true;
            }
        }

        for (const group in groupSettings) {

            if (!activeGroups[group]) continue;

            const settings = groupSettings[group];
            const defaults = groupDefaults[group] || {};
            const populated = {};

            for (let i = 0; i < settingKeys.length; i++) {

                const key = settingKeys[i];
                const value = settings[key];

                if (value === undefined || value === null || value === "") continue;

                if (value === defaults[key]) continue; // Defaults are re-derived from markup.

                populated[key] = value;
            }

            if (Object.keys(populated).length) {
                result[group] = populated;
            }
        }

        return result;
    };

    return {
        registerGroupDefaults,
        getGroupSettings,
        getGroupDefaults,
        setGroupSetting,
        setGroupSettings,
        setGroupMissingFiles,
        clearGroupMissingFiles,
        getGroupMissingFiles,
        addFromReportSettings,
        applyReportSettings,
        getSettingsForSerialization
    };
})();
