/**
 * The data and event half of a visualisation's life: which tabular data it is reading, and what it
 * does when the world around it changes.  It knows nothing about drawing, so any renderer can use
 * it.  Every subscription drops itself once the visualisation is destroyed.
 */
Ren.VisualisationLifecycle = (config) => {

    const visualisation = config.visualisation;

    // Held here, as an ad hoc visualisation is re-pointed at a fresh copy each time its source grid
    // changes.
    let tabularData = config.tabularData;

    const getTabularData = () => tabularData;

    const hasUsableData = () => !!tabularData && !tabularData.isDestroyed;

    // Optional, returning the indexes of the only columns the visualisation reads, or null for all.
    const getRequiredInputColumns = config.getRequiredInputColumns;

    // Optional, returning the columns whose filters the visualisation isn't filtered by, or null.
    const getUnfilteredColumns = config.getUnfilteredColumns;

    const getInputData = () => Ren.VisualisationInputDataHelper.getInputData(
        tabularData,
        visualisation,
        getRequiredInputColumns ? getRequiredInputColumns(visualisation, tabularData) : null,
        getUnfilteredColumns ? getUnfilteredColumns(visualisation, tabularData) : null
    );

    /**
     * Gets a value indicating whether the visualisation should wait for its filterGroup's settings.
     * That is the case when they are not registered yet but a visualisation that has not rendered
     * yet might register them.  Drawn before then, it would show unfiltered rows and then be drawn
     * again from scratch when the settings arrive.
     */
    const isAwaitingFilterGroupSource = () => {

        const filterGroup = visualisation.filterGroup;

        if (!filterGroup || filterGroup === visualisation.dataGroupingSettingsGroup) return false;

        if (Ren.DataGroupingSettingsCollection.getDataGroupingSettings(filterGroup)) return false;

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < visualisations.length; index++) {

            const other = visualisations[index];

            if (other === visualisation || other.isRendered || other.isDestroyed) continue;

            // A filter module reads a group rather than registering one, so it may be waiting too.
            if (other.sourceDataGroupingSettingsGroup) continue;

            const isSameSource = other.sqlFilename && visualisation.sqlFilename ?
                other.sqlFilename === visualisation.sqlFilename :
                other.dataSourceUri === visualisation.dataSourceUri;

            if (!isSameSource) continue;

            // Excluded because it may itself be waiting, so two such visualisations can't wait on
            // each other.
            if (other.filterGroup && other.filterGroup !== other.dataGroupingSettingsGroup) continue;

            // A group is only unset until the visualisation's first render gives it its default.
            if (!other.dataGroupingSettingsGroup || other.dataGroupingSettingsGroup === filterGroup) {
                return true;
            }
        }

        return false;
    };

    /**
     * Registers settings for a filterGroup that nothing else owns, such as one shared by charts on
     * a page with no grid, so that filter modules have a group to filter.  They hold no groupings
     * of their own, as nothing renders them.
     */
    const ensureFilterGroupSettings = () => {

        const filterGroup = visualisation.filterGroup;

        if (visualisation.isAdHoc || !hasUsableData()) return;
        if (!filterGroup || filterGroup === visualisation.dataGroupingSettingsGroup) return;
        if (Ren.DataGroupingSettingsCollection.getDataGroupingSettings(filterGroup)) return;

        const settingsOwner = {
            dataGroupingSettingsGroup: filterGroup,
            filterGroup,
            dataSourceUri: visualisation.dataSourceUri,
            sqlFilename: visualisation.sqlFilename,
            containingReportGuid: visualisation.containingReportGuid,
            visualisationGuid: visualisation.visualisationGuid,
            columnDefaults: visualisation.columnDefaults,
            ignoreSqlGroupByDirectives: true
        };

        const settings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
            tabularData,
            settingsOwner,
            null,
            false
        );

        Ren.DataGroupingSettingsInitialiser.initialiseDataGroupingSettings(
            settingsOwner,
            Ren.DataGroupingSettingsApplyer(tabularData, settings)
        );

        settings.isFilterGroupOnly = true;

        Ren.DataGroupingSettingsCollection.addDataGroupingSettings(settings);
    };

    /**
     * Re-points the visualisation at the data a change has produced, and redraws it.
     */
    const handleDataChange = (dataSourceUri, redraw) => {

        const changedTabularData = Ren.DataSources.getTabularData(
            dataSourceUri,
            visualisation.dataTabIndex,
            visualisation.dataTabGroup
        );

        // The URI doesn't resolve while an ad hoc visualisation's data source is being replaced, so
        // the data already held is kept and the change that does resolve redraws.
        if (!changedTabularData) return;

        tabularData = changedTabularData;

        redraw();
    };

    /**
     * Subscribes any of the redraw, recreate, resize and themeChanged handlers given.  Called
     * once the visualisation has been built, so that a failed build leaves nothing behind.  With
     * getElement, returning what the visualisation is drawn in, it's redrawn before those out of
     * view.
     */
    const start = (handlers) => {

        const redraw = handlers.redraw;
        const recreate = handlers.recreate;

        if (handlers.resize) {

            Ren.Messages.Events.visualisationContainerResize.handle((visualisationGuid, width, height) => {

                if (visualisation.isDestroyed) return false;
                if (visualisationGuid !== visualisation.visualisationGuid) return;

                handlers.resize(width, height);
            });
        }

        // Undims straight after drawing rather than waiting to be noticed at the end of the turn.
        const draw = (drawFn) => {

            drawFn();

            Ren.VisualisationFilterDim.undimVisualisation(visualisation);
        };

        const redrawAction = redraw ? { action: "redraw", handler: () => draw(redraw) } : null;

        // An ad hoc visualisation's own data already answers the filter, so the group's filter
        // events are left to the visualisations reading the group directly.
        const followsGroupFilters = redrawAction && !visualisation.isAdHoc;

        Ren.DataGroupingSettingsBinding({
            visualisation,
            getElement: handlers.getElement,
            onSettingsChanged: redrawAction,
            onFilterChanged: followsGroupFilters ? redrawAction : null,
            onFilterGroupChanged: followsGroupFilters ? redrawAction : null,
            onGroupingsChanged: recreate
                ? { immediate: true, handler: () => draw(recreate) }
                : null
        });

        if (visualisation.isAdHoc && redraw) {

            Ren.Messages.Events.visualisationDataChanged.handle((visualisationGuid, dataSourceUri) => {

                if (visualisation.isDestroyed) return false;
                if (visualisationGuid !== visualisation.visualisationGuid) return;

                handleDataChange(dataSourceUri, redraw);
            });
        }

        if (handlers.themeChanged && Ren.Messages?.Events?.themeChanged) {

            Ren.Messages.Events.themeChanged.handle(() => {

                if (visualisation.isDestroyed) return false;

                handlers.themeChanged();
            });
        }
    };

    return {
        getTabularData,
        hasUsableData,
        getInputData,
        isAwaitingFilterGroupSource,
        ensureFilterGroupSettings,
        start
    };
};
