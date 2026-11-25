/**
 * Converts <ren-*> elements to visualisation objects.
 */
Ren.RenElementParser = (() => {

    /**
     * Gives the options with data-source-name's value under sqlFilename, the visualisation's
     * name for it, so that it wins over sql-filename, the older name it stands in for.
     */
    const applyDataSourceNameAlias = (options) => {

        if (options.dataSourceName === undefined) return options;

        const aliased = { ...options, sqlFilename: options.dataSourceName };

        delete aliased.dataSourceName;

        return aliased;
    };

    /**
     * Parses a Ren element such as <ren-grid> and returns a corresponding visualisation object.
     */
    const parseRenElement = (element) => {

        const visualisation = {
            tabularDataTransformers: [],
            clientSide: false
        };

        let parameters = Ren.RenElementAttributeParser.parseRenElementAttributes(element);

        // src is a shorter name for fetch-uri.
        if (parameters.src !== undefined) {

            if (parameters.fetchUri === undefined) parameters.fetchUri = parameters.src;

            delete parameters.src;
        }

        parameters = applyDataSourceNameAlias(parameters);

        const visualisationType = Ren.VisualisationTypes.getByTagName(element.tagName);
        const visualisationAttributeNames = Object.keys(visualisationType.availableOptions);

        visualisation.visualisationTypeName = visualisationType.visualisationTypeName;

        if (visualisationType.applyDefaultLogic) {

            visualisationType.applyDefaultLogic(visualisation, parameters);
        }

        const registeredDefaults = applyDataSourceNameAlias(
            Ren.VisualisationTypes.getRegisteredDefaults(visualisationType.visualisationTypeName)
        );

        // The host's defaults for the type, which the element's own attributes override below.
        Object.assign(visualisation, registeredDefaults);

        // The options the host's defaults and the element's attributes set, which saved settings
        // are applied over, so need to state even where they are a setting's default.
        const markupOptionNames = Object.keys(registeredDefaults);

        if (visualisation.fetchUri && !visualisation.dataSourceUri) {
            visualisation.dataSourceUri = visualisation.fetchUri;
        }
        else if (visualisation.sqlFilename && !visualisation.dataSourceUri) {

            visualisation.dataSourceUri =
                Ren.NamedDataSources.getUri(visualisation.sqlFilename);
        }

        const dataSourceUriParameters = {};

        // dataSourceUri takes precedence, letting ren-* elements set specific data parameters; with
        // fetchUri or sqlFilename the parameters come from the containing report context.  A data
        // source the element names replaces any its type's defaults gave it.

        if (parameters.dataSourceUri || parameters.fetchUri || parameters.sqlFilename) {

            delete visualisation.fetchUri;
            delete visualisation.sqlFilename;
        }

        if (parameters.dataSourceUri) {
            visualisation.dataSourceUri = parameters.dataSourceUri;
        }
        else if (parameters.fetchUri) {

            visualisation.fetchUri = parameters.fetchUri;
            visualisation.dataSourceUri = parameters.fetchUri;
        }
        else if (parameters.sqlFilename) {

            visualisation.sqlFilename = parameters.sqlFilename;
            visualisation.dataSourceUri = Ren.NamedDataSources.getUri(parameters.sqlFilename);
        }

        if (parameters.settingsGroup) { // Shortcut for setting all three settings groups.

            visualisation.gridStateGroup = parameters.settingsGroup;
            visualisation.dataGroupingSettingsGroup = parameters.settingsGroup;
            visualisation.visualisationSettingsGroup = parameters.settingsGroup;
        }

        // An ID gives the visualisation's saved settings a stable key, where otherwise its type,
        // SQL filename and position identify it.  A valueless attribute parses as true, so is
        // ignored.
        if (typeof parameters.id === "string" && parameters.id.trim()) {
            visualisation.settingsId = parameters.id.trim();
        }

        for (const key in parameters) {

            if (key === "dataSourceUri" || key === "sqlFilename" || key === "fetchUri" ||
                key === "settingsGroup" || key === "id") {

                continue; // Already processed above.
            }

            let value = parameters[key];

            if (typeof value !== "string") {

                // The attribute parser has already made "false" a boolean, which for these is still
                // a data source parameter; left on the visualisation it would be defaulted to true.
                if (Ren.DataSourcesUploadedFiles.uploadedFilesParameterKeys.includes(key)) {
                    dataSourceUriParameters[key] = value;
                }
                else {

                    visualisation[key] = value;
                    markupOptionNames.push(key);
                }

                continue;
            }

            value = value.trim();

            const lower = value.toLowerCase();

            if (lower === "true") value = true;
            if (lower === "false") value = false;
            if (lower === "null") value = null;
            if (key === "dataTabIndexes") value = Ren.TextUtils.parseIntegerCSV(value);

            if (visualisationAttributeNames.includes(key)) {

                visualisation[key] = value;
                markupOptionNames.push(key);
            }
            else { // Otherwise, a data source parameter.
                dataSourceUriParameters[key] = value;
            }
        }

        // Convert date range acronyms to start and end dates.
        if (dataSourceUriParameters.dateRange &&
            !dataSourceUriParameters.startDate &&
            !dataSourceUriParameters.endDate) {

            const dateRange = Ren.DateAcronyms.getSortableDateRangeByAcronym(
                dataSourceUriParameters.dateRange
            );

            if (dateRange) {

                dataSourceUriParameters.startDate = dateRange.getStartDate();
                dataSourceUriParameters.endDate = dateRange.getEndDate();
            }
        }

        visualisation.dataSourceUriParameters = dataSourceUriParameters;
        visualisation.markupOptionNames = markupOptionNames;

        // A group member's uploaded files come from the group's module, so its own uploaded-files-*
        // attributes are ignored (and warned about).
        if (visualisation.uploadedFilesGroup) {

            Ren.DataSourcesUploadedFiles.stripUploadedFilesOptionsForGroup(
                visualisation,
                dataSourceUriParameters
            );
        }

        Ren.DataSourcesUploadedFiles.applyDefaultUploadedFilesOptions(dataSourceUriParameters);

        if (visualisationType.applyNestedElement) {

            const nestedElements = Array.from(element.children);

            for (let i = 0; i < nestedElements.length; i++) {

                const nestedElementTagName = nestedElements[i].tagName.toLowerCase();

                visualisationType.applyNestedElement(
                    visualisation,
                    parameters,
                    nestedElements[i],
                    nestedElementTagName
                );
            }
        }

        if (visualisationType.applyNestedHTML) {

            const nestedRenElements = Array.from(element.querySelectorAll(Ren.VisualisationTypes.tagNames.join(',')));

            nestedRenElements.forEach(nestedElement => {

                const nestedVisualisation = parseRenElement(nestedElement);
                const nestedVisualisationType = Ren.VisualisationTypes.getByTagName(nestedElement.tagName);

                // Non-virtual ones are processed later by scanify.
                if (nestedVisualisationType.isVirtual) {

                    nestedVisualisation.containingReport = Ren.HtmlUtils.getContainingReportContext(nestedElement);
                    nestedVisualisation.containingReportUrl = nestedVisualisation.containingReport?.getAttribute("data-request-url");

                    // Adds parameters (like date ranges) to the report context.
                    Ren.VirtualVisualisationActivator.activateVirtualVisualisation(
                        nestedVisualisation,
                        nestedVisualisationType,
                        nestedElement
                    );

                    // Added so it is written to a downloaded report's settings, as the element is
                    // removed below and nothing else would carry it there.
                    nestedVisualisation.visualisationGuid ??=
                        Ren.RandomUtils.generateRandomClassName("ren-visualisation");

                    Ren.VisualisationCollection.addVisualisation(nestedVisualisation);

                    nestedElement.remove();
                }
            });

            // Virtual elements have been processed and removed.
            visualisationType.applyNestedHTML(
                visualisation,
                parameters,
                element.innerHTML
            );
        }

        return visualisation;
    };

    return {
        parseRenElement
    };
})();
