/**
 * Adds the report settings name to the URL query string.
 */
Ren.ReportSettingsUrlParameters = (() => {

    /**
     * Updates the settings parameters in the URL to name the settings now on the page.  The
     * report's default and preset settings leave both parameters out, unless the report has a
     * __Default user settings file: on the Reporting server a URL naming no settings loads that,
     * so the preset settings keep "isPreset=true" for a page reload not to swap it in for them.
     */
    const updateReportSettingsNameInQueryString = (settingsName, isPreset, isDefault) => {

        let url = location.href;

        if (settingsName) {
            url = Ren.UrlUtils.upsertQueryParameter(url, "settingsName", settingsName);
        }
        else {

            url = Ren.UrlUtils.removeQueryParameter(url, "settingsName");
        }

        if (isPreset === false) {
            url = Ren.UrlUtils.upsertQueryParameter(url, "isPreset", "false");
        }
        else if (
            !settingsName &&
            !isDefault &&
            !Ren.UrlContext.onEditorPage() &&
            Ren.ReportSettingsFilesList.defaultUserSettingsFileExists()
        ) {

            url = Ren.UrlUtils.upsertQueryParameter(url, "isPreset", "true");
        }
        else {

            url = Ren.UrlUtils.removeQueryParameter(url, "isPreset");
        }

        // Update the URL in the address bar without reloading the page.
        window.history.replaceState({}, "", url);
    };

    const removeReportSettingsNameFromQueryString = () => {

        let url = location.href;

        url = Ren.UrlUtils.removeQueryParameter(url, "settingsName");
        url = Ren.UrlUtils.removeQueryParameter(url, "isPreset");

        // Update the URL in the address bar without reloading the page.
        window.history.replaceState({}, "", url);
    };

    /**
     * Gets the report settings name from the URL query string.
     */
    const getReportSettingsNameFromQueryString = (url) => {

        url = url || window.location.href;

        return Ren.UrlUtils.getParameterValue(url, "settingsName");
    };

    /**
     * Gets a value indicating whether the URL names no settings, so the page opened with the
     * report's default settings.
     */
    const urlNamesNoSettings = () => {

        const url = window.location.href;

        return Ren.UrlUtils.getParameterValue(url, "settingsName") == null &&
            Ren.UrlUtils.getParameterValue(url, "isPreset") == null;
    };

    const getReportSettingsIsPresetFromQueryString = (url) => {

        url = url || window.location.href;

        const value = Ren.UrlUtils.getParameterValue(url, "isPreset");

        if (value == null) return true; // Default to true if not specified.

        return Ren.TextUtils.convertStringToBoolean(value);
    };

    Ren.Messages.Events.reportSettingsFileListChanged.handle(() => {

        // Use onCondition to wait until the report settings files list fetch request has completed
        // before checking for the settings file's existence.
        Ren.MessageBus_Conditions.onCondition(
            () => Ren.ReportSettingsFilesList.allReportSettingsFileDetails[0] !== "PENDING",
            () => {

                // If the query parameters point to a non-existent settings file (which can happen
                // after a the user deletes a settings file), remove the settings name parameters.

                const settingsName = getReportSettingsNameFromQueryString();

                if (!Ren.ReportSettingsFilesList.settingsFileExists(settingsName)) {

                    updateReportSettingsNameInQueryString(null, true, true);
                }
            },
            true
        );
    });

    return {
        updateReportSettingsNameInQueryString,
        removeReportSettingsNameFromQueryString,
        getReportSettingsNameFromQueryString,
        getReportSettingsIsPresetFromQueryString,
        urlNamesNoSettings
    };
})();
