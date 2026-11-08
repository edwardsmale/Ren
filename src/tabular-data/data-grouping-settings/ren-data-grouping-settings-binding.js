/**
 * Subscribes a visualisation to the data grouping settings events of the group it follows, and
 * coalesces the responses, as one user action commonly fires several of those events.
 *
 *     Ren.DataGroupingSettingsBinding({
 *         visualisation,
 *         group: sourceGroup,
 *         onSettingsChanged: { action: "refresh", rank: 1, handler: () => refresh() },
 *         onFilterChanged: { action: "sync", handler: () => sync() }
 *     });
 * Actions scheduled within one synchronous turn are flushed together at its end: repeats of an
 * action collapse into one call (the last one's arguments win), and only the highest-ranked pending
 * actions run.  An immediate action runs inside the event instead.  A handler given as a bare
 * function is its own action of rank 0.
 */
Ren.DataGroupingSettingsBinding = (config) => {

    const visualisation = config.visualisation;

    // The actions scheduled so far this turn, in the order they were first scheduled.
    const pendingActions = [];

    let flushScheduled = false;

    /**
     * Runs the highest-ranked actions scheduled during the turn just ended, and discards the rest.
     */
    const flush = () => {

        flushScheduled = false;

        const actions = pendingActions.slice();
        pendingActions.length = 0;

        if (visualisation.isDestroyed) return;

        let highestRank = -Infinity;

        for (let i = 0; i < actions.length; i++) {

            if (actions[i].rank > highestRank) highestRank = actions[i].rank;
        }

        for (let i = 0; i < actions.length; i++) {

            if (actions[i].rank < highestRank) continue;

            actions[i].run();
        }
    };

    /**
     * Queues an action to run at the end of the turn, replacing any call of the same action already
     * queued so that a burst of events produces one call with the latest settings.
     */
    const schedule = (action, rank, run) => {

        for (let i = 0; i < pendingActions.length; i++) {

            if (pendingActions[i].action !== action) continue;

            pendingActions[i].run = run;
            return;
        }

        pendingActions.push({ action, rank, run });

        if (flushScheduled) return;

        flushScheduled = true;
        setTimeout(flush, 0);
    };

    /**
     * Expands a handler given as a bare function into the full form, and fills in the defaults.
     */
    const normaliseHandler = (handlerConfig, defaultAction) => {

        if (!handlerConfig) return null;

        if (typeof handlerConfig === "function") {

            return { action: defaultAction, rank: 0, immediate: false, handler: handlerConfig };
        }

        return {
            action: handlerConfig.action ?? defaultAction,
            rank: handlerConfig.rank ?? 0,
            immediate: handlerConfig.immediate ?? false,
            handler: handlerConfig.handler
        };
    };

    const settingsChangedHandler = normaliseHandler(config.onSettingsChanged, "settingsChanged");
    const filterChangedHandler = normaliseHandler(config.onFilterChanged, "filterChanged");
    const filterGroupChangedHandler = normaliseHandler(config.onFilterGroupChanged, "filterGroupChanged");
    const groupingsChangedHandler = normaliseHandler(config.onGroupingsChanged, "groupingsChanged");
    const dateRangeChangedHandler = normaliseHandler(config.onDateRangeChanged, "dateRangeChanged");
    const hoveredDateChangedHandler =
        normaliseHandler(config.onHoveredDateChanged, "hoveredDateChanged");

    const invoke = (entry, run) => {

        if (entry.immediate) {

            run();
            return;
        }

        schedule(entry.action, entry.rank, run);
    };

    const resolve = (groupConfig) => typeof groupConfig === "function" ? groupConfig() : groupConfig;

    // The groups are resolved per event rather than once, so that a visualisation whose group is
    // reassigned after creation is followed by the binding rather than left behind by it.
    const getGroup = () => resolve(config.group) ?? visualisation.dataGroupingSettingsGroup;

    const getFilterGroup = () =>
        resolve(config.filterGroup) ?? visualisation.filterGroup ?? getGroup();

    // Defaulted to the filter group, so that visualisations of one grid's data share a date range
    // without being given a group of their own.
    const getDateRangeGroup = () =>
        resolve(config.dateRangeGroup) ?? visualisation.dateRangeGroup ?? getFilterGroup();

    /**
     * A settings group declared in a report's view is the same literal in every open instance of
     * that report, so only the instance a change was fired from answers it.
     */
    const isOwnGroup = (group, containingReportGuid, ownGroup) =>
        Ren.ReportContextMatch.isSameGroup(
            group,
            containingReportGuid,
            ownGroup,
            visualisation.containingReportGuid
        );

    if (settingsChangedHandler) {

        // The settings arrive carrying a signifier identifying the state they describe; the
        // same signifier seen twice is the same state, so it is answered once.
        let lastProcessedSignifier = null;

        Ren.Messages.Events.dataGroupingSettingsChanged.handle((settings) => {

            if (visualisation.isDestroyed) return false;

            if (!isOwnGroup(
                settings.dataGroupingSettingsGroup,
                settings.containingReportGuid,
                getGroup()
            )) return;
            if (settings.signifier === lastProcessedSignifier) return;
            if (settings.isDestroyedCleanup) return;

            lastProcessedSignifier = settings.signifier;

            invoke(settingsChangedHandler, () => settingsChangedHandler.handler(settings));
        });
    }

    if (filterChangedHandler) {

        Ren.Messages.Events.filterChanged.handle((
            _tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid) => {

            if (visualisation.isDestroyed) return false;
            if (!isOwnGroup(dataGroupingSettingsGroup, containingReportGuid, getGroup())) return;

            invoke(filterChangedHandler, () => filterChangedHandler.handler());
        });
    }

    if (filterGroupChangedHandler) {

        // A filter change from a visualisation sharing this one's filter group but not its settings
        // group (e.g. a begotten date/value chart).  Where the groups are the same, filterChanged
        // has already answered it.
        Ren.Messages.Events.filterGroupChanged.handle((
            _tabularDataGuid, filterGroup, _filterSet, containingReportGuid) => {

            if (visualisation.isDestroyed) return false;

            const boundFilterGroup = getFilterGroup();

            if (boundFilterGroup === getGroup()) return;
            if (!isOwnGroup(filterGroup, containingReportGuid, boundFilterGroup)) return;

            invoke(filterGroupChangedHandler, () => filterGroupChangedHandler.handler());
        });
    }

    if (dateRangeChangedHandler) {

        // A date range picked on a visualisation sharing this one's date range group.  The one it
        // was picked on has already applied it, so it is passed over here.
        Ren.Messages.Events.chartDateRangeChanged.handle((
            dateRangeGroup,
            range,
            containingReportGuid,
            sourceVisualisationGuid,
            rangeSignature,
            chartCount) => {

            if (visualisation.isDestroyed) return false;

            if (sourceVisualisationGuid === visualisation.visualisationGuid) return;
            if (!isOwnGroup(dateRangeGroup, containingReportGuid, getDateRangeGroup())) return;

            invoke(
                dateRangeChangedHandler,
                () => dateRangeChangedHandler.handler(range, rangeSignature, chartCount)
            );
        });
    }

    if (hoveredDateChangedHandler) {

        Ren.Messages.Events.chartHoveredDateChanged.handle((
            dateRangeGroup, date, containingReportGuid, sourceVisualisationGuid) => {

            if (visualisation.isDestroyed) return false;

            if (sourceVisualisationGuid === visualisation.visualisationGuid) return;
            if (!isOwnGroup(dateRangeGroup, containingReportGuid, getDateRangeGroup())) return;

            invoke(hoveredDateChangedHandler, () => hoveredDateChangedHandler.handler(date));
        });
    }

    if (groupingsChangedHandler) {

        Ren.Messages.Events.groupingsChanged.handle((
            _tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid) => {

            if (visualisation.isDestroyed) return false;
            if (!isOwnGroup(dataGroupingSettingsGroup, containingReportGuid, getGroup())) return;

            invoke(groupingsChangedHandler, () => groupingsChangedHandler.handler());
        });
    }

    return {
        getGroup,
        getFilterGroup,
        getDateRangeGroup
    };
};
