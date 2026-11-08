/**
 * Transforms visualisation properties into report settings for serialization and applies them back
 * when loading.  A markup visualisation is rebuilt from its <ren-*> element on every load, so the
 * properties its type declares in persistedProperties are saved to "visualisationProperties" and
 * applied as it renders.
 */
Ren.VisualisationPropertiesTransformer = (() => {

    /**
     * The visualisations already given their saved properties.  They are applied once, so that a
     * re-render does not undo an unsaved context menu change; loading different report settings
     * applies them again.
     */
    const visualisationsGivenSavedProperties = new WeakSet();

    /**
     * Gets the key a visualisation's properties are stored under.  The GUID is regenerated on every
     * load, so the <ren-*> element's ID is used where it has one, and otherwise a key built as the
     * default settings groups' are, which survives a reload but not a rearrangement.
     */
    const getVisualisationKey = (visualisation) => {

        if (visualisation.settingsId) return visualisation.settingsId;

        const parts = [];

        // The same type can appear in each of a page's popups and embedded reports.
        if (visualisation.isInsidePopup || visualisation.isInsideEmbeddedReport) {

            const reportContextGuid = visualisation.reportContext?.reportContextGuid;

            if (reportContextGuid) parts.push(reportContextGuid);
        }

        parts.push(visualisation.visualisationTypeName);

        if (visualisation.sqlFilename) parts.push(visualisation.sqlFilename);

        const typeCount =
            Ren.DefaultSettingsGroupGenerator.getReportContextScopedTypeCount(visualisation);

        if (typeCount > 1) parts.push(typeCount);

        return parts.join(" ");
    };

    /**
     * Gets the key a visualisation in a popup or embedded report looks up properties by, from the
     * key they were saved under with the report as a page of its own.  A derived key gains the
     * report context GUID; an element ID is left as it is.
     */
    const getReportContextScopedKey = (visualisationKey, reportContextGuid) => {

        const typeName = visualisationKey.split(" ")[0];

        if (!Ren.VisualisationTypes.getByTypeName(typeName)) return visualisationKey;

        return reportContextGuid + " " + visualisationKey;
    };

    /**
     * Extracts the properties a visualisation's type lists in persistedProperties, and those every
     * type has, each a name or a { name, transform(value, vis) }.  A transform returning undefined
     * omits the property.
     */
    const extractPersistedProperties = (vis) => {

        const visualisationType = Ren.VisualisationTypes.getByTypeName(vis.visualisationTypeName);

        const visProps = {};

        addPersistedProperties(visProps, vis, visualisationType?.persistedProperties);
        addPersistedProperties(visProps, vis, Ren.VisualisationTypes_CommonPersistedProperties);

        return visProps;
    };

    const addPersistedProperties = (visProps, vis, persistedProperties) => {

        if (!persistedProperties) return;

        for (let i = 0; i < persistedProperties.length; i++) {

            const persistedProperty = persistedProperties[i];

            const name = typeof persistedProperty === "string"
                ? persistedProperty
                : persistedProperty.name;

            const value = vis[name];

            if (value === undefined) continue;

            const transformedValue = persistedProperty.transform
                ? persistedProperty.transform(value, vis)
                : value;

            if (transformedValue === undefined) continue;

            visProps[name] = transformedValue;
        }
    };

    /**
     * Gets the persisted properties of the visualisations, keyed by visualisation key, leaving out
     * those with none.
     */
    const transform = (visualisations) => {

        const properties = {};

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            const visProps = extractPersistedProperties(visualisation);

            if (Ren.ObjectUtils.isEmptyObject(visProps)) continue;

            const key = getVisualisationKey(visualisation);

            // Derived keys count their duplicates apart, so only a clash of IDs is warned about.
            if (properties[key] && visualisation.settingsId) {

                console.warn(
                    `[VisualisationPropertiesTransformer] More than one visualisation has the id ` +
                    `'${key}'.  Their saved settings will overwrite one another.`
                );
            }

            properties[key] = visProps;
        }

        return properties;
    };

    /**
     * Gets the saved properties with anything a type states by name, such as an enum key, turned
     * back into the value the visualisation holds, so that the two compare as well as apply.
     */
    const getResolvedProperties = (visualisation, properties) => {

        const visualisationType = Ren.VisualisationTypes.getByTypeName(
            visualisation.visualisationTypeName
        );

        if (!visualisationType?.resolvePersistedProperties) return properties;

        const resolvedProperties = Ren.ObjectUtils.clone(properties);
        visualisationType.resolvePersistedProperties(resolvedProperties);

        return resolvedProperties;
    };

    /**
     * Applies any saved properties to a visualisation as it renders, returning whether that changed
     * it.  isSettingsLoad applies them to one that has already had them.  The values are cloned so
     * that the visualisation's later edits to them don't reach the stored settings.
     */
    const applyToVisualisation = (visualisation, isSettingsLoad) => {

        if (!isSettingsLoad && visualisationsGivenSavedProperties.has(visualisation)) return false;

        visualisationsGivenSavedProperties.add(visualisation);

        const savedProperties = Ren.ReportSettings_VisualisationPropertiesCollection
            .getProperties(getVisualisationKey(visualisation));

        if (!savedProperties) return false;

        const properties = getResolvedProperties(visualisation, savedProperties);
        const names = Object.keys(properties);

        let hasChanged = false;

        for (let i = 0; i < names.length; i++) {

            const name = names[i];

            if (Ren.ObjectUtils.areSame(visualisation[name], properties[name])) continue;

            visualisation[name] = Ren.ObjectUtils.clone(properties[name]);
            hasChanged = true;
        }

        return hasChanged;
    };

    /**
     * Applies the saved properties to the visualisations already on the page when different report
     * settings are loaded, re-rendering those they change.  A report context GUID limits this to
     * the visualisations in that report context.
     */
    const applyToExistingVisualisations = (reportContextGuid) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (reportContextGuid &&
                visualisation.reportContext?.reportContextGuid !== reportContextGuid) {

                continue;
            }

            if (!applyToVisualisation(visualisation, true)) continue;
            if (!visualisation.isRendered) continue;

            visualisation.recreate();
        }
    };

    return {
        getVisualisationKey,
        getReportContextScopedKey,
        transform,
        applyToVisualisation,
        applyToExistingVisualisations
    };
})();
