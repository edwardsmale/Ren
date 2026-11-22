/**
 * Provides date tick formatting functions for the date value chart.
 */
Ren.DateValueChart_DateTickFormat = (() => {

    const formatMonthName = Ren.ChartDateTime.createLocalFormat("MMM");
    const formatDayAndMonth = Ren.ChartDateTime.createLocalFormat("dd MMM");

    /**
     * Returns a tick format function based on the specified date period.
     */
    const getTickFormat = datePeriod => {

        const formatDay = date => {

            const day = date.getDate();
            const month = formatMonthName(date);
            const year = date.getFullYear();
            return `${day} ${month}\n${year}`;
        };

        const formatWeek = date => {

            const weekStart = formatDayAndMonth(Ren.DateUtils.startOfWeek(date));
            const year = date.getFullYear();
            return `${weekStart}\n${year}`;
        };

        const formatMonth = date => {

            const month = formatMonthName(date);
            return `${month}\n${date.getFullYear()}`;
        };

        // Sub-day dates are plotted as UTC wall-clock times, so are read by their UTC parts.  The
        // date goes on the last line, where a repeat of the one before it is dropped (see
        // Ren.DateValueChart_DeclutterDateAxisLabels).
        const formatTimeOfDay = timePattern =>
            Ren.ChartDateTime.createUtcFormat(timePattern + "\nd MMM yyyy");

        const formatQuarter = date => {

            return `Q${Ren.DateUtils.quarterNumber(date)}\n${date.getFullYear()}`;
        };

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second:
                return formatTimeOfDay("HH:mm:ss");
            case Ren.DatePeriodEnum.Minute:
            case Ren.DatePeriodEnum.QuarterHour:
                return formatTimeOfDay("HH:mm");
            case Ren.DatePeriodEnum.Hour:
                return formatTimeOfDay("HH:00");
            case Ren.DatePeriodEnum.Day:
                return formatDay;
            case Ren.DatePeriodEnum.Week:
                return formatWeek;
            case Ren.DatePeriodEnum.Month:
                return formatMonth;
            case Ren.DatePeriodEnum.Quarter:
                return formatQuarter;
            case Ren.DatePeriodEnum.Year:
                return Ren.ChartDateTime.createLocalFormat("yyyy");
        }
    };

    /**
     * Gets what an all-time chart's one point is labelled: the dates its range covers, or "All
     * time" where it covers every date.
     */
    const getAllTimeLabel = (props) =>
        (props.chartDateRange
            ? Ren.DateValueChart_DateRange.describe({}, props.chartDateRange)
            : null) || "All time";

    /**
     * Gets the tick format for a chart's dates: the one for the period it draws, or for an
     * all-time chart, its label whatever the date.
     */
    const getChartTickFormat = (props) =>
        props.isAllTime ? () => getAllTimeLabel(props) : getTickFormat(props.datePeriod);

    /**
     * Gets the tick format for a chart's date axis, which leaves an all-time chart's one tick
     * unlabelled, as there is no date on it to tell apart from another.
     */
    const getAxisTickFormat = (props) =>
        props.isAllTime ? () => null : getChartTickFormat(props);

    return {
        getAllTimeLabel,
        getAxisTickFormat,
        getChartTickFormat,
        getTickFormat
    };
})();
