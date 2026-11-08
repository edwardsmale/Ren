/**
 * Provides a unique settings group string for visualisations that are created as offspring of a
 * parent visualisation (i.e. are begotten).  For example, the chart that is begotten by a grid.
 */
Ren.BegottenVisualisationSettingsGroupProvider = (() => {

    const getSettingsGroupName = (stem, counter) => {

        if (counter === 1) {
            return stem;
        }
        else {

            return stem + " -> #" + counter;
        }
    };

    const getSettingsGroup = (parentVisualisation, additionalKeys) => {

        let key = "";

        if (parentVisualisation.dataGroupingSettingsGroup) {
            key += parentVisualisation.dataGroupingSettingsGroup + " -|- ";
        }

        key += parentVisualisation.visualisationTypeName;

        if (additionalKeys) {

            additionalKeys = Ren.ArrayUtils.ensureArray(additionalKeys);
            key += " -|- " + additionalKeys.join(" -|- ");
        }

        let counter = 1;

        while (true) {

            const settingsGroup = getSettingsGroupName(key, counter);

            const isUsed = Ren.VisualisationCollection.hasVisualisationUsingSettingsGroup(
                settingsGroup,
                vis => vis.dataGroupingSettingsGroup
            );

            if (!isUsed) return settingsGroup;

            counter++;
        }
    };

    return {
        getSettingsGroup
    };
})();
