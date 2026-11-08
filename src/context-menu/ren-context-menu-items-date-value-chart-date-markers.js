/**
 * The date/value chart context menu's "Date markers" submenu: showing and hiding the markers a
 * chart reads from a marker data source, listing the dates behind them as a grid, and clearing the
 * filter set there (see Ren.DateValueChart_DateMarkers and Ren.DateValueChart_DateMarkersGrid).
 *
 * It also determines the layout of date marker labels and the function that decides what each flag
 * says (see Ren.DateValueChart_MarkerLabels and formatMarkerLabels in
 * ren-date-value-chart-marker-lines.js).
 */
Ren.ContextMenuItems_DateValueChart_DateMarkers = (chart) => {

    const { visualisation, props } = chart;

    const DateMarkers = Ren.DateValueChart_DateMarkers;
    const DateMarkersGrid = Ren.DateValueChart_DateMarkersGrid;
    const MarkerLabels = Ren.DateValueChart_MarkerLabels;
    const CalendarMarkers = Ren.DateValueChart_CalendarMarkers;

    const hasDateMarkers = () => !!DateMarkers.getConfig(visualisation);

    /**
     * Gets a value indicating whether the chart has any date markers.
     */
    const hasAnyMarker = () => hasDateMarkers()
        || !!visualisation.markerLines
        || CalendarMarkers.getPeriods(visualisation).length > 0;

    /**
     * Gets the data source text to display in the input box when the user opens the date markers
     * data source window.
     */
    const getDataSourceText = () => {

        const config = DateMarkers.getConfig(visualisation);

        if (!config) return "";

        return config.sqlFilename || config.dataSourceUri || "";
    };

    /**
     * Points the chart at a marker data source, or removes the one it has where nothing is entered.
     *
     * A bare name is the SQL file the dates are read from; anything carrying a path or parameters
     * is a data source URI already.
     */
    const setDataSource = (text) => {

        const value = (text ?? "").trim();
        const config = DateMarkers.getConfig(visualisation);
        const previousDataSourceUri = config?.dataSourceUri ?? null;

        if (!value) {

            visualisation.dateMarkers = null;
            visualisation.dateMarkersDataSourceUri = null;

            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);

            return;
        }

        const newConfig = config ?? {};
        const isUri = value.indexOf("/") !== -1 || value.indexOf("?") !== -1;

        if (isUri) {

            newConfig.dataSourceUri = value;
            newConfig.sqlFilename = null;
        }
        else {

            newConfig.sqlFilename = value;
            newConfig.dataSourceUri = null;
        }

        // The shorthand form is dropped with the same write, so a chart that declared one is not
        // left stating two sources with the object form quietly winning.
        visualisation.dateMarkers = newConfig;
        visualisation.dateMarkersDataSourceUri = null;

        // Reading the configuration back resolves and normalises the URI, so the comparison below
        // is between the two sources as the chart actually requests them.
        const resolvedConfig = DateMarkers.getConfig(visualisation);

        // A marker filter names the columns and values of the source it was set on, so it means
        // nothing on a different one: kept, it would silently filter out every marker the new
        // source offers.
        if (resolvedConfig && resolvedConfig.dataSourceUri !== previousDataSourceUri) {
            resolvedConfig.filterSet = null;
        }

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    const showDataSourceWindow = () => Ren.CreateOkCancelTextEditorPopupWindow(
        "Date markers data source",
        (text) => setDataSource(text),
        {
            label: "SQL file name, or a data source URI.  Leave blank for no date markers.",
            initialText: getDataSourceText(),
            multiline: false,
            width: 420,
            height: 150
        }
    );

    /**
     * Flips the markers on or off, saving the choice with the chart so it opens as the reader left
     * it.  Written through the grid module's setter, which is where the configuration object is
     * normalised and committed.
     */
    const toggleShowDateMarkers = () => {

        const config = DateMarkers.getConfig(visualisation);

        if (!config) return;

        config.hidden = !config.hidden;
        visualisation.dateMarkers = config;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    const showDateMarkersMenuItem = {
        text: "Show date markers",
        id: "date-value-chart-show-date-markers",
        visible: () => hasDateMarkers(),
        ticked: () => !DateMarkers.getConfig(visualisation)?.hidden,
        action: () => toggleShowDateMarkers()
    };

    // The dates themselves, as a grid: what each marker stands for, and where the reader picks
    // which of them the chart is annotated with - by ticking them off one at a time, or by
    // filtering the grid where there are too many for that.
    const showDatesGridMenuItem = {
        text: "Dates...",
        id: "date-value-chart-date-markers-grid",
        visible: () => hasDateMarkers(),
        action: () => DateMarkersGrid.showDatesGrid(visualisation, props)
    };

    /**
     * Gets the date of the right-clicked date marker as the marker filter holds it, or null where
     * the right-click was not on one of this chart's date markers.
     */
    const getClickedDateMarkerValue = () => {

        const target = Ren.LastRightClickTarget;
        const markerElement = target?.closest ? target.closest("[data-date-marker-value]") : null;
        const svgNode = props.svg;

        if (!markerElement || !svgNode || !svgNode.contains(markerElement)) return null;

        return markerElement.getAttribute("data-date-marker-value");
    };

    // Unsectioned, so that it leads the menu as what was clicked.
    const hideClickedDateMarkerMenuItem = {
        text: "Hide this date marker",
        id: "date-value-chart-hide-date-marker",
        visible: () => getClickedDateMarkerValue() !== null,
        action: () => {

            const value = getClickedDateMarkerValue();

            if (value === null) return;

            DateMarkersGrid.hideDate(visualisation, props, value);
        }
    };

    const clearDateMarkersFilterMenuItem = {
        text: "Show every date",
        id: "date-value-chart-clear-date-markers-filter",
        visible: () => hasDateMarkers() && DateMarkersGrid.hasFilter(visualisation),
        action: () => DateMarkersGrid.clearFilter(visualisation, props)
    };

    const calendarMarkerPeriods = [
        { period: CalendarMarkers.PERIODS.years, text: "Years", example: "2025" },
        { period: CalendarMarkers.PERIODS.quarters, text: "Quarters", example: "Q2 2025" },
        { period: CalendarMarkers.PERIODS.months, text: "Months", example: "Feb 2025" }
    ];

    const calendarMarkersSubmenu = calendarMarkerPeriods.map(item => ({
        text: item.text,
        title: "A marker at the start of every " + item.text.toLowerCase().replace(/s$/, "")
            + ", e.g. \"" + item.example + "\".  A date starting several periods is marked only "
            + "with the longest",
        id: "date-value-chart-calendar-markers-" + item.period,
        ticked: () => CalendarMarkers.hasPeriod(visualisation, item.period),
        action: () => CalendarMarkers.setPeriodShown(
            visualisation,
            item.period,
            !CalendarMarkers.hasPeriod(visualisation, item.period),
            props
        )
    }));

    const todayMarkerMenuItem = {
        text: "Today",
        title: "A marker at today's date",
        id: "date-value-chart-calendar-markers-" + CalendarMarkers.PERIODS.today,
        ticked: () => CalendarMarkers.hasPeriod(visualisation, CalendarMarkers.PERIODS.today),
        action: () => CalendarMarkers.setPeriodShown(
            visualisation,
            CalendarMarkers.PERIODS.today,
            !CalendarMarkers.hasPeriod(visualisation, CalendarMarkers.PERIODS.today),
            props
        )
    };

    calendarMarkersSubmenu.unshift(todayMarkerMenuItem, Ren.MENU_SEPARATOR);

    const calendarMarkersMenuItem = {
        text: "Calendar markers",
        id: "date-value-chart-calendar-markers",
        submenu: calendarMarkersSubmenu
    };

    const shadeNonWorkingDaysMenuItem = {
        text: "Shade non-working days",
        id: "date-value-chart-shade-non-working-days",
        title: "Shades the weekends and holidays behind the series",
        visible: () => Ren.DateValueChart_NonWorkingDays.isAvailable(props),
        ticked: () => Ren.DateValueChart_NonWorkingDays.isShown(props),
        action: () => {

            visualisation.shadeNonWorkingDays = visualisation.shadeNonWorkingDays !== true;
            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
        }
    };

    const markerLabelLayouts = [
        {
            layout: MarkerLabels.LAYOUTS.auto,
            text: "Automatic",
            title: "The labels themselves where they fit, and numbers with a key where they do not"
        },
        {
            layout: MarkerLabels.LAYOUTS.staggered,
            text: "Staggered labels",
            title: "The labels themselves, stacked above the chart; any that will not fit are left "
                + "off"
        },
        {
            layout: MarkerLabels.LAYOUTS.numbered,
            text: "Numbers with a key",
            title: "A number at each marker, and a key beneath the chart saying what each stands for"
        },
        {
            layout: MarkerLabels.LAYOUTS.numbers,
            text: "Numbers without a key",
            title: "A number at each marker and nothing beneath the chart: what each stands for is "
                + "read by hovering it"
        },
        {
            layout: MarkerLabels.LAYOUTS.hover,
            text: "Only on hover",
            title: "No labels on the chart: what a marker stands for is read by hovering its line"
        }
    ];

    const markerLabelsSubmenu = markerLabelLayouts.map(item => ({
        text: item.text,
        title: item.title,
        id: "date-value-chart-marker-labels-" + item.layout,
        ticked: () => MarkerLabels.getLayout(visualisation) === item.layout,
        action: () => MarkerLabels.setLayout(visualisation, item.layout, props)
    }));

    const markerLabelsMenuItem = {
        text: "Marker labels",
        id: "date-value-chart-marker-labels",
        visible: () => hasAnyMarker(),
        submenu: markerLabelsSubmenu
    };

    /**
     * Gets the chart's flag function's code, or an empty string where none is set.
     */
    const getFlagTextFunctionCode = () => {

        const specification = visualisation.markerLabelFormatFunction;

        return typeof specification === "string" ? specification : "";
    };

    const hasFlagTextFunction = () => !!getFlagTextFunctionCode();

    /**
     * Sets the function for the date marker labels.  Passing null/empty clears it.
     */
    const setFlagTextFunction = (code) => {

        const value = (code ?? "").trim();

        visualisation.markerLabelFormatFunction = value || null;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    const flagTextFunctionMenuItem = {
        text: "Flag text function...",
        id: "date-value-chart-marker-label-format-function",
        title: "A function deciding what each marker's flag says, from its label and the row it "
            + "came from",
        visible: () => hasAnyMarker(),
        action: () => Ren.Messages.Requests.functionEditorWindow.notify(
            getFlagTextFunctionCode,
            (code) => setFlagTextFunction(code),
            null,
            null,
            { centred: true, parameterSet: "flagText" }
        )
    };

    const clearFlagTextFunctionMenuItem = {
        text: "Use the labels as they are",
        id: "date-value-chart-clear-marker-label-format-function",
        title: "Draws each flag with the label its marker resolved to, dropping the flag text "
            + "function",
        visible: () => hasAnyMarker() && hasFlagTextFunction(),
        action: () => setFlagTextFunction(null)
    };

    const dateMarkersDataSourceMenuItem = {
        text: "Data source...",
        id: "date-value-chart-date-markers-data-source",
        title: "The SQL file or data source URI the chart's marker dates are read from",
        action: () => showDataSourceWindow()
    };

    const dateMarkersSubmenu = [
        showDateMarkersMenuItem,
        showDatesGridMenuItem,
        clearDateMarkersFilterMenuItem,
        Ren.MENU_SEPARATOR,
        calendarMarkersMenuItem,
        shadeNonWorkingDaysMenuItem,
        Ren.MENU_SEPARATOR,
        markerLabelsMenuItem,
        flagTextFunctionMenuItem,
        clearFlagTextFunctionMenuItem,
        Ren.MENU_SEPARATOR,
        dateMarkersDataSourceMenuItem
    ];

    const dateMarkersMenuItem = {
        section: "Dates",
        text: "Date markers",
        id: "date-value-chart-date-markers",

        // Kept in the settings while the chart has no date column, but with no dates to mark.
        visible: () => props.hasDateColumn !== false,
        submenu: dateMarkersSubmenu
    };

    return {
        hideClickedDateMarkerMenuItem,
        dateMarkersMenuItem
    };
};
