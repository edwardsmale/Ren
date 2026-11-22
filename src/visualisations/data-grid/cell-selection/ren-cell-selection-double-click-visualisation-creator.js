/**
 * Opens the visualisation that the data grouping settings' doubleClick setting names for a
 * double-clicked row, e.g.
 *
 *     "doubleClick": {
 *         "visualisationTypeName": "OrderDetails",
 *         "reportName": "OrderDetails",
 *         "parameters": { "OrderId": "OrderId" }
 *     }
 *
 * Each parameter names a query parameter of the report (or SQL file) and the column (ID or
 * heading) whose value in the row it is given.  A row is a data row or the group row of a grouping
 * whose groups cannot be expanded, which stands in for the data rows it hides, and gives the value
 * it shows (see Ren.DataGridCellSelection_RawValueReader).
 *
 * With a reportName, the visualisation is the report, opened as a popup report so that it can be
 * kept and reopened like any other.  With a sqlFilename instead, it is an ad hoc visualisation of
 * that SQL file's data.  With neither, it is built from the row itself, as the default key/value
 * grid is, whose popup is ad hoc because the row's data may not exist when the report is next
 * opened.
 *
 * The user can open a row in a key/value grid or in the doubleClick setting's visualisation (the
 * row visualisers), and choose which of them a double-click opens, which the data grouping
 * settings' defaultRowVisualiser records.
 */
