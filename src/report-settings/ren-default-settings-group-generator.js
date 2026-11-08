Ren.DefaultSettingsGroupGenerator = (() => {

    let adHocCounter = 1;

    const reset = () => {

        adHocCounter = 1;
    };

    const getAdHocSqlFilename = () => "Ad hoc data " + adHocCounter++;

    const isAdHocSettingsGroup = (settingsGroup) => {

        return settingsGroup && settingsGroup.startsWith("Ad hoc");
    };

    /**
     * Gets the instance number of this visualisation amongst those of the same type and SQL
     * filename in the same report context.  Scoped to the report context, as a global count gave a
     * popup report opened twice settings group names its settings file's keys did not match.
     */
    const getReportContextScopedTypeCount = (visualisation) => {

        // Cached, so that a re-rendered deferred visualisation keeps the same count.
        if (visualisation.contextScopedTypeCount) {
            return visualisation.contextScopedTypeCount;
        }

        const reportContextGuid = visualisation.reportContext?.reportContextGuid;

        const allVisualisations = Ren.VisualisationCollection.getVisualisations();

        let maxCount = 0;

        for (let i = 0; i < allVisualisations.length; i++) {

            const otherVisualisation = allVisualisations[i];

            if (otherVisualisation === visualisation) continue;
            if (!otherVisualisation.contextScopedTypeCount) continue;
            if (otherVisualisation.visualisationTypeName !== visualisation.visualisationTypeName) continue;
            if (otherVisualisation.sqlFilename !== visualisation.sqlFilename) continue;
            if (otherVisualisation.reportContext?.reportContextGuid !== reportContextGuid) continue;

            // A grid scanified inside a closed popup report can linger in the collection with a
            // detached element, and would wrongly bump this one's count.
            if (!otherVisualisation.element?.isConnected) continue;

            if (otherVisualisation.contextScopedTypeCount > maxCount) {
                maxCount = otherVisualisation.contextScopedTypeCount;
            }
        }

        visualisation.contextScopedTypeCount = maxCount + 1;

        return visualisation.contextScopedTypeCount;
    };

    /**
     * Gets the "<sql filename>[ <type count>]" a settings group starts with.
     */
    const getSettingsGroupStart = (tabularDataSet, visualisation) => {

        let start = tabularDataSet?.SqlFilename ?? getAdHocSqlFilename();

        const visualisationTypeCount = getReportContextScopedTypeCount(visualisation);

        if (visualisationTypeCount > 1) {
            start += " " + visualisationTypeCount;
        }

        return start;
    };

    /**
     * Gets a base settings group for gridset or tabular data settings, which report settings files
     * are keyed by, so a mismatched key is silently never read.  Composed as
     * "<sql filename>[ <type count>][ <tab>]"; an ordinary grid defaults to dataTabIndexes [1], so
     * its group ends " 1", while an include-all-tabs grid's has no tab.
     */
    const getSettingsGroup = (start, visualisation) => {

        if (visualisation.dataTabGroup) {

            return start + " " + visualisation.dataTabGroup;
        }
        else if (visualisation.dataTabIndexes) {

            return start + " " + visualisation.dataTabIndexes.join(",");
        }
        else if (visualisation.dataTabIndex) {

            return start + " " + visualisation.dataTabIndex;
        }
        else {

            return start;
        }
    };

    /**
     * Gets the groups a grid's settings were saved under if its tabs were chosen differently then:
     * an include-all-tabs grid set keeps its first tab's settings under its bare group and a later
     * tab's under "[n]", whereas a grid of chosen tabs has them listed after its group.
     */
    const getAlternativeSettingsGroups = (start, visualisation) => {

        if (visualisation.dataTabGroup) return [];

        const dataTabIndexes = Array.isArray(visualisation.dataTabIndexes) ?
            visualisation.dataTabIndexes :
            visualisation.dataTabIndex ? [visualisation.dataTabIndex] : null;

        if (!dataTabIndexes?.length) return [start + " 1"];

        const firstDataTabIndex = dataTabIndexes[0];

        const alternatives = [
            firstDataTabIndex === 1 ? start : start + "[" + (firstDataTabIndex - 1) + "]"
        ];

        if (dataTabIndexes.length > 1) alternatives.push(start + " " + firstDataTabIndex);

        return alternatives;
    };

    const hasSavedSettings = (settingsGroup) => {

        return Ren.ReportSettings_DataGroupingSettingsCollection
            .hasDataGroupingSettings(settingsGroup) ||
            Ren.ReportSettings_GridStateCollection.hasGridState(settingsGroup);
    };

    /**
     * Gets a string to use as a default group name for gridset or tabular data settings.  Where
     * nothing is saved under it, the group settings were saved under before the grid's tabs
     * attributes were changed is used instead, so that changing them does not lose the settings.
     */
    const getDefaultSettingsGroup = (tabularDataSet, visualisation) => {

        const start = getSettingsGroupStart(tabularDataSet, visualisation);

        let settingsGroup = getSettingsGroup(start, visualisation);

        if (!visualisation.reportContext) return settingsGroup; // e.g. DataSource visualisation

        const usedDefaultSettingsGroupCounts =
            visualisation.reportContext.usedDefaultSettingsGroupCounts ?? new Map();

        const prefix = visualisation.isInsidePopup || visualisation.isInsideEmbeddedReport ?
            visualisation.reportContext.reportContextGuid + " " :
            "";

        settingsGroup = prefix + settingsGroup;

        if (!hasSavedSettings(settingsGroup)) {

            const alternatives = getAlternativeSettingsGroups(start, visualisation);

            for (let i = 0; i < alternatives.length; i++) {

                const alternative = prefix + alternatives[i];

                // Another grid on the page may still be using it.
                if (usedDefaultSettingsGroupCounts.has(alternative)) continue;
                if (!hasSavedSettings(alternative)) continue;

                settingsGroup = alternative;
                break;
            }
        }

        const count = usedDefaultSettingsGroupCounts.get(settingsGroup) || 0;

        usedDefaultSettingsGroupCounts.set(settingsGroup, count + 1);

        if (count > 0) settingsGroup = settingsGroup + "[" + count + "]";

        return settingsGroup;
    };

    return {
        getDefaultSettingsGroup,
        getReportContextScopedTypeCount,
        isAdHocSettingsGroup,
        reset
    };
})();
