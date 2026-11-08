Ren.CreateDateSelector = (tabularData, visualisation) => {

    const showCompareDates = visualisation.showCompareDates === true;

    // When only the date range is shown, the report should reload when the date range is changed.
    // Conversely, when the compare date range is shown, the report should not reload when the
    // date range is changed, but instead show an "Update" button that the user can click to
    // reload the report with the new date range.
    const reloadOnChange = !showCompareDates;

    // All editing functions are hidden and disabled in downloaded reports, since in that context
    // the report can't reload itself with different query parameters.  The date selector may also 
    // be disabled using the disabled property in the visualisation options.
    const isDisabled = Ren.UrlContext.isDownloadedReport() || visualisation.disabled;

    let startDate, endDate, compareStartDate, compareEndDate;

    // Without a data source, or in a downloaded report where it may not be available, the dates
    // are the report's own: those a data source would have been requested with.
    if (!tabularData) {

        ({ startDate, endDate, compareStartDate, compareEndDate } =
            Ren.DataSourceUriResolver.getDates(visualisation, visualisation.element));

        // Try to extract from the data source URI as a last resort.
        if (!startDate && visualisation.dataSourceUri) {

            try {

                const url = new URL(visualisation.dataSourceUri, window.location.origin);
                startDate = url.searchParams.get('startDate');
                endDate = url.searchParams.get('endDate');
                compareStartDate = url.searchParams.get('compareStartDate');
                compareEndDate = url.searchParams.get('compareEndDate');
            }
            catch (e) {

                // The dates are left unset.
            }
        }

        if (!startDate && !endDate) {
            console.warn(`[DateSelector] Could not determine dates - date selector will show 'Not set'`);
        }
    }
    else {

        // Normal case: extract dates from tabular data.
        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        // The tabular data has two rows, one for the date range and one for the compare date range.
        // The column headings we need are "StartDate" and "EndDate".

        const startDateColumn = tabularData.ColumnModels.findIndex(c => c.ColumnIdOrHeading === "StartDate");
        const endDateColumn = tabularData.ColumnModels.findIndex(c => c.ColumnIdOrHeading === "EndDate");

        startDate = decompressValue(tabularData.RowModels[0].CV[startDateColumn], startDateColumn);
        endDate = decompressValue(tabularData.RowModels[0].CV[endDateColumn], endDateColumn);

        compareStartDate = decompressValue(tabularData.RowModels[1].CV[startDateColumn], startDateColumn);
        compareEndDate = decompressValue(tabularData.RowModels[1].CV[endDateColumn], endDateColumn);

        // Convert null sentinel to null for date values
        if (startDate === Ren.NullSentinel) startDate = null;
        if (endDate === Ren.NullSentinel) endDate = null;
        if (compareStartDate === Ren.NullSentinel) compareStartDate = null;
        if (compareEndDate === Ren.NullSentinel) compareEndDate = null;
    }

    const state = {
        startDate,
        endDate,
        compareStartDate,
        compareEndDate
    };

    if (state.startDate === "2000-01-01") { // RenDateHelper.OriginDate

        state.startDate = undefined;
    }

    if (state.endDate === "2100-01-01") { // RenDateHelper.HorizonDate

        state.endDate = undefined;
    }

    const reifiedTemplate = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("DateSelectorTemplate", {});

    const element = document.createElement("div");
    element.appendChild(reifiedTemplate);
    element.classList.add("ren-web-report-date-selector", "ren-shadow-module");
    if (showCompareDates) element.classList.add("ren-web-report-date-selector--with-compare-dates");
    if (!showCompareDates) element.classList.add("ren-web-report-date-selector--without-compare-dates");
    if (isDisabled) element.classList.add("ren-web-report-date-selector--disabled");

    const showUpdateButton = () => {

        const updateButton = element.querySelector(".js-ren-date-range-update-button");
        updateButton.style.opacity = "1";
        updateButton.style.pointerEvents = "auto";
    };

    element.querySelector(".js-ren-date-range-update-button").addEventListener("click", (e) => {

        e.preventDefault();
        updateDateRange();
    });

    const renderDateRange = (startDate, endDate, targetSelector, summary) => {

        const targetElement = element.querySelector(targetSelector);

        if (summary) {

            targetElement.innerHTML = summary;
            return;
        }

        const startDateText = Ren.DateUtils.sortableDateToddMMyyyy(startDate);
        const endDateText = Ren.DateUtils.sortableDateToddMMyyyy(endDate);

        if (Ren.IsNull(startDate) && Ren.IsNull(endDate)) {

            targetElement.innerHTML = '<span class="ren-not-set">Not set</span>';
        }
        else if (Ren.IsNull(startDate)) {

            targetElement.innerHTML = `<span class="ren-not-set">Not set</span> to ${endDateText}`;
        }
        else {

            targetElement.innerHTML = `${startDateText} <span class="ren-web-report-date-selector__date-range-text-to">to</span> ${endDateText}`;
        }
    };

    const showDateRange = (revealUpdateButton) => {

        let primarySummary = null;
        let compareSummary = null;

        if (showCompareDates && state.compareStartDate && state.compareEndDate) {

            const comparison = Ren.DateRangeSummariser.getDateRangeComparisonSummary(
                state.startDate,
                state.endDate,
                state.compareStartDate,
                state.compareEndDate
            );

            if (comparison) {

                primarySummary = comparison.dateRangeSummary;
                compareSummary = comparison.compareDateRangeSummary;
            }
        }

        if (!primarySummary) {
            primarySummary = Ren.DateRangeSummariser.getDateRangeSummary(state.startDate, state.endDate);
        }

        if (showCompareDates && !compareSummary) {
            compareSummary = Ren.DateRangeSummariser.getDateRangeSummary(state.compareStartDate, state.compareEndDate);
        }

        renderDateRange(state.startDate, state.endDate, ".js-ren-web-report-date-selector-date-range-text", primarySummary);
        renderDateRange(state.compareStartDate, state.compareEndDate, ".js-ren-web-report-date-selector-compare-date-range-text", compareSummary);

        if (revealUpdateButton) showUpdateButton();

        notifyCalendars();
    };

    /**
     * Gets the group under which a calendar picks the date range or the compare date range.  It is
     * keyed on the report rather than on this date selector, so that a calendar left open carries
     * on with the date selector that replaces this one when the report reloads.
     */
    const getCalendarGroup = (target) => {

        return (visualisation.containingReportGuid ?? visualisation.visualisationGuid) + "|" + target;
    };

    // A range cleared to the origin and horizon dates is shown in a calendar as no range at all.
    const toCalendarDate = (date, sentinel) => date && date !== sentinel ? date : null;

    const notifyCalendars = () => {

        Ren.Messages.Events.dateSelectorDateRangeChanged.notify(
            getCalendarGroup("Date"),
            toCalendarDate(state.startDate, "2000-01-01"),
            toCalendarDate(state.endDate, "2100-01-01")
        );

        if (!showCompareDates) return;

        Ren.Messages.Events.dateSelectorDateRangeChanged.notify(
            getCalendarGroup("CompareDate"),
            toCalendarDate(state.compareStartDate, "2000-01-01"),
            toCalendarDate(state.compareEndDate, "2100-01-01")
        );
    };

    if (showCompareDates) {

        element.querySelector(".js-ren-compare-mom").addEventListener("click", () => {

            state.compareStartDate = Ren.DateUtils.addMonths(state.startDate, -1);
            state.compareEndDate = Ren.DateUtils.addMonths(state.endDate, -1);
            onCompareDateRangeEdited();
            showDateRange(true);
        });

        element.querySelector(".js-ren-compare-qoq").addEventListener("click", () => {

            state.compareStartDate = Ren.DateUtils.addMonths(state.startDate, -3);
            state.compareEndDate = Ren.DateUtils.addMonths(state.endDate, -3);
            onCompareDateRangeEdited();
            showDateRange(true);
        });

        element.querySelector(".js-ren-compare-yoy").addEventListener("click", () => {

            state.compareStartDate = Ren.DateUtils.addMonths(state.startDate, -12);
            state.compareEndDate = Ren.DateUtils.addMonths(state.endDate, -12);
            onCompareDateRangeEdited();
            showDateRange(true);
        });
    }

    const updateDateRange = () => {

        Ren.DateSelectorDateUpdater.updateDateRange(
            visualisation,
            state.startDate,
            state.endDate,
            showCompareDates && state.compareStartDate,
            showCompareDates && state.compareEndDate
        );
    };

    showDateRange(false);

    const onDateRangeEdited = () => {

        element.querySelector(".js-ren-web-report-date-selector-date-range-text")
            .classList.add("ren-web-report-date-selector__date-range-text--edited");

        if (reloadOnChange) updateDateRange();
    };

    const onCompareDateRangeEdited = () => {

        element.querySelector(".js-ren-web-report-date-selector-compare-date-range-text")
            .classList.add("ren-web-report-date-selector__date-range-text--edited");
    };

    Ren.Messages.Events.calendarDateRangeSelected.handle((calendarGroup, startDate, endDate) => {

        if (visualisation.isDestroyed) return false;

        if (calendarGroup === getCalendarGroup("Date")) {

            state.startDate = startDate;
            state.endDate = endDate;
            onDateRangeEdited();
        }
        else if (calendarGroup === getCalendarGroup("CompareDate")) {

            state.compareStartDate = startDate;
            state.compareEndDate = endDate;
            onCompareDateRangeEdited();
        }
        else {

            return;
        }

        showDateRange(true);
    });

    Ren.DateSelector_ContextMenu.initialise(
        element,
        getCalendarGroup,
        state,
        showDateRange,
        onDateRangeEdited,
        onCompareDateRangeEdited
    );

    return {
        element
    };
};
