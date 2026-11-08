/**
 * Removes series from a date/value chart.  A removed series is left out of the chart altogether,
 * legend entry and all, where a hidden one keeps its entry.  The chart saves the series it draws as
 * includedSeries, which is unset while no series is removed.  An "Other" series is never named
 * there, being removed by its own settings instead.
 */
Ren.DateValueChart_SeriesRemoval = (() => {

    /**
     * Gets those of the given headings that includedSeries names, or all of them where it is unset
     * or names none of them, so that the chart is never left with nothing to draw.
     */
    const getIncludedHeadings = (headings, includedSeries) => {

        if (!Array.isArray(includedSeries)) return headings;

        const includedHeadings = headings.filter(heading => includedSeries.indexOf(heading) !== -1);

        return includedHeadings.length > 0 ? includedHeadings : headings;
    };

    /**
     * Orders an unsplit chart's series settings to match the series it draws, as the two are
     * matched by position.  The settings of removed series are kept after them, so that a series
     * comes back as it was when reinstated, and so that its column is still read from them.
     */
    const orderSeriesSettings = (seriesSettings, headings, allHeadings) => {

        const settingsByColumn = {};
        const unmatchedSettings = [];

        for (let i = 0; i < seriesSettings.length; i++) {

            const settings = seriesSettings[i];

            if (!settings) continue;

            // Settings that pre-date series columns are matched to the columns by position.
            const column = settings.column ?? allHeadings[i];

            if (column == null || settingsByColumn[column]) {

                unmatchedSettings.push(settings);
                continue;
            }

            settings.column = column;
            settingsByColumn[column] = settings;
        }

        // A series drawn without settings of its own is given its defaults by the chart.
        const orderedSettings = [];

        for (let i = 0; i < headings.length; i++) {
            orderedSettings.push(settingsByColumn[headings[i]] ?? null);
        }

        for (let i = 0; i < allHeadings.length; i++) {

            if (headings.indexOf(allHeadings[i]) !== -1) continue;

            orderedSettings.push(settingsByColumn[allHeadings[i]] ?? { column: allHeadings[i] });
        }

        // Then those of columns the data no longer holds.
        for (let i = 0; i < seriesSettings.length; i++) {

            const settings = seriesSettings[i];

            if (settings && settingsByColumn[settings.column] === settings
                && allHeadings.indexOf(settings.column) === -1) {

                orderedSettings.push(settings);
            }
        }

        for (let i = 0; i < unmatchedSettings.length; i++) {
            orderedSettings.push(unmatchedSettings[i]);
        }

        return orderedSettings;
    };

    // Gets the headings of the series drawn and removed alike.
    const getAllHeadings = props => props.allValueHeadings || props.valueHeadings || [];

    // Those beyond the legend's limit are left out too, but by the limit rather than removed.
    const getRemovedHeadings = props => {

        const headings = props.valueHeadings || [];
        const limitedOutHeadings = props.limitedOutHeadings || [];

        return getAllHeadings(props).filter(
            heading => headings.indexOf(heading) === -1
                && limitedOutHeadings.indexOf(heading) === -1
        );
    };

    const getHeadings = (props, seriesIndexes) => {

        const headings = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            const heading = props.valueHeadings?.[seriesIndexes[i] - 1];

            if (heading != null) headings.push(heading);
        }

        return headings;
    };

    /**
     * Shows the series of the given headings where none of them is shown, so that what is left
     * once the others are removed is not a chart with nothing drawn on it.
     */
    const ensureAnyShown = (props, headings) => {

        const visualisation = props.visualisation;

        for (let i = 0; i < headings.length; i++) {

            const index = props.valueHeadings.indexOf(headings[i]);

            if (props.series?.[index]?.isEnabled !== false) return;
        }

        const seriesSettings = visualisation.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            if (seriesSettings[i] && headings.indexOf(seriesSettings[i].column) !== -1) {
                seriesSettings[i].isEnabled = true;
            }
        }
    };

    // Saves which series are drawn, and builds the chart again with only those.
    const setIncludedSeries = (props, includedSeries) => {

        const visualisation = props.visualisation;

        visualisation.includedSeries = includedSeries;

        // The axes are re-fitted to the series drawn, so the extents must not be skipped.
        props.skipExtentRecalculation = false;

        Ren.VisualisationSettingsSynchroniser.commitChange(
            visualisation,
            props.redrawVisualisation
        );
    };

    const isOtherHeading = heading => Ren.DateValueChart_OtherSeries.isOtherHeading(heading);

    /**
     * Removes the series of the given numbers.  A split series the data holds no value for, as
     * under a filter, keeps its place in includedSeries.  At least one series other than an
     * "Other" series is always kept.
     */
    const removeSeries = (props, seriesIndexes) => {

        const visualisation = props.visualisation;

        if (!visualisation || !props.valueHeadings) return;

        const targetHeadings = getHeadings(props, seriesIndexes);
        const removedHeadings = targetHeadings.filter(heading => !isOtherHeading(heading));
        const keptHeadings = props.valueHeadings.filter(
            heading => !isOtherHeading(heading) && targetHeadings.indexOf(heading) === -1
        );

        if (targetHeadings.length === 0 || keptHeadings.length === 0) return;

        Ren.DateValueChart_OtherSeries.setRemoved(
            visualisation,
            targetHeadings.filter(isOtherHeading),
            true
        );

        if (removedHeadings.length === 0) {

            ensureAnyShown(props, keptHeadings);
            setIncludedSeries(props, visualisation.includedSeries ?? null);
            return;
        }

        const includedSeries = visualisation.includedSeries;

        // A list naming none of the series is being ignored, so is started afresh.
        const isListApplied = Array.isArray(includedSeries)
            && getAllHeadings(props).some(heading => includedSeries.indexOf(heading) !== -1);

        const baseHeadings = isListApplied ? includedSeries : getAllHeadings(props);

        ensureAnyShown(props, keptHeadings);

        setIncludedSeries(
            props,
            baseHeadings.filter(heading => removedHeadings.indexOf(heading) === -1)
        );
    };

    // Removes every series but those of the given numbers, which are shown too, as "Hide all
    // other data series" shows them, so that what is left is exactly them.
    const removeOtherSeries = (props, seriesIndexes) => {

        const keptHeadings = getHeadings(props, seriesIndexes);

        if (!props.visualisation || keptHeadings.length === 0) return;

        const seriesSettings = props.visualisation.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            if (seriesSettings[i] && keptHeadings.indexOf(seriesSettings[i].column) !== -1) {
                seriesSettings[i].isEnabled = true;
            }
        }

        setIncludedSeries(props, keptHeadings);
    };

    /**
     * Reinstates the series of the given headings, or every removed series, "Other" series among
     * them, where none are given.  Each comes back shown or hidden as it was when removed.
     */
    const reinstateSeries = (props, headings) => {

        const visualisation = props.visualisation;

        if (!visualisation) return;

        if (!headings) {

            Ren.DateValueChart_OtherSeries.setRemoved(visualisation, null, false);
            setIncludedSeries(props, null);
            return;
        }

        if (!Array.isArray(visualisation.includedSeries)) return;

        const includedSeries = visualisation.includedSeries.slice();

        for (let i = 0; i < headings.length; i++) {
            if (includedSeries.indexOf(headings[i]) === -1) includedSeries.push(headings[i]);
        }

        const isEverySeriesIncluded = getAllHeadings(props).every(
            heading => includedSeries.indexOf(heading) !== -1
        );

        setIncludedSeries(props, isEverySeriesIncluded ? null : includedSeries);
    };

    // Reinstates the chart's removed "Other" series, leaving the series they gather removed.
    const reinstateOtherSeries = (props) => {

        if (!props.visualisation) return;

        Ren.DateValueChart_OtherSeries.setRemoved(props.visualisation, null, false);
        setIncludedSeries(props, props.visualisation.includedSeries ?? null);
    };

    // Swaps one heading for another in includedSeries, as when a series' column is switched.
    const renameIncludedSeries = (visualisation, oldHeading, newHeading) => {

        const includedSeries = visualisation.includedSeries;

        if (!Array.isArray(includedSeries)) return;

        const index = includedSeries.indexOf(oldHeading);

        if (index !== -1) includedSeries[index] = newHeading;
    };

    return {
        getIncludedHeadings,
        orderSeriesSettings,
        getRemovedHeadings,
        removeSeries,
        removeOtherSeries,
        reinstateSeries,
        reinstateOtherSeries,
        renameIncludedSeries
    };
})();
