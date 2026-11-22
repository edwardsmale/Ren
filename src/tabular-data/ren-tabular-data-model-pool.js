/**
 * Creates clones of tabular data models, and provides them to clients.
 */
Ren.TabularDataPool = (() => {

    const tabularDataClones = {};

    const determineRequiredCloneDepth = (tabularDataTransformers) => {

        // If there are no transformers, it is sufficient to clone the tabular data to a depth of 1
        // since we aren't adding any columns.
        if (!tabularDataTransformers || tabularDataTransformers.length === 0) {
            return 1;
        }

        // If all transformers are filters, we can clone to a depth of 1, since these only affect
        // whether rows are included, and don't modify the row models themselves.
        if (tabularDataTransformers.every(t => t.isFilter)) {
            return 1;
        }

        // Otherwise, clone to a depth of 2 to ensure RowModels arrays are not shared (e.g. because
        // the filter adds columns or modifies values).
        return 2;
    };

    /**
     * Clones the tabular data model, applying the passed transformers to the clone.
     */
    const cloneTabularData = (tabularData, tabularDataTransformers) => {

        const cloneDepth = determineRequiredCloneDepth(tabularDataTransformers);

        // Use the generic object clone function which properly handles the depth semantics
        const clone = Ren.ObjectUtils.cloneTabularData(tabularData, cloneDepth);

        for (let i = 0; i < tabularDataTransformers.length; i++) {

            const tabularDataTransformer = tabularDataTransformers[i];

            const tabularDataTransformerName = tabularDataTransformer.tabularDataTransformerName;

            const transformer = Ren.TabularDataTransformerFactory.createTransformer(
                tabularDataTransformerName,
                tabularDataTransformer.parameters || {}
            );

            transformer.execute(clone);

            // After each transformer runs, update the column resolver so subsequent transformers
            // can correctly find columns by their IDs or headings (important when multiple
            // transformers modify the column structure, e.g., multiple DuplicateColumn).
            if (clone.columnResolver) {
                clone.columnResolver = Ren.DataGridColumnResolver(clone);
            }
        }

        if (tabularDataTransformers.length) {

            // Services must be regenerated in case the transformer has changed the columns.
            Ren.TabularData_Services.updateTabularDataServices(clone);
            Ren.TabularData_Services.updateCompressionDictionary(clone);
        }

        return clone;
    };

    const addClone = (
        tabularData,
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers) => {

        const key = getKey(
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        );

        tabularDataClones[key] = cloneTabularData(tabularData, tabularDataTransformers);

        Ren.Messages.Events.dataSourcesChanged.notify();
        Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
    };

    const getKey = (
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers) => {

        return dataSourceUri + "|" +
            dataTabIndexes.join(",") + "|" +
            dataTabGroup + "|" +
            dataGroupingSettingsGroup + "|" +
            JSON.stringify(tabularDataTransformers);
    };

    const has = (
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers) => {

        const key = getKey(
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        );

        return tabularDataClones[key] !== undefined;
    };

    const get = (
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers
    ) => {

        const key = getKey(
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        );

        return tabularDataClones[key];
    };

    /**
     * Returns every tabular data model clone in the pool, keyed as they are held.
     */
    const getAll = () => {

        return tabularDataClones;
    };

    /**
     * Returns the tabular data model clone that has the specified tabularDataGuid.
     */
    const getByTabularDataGuid = (tabularDataGuid) => {

        for (const key in tabularDataClones) {

            if (tabularDataClones[key].tabularDataGuid === tabularDataGuid) {
                return tabularDataClones[key];
            }
        }
        return null;
    };

    const clear = () => {

        for (const key in tabularDataClones) {
            delete tabularDataClones[key];
        }
    };

    Ren.Messages.Events.reportGenerating.handle(clear);

    /**
     * Adds a clone of the tabular data model to the pool if none already exists for the specified
     * data source URI, data grouping settings group, and filter function, and returns the clone.
     */
    const provideClone = (
        tabularData,
        dataSourceUri,
        dataTabIndexes,
        dataTabGroup,
        dataGroupingSettingsGroup,
        tabularDataTransformers) => {

        if (!has(
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        )) {

            addClone(
                tabularData,
                dataSourceUri,
                dataTabIndexes,
                dataTabGroup,
                dataGroupingSettingsGroup,
                tabularDataTransformers
            );
        }

        return get(
            dataSourceUri,
            dataTabIndexes,
            dataTabGroup,
            dataGroupingSettingsGroup,
            tabularDataTransformers
        );
    };

    const deleteClone = (dataSourceUri) => {

        for (const key in tabularDataClones) {

            if (key.startsWith(dataSourceUri + "|")) {
                delete tabularDataClones[key];
            }
        }
    };

    Ren.Messages.Events.dataSourceRemoved.handle((dataSourceUri) => {

        deleteClone(dataSourceUri);
    });

    return {
        provideClone,
        get,
        getAll,
        getByTabularDataGuid
    };
})();
