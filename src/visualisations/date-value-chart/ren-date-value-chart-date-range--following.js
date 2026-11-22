/**
 * Keeps the date/value charts sharing a date range group in step: a range picked on one chart is
 * applied to the others, so several charts of the same data read the same span of dates, and the
 * date hovered on one is shown on the others.
 *
 * A chart's group defaults to its filter group - which a begotten chart takes from the grid it was
 * drawn from - so charts of one grid follow each other with nothing configured, and dateRangeGroup
 * names a group of its own where that is not what is wanted.
 */
Ren.DateValueChart_DateRange_Following = (() => {

    /**
     * Subscribes a chart to the ranges picked on the others in its date range group.  Called as the
     * chart is initialised, so the subscription lasts as long as the chart does.
     *
     * Applied immediately rather than at the end of the turn, so that the chart keeps pace with a
     * pan or zoom on another; the one panned already applies at most one range per frame.  A range
     * from a chart grouped by another period, or drawn as other multi-charts, is passed over.
     * Where a multi-chart drawn as this one's count of charts is drawn as another, this one is
     * drawn as that count too.
     */
    const followDateRangeGroup = (visualisation, props) => {

        Ren.DataGroupingSettingsBinding({
            visualisation,
            onDateRangeChanged: {
                immediate: true,
                handler: (range, rangeSignature, chartCount) => {

                    const DateRange = Ren.DateValueChart_DateRange;

                    if (rangeSignature !== DateRange.getRangeSignature(visualisation)) return;

                    if (chartCount) {

                        Ren.DateValueChart_MultiChart.setMaxChartCount(
                            visualisation,
                            props,
                            chartCount
                        );
                    }

                    DateRange.applyToChart(visualisation, props, range);
                }
            },
            // Only a chart showing or highlighting its own hovered date shows another's.
            onHoveredDateChanged: {
                immediate: true,
                handler: (date) => {

                    if (props.hasDateColumn === false) return;

                    if (!props.showHoverDateLine
                        && !props.hoverDateLineFullHeight
                        && !props.showHoverValues) {

                        return;
                    }

                    props.showHoveredDate?.(date);
                }
            }
        });
    };

    /**
     * Announces the date a chart's hover band stands at, or null once it is taken down, so that
     * the charts sharing its date range group show the same date.
     */
    const notifyHoveredDate = (visualisation, date) => {

        Ren.Messages.Events.chartHoveredDateChanged.notifyImmediately(
            Ren.DateValueChart_DateRange.getDateRangeGroup(visualisation),
            date,
            visualisation.containingReportGuid,
            visualisation.visualisationGuid
        );
    };

    return {
        followDateRangeGroup,
        notifyHoveredDate
    };
})();
