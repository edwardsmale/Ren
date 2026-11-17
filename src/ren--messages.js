/**
 * Contains the messages used by the Ren framework, divided into events and requests.  The division
 * is purely semantic; they behave in exactly the same way.
 */
Ren.Messages = (() => {

    const createMessage = Ren.MessageBus.createMessageType;

    // Notifying a message with a dedupe key first removes any pending messages with the same key.
    // A queued message whose removeIf is true by the time it is dispatched is dropped.

    const events = {
        allReportsLoaded: createMessage(),
        // Carries the range picked in a calendar, with an exclusive end date, to whatever opened
        // it under that calendar group.
        calendarDateRangeSelected: createMessage(["calendarGroup", "startDate", "endDate"]),
        // Carries the group a date/value chart's date range is shared under, and the range as it
        // is stored, so each chart in the group resolves it against its own dates and bins.  Only
        // the charts with the same range signature take it up (see
        // Ren.DateValueChart_DateRange.getRangeSignature).  A chart count is carried where a
        // multi-chart has been drawn as more or fewer charts, for those charts to take it too.
        chartDateRangeChanged: createMessage(
            [
                "dateRangeGroup",
                "range",
                "containingReportGuid",
                "sourceVisualisationGuid",
                "rangeSignature",
                "chartCount"
            ],
            {
                dedupeKey: (
                    dateRangeGroup,
                    _range,
                    containingReportGuid,
                    _source,
                    rangeSignature,
                    chartCount
                ) => dateRangeGroup + "|" + containingReportGuid + "|" + rangeSignature + "|"
                    + chartCount
            }
        ),
        // Carries the dates a date/value chart has just been drawn over, resolved as
        // { from, toExclusive } (either end null where open, or null for every date), with the
        // column they were read from, for whatever narrows its figures to what the charts in that
        // date range group show (see Ren.DateValueChart_DateRange.announceShownRange).
        chartShownRangeChanged: createMessage(
            ["dateRangeGroup", "shownRange", "containingReportGuid", "sourceVisualisationGuid"],
            {
                dedupeKey: (dateRangeGroup, _shownRange, containingReportGuid) =>
                    dateRangeGroup + "|" + containingReportGuid
            }
        ),
        // Carries the date a chart's hover band stands at, or null once it is taken down, so that
        // the other charts in its date range group show the same date.
        chartHoveredDateChanged: createMessage(
            ["dateRangeGroup", "date", "containingReportGuid", "sourceVisualisationGuid"]
        ),
        // Carries the colour picked in a colour picker window to whatever opened it under that
        // colour picker group.  Dragging across the picker supersedes the colours not yet applied.
        colourPicked: createMessage(
            ["colourPickerGroup", "colour"],
            { dedupeKey: (colourPickerGroup) => colourPickerGroup }
        ),
        colourPickerWindowClosed: createMessage(["colourPickerGroup"]),
        columnResized: createMessage(),
        columnsMoved: createMessage(),
        columnVisibilityChanged: createMessage(),
        themeChanged: createMessage(),
        dataGridColumnFormattingChanged: createMessage(["dataGroupingSettings", "columnIndex"], {
            dedupeKey: (dataGroupingSettings, columnIndex) => dataGroupingSettings?.dataGroupingSettingsGroup + "|" + columnIndex,
            removeIf: (dataGroupingSettings) => dataGroupingSettings?.isDestroyed === true
        }),
        dataGridDimensionsUpdated: createMessage(["guid"]), // Deduping this message doesn't work.
        dataGridFindCompleted: createMessage(["dataGridGuid", "found"]),
        dataGridSelectRowsCompleted: createMessage(["dataGridGuid", "rowCount", "wasCopied"]),
        dataGridFilterRowsCompleted: createMessage(["dataGridGuid", "rowCount"]),
        dataGridClearFilterRowsCompleted: createMessage(["dataGridGuid"]),
        dataGridTabChanged: createMessage(["dataGridGuid"], {
            dedupeKey: (dataGridGuid) => dataGridGuid
        }),
        // The report context GUID is in the dedupe key, as instances of the same report share
        // settings groups, and deduping by group alone would drop one instance's change.
        dataGroupingSettingsChanged: createMessage(["settings"], {
            dedupeKey: (settings) =>
                settings?.dataGroupingSettingsGroup + "|" + settings?.containingReportGuid,
            removeIf: (settings) => settings?.isDestroyed === true
        }),
        // Without parameters, so a burst of registrations makes one retry of what waits on them.
        dataGroupingSettingsRegistered: createMessage(),
        dataSourceRemoved: createMessage(["dataSourceUri"], {
            dedupeKey: (dataSourceUri) => dataSourceUri
        }),
        dataSourceChanged: createMessage(["dataSourceUri"], {
            dedupeKey: (dataSourceUri) => dataSourceUri
        }),
        dataSourcesChanged: createMessage(),
        // Lets an open calendar follow a range changed by other means, in a date selector or a
        // compare filter's value boxes.
        dateSelectorDateRangeChanged: createMessage(["calendarGroup", "startDate", "endDate"], {
            dedupeKey: (calendarGroup) => calendarGroup
        }),
        dragEnded: createMessage(),
        dragStarted: createMessage(),
        escapeKey: createMessage(),
        expandableModuleToggled: createMessage(["key", "isExpanded"]),
        fileUploadChanged: createMessage(),
        filterChanged: createMessage(
            ["tabularDataGuid", "dataGroupingSettingsGroup", "containingReportGuid"],
            {
                dedupeKey: (tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid) =>
                    tabularDataGuid + "|" + dataGroupingSettingsGroup + "|" + containingReportGuid
            }
        ),
        // Notified immediately, so that a listener can put something on screen while the browser
        // can still paint it, which it cannot once the bus is sending the queued redraw messages.
        filterChanging: createMessage(
            ["dataGroupingSettingsGroup", "filterGroup", "containingReportGuid"]
        ),
        // Carries the filterGroup, not the dataGroupingSettingsGroup, so that visualisations
        // sharing a filterGroup sync their filter section even when their settings groups differ.
        filterGroupChanged: createMessage(
            ["tabularDataGuid", "filterGroup", "filterSet", "containingReportGuid"],
            {
                dedupeKey: (tabularDataGuid, filterGroup, _filterSet, containingReportGuid) =>
                    tabularDataGuid + "|" + filterGroup + "|" + containingReportGuid
            }
        ),
        focusChanged: createMessage(["focussedVisualisation"]),
        generalEvent: createMessage(["eventName", "data"]),
        gridStateChanged: createMessage(["gridState"], {
            dedupeKey: (gridState) => gridState?.gridStateGroup
        }),
        groupingsChanged: createMessage(
            ["tabularDataGuid", "dataGroupingSettingsGroup", "containingReportGuid"],
            {
                dedupeKey: (tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid) =>
                    tabularDataGuid + "|" + dataGroupingSettingsGroup + "|" + containingReportGuid
            }
        ),
        keyDown: createMessage(["e"]),
        pageLoaded: createMessage(),
        popupManuallyResized: createMessage(["windowElement", "resizeType"]),
        popupResized: createMessage(),
        reportAddedToDom: createMessage(),
        reportDownloaded: createMessage(),
        reportDownloadFailed: createMessage(),
        reportGenerating: createMessage(),
        reportOptionsLoaded: createMessage(),
        reportParametersModuleOptionsAvailable: createMessage(["contentContainer", "parameter"]),
        reportSettingsFileListChanged: createMessage(),
        reportSettingsLoaded: createMessage(),
        // Carries the URL the settings were posted to and, where the save failed, the server's
        // error details.
        reportSettingsSaved: createMessage(["success", "url", "errorDetails"]),
        reportUrlChanged: createMessage(["reportContextGuid", "reportUrl"]),
        selectedValuesChanged: createMessage(["visualisationGuid", "getStatBarValues"], {
            removeIf: (visualisationGuid) => {

                const visualisation = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(visualisationGuid);
                return visualisation?.isDestroyed === true;
            }
        }),
        tabbedModuleTabChanged: createMessage(),
        uploadedFilesGroupSettingsChanged: createMessage(["uploadedFilesGroup"]),
        variationsChanged: createMessage(),
        visualisationContainerResize: createMessage(["visualisationGuid", "width", "height"], {
            removeIf: (visualisationGuid) => {

                const visualisation = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(visualisationGuid);
                return visualisation?.isDestroyed === true;
            }
        }),
        visualisationDataChanged: createMessage(["visualisationGuid", "dataSourceUri"], {
            dedupeKey: (visualisationGuid, dataSourceUri) => visualisationGuid + "|" + dataSourceUri
        }),
        visualisationSettingsChanged: createMessage(["visualisation"], {
            removeIf: (visualisation) => visualisation?.isDestroyed === true
        }),
        visualisationDestroyed: createMessage(),
        // Without parameters, so a burst of renders makes one retry of what waits on them.
        visualisationRendered: createMessage(),
        windowMouseDown: createMessage(["target"]),
        windowMouseUp: createMessage(["target"])
    };

    Ren.MessageBus.populateMessageNames(events);

    Ren.whenDocumentReady(() => {

        events.pageLoaded.notify();
    });

    events.pageLoaded.handle(() => {

        Ren.PageReportContext.ensure();
        Ren.EmbeddedReportResponses.initialise();
        Ren.Scanifier.scanify();

    }, true);

    const requests = {
        addDataSource: createMessage(["sqlFilename"]),
        addDataSourceWindow: createMessage(["triggeringElement"]),
        // Every open instance of a report declares the same settings group, so these carry the
        // destination report context GUID.  A null GUID applies them to every context.
        applyDeserialisedDataGroupingSettings: createMessage(
            ["deserializedDataGroupingSettings", "containingReportGuid"]
        ),
        applyDeserialisedGlobalReportSettings: createMessage(),
        applyDeserialisedGridState: createMessage(["deserializedGridState", "containingReportGuid"]),
        // Opens a calendar for picking a date range, or a single day where pickSingleDate is true;
        // the range picked comes back as a calendarDateRangeSelected event under the same calendar
        // group, a single day as the range of that day.
        calendarWindow: createMessage(
            ["calendarGroup", "title", "startDate", "endDate", "anchorElement", "pickSingleDate"]
        ),
        closeColourPickerWindow: createMessage(["colourPickerGroup"]),
        collapseAllGroups: createMessage(["dataGridGuid"]),
        // Opens a colour picker window below anchorElement, or brings forward the one open under
        // the same colour picker group.  Colours picked come back as colourPicked events.
        colourPickerWindow: createMessage(
            ["colourPickerGroup", "title", "colour", "anchorElement"]
        ),
        columnFilterSelectorWindow: createMessage(["visualisation", "dataGroupingSettings", "column", "anchorElement"]),
        createAdHocVisualisation: createMessage(["requestedDataGridGuid", "visualisationTypeName", "popupReuseId", "options"]),
        createOrUpdateVariation: createMessage(["dataGroupingSettingsGroup", "gridStateGroup", "variationName", "visualisationGuid"]),
        // Only the active datagrid acts on the Find window's requests.  A null columnIndexes
        // searches every visible column.
        dataGridFindNext: createMessage(
            ["searchText", "columnIndexes", "matchCase", "matchWholeCell", "fromTop"]
        ),
        dataGridFilterRowsWithText: createMessage(
            ["searchText", "columnIndexes", "matchCase", "matchWholeCell"]
        ),
        dataGridClearFilterRows: createMessage(),
        dataGridSelectRowsWithText: createMessage(
            ["searchText", "columnIndexes", "matchCase", "matchWholeCell", "copyRows"]
        ),
        dataGridShowHideColumnsWindow: createMessage(["guid", "element", "scope"]),
        dataGroupingSettingsCollectionDebugWindow: createMessage(),
        dataGroupingSettingsDebugWindow: createMessage(["guid"]),
        dataSourceDebugWindow: createMessage(["dataSourceUri"]),
        dataSourcesWindow: createMessage(["triggeringElement"]),
        deleteReportSettings: createMessage(["settingsName", "isPreset"]),
        removeVariation: createMessage(["dataGroupingSettingsGroup", "gridStateGroup", "variationName"]),
        downloadReport: createMessage(["convertToLiveUrls", "compressed"]),
        exportData: createMessage(["guid"]),
        functionEditorWindow: createMessage(["getCalcFunction", "setCalcFunction", "leftPos", "topPos", "options"]),
        gridStateCollectionDebugWindow: createMessage(),
        gridStateDebugWindow: createMessage(["guid"]),
        groupExpandCollapse: createMessage(["guid", "rowIndex"]),
        loadReportSettings: createMessage(["settingsName", "isPreset", "onEditorPage"]),
        applyVariation: createMessage(
            ["dataGroupingSettingsGroup", "gridStateGroup", "variationName", "containingReportGuid"]
        ),
        qaColumnWidthChange: Ren.MessageBus.createMessageType(["columnIndex", "columnWidth"]),
        qaDataGridScroll: Ren.MessageBus.createMessageType(["scrollTop"]),
        reapplyQueryParameterFilters: createMessage(
            ["dataGroupingSettingsGroup", "containingReportGuid"]
        ),
        renderUnrenderedVisualisations: createMessage(),
        repaint: createMessage(),
        reportContextCollectionDebugWindow: createMessage(),
        saveReportSettings: createMessage(["settingsName", "isPreset", "isSqlBasedReport"]),
        // Saves the settings named in the URL, or the report's default settings if none are.
        saveCurrentReportSettings: createMessage(),
        // Saves the report's default settings, whatever settings the URL names.
        saveDefaultReportSettings: createMessage(),
        scanPageForDataSources: createMessage(["callback"]),
        // Shows a colour in the picker open under the group, without reporting it back.
        showColourPickerColour: createMessage(["colourPickerGroup", "colour"]),
        tabularDataColumnSummary: createMessage(["guid", "columnIndex", "anchorElement"]),
        visualisationCollectionDebugWindow: createMessage(),
        visualisationSettingsDebugWindow: createMessage(["guid"]),
        updateLoadSaveReportSettingsWindow: createMessage()
    };

    Ren.MessageBus.populateMessageNames(requests);

    return {
        Events: events,
        Requests: requests,
        withOwner: Ren.MessageBus.withOwner,
        removeListener: Ren.MessageBus.removeListener,
        removeListenersByOwner: Ren.MessageBus.removeListenersByOwner
    };
})();
