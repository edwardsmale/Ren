/**
 * Holds the per-visualisation properties read from the JSON report settings, keyed by the stable
 * visualisation key - the id of the visualisation's <ren-*> element where it has one, and otherwise
 * one derived from it (see Ren.VisualisationPropertiesTransformer.getVisualisationKey).
 * A visualisation declared as markup - a <ren-*> element in a web report's view, or inside another
 * visualisation's HTML such as a filters bar's contents - is rebuilt from that markup on every
 * load, so it is not written to the settings file's "visualisations" list and cannot carry its
 * properties there.  Its type's persistedProperties go in the settings file's
 * "visualisationProperties" section instead, and this collection hands them back to the
 * visualisation as it renders.
 */
Ren.ReportSettings_VisualisationPropertiesCollection = (() => {

    /**
     * The saved properties for every visualisation key seen in the settings read so far.
     */
    const allVisualisationProperties = {};

    /**
     * Merges the visualisation properties from a report settings object into the collection.  A key
     * present in the settings replaces what the collection holds for it, so loading settings in
     * which a property has been changed takes effect rather than being masked by settings loaded
     * earlier.
     */
    const addFromReportSettings = (reportSettings) => {

        const visualisationProperties = reportSettings?.visualisationProperties;

        if (!visualisationProperties) return;

        for (const visualisationKey in visualisationProperties) {

            allVisualisationProperties[visualisationKey] = visualisationProperties[visualisationKey];
        }
    };

    /**
     * Returns the saved properties for a visualisation key, or undefined when it has none.
     */
    const getProperties = (visualisationKey) => allVisualisationProperties[visualisationKey];

    return {
        allVisualisationProperties,
        addFromReportSettings,
        getProperties
    };
})();