Ren.DataGridCellSelection_DoubleClickVisualisationCreator = (
    tabularData,
    dataGroupingSettings,
    adHocVisualisationCreator,
    rawValueReader) => {

    const DEFAULT_VISUALISATION_TYPE_NAME = "KeyValueGrid";

    /**
     * Gets the query string (without its "?") holding the parameter values of the row with the
     * specified index (excluding headings), or null if the row lacks any of them.
     */
    const getQueryString = (doubleClick, rowIndex) => {

        const parameters = doubleClick.parameters ?? {};
        const parameterNames = Object.keys(parameters);
        const queryParts = [];

        for (let i = 0; i < parameterNames.length; i++) {

            const parameterName = parameterNames[i];
            const column = parameters[parameterName];
            const columnIndex = tabularData.columnResolver.getColumnIndex(column);

            if (columnIndex == null) {

                console.warn("[DoubleClickVisualisationCreator] Column not found: " + column);

                return null;
            }

            const value = rawValueReader.getRawValue(rowIndex, columnIndex);

            if (value === undefined || Ren.IsNullOrEmpty(value)) return null;

            queryParts.push(
                encodeURIComponent(parameterName) + "=" + encodeURIComponent(value)
            );
        }

        return queryParts.join("&");
    };

    /**
     * Gets the URI of the doubleClick setting's named data source with the query string, or null
     * where there are no named data sources.
     */
    const getDataSourceUri = (doubleClick, queryString) => {

        const dataSourceUri = Ren.NamedDataSources.getUri(doubleClick.sqlFilename);

        if (!dataSourceUri) return null;

        return Ren.UrlUtils.sortDataSourceUriParameters(
            dataSourceUri + (queryString ? "?" + queryString : "")
        );
    };

    const showPopupReport = (doubleClick, queryString, popupReuseId) => {

        const url = Ren.HostUrls.reportUrl(
            "/" + doubleClick.reportName + (queryString ? "?" + queryString : "")
        );

        if (Ren.UrlContext.isDownloadedReport()) {

            // A downloaded report opens the popup in a new tab, against the reporting server.
            window.open(url, "_blank");
            return;
        }

        // The report shows the one visualisation, so its popup is sized as that visualisation's
        // would be.
        const defaultOptions = Ren.VisualisationTypes
            .getByTypeName(doubleClick.visualisationTypeName)?.defaultOptions;

        Ren.ShowPopupReport(url, doubleClick.popupTitle ?? "", null, {
            popupReuseId,
            fitPopupToContentExactly: defaultOptions?.fitPopupToContentExactly,
            raisePopupToFitContent: defaultOptions?.raisePopupToFitContent
        });
    };

    const createDataSourceVisualisation = (doubleClick, dataSourceUri, popupReuseId) => {

        Ren.VisualisationCreator.createVisualisation({
            dataSourceUri,
            sqlFilename: doubleClick.sqlFilename,
            visualisationTypeName: doubleClick.visualisationTypeName,
            isPopup: true,
            maxWidth: "100%",
            maxHeight: "calc(100% - 22px)",
            popupTitle: doubleClick.popupTitle ?? "",
            isAdHoc: true,
            sourceVisualisation: null,
            popupReuseId,
            needsUriReResolution: false
        });

        // A row double-clicked before already has its data source, which is not requested again,
        // so nothing would announce it to the new visualisation.
        if (Ren.DataSources.isDataSourceLoaded(dataSourceUri)) {
            Ren.Messages.Requests.renderUnrenderedVisualisations.notify();
        }
        else {

            Ren.DataSources.requestDataSource(dataSourceUri);
        }
    };

    /**
     * Gets a value indicating whether the row with the specified index (including headings) can be
     * opened in a row visualiser: a data row, or the group row of a grouping that prevents its
     * groups from expanding.
     */
    const isVisualisableRow = (rowIndex) => {

        const rowIndexExcludingHeadings = rowIndex - tabularData.HeadingCount;

        if (tabularData.isDataRow(rowIndexExcludingHeadings)) return true;

        if (!tabularData.isGroupRow(rowIndexExcludingHeadings)) return false;

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(
            rowIndexExcludingHeadings
        );

        return !!grouping?.preventExpansion && !grouping.isOutermostGrouping;
    };

    /**
     * Gets the visualisations a row can be opened in, as { visualisationTypeName, text }
     * objects: a key/value grid, and the one the doubleClick setting names, if any.
     */
    const getRowVisualisers = () => {

        const rowVisualisers = [{
            visualisationTypeName: DEFAULT_VISUALISATION_TYPE_NAME,
            text: "Key/Value Grid"
        }];

        const visualisationTypeName = dataGroupingSettings.doubleClick?.visualisationTypeName;

        if (visualisationTypeName && visualisationTypeName !== DEFAULT_VISUALISATION_TYPE_NAME) {

            rowVisualisers.push({
                visualisationTypeName,
                text: visualisationTypeName.replace(/([a-z])([A-Z])/g, "$1 $2")
            });
        }

        return rowVisualisers;
    };

    /**
     * Gets the type name of the row visualiser a double-click opens: the one the user chose, or
     * else the doubleClick setting's, or else a key/value grid.
     */
    const getDefaultRowVisualiser = () => {

        const rowVisualisers = getRowVisualisers();
        const defaultRowVisualiser = dataGroupingSettings.defaultRowVisualiser;

        if (rowVisualisers.some(
            rowVisualiser => rowVisualiser.visualisationTypeName === defaultRowVisualiser
        )) {

            return defaultRowVisualiser;
        }

        // The doubleClick setting's visualiser, where there is one, comes last.
        return Ren.ArrayUtils.last(rowVisualisers).visualisationTypeName;
    };

    /**
     * Sets the type name of the row visualiser a double-click opens.
     */
    const setDefaultRowVisualiser = (visualisationTypeName) => {

        dataGroupingSettings.defaultRowVisualiser = visualisationTypeName;
        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Opens the named row visualiser for the row with the specified index (including headings),
     * falling back to a key/value grid of the row where the row can't supply the visualisation's
     * parameters.  The row is already selected.
     */
    const createRowVisualisation = (visualisationTypeName, rowIndex, popupReuseId) => {

        const doubleClick = dataGroupingSettings.doubleClick;

        if (visualisationTypeName === doubleClick?.visualisationTypeName &&
            isVisualisableRow(rowIndex)) {

            if (!doubleClick.reportName && !doubleClick.sqlFilename) {

                adHocVisualisationCreator.createAdHocVisualisation(
                    doubleClick.visualisationTypeName,
                    popupReuseId
                );

                return;
            }

            const queryString = getQueryString(doubleClick, rowIndex - tabularData.HeadingCount);

            if (queryString !== null) {

                if (doubleClick.reportName) {

                    showPopupReport(doubleClick, queryString, popupReuseId);

                    return;
                }

                const dataSourceUri = getDataSourceUri(doubleClick, queryString);

                if (dataSourceUri) {

                    createDataSourceVisualisation(doubleClick, dataSourceUri, popupReuseId);

                    return;
                }
            }
        }

        adHocVisualisationCreator.createAdHocVisualisation(
            DEFAULT_VISUALISATION_TYPE_NAME,
            popupReuseId
        );
    };

    /**
     * Opens the default row visualiser for the row with the specified index (including headings).
     * The row is already selected.
     */
    const createDoubleClickVisualisation = (rowIndex, popupReuseId) => {

        createRowVisualisation(getDefaultRowVisualiser(), rowIndex, popupReuseId);
    };

    return {
        isVisualisableRow,
        getRowVisualisers,
        getDefaultRowVisualiser,
        setDefaultRowVisualiser,
        createRowVisualisation,
        createDoubleClickVisualisation
    };
};
