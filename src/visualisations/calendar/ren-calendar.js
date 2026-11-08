/**
 * Creates a calendar for picking a date range, or a single day where pickSingleDate is set.  It
 * shows as many months as fit the space it is given, with non-working days in red.  Each range
 * picked is announced on the message bus under the calendar's group, rather than handed to whatever
 * opened it, so the calendar carries on working while the report it is picking dates for reloads.
 *
 * The last day of a range is picked and shown, marked on its right edge, but ranges are announced
 * and summarised with an exclusive end date, the day after, as the rest of Ren holds them.
 *
 * Dates can be highlighted, listed as highlightedDates or read from a data source named by
 * highlightedDatesSource (or its shorthand highlightedDatesDataSourceUri) in the same way as a
 * date/value chart's dateMarkers.  A month ("May 2026") or quarter ("Q2 2026") highlights every day
 * in it.
 */
Ren.CreateCalendar = (_tabularData, visualisation) => {

    // Picking dates is what the user is doing at the time, not part of the report.
    visualisation.excludeFromSerialization = true;
    visualisation.isTransitive = true;

    const calendarGroup = visualisation.calendarGroup;
    const pickSingleDate = visualisation.pickSingleDate === true;

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("Calendar", {});

    const monthsElement = element.querySelector(".js-ren-calendar-months");
    const statusElement = element.querySelector(".js-ren-calendar-status");
    const previousButton = element.querySelector(".js-ren-calendar-previous-button");
    const nextButton = element.querySelector(".js-ren-calendar-next-button");
    const todayButton = element.querySelector(".js-ren-calendar-today-button");

    // Enough wheel movement to scroll by a row of months, in pixels.
    const WHEEL_DELTA_PER_ROW = 100;

    const today = Ren.DateUtils.todayAsSortableDate();

    let monthColumns = visualisation.monthColumns ?? 3;
    let monthRows = visualisation.monthRows ?? 1;

    // The range picked, by its start and exclusive end dates, or null for none.
    let selectionStart = null;
    let selectionEnd = null;

    // The day first clicked while picking a range, and the day the pointer is over since.
    let pickStart = null;
    let hoverDate = null;

    let dayElements = [];
    let dayDates = [];

    let wheelDelta = 0;

    // The days highlighted, by yyyy-MM-dd, each with the labels of the dates covering it.
    let highlightLabelsByDate = new Map();
    let earliestHighlightedDate = null;

    /**
     * Gets a month as a count of months, so that months can be stepped through by adding.
     */
    const getMonthIndex = (sortableDate) => {

        const ymd = Ren.DateUtils.parseSortableDate(sortableDate);

        return ymd.y * 12 + ymd.m - 1;
    };

    const getMonthStart = (monthIndex) => {

        return Ren.DateUtils.formatSortableYmd(Math.floor(monthIndex / 12), monthIndex % 12 + 1, 1);
    };

    const getMonthCount = () => monthColumns * monthRows;

    const toSortableDate = (value) => value ? String(value).substring(0, 10) : null;

    const countDays = (startDate, endDate) => {

        const start = Ren.DateUtils.parseSortableDate(startDate);
        const end = Ren.DateUtils.parseSortableDate(endDate);

        const MS_PER_DAY = 86400000;

        return Math.round(
            (Date.UTC(end.y, end.m - 1, end.d) - Date.UTC(start.y, start.m - 1, start.d)) /
            MS_PER_DAY
        );
    };

    /**
     * Takes up a range given with an exclusive end date.  A range open at either end is shown as
     * no selection at all, as there is nothing to highlight up to.
     */
    const setSelection = (startDate, endDate) => {

        const start = toSortableDate(startDate);
        const end = toSortableDate(endDate);

        if (!start || !end || end <= start) {

            selectionStart = null;
            selectionEnd = null;
            return;
        }

        selectionStart = start;
        selectionEnd = end;
    };

    /**
     * Gets the range covering two days picked in either order, and the days between them.
     */
    const getRangeBetween = (date, otherDate) => {

        return date <= otherDate
            ? { start: date, end: Ren.DateUtils.addDaysToSortableDate(otherDate, 1) }
            : { start: otherDate, end: Ren.DateUtils.addDaysToSortableDate(date, 1) };
    };

    /**
     * Highlights the days from a range's start up to its exclusive end, with the label given, if
     * any.
     */
    const addHighlightedRange = (range, label) => {

        for (
            let date = range.start;
            date < range.end;
            date = Ren.DateUtils.addDaysToSortableDate(date, 1)
        ) {

            const labels = highlightLabelsByDate.get(date);

            if (!labels) {

                highlightLabelsByDate.set(date, label ? [label] : []);
            }
            else if (label && labels.indexOf(label) === -1) {

                labels.push(label);
            }
        }

        if (earliestHighlightedDate === null || range.start < earliestHighlightedDate) {
            earliestHighlightedDate = range.start;
        }
    };

    /**
     * Highlights the days a date covers, with the label given, if any.
     */
    const addHighlightedDate = (dateValue, label) => {

        const range = Ren.DateUtils.parseDateRange(dateValue);

        if (range) addHighlightedRange(range, label);
    };

    /**
     * Highlights a range listed as { start, end, label }, the end being exclusive.  A range
     * without an end covers whatever its start names.
     */
    const addListedRange = (listedRange) => {

        const startRange = Ren.DateUtils.parseDateRange(listedRange.start);

        if (!startRange) return;

        const endRange = Ren.DateUtils.parseDateRange(listedRange.end);
        const end = endRange ? endRange.start : startRange.end;

        if (end <= startRange.start) return;

        addHighlightedRange({ start: startRange.start, end }, listedRange.label ?? "");
    };

    /**
     * Gets the highlighted dates' data source configuration, normalised as a date/value chart's
     * dateMarkers is, or null where none is declared.
     */
    const getHighlightSourceConfig = () => {

        const source = visualisation.highlightedDatesSource;

        // Copied, as normalising it fills in its data source URI.
        return Ren.DateValueChart_DateMarkers.getConfig({
            dateMarkers: source && typeof source === "object" ? Object.assign({}, source) : source,
            dateMarkersDataSourceUri: visualisation.highlightedDatesDataSourceUri
        });
    };

    /**
     * Gets the first month to show where there is no range to open on: that of the earliest date
     * highlighted, or otherwise the one that ends the months on the current month, since reports
     * mostly look back.
     */
    const getInitialFirstMonthIndex = () => earliestHighlightedDate !== null
        ? getMonthIndex(earliestHighlightedDate)
        : getMonthIndex(today) - getMonthCount() + 1;

    /**
     * Highlights the dates in the data source once it arrives, showing them where no range is
     * shown.
     */
    const onHighlightSourceLoaded = () => {

        if (visualisation.isDestroyed) return;

        findHighlightedDates();

        if (selectionStart === null) firstMonthIndex = getInitialFirstMonthIndex();

        renderMonths();
    };

    /**
     * Highlights the dates the data source holds, filtered by its filter set, if any.  The data
     * source is asked for where it has yet to arrive, and the calendar redrawn when it does.
     */
    const addHighlightedDatesFromSource = () => {

        const config = getHighlightSourceConfig();

        if (!config) return;

        const dateMarkers = Ren.DateValueChart_DateMarkers;
        const tabularData = dateMarkers.getTabularData(config);

        if (!tabularData) {

            dateMarkers.requestDataSource(config, { redrawChart: onHighlightSourceLoaded });
            return;
        }

        const { dateColumn, labelColumn } = dateMarkers.getMarkerData(config, tabularData);

        if (!dateColumn) return;

        const rows = dateMarkers.getRows(config, tabularData);

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {

            const row = rows[rowIndex];

            addHighlightedDate(
                row[dateColumn],
                labelColumn ? String(row[labelColumn] ?? "").trim() : ""
            );
        }
    };

    /**
     * Gathers the days to highlight from the dates listed and those in the data source.  A listed
     * date is the date alone, { date, label } or a range as { start, end, label }, and a month or
     * quarter listed alone is labelled with its name.
     */
    const findHighlightedDates = () => {

        highlightLabelsByDate = new Map();
        earliestHighlightedDate = null;

        const highlightedDates = visualisation.highlightedDates ?? [];

        for (let index = 0; index < highlightedDates.length; index++) {

            const highlightedDate = highlightedDates[index];

            if (highlightedDate && typeof highlightedDate === "object") {

                if (highlightedDate.start != null) {
                    addListedRange(highlightedDate);
                }
                else {

                    addHighlightedDate(highlightedDate.date, highlightedDate.label ?? "");
                }

                continue;
            }

            const range = Ren.DateUtils.parseDateRange(highlightedDate);
            const isSingleDay = !!range &&
                range.end === Ren.DateUtils.addDaysToSortableDate(range.start, 1);

            addHighlightedDate(highlightedDate, isSingleDay ? "" : String(highlightedDate).trim());
        }

        addHighlightedDatesFromSource();
    };

    setSelection(visualisation.startDate, visualisation.endDate);
    findHighlightedDates();

    // Opens on the range being edited, where there is one.
    let firstMonthIndex = selectionStart
        ? getMonthIndex(selectionStart)
        : getInitialFirstMonthIndex();

    const renderDay = (date, dayOfMonth, isWeekend) => {

        const isNonWorkingDay = !!date && Ren.WorkingDayUtils.isNonWorkingDay(date);

        const modifierClasses = [];

        if (!date) modifierClasses.push("ren-calendar-month__day--blank");
        if (isWeekend || isNonWorkingDay) modifierClasses.push("ren-calendar-month__day--non-working");
        if (date && date === today) modifierClasses.push("ren-calendar-month__day--today");

        return Ren.HtmlTemplateFunctions.renderHtmlTemplate("CalendarDay", {
            date: date ?? "",
            dayOfMonth: dayOfMonth ?? "",
            modifierClasses: modifierClasses.join(" "),
            tooltip: isNonWorkingDay ? "Non-working day" : ""
        });
    };

    /**
     * Renders a month's days as six weeks, blank either side of the month, so that every month is
     * the same height and they line up in rows.
     */
    const renderDays = (monthIndex) => {

        const y = Math.floor(monthIndex / 12);
        const m = monthIndex % 12 + 1;
        const dayCount = new Date(y, m, 0).getDate();

        // Weeks start on a Monday.
        const leadingBlankCount = (new Date(y, m - 1, 1).getDay() + 6) % 7;

        const DAY_SLOT_COUNT = 42;

        const days = [];

        for (let slotIndex = 0; slotIndex < DAY_SLOT_COUNT; slotIndex++) {

            const dayOfMonth = slotIndex - leadingBlankCount + 1;

            if (dayOfMonth < 1 || dayOfMonth > dayCount) {

                days.push(renderDay(null, null, false));
                continue;
            }

            days.push(renderDay(
                Ren.DateUtils.formatSortableYmd(y, m, dayOfMonth),
                dayOfMonth,
                slotIndex % 7 >= 5
            ));
        }

        return days.join("");
    };

    const createMonthElement = (monthIndex) => {

        const y = Math.floor(monthIndex / 12);
        const m = monthIndex % 12 + 1;

        return Ren.HtmlTemplateFunctions.reifyHtmlTemplate("CalendarMonth", {
            title: Ren.DateUtils.monthNames[m - 1] + " " + y,
            monthStart: getMonthStart(monthIndex),
            daysHtml: renderDays(monthIndex)
        });
    };

    const showRangeStatus = (rangeStart, rangeEnd, isPicking) => {

        const dayCount = countDays(rangeStart, rangeEnd);
        const workingDayCount = Ren.WorkingDayUtils.countWorkingDays(rangeStart, rangeEnd);

        // A range with a summary, such as "Apr 2026" or its one day, is shown by that in place of
        // its dates.
        const summary = dayCount === 1
            ? Ren.DateUtils.sortableDateToddMMyyyy(rangeStart)
            : Ren.DateRangeSummariser.getDateRangeSummary(rangeStart, rangeEnd);

        statusElement.innerHTML = Ren.HtmlTemplateFunctions.renderHtmlTemplate("CalendarStatus", {
            suffix: isPicking ? "Click the end date." : "",
            summary,
            startDate: Ren.DateUtils.sortableDateToddMMyyyy(rangeStart),
            endDate: Ren.DateUtils.sortableDateToddMMyyyy(rangeEnd),
            dayCountText: dayCount === 1 ? "1 day" : dayCount + " days",
            workingDayCountText: workingDayCount === 1
                ? "1 working day"
                : workingDayCount + " working days"
        });
    };

    /**
     * Shows the days highlighted as a range picked would be when they run unbroken, or otherwise
     * how many there are.
     */
    const showHighlightStatus = () => {

        const highlightedDayCount = highlightLabelsByDate.size;
        const instruction = pickSingleDate
            ? "Click a date."
            : "Click the start date of a range.";

        if (highlightedDayCount === 0) {

            statusElement.textContent = instruction;
            return;
        }

        let firstDate = null;
        let lastDate = null;
        let highlightedWorkingDayCount = 0;

        highlightLabelsByDate.forEach((labels, date) => {

            if (firstDate === null || date < firstDate) {
                firstDate = date;
            }

            if (lastDate === null || date > lastDate) {
                lastDate = date;
            }

            highlightedWorkingDayCount += Ren.WorkingDayUtils.countWorkingDays(
                date,
                Ren.DateUtils.addDaysToSortableDate(date, 1)
            );
        });

        const rangeEnd = Ren.DateUtils.addDaysToSortableDate(lastDate, 1);

        if (countDays(firstDate, rangeEnd) === highlightedDayCount) {

            showRangeStatus(firstDate, rangeEnd, false);
            return;
        }

        statusElement.innerHTML = Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "CalendarHighlightStatus",
            {
                dayCountText: highlightedDayCount === 1
                    ? "1 day"
                    : highlightedDayCount + " days",
                workingDayCountText: highlightedWorkingDayCount === 1
                    ? "1 working day"
                    : highlightedWorkingDayCount + " working days",
                instruction
            }
        );
    };

    const showStatus = (rangeStart, rangeEnd, isPicking) => {

        if (rangeStart === null) {

            showHighlightStatus();
            return;
        }

        if (pickSingleDate) {

            statusElement.textContent =
                "Selected date: " + Ren.DateUtils.sortableDateToddMMyyyy(rangeStart);
            return;
        }

        showRangeStatus(rangeStart, rangeEnd, isPicking);
    };

    /**
     * Highlights the range picked, or while one is being picked, the range from the day first
     * clicked to the day under the pointer.
     */
    const showSelection = () => {

        const isPicking = pickStart !== null;

        let rangeStart = selectionStart;
        let rangeEnd = selectionEnd;

        if (isPicking) {

            const range = getRangeBetween(pickStart, hoverDate ?? pickStart);

            rangeStart = range.start;
            rangeEnd = range.end;
        }

        element.classList.toggle("ren-calendar--picking", isPicking);

        const rangeLastDay = rangeStart !== null
            ? Ren.DateUtils.addDaysToSortableDate(rangeEnd, -1)
            : null;

        for (let dayIndex = 0; dayIndex < dayElements.length; dayIndex++) {

            const date = dayDates[dayIndex];

            if (!date) continue;

            const dayElement = dayElements[dayIndex];
            const isInRange = rangeStart !== null && date >= rangeStart && date < rangeEnd;

            dayElement.classList.toggle("ren-calendar-month__day--in-range", isInRange);
            dayElement.classList.toggle(
                "ren-calendar-month__day--range-start",
                isInRange && date === rangeStart
            );

            dayElement.classList.toggle(
                "ren-calendar-month__day--range-end",
                isInRange && date === rangeLastDay
            );
        }

        showStatus(rangeStart, rangeEnd, isPicking);
    };

    /**
     * Highlights a day shown if it is among those highlighted, adding its labels to what it says
     * on hover.  The labels are set here rather than in the template, as they can hold quotes.
     */
    const showHighlightedDay = (dayElement, date) => {

        const labels = highlightLabelsByDate.get(date);

        dayElement.classList.toggle("ren-calendar-month__day--highlighted", !!labels);

        if (!labels || labels.length === 0) return;

        const tooltipLines = labels.slice();

        if (dayElement.title) tooltipLines.push(dayElement.title);

        dayElement.title = tooltipLines.join("\n");
    };

    const findDayElements = () => {

        dayElements = monthsElement.querySelectorAll(".js-ren-calendar-day");
        dayDates = new Array(dayElements.length);

        for (let dayIndex = 0; dayIndex < dayElements.length; dayIndex++) {

            const date = dayElements[dayIndex].getAttribute("data-date");

            dayDates[dayIndex] = date;

            if (date) showHighlightedDay(dayElements[dayIndex], date);
        }

        showSelection();
    };

    const renderMonths = () => {

        monthsElement.innerHTML = "";
        monthsElement.style.gridTemplateColumns = "repeat(" + monthColumns + ", max-content)";

        const monthCount = getMonthCount();

        for (let monthOffset = 0; monthOffset < monthCount; monthOffset++) {

            monthsElement.appendChild(createMonthElement(firstMonthIndex + monthOffset));
        }

        findDayElements();
    };

    /**
     * Adds or removes months at the end to show as many as the layout now takes.  The months
     * already shown are left in place, so that only those added fade in.
     */
    const fitMonths = () => {

        monthsElement.style.gridTemplateColumns = "repeat(" + monthColumns + ", max-content)";

        const monthCount = getMonthCount();

        while (monthsElement.children.length > monthCount) {

            monthsElement.lastElementChild.remove();
        }

        for (
            let monthOffset = monthsElement.children.length;
            monthOffset < monthCount;
            monthOffset++
        ) {

            const monthElement = createMonthElement(firstMonthIndex + monthOffset);

            monthElement.classList.add("ren-calendar-month--fading-in");

            monthsElement.appendChild(monthElement);
        }

        findDayElements();
    };

    /**
     * Fits as many whole months into the space available as it will take, keeping the first month
     * where it is, so that widening the window shows later months beside those already there.
     */
    const layOutMonths = () => {

        const sampleMonth = monthsElement.querySelector(".js-ren-calendar-month");

        if (!sampleMonth) return;

        const monthWidth = sampleMonth.offsetWidth;
        const monthHeight = sampleMonth.offsetHeight;
        const availableWidth = monthsElement.clientWidth;
        const availableHeight = monthsElement.clientHeight;

        if (!monthWidth || !monthHeight || !availableWidth || !availableHeight) return;

        const monthsStyle = getComputedStyle(monthsElement);
        const columnGap = parseFloat(monthsStyle.columnGap) || 0;
        const rowGap = parseFloat(monthsStyle.rowGap) || 0;

        // A pixel's leeway, as the window is fitted to measurements that have been rounded.
        const columns = Math.max(
            1,
            Math.floor((availableWidth + columnGap + 1) / (monthWidth + columnGap))
        );

        const rows = Math.max(
            1,
            Math.floor((availableHeight + rowGap + 1) / (monthHeight + rowGap))
        );

        if (columns === monthColumns && rows === monthRows) return;

        monthColumns = columns;
        monthRows = rows;

        fitMonths();
    };

    const moveMonths = (monthOffset) => {

        firstMonthIndex += monthOffset;

        renderMonths();
    };

    /**
     * Brings a date into view, if it is not already, as the first month shown.
     */
    const showMonthOf = (date) => {

        const monthIndex = getMonthIndex(date);

        if (monthIndex >= firstMonthIndex && monthIndex < firstMonthIndex + getMonthCount()) {

            showSelection();
            return;
        }

        firstMonthIndex = monthIndex;

        renderMonths();
    };

    const selectRange = (startDate, endDate) => {

        pickStart = null;
        hoverDate = null;
        selectionStart = startDate;
        selectionEnd = endDate;

        showSelection();

        Ren.Messages.Events.calendarDateRangeSelected.notify(calendarGroup, startDate, endDate);
    };

    const selectRangeBetween = (date, otherDate) => {

        const range = getRangeBetween(date, otherDate);

        selectRange(range.start, range.end);
    };

    /**
     * Picks a range with two clicks, on its first and last days in either order.  Shift+click moves
     * the first day if the day clicked is before it, and otherwise the last day.  A single date is
     * picked with one click.
     */
    const onDayClicked = (date, isShiftClick) => {

        if (pickSingleDate) {

            selectRange(date, Ren.DateUtils.addDaysToSortableDate(date, 1));
            return;
        }

        if (isShiftClick && pickStart === null && selectionStart !== null) {

            if (date < selectionStart) {

                selectRange(date, selectionEnd);
            }
            else {

                selectRangeBetween(selectionStart, date);
            }

            return;
        }

        if (pickStart === null) {

            pickStart = date;
            hoverDate = date;

            showSelection();
            return;
        }

        selectRangeBetween(pickStart, date);
    };

    const getEventDate = (e) => e.target.closest(".js-ren-calendar-day")?.getAttribute("data-date");

    monthsElement.addEventListener("click", (e) => {

        const monthTitle = e.target.closest(".js-ren-calendar-month-title");

        // A month is a range, so is not picked where a single date is.
        if (monthTitle && !pickSingleDate) {

            const monthIndex = getMonthIndex(monthTitle.getAttribute("data-month-start"));

            selectRange(getMonthStart(monthIndex), getMonthStart(monthIndex + 1));
            return;
        }

        const date = getEventDate(e);

        if (!date) return;

        onDayClicked(date, e.shiftKey);
    });

    monthsElement.addEventListener("mouseover", (e) => {

        if (pickStart === null) return;

        const date = getEventDate(e);

        if (!date || date === hoverDate) return;

        hoverDate = date;

        showSelection();
    });

    // Scrolls by a row of months, so that the months shown stay in the same columns.
    monthsElement.addEventListener("wheel", (e) => {

        e.preventDefault();

        wheelDelta += e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * 40;

        if (Math.abs(wheelDelta) < WHEEL_DELTA_PER_ROW) return;

        const rowCount = wheelDelta > 0 ? 1 : -1;

        wheelDelta = 0;

        moveMonths(rowCount * monthColumns);
    }, { passive: false });

    previousButton.addEventListener("click", () => {

        moveMonths(-1);
    });

    nextButton.addEventListener("click", () => {

        moveMonths(1);
    });

    todayButton.addEventListener("click", () => {

        firstMonthIndex = getMonthIndex(today);

        renderMonths();
    });

    Ren.Messages.Events.escapeKey.handle(() => {

        if (visualisation.isDestroyed) return false;

        if (pickStart === null) return;

        pickStart = null;
        hoverDate = null;

        showSelection();
    });

    Ren.Messages.Events.visualisationContainerResize.handle((visualisationGuid) => {

        if (visualisation.isDestroyed) return false;

        if (visualisationGuid !== visualisation.visualisationGuid) return;

        layOutMonths();
    });

    Ren.Messages.Events.dateSelectorDateRangeChanged.handle((
        changedCalendarGroup,
        startDate,
        endDate
    ) => {

        if (visualisation.isDestroyed) return false;

        if (changedCalendarGroup !== calendarGroup) return;

        setSelection(startDate, endDate);

        if (selectionStart === null) {

            showSelection();
            return;
        }

        showMonthOf(selectionStart);
    });

    renderMonths();

    return {
        element
    };
};
