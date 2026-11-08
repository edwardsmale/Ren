/**
 * Report settings variations: a set of settings applied to a datagrid by clicking a variation above
 * it, defined in the report settings JSON under "<group name>__<variation name>".  A variation can
 * exist for the dataGroupingSettings, for the gridState, or for both.
 */
Ren.ReportSettings_Variations = (() => {

    const addVariationsFromSettings = (allSettings, groupName, variations, settingsType) => {

        for (const key in allSettings) {

            if (!key.includes("__")) continue;

            const group = Ren.TextUtils.getTextBeforeDoubleUnderscore(key);

            if (group !== groupName) continue;

            const settings = allSettings[key];

            // Older settings can hold a variation key with nothing behind it, which is not a
            // variation.
            if (!settings) continue;

            const variationName = Ren.TextUtils.getTextAfterDoubleUnderscore(key);

            const variation = {

                variationName
            };

            variation["has" + Ren.TextUtils.makeFirstCharUpperCase(settingsType)] = true;

            if (!variation.variationLabel) {

                if (settings.variationLabel) {
                    variation.variationLabel = settings.variationLabel;
                }
                else {

                    variation.variationLabel = variationName
                        .replace(/^!+/, "")
                        .replace(/^Ω+/, "");
                }
            }

            if (!variation.variationTooltip) {

                variation.variationTooltip = settings.variationTooltip ||
                    "Apply '" + variation.variationLabel + "' settings";
            }

            variation.className = settings.variationClassName;

            if (variations[variationName]) {

                Ren.ObjectUtils.mergeObject(variation, variations[variationName]);
            }
            else {

                variations[variationName] = variation;
            }
        }
    };

    const addGridStateVariations = (gridStateGroup, variations) => {

        addVariationsFromSettings(
            Ren.ReportSettings_GridStateCollection.allGridState,
            gridStateGroup,
            variations,
            "gridState"
        );
    };

    const addDataGroupingSettingsVariations = (dataGroupingSettingsGroup, variations) => {

        addVariationsFromSettings(
            Ren.ReportSettings_DataGroupingSettingsCollection.allDataGroupingSettings,
            dataGroupingSettingsGroup,
            variations,
            "dataGroupingSettings"
        );
    };

    /**
     * Gets the variations sorted by name.  Leading exclamation marks on a variation name move it to
     * the start of the list, leading Ω characters to the end.
     */
    const getSortedVariations = (variations) => {

        const allVariations = Object.values(variations);

        Ren.ArrayUtils.sortAuto(allVariations, v => v.variationName, false);

        return allVariations;
    };

    /**
     * Gets the variations that exist for a data grouping settings group and a grid state group.
     */
    const getVariations = (dataGroupingSettingsGroup, gridStateGroup) => {

        const variations = {};

        addGridStateVariations(gridStateGroup, variations);
        addDataGroupingSettingsVariations(dataGroupingSettingsGroup, variations);

        return getSortedVariations(variations);
    };

    const getVariation = (dataGroupingSettingsGroup, gridStateGroup, variationName) => {

        const variations = getVariations(dataGroupingSettingsGroup, gridStateGroup);

        return variations.find(variation => variation.variationName === variationName) || null;
    };

    const removeVariationFromSettings = (settings, settingsGroup, variationName) => {

        const settingsKeys = Object.keys(settings);

        for (let i = 0; i < settingsKeys.length; i++) {

            const key = settingsKeys[i];

            if (key.startsWith(settingsGroup + "__") && key.endsWith("__" + variationName)) {

                delete settings[key];
            }
        }
    };

    const removeVariation = (dataGroupingSettingsGroup, gridStateGroup, variationName) => {

        const dataGroupingSettings = Ren.ReportSettings_DataGroupingSettingsCollection.allDataGroupingSettings;
        removeVariationFromSettings(dataGroupingSettings, dataGroupingSettingsGroup, variationName);

        const gridState = Ren.ReportSettings_GridStateCollection.allGridState;
        removeVariationFromSettings(gridState, gridStateGroup, variationName);

        // The reader's persistent settings too, or the next page read re-adds the deleted
        // variation back into the collections above.
        Ren.ReportSettingsReader.removeVariation(
            dataGroupingSettingsGroup,
            gridStateGroup,
            variationName
        );
    };

    Ren.Messages.Requests.removeVariation.handle((dataGroupingSettingsGroup, gridStateGroup, variationName) => {

        removeVariation(dataGroupingSettingsGroup, gridStateGroup, variationName);
        Ren.Messages.Events.variationsChanged.notify();
    });

    const createOrUpdateVariation = (dataGroupingSettingsGroup, gridStateGroup, variationName, visualisationGuid) => {

        const visualisation = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(visualisationGuid);

        const transformedDataGroupingSettings = Ren.DataGroupingSettingsTransformer_All.transform([visualisation])[dataGroupingSettingsGroup];
        const transformedGridState = Ren.GridStateTransformer_All.transform([visualisation])[gridStateGroup];

        removeVariation(dataGroupingSettingsGroup, gridStateGroup, variationName);

        // Only the parts that transformed to something are written, as a key holding nothing is
        // still a variation key and everything reading one expects settings behind it.

        if (transformedDataGroupingSettings) {

            const dataGroupingSettingsKey = dataGroupingSettingsGroup + "__" + variationName;

            Ren.ReportSettings_DataGroupingSettingsCollection
                .allDataGroupingSettings[dataGroupingSettingsKey] = transformedDataGroupingSettings;
        }

        if (transformedGridState) {

            const gridStateKey = gridStateGroup + "__" + variationName;
            Ren.ReportSettings_GridStateCollection.allGridState[gridStateKey] = transformedGridState;
        }
    };

    Ren.Messages.Requests.createOrUpdateVariation.handle((dataGroupingSettingsGroup, gridStateGroup, variationName, visualisationGuid) => {

        createOrUpdateVariation(dataGroupingSettingsGroup, gridStateGroup, variationName, visualisationGuid);
        Ren.Messages.Events.variationsChanged.notify();
    });

    /**
     * Applies the data grouping settings and grid state from the specified variation.  A settings
     * group is the same literal in every open instance of a report, so it is applied only to the
     * context whose link was clicked; a null containingReportGuid applies it to every context.
     */
    const applyVariation = (
        dataGroupingSettingsGroup, gridStateGroup, variationName, containingReportGuid) => {

        const dataGroupingSettings = Ren.ReportSettings_DataGroupingSettingsCollection
            .getClonedDataGroupingSettings(dataGroupingSettingsGroup, variationName);

        if (dataGroupingSettings) {

            Ren.Messages.Requests.applyDeserialisedDataGroupingSettings.notify(
                dataGroupingSettings,
                containingReportGuid
            );
        }

        const gridState = Ren.ReportSettings_GridStateCollection
            .getClonedGridState(gridStateGroup, variationName);

        if (gridState) {

            Ren.Messages.Requests.applyDeserialisedGridState.notify(
                gridState,
                containingReportGuid
            );
        }
    };

    Ren.Messages.Requests.applyVariation.handle((
        dataGroupingSettingsGroup, gridStateGroup, variationName, containingReportGuid) => {

        applyVariation(
            dataGroupingSettingsGroup,
            gridStateGroup,
            variationName,
            containingReportGuid
        );

        Ren.Messages.Events.variationsChanged.notify();
    });

    return {
        getVariations,
        getVariation,
        removeVariation,
        createOrUpdateVariation,
        applyVariation
    };
})();
