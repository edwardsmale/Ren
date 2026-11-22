/**
 * Transforms visualisation settings for the visualisation settings debug window.
 */
Ren.VisualisationSettingsDebugTransformer = () => {

    const transform = (settings) => {

        let transformedSettings = JSON.parse(Ren.JsonUtils.serializeForDebug(settings) || "null");

        // Remove the instance property because it contains all of the data in the visualisation.
        Ren.ObjectUtils.recursivelyRemoveProperty(transformedSettings, "instance");

        if (transformedSettings.includeAllTabs === false) {

            delete transformedSettings.includeAllTabs;
        }

        transformedSettings = Ren.ObjectUtils.sortKeys(transformedSettings);

        return transformedSettings;
    };

    return {
        transform
    };
};
