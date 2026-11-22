/**
 * Contains all of the grid state settings that exist on the page.  Only contains the settings,
 * and not materialised grid state objects.
 */
Ren.ReportSettings_GridStateCollection = (() => {

    const baseCollection = Ren.SettingsCollectionBase.createCollection({
        collectionName: "GridState",
        settingsKey: "gridState",
        getSettingsGroupFromVis: vis => vis.gridStateGroup
    });

    const {
        allSettings: allGridState,
        updateVariations: updateGridStateVariations,
        addNewSettings: addNewGridState,
        getSettings: getGridState,
        hasSettings: hasGridState,
        garbageCollect
    } = baseCollection;

    /**
     * Returns a cloned grid state for the given group and variation name.  Where the grid's data
     * tabs are given, a tab whose query has changed since its grid state was saved is given the
     * grid state saved against its query instead.
     *
     * @param {Object} tabs - The visualisation's data tabs (optional; see
     *   Ren.SettingsEmbeddingMatcher.findSettingsForTab).
     * @param {number} tabIndex - The index of the grid's data tab among them.
     */
    const getClonedGridState = (gridStateGroup, variationName, tabs, tabIndex) => {

        let gridState = getGridState(gridStateGroup, variationName);
        let matchedColumnNames = null;

        // Variations are chosen by name, so are never paired with a query.
        if (!variationName && tabs) {

            const match = Ren.SettingsEmbeddingMatcher.findSettingsForTab(
                tabIndex,
                tabs,
                allGridState
            );

            gridState = match ? allGridState[match.key] : null;
            matchedColumnNames = match?.columnNames ?? null;
        }

        if (!gridState) {

            return null;
        }

        gridState = Ren.ObjectUtils.clone(gridState);
        gridState.gridStateGroup = gridStateGroup;

        // Include the columns the matched settings were saved against, so that new columns (not
        // among those) can remain visible.  Taken from the settings rather than the key, which
        // only lists columns on the Editor path - a web report's key is its SQL filename.
        if (matchedColumnNames?.length) {
            gridState.originalColumns = matchedColumnNames;
        }

        return gridState;
    };

    /**
     * If there is existing grid state for the given group, replaces the grid state in the report
     * settings with those existing settings.
     */
    const replaceGridStateWithExisting = (reportSettings, gridStateGroup) => {

        baseCollection.replaceSettingsWithExisting(reportSettings, gridStateGroup);
    };

    /**
     * When grid state changes (e.g. column resize, hide/show), update the static collection
     * so the changes are captured and can be restored on the next preview regeneration.
     */
    Ren.Messages.Events.gridStateChanged.handle((changedGridState) => {

        if (!changedGridState) return;
        if (!changedGridState.gridStateGroup) return;
        if (!changedGridState.tabularDataGuid) return;

        // Only capture on Editor page where settings need to persist across preview regenerations
        if (!Ren.UrlContext.onEditorPage()) return;

        const gridStateGroup = changedGridState.gridStateGroup;

        // Get the tabularData using the tabularDataGuid from the grid state.
        // Check TabularDataPool first (for grids with transformers), then DataSources
        // (for grids without transformers that use the original tabularData).
        let tabularData = Ren.TabularDataPool.getByTabularDataGuid(
            changedGridState.tabularDataGuid
        );

        if (!tabularData) {

            tabularData = Ren.DataSources.getTabularDataByTabularDataGuid(
                changedGridState.tabularDataGuid
            );
        }

        if (!tabularData) {

            console.warn(`[ReportSettings_GridStateCollection] Could not find tabularData for guid '${changedGridState.tabularDataGuid}' in TabularDataPool or DataSources`);
            return;
        }

        // Transform the grid state and update the static collection.
        const transformedGridState = Ren.GridStateTransformer.transform(tabularData, changedGridState);

        if (transformedGridState) {

            allGridState[gridStateGroup] = transformedGridState;
        }
    });

    return {
        updateGridStateVariations,
        addNewGridState,
        allGridState,
        getGridState,
        hasGridState,
        getClonedGridState,
        replaceGridStateWithExisting,
        garbageCollect
    };
})();
