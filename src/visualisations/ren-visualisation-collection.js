/**
 * Maintains a list of the visualisations on the page.
 */
Ren.VisualisationCollection = (() => {

    const visualisations = [];

    const visualisationTypeIndices = {};

    /**
     * Indexed lookups for O(1) access to visualisations by various keys.
     * These indices are maintained automatically as visualisations are added/removed.
     */
    const visualisationsByGuid = new Map();
    const visualisationsByDataGroupingSettingsGroup = new Map();
    const visualisationsByGridStateGroup = new Map();
    const visualisationsByVisualisationSettingsGroup = new Map();

    /**
     * Adds a visualisation to a Map-based index, creating the entry array on first use.
     */
    const addToIndex = (indexMap, key, visualisation) => {

        if (!indexMap.has(key)) indexMap.set(key, []);
        indexMap.get(key).push(visualisation);
    };

    /**
     * Removes a visualisation from a Map-based index entry, deleting the entry when it becomes
     * empty.
     */
    const removeFromIndex = (indexMap, key, visualisation) => {

        const group = indexMap.get(key);
        if (!group) return;
        const index = group.indexOf(visualisation);
        if (index > -1) group.splice(index, 1);
        if (group.length === 0) indexMap.delete(key);
    };

    /**
     * Adds a visualisation to the appropriate indices.
     */
    const addToIndices = (visualisation) => {

        if (visualisation.visualisationGuid) {
            visualisationsByGuid.set(visualisation.visualisationGuid, visualisation);
        }

        if (visualisation.dataGroupingSettingsGroup) {
            addToIndex(visualisationsByDataGroupingSettingsGroup, visualisation.dataGroupingSettingsGroup, visualisation);
        }

        if (visualisation.gridStateGroup) {
            addToIndex(visualisationsByGridStateGroup, visualisation.gridStateGroup, visualisation);
        }

        if (visualisation.visualisationSettingsGroup) {
            addToIndex(visualisationsByVisualisationSettingsGroup, visualisation.visualisationSettingsGroup, visualisation);
        }
    };

    /**
     * Removes a visualisation from the indices.
     */
    const removeFromIndices = (visualisation) => {

        if (visualisation.visualisationGuid) {
            visualisationsByGuid.delete(visualisation.visualisationGuid);
        }

        if (visualisation.dataGroupingSettingsGroup) {
            removeFromIndex(visualisationsByDataGroupingSettingsGroup, visualisation.dataGroupingSettingsGroup, visualisation);
        }

        if (visualisation.gridStateGroup) {
            removeFromIndex(visualisationsByGridStateGroup, visualisation.gridStateGroup, visualisation);
        }

        if (visualisation.visualisationSettingsGroup) {
            removeFromIndex(visualisationsByVisualisationSettingsGroup, visualisation.visualisationSettingsGroup, visualisation);
        }
    };

    const getVisualisationTypeCountKey = (visualisation) => {

        return visualisation.visualisationTypeName + "_" + visualisation.sqlFilename;
    };

    /**
     * Removes a visualisation from the page and from the visualisation collection, and removes any
     * other references to it.
     */
    const destroyVisualisation = (visualisation, isChildVisualisation) => {

        if (!visualisation) return;

        Ren.VisualisationContainers.forgetContainer(visualisation);

        // A container's children go with it, before its element is emptied.
        const containedVisualisations = Ren.VisualisationContainers.getChildren(visualisation);

        for (let index = 0; index < containedVisualisations.length; index++) {
            destroyVisualisation(containedVisualisations[index], true);
        }

        if (visualisation.element) {

            visualisation.element.innerHTML = "";
            visualisation.element.remove();
            visualisation.element = null;
        }

        // After the element has gone, so that closing a focus mode window doesn't destroy it again.
        Ren.VisualisationFocusMode.abandon(visualisation);

        if (visualisation.popup) visualisation.popup.closeWindow(true);

        visualisation.instance = null;
        visualisation.props = null;

        visualisation.isRendered = false;
        visualisation.hasResizeHandles = false;

        visualisation.isDestroyed = true;

        // Remove the message-bus listeners registered by this visualisation's most recent render
        // generation, so its state is not pinned until each of those messages next fires.
        if (visualisation._renderOwner) {

            Ren.Messages.removeListenersByOwner(visualisation._renderOwner);
            visualisation._renderOwner = null;
        }

        const visualisationIndex = visualisations.indexOf(visualisation);

        if (visualisationIndex > -1) {

            visualisations.splice(visualisationIndex, 1);
        }

        // Remove from indices
        removeFromIndices(visualisation);

        const childVisualisations =
            Ren.VisualisationCollection.getVisualisationsBySourceVisualisation(visualisation);

        childVisualisations.forEach(childVisualisation => {

            destroyVisualisation(childVisualisation, true);
        });

        Ren.DynamicStylesheets.removeDynamicStylesheets(visualisation.visualisationGuid);

        const key = getVisualisationTypeCountKey(visualisation);
        const visualisationTypeIndicesArray = visualisationTypeIndices[key];

        if (visualisationTypeIndicesArray) {
            visualisationTypeIndicesArray[visualisation.visualisationTypeCount - 1] = undefined;
        }

        if (!isChildVisualisation) {

            // Immediately garbage collect settings.
            Ren.Messages.Events.visualisationDestroyed.notifyImmediately();
        }
    };

    /**
     * Finds all of the client-side visualisations on the page; removes them from the page and the
     * visualisation collection, and removes any other references to them.
     */
    const destroyAllClientSideVisualisations = () => {

        visualisations
            .filter(visualisation => visualisation.clientSide && !visualisation.isTransitive)
            .forEach(visualisation => {

                if (visualisation.popup) {

                    visualisation.popup.closeWindow();
                }
                else {

                    destroyVisualisation(visualisation);
                }
            });
    };

    /**
     * Finds all of the visualisations inside a container; removes them from the page and the
     * visualisation collection, and removes any other references to them.
     */
    const destroyAllVisualisationsInsideContainer = (container) => {

        const visualisationElements = container.querySelectorAll(".ren-visualisation");

        for (let i = 0; i < visualisationElements.length; i++) {

            const visualisationElement = visualisationElements[i];

            const visualisationGuid =
                Ren.HtmlUtils.getGuidClassName(visualisationElement, "ren-visualisation-");

            Ren.VisualisationCollection.destroyVisualisationByVisualisationGuid(visualisationGuid);
        }
    };

    /**
     * Removes all visualisations from the page and the visualisation collection, and removes any
     * other references to them.
     */
    const destroyAllVisualisations = () => {

        //destroyAllVisualisationsInsideContainer(document);
        //destroyAllClientSideVisualisations();

        visualisations
            .forEach(visualisation => {

                if (visualisation.popup) {

                    visualisation.popup.closeWindow();
                }
                else {

                    destroyVisualisation(visualisation);
                }
            });
    };

    /**
     * Removes a visualisation from the page and from the visualisation collection, and any other
     * references to it.
     */
    const destroyVisualisationByVisualisationGuid = (visualisationGuid) => {

        const visualisation = getVisualisationByVisualisationGuid(visualisationGuid);

        destroyVisualisation(visualisation);
    };

    /**
     * Adds a visualisation to the collection.
     */
    const addVisualisation = (visualisation) => {

        if (visualisation.dataSourceUri) {
            visualisation.dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(visualisation.dataSourceUri);
        }

        visualisation.recreate = (newDataSourceUri) => {

            if (newDataSourceUri) {
                visualisation.dataSourceUri = newDataSourceUri;
            }

            // Clear the element content but keep it in the DOM and in the collection, so it can be
            // re-rendered into the same container.
            Ren.DynamicStylesheets.removeDynamicStylesheets(visualisation.visualisationGuid);

            if (visualisation.element) {
                visualisation.element.innerHTML = "";
            }

            visualisation.instance = null;
            visualisation.isRendered = false;

            Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
        };

        populateVisualisationTypeCount(visualisation);

        visualisations.push(visualisation);

        // Add to indices for fast lookups
        addToIndices(visualisation);

        return visualisation;
    };

    const findVisualisationIndex = (key) => {

        const visualisationIndices = visualisationTypeIndices[key];

        for (let i = 0; i < visualisationIndices.length; i++) {

            if (visualisationIndices[i] === undefined) {

                return i;
            }
        }

        visualisationIndices.push(true);

        return visualisationIndices.length;
    };

    /**
     * Increments the type count for a visualisation and sets the visualisationTypeCount property.
     * This property shows the instance number of the visualisation of that type (e.g. the 2nd
     * gridset on the page would have visualisationTypeCount = 2).
     */
    const populateVisualisationTypeCount = (visualisation) => {

        const key = getVisualisationTypeCountKey(visualisation);

        if (visualisationTypeIndices[key] === undefined) {
            visualisationTypeIndices[key] = [];
        }

        const visualisationIndex = findVisualisationIndex(key);

        visualisation.visualisationTypeCount = visualisationIndex;
    };

    /**
     * Gets a list of the visualisations that sit inside the specified report context.
     */
    const getVisualisationsInsideReportContext = (reportContext) => {

        return visualisations
            .filter(vis => vis.reportContext?.reportContextGuid === reportContext?.reportContextGuid);
    };

    /**
     * Removes all visualisations inside the specified report context.
     */
    const destroyVisualisationsBelongingToReportContext = (reportContext) => {

        const destroyedGroups = new Set();
        getVisualisationsInsideReportContext(reportContext).forEach(visualisation => {

            if (visualisation.dataGroupingSettingsGroup) {

                destroyedGroups.add(visualisation.dataGroupingSettingsGroup);
            }
            destroyVisualisation(visualisation);
        });

        // Trigger cleanup messages to remove orphaned listeners from the message bus.
        // isDestroyedCleanup=true tells handlers to only do the isDestroyed check and return
        // false to unregister — they must not do any real work (redraw, transform, etc.).
        destroyedGroups.forEach(group => {

            Ren.Messages.Events.dataGroupingSettingsChanged.notify({
                dataGroupingSettingsGroup: group,
                signifier: Ren.RandomUtils.generateRandomClassName(),
                isDestroyedCleanup: true
            });
        });
    };

    /**
     * Gets a list of visualisations of the specified type, or all visualisations if no type is
     * specified.
     */
    const getVisualisations = (visualisationTypeName) => {

        const result = visualisationTypeName ?
            visualisations.filter(vis => vis.visualisationTypeName === visualisationTypeName) :
            visualisations;

        return result;
    };

    /**
     * Returns a value indicating whether any visualisations use the specified settings group.
     *
     * @param {string} settingsGroup The settings group to check.
     * @param {function} getFunc Function that takes a visualisation and returns the settings group.
     */
    const hasVisualisationUsingSettingsGroup = (settingsGroup, getFunc) => {

        // "[" follows a grid set's group in the groups of the grids after its first.
        const result = visualisations.some(vis =>
            settingsGroup === getFunc(vis) ||
            settingsGroup?.startsWith(getFunc(vis) + "__") ||
            settingsGroup?.startsWith(getFunc(vis) + "[")
        );

        return result;
    };

    /**
     * Gets the visualisations to serialize.
     */
    const getVisualisationsToSerialize = () => {

        return getVisualisations()
            .filter(vis => !vis.isTransitive && !vis.excludeFromSerialization);
    };

    /**
     * Gets a copy of the array stored under key in an index Map, or an empty array if the key
     * is absent.
     */
    const getFromIndex = (indexMap, key) => {

        const result = indexMap.get(key);
        return result ? Array.from(result) : [];
    };

    const getVisualisationsByDataGroupingSettingsGroup = (dataGroupingSettingsGroup) =>
        getFromIndex(visualisationsByDataGroupingSettingsGroup, dataGroupingSettingsGroup);

    const getVisualisationsByGridStateGroup = (gridStateGroup) =>
        getFromIndex(visualisationsByGridStateGroup, gridStateGroup);

    const getVisualisationsByVisualisationSettingsGroup = (visualisationSettingsGroup) =>
        getFromIndex(visualisationsByVisualisationSettingsGroup, visualisationSettingsGroup);

    /**
     * Gets all visualisations that are contained by the specified element.
     */
    const getVisualisationsByContainingElement = (container) => {

        return Array.from(
            visualisations.filter(vis => vis.element && vis.element.contains(container))
        );
    };

    /**
     * Gets all visualisations whose source visualisation is the specified visualisation.
     */
    const getVisualisationsBySourceVisualisation = (visualisation) => {

        return Array.from(
            visualisations.filter(vis =>
                vis.sourceVisualisation === visualisation ||
                vis.sourceVisualisationGuid === visualisation.visualisationGuid
            )
        );
    };

    /**
     * Gets a visualisation by its visualisation GUID.
     */
    const getVisualisationByVisualisationGuid = (visualisationGuid) => {

        return visualisationsByGuid.get(visualisationGuid);
    };

    /**
     * Gets the closest containing visualisation element for the specified element.
     */
    const getClosestVisualisation = (element) => element.closest(".ren-visualisation");

    /**
     * Gets the visualisations that have not yet been rendered.
     */
    const getUnrenderedVisualisations = () => {

        return getVisualisations().filter(vis => !vis.isRendered);
    };

    let focussedVisualisation = null;

    const setFocus = (visualisation) => {

        // Deselect any text that is selected on the page, but preserve selection in the SQL editor.
        if (window.getSelection) {

            const selection = window.getSelection();

            if (selection.rangeCount > 0) {

                const sqlEditorTextarea = document.querySelector(".js-ren-report-editor-sql-box");
                const activeElement = document.activeElement;

                // Only remove the selection if we're not in the SQL editor.
                if (!sqlEditorTextarea || activeElement !== sqlEditorTextarea) {
                    selection.removeAllRanges();
                }
            }
        }

        focussedVisualisation = visualisation;

        Ren.Messages.Events.focusChanged.notify(visualisation);
    };

    const clearFocus = () => {

        focussedVisualisation = null;
    };

    const hasFocus = (visualisation) => focussedVisualisation === visualisation;

    const setupFocus = (visualisation) => {

        if (!visualisation.element?.addEventListener) return;

        visualisation.element.addEventListener("mousedown", (e) => {

            // Prevents the click event from being propagated to the parent container, which
            // would cause the visualisation to lose focus.
            e.stopPropagation();

            setFocus(visualisation);
        });
    };

    window.addEventListener("mousedown", () => {

        if (focussedVisualisation) clearFocus();
    });

    return {
        addVisualisation,
        clearFocus,
        destroyAllClientSideVisualisations,
        destroyAllVisualisationsInsideContainer,
        destroyVisualisation,
        destroyVisualisationByVisualisationGuid,
        destroyAllVisualisations,
        destroyVisualisationsBelongingToReportContext,
        getClosestVisualisation,
        getUnrenderedVisualisations,
        getVisualisationByVisualisationGuid,
        getVisualisations,
        getVisualisationsByContainingElement,
        getVisualisationsByDataGroupingSettingsGroup,
        getVisualisationsByGridStateGroup,
        getVisualisationsBySourceVisualisation,
        getVisualisationsByVisualisationSettingsGroup,
        getVisualisationsToSerialize,
        hasFocus,
        hasVisualisationUsingSettingsGroup,
        setFocus,
        setupFocus,
        visualisations
    };
})();
