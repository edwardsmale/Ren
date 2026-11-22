/**
 * Converts the chart settings that hold an enum value between the numbers the chart works in and
 * the key names a report settings file states, so that no magic numbers reach the file.
 */
Ren.ChartEnumSettings = (() => {

    // Functions rather than constants, as the enums are declared in files that load after this one.
    const getChartEnumProperties = () => [
        { name: "barLayout", enumType: Ren.BarLayoutEnum },
        { name: "lineLayout", enumType: Ren.LineLayoutEnum },
        { name: "showIncompleteLastPeriod", enumType: Ren.ShowIncompleteLastPeriodEnum }
    ];

    const getSeriesEnumProperties = () => [
        { name: "chartType", enumType: Ren.SeriesChartTypeEnum },
        { name: "estimateLastPeriod", enumType: Ren.EstimateLastPeriodEnum }
    ];

    const resolveProperties = (settings, enumProperties) => {

        if (!settings) return;

        for (let i = 0; i < enumProperties.length; i++) {

            const enumProperty = enumProperties[i];

            if (typeof settings[enumProperty.name] !== "string") continue;

            settings[enumProperty.name] =
                Ren.ObjectUtils.getEnumValue(enumProperty.enumType, settings[enumProperty.name]);
        }
    };

    const withEnumKeys = (settings, enumProperties) => {

        let result = settings;

        if (!settings) return result;

        for (let i = 0; i < enumProperties.length; i++) {

            const enumProperty = enumProperties[i];
            const value = settings[enumProperty.name];

            if (typeof value !== "number") continue;

            // Copied only once there is something to change, since the live settings are shared.
            if (result === settings) result = Object.assign({}, settings);

            result[enumProperty.name] = Ren.ObjectUtils.getEnumKey(enumProperty.enumType, value);
        }

        return result;
    };

    /**
     * Replaces the enum key names a settings file states with the values they name, in place.
     */
    const resolve = (visualisation) => {

        if (!visualisation) return;

        resolveProperties(visualisation, getChartEnumProperties());

        const seriesEnumProperties = getSeriesEnumProperties();

        resolveProperties(visualisation.splitSeriesDefaults, seriesEnumProperties);

        const series = visualisation.series;

        if (!Array.isArray(series)) return;

        for (let i = 0; i < series.length; i++) {
            resolveProperties(series[i], seriesEnumProperties);
        }
    };

    /**
     * Gets the series with their enum-valued settings written as key names, copying each series
     * that has one rather than writing to the live settings.
     */
    const withSeriesEnumKeys = (series) => {

        if (!Array.isArray(series)) return series;

        const seriesEnumProperties = getSeriesEnumProperties();
        const transformedSeries = new Array(series.length);

        for (let i = 0; i < series.length; i++) {
            transformedSeries[i] = withEnumKeys(series[i], seriesEnumProperties);
        }

        return transformedSeries;
    };

    /**
     * Gets the key name for one of the chart's own enum-valued settings, such as barLayout.
     */
    const getChartEnumKey = (propertyName, value) => {

        const chartEnumProperties = getChartEnumProperties();

        for (let i = 0; i < chartEnumProperties.length; i++) {

            if (chartEnumProperties[i].name !== propertyName) continue;

            return Ren.ObjectUtils.getEnumKey(chartEnumProperties[i].enumType, value);
        }

        return value;
    };

    /**
     * Writes the enum-valued settings of a visualisation being serialized as their key names.  The
     * visualisation passed is the transformer's own shallow copy, so the series it holds are copied
     * rather than written to.
     */
    const writeEnumKeys = (transformedVisualisation) => {

        const chartEnumProperties = getChartEnumProperties();

        for (let i = 0; i < chartEnumProperties.length; i++) {

            const enumProperty = chartEnumProperties[i];
            const value = transformedVisualisation[enumProperty.name];

            if (typeof value !== "number") continue;

            transformedVisualisation[enumProperty.name] =
                Ren.ObjectUtils.getEnumKey(enumProperty.enumType, value);
        }

        if (transformedVisualisation.splitSeriesDefaults) {

            transformedVisualisation.splitSeriesDefaults = withEnumKeys(
                transformedVisualisation.splitSeriesDefaults,
                getSeriesEnumProperties()
            );
        }

        if (Array.isArray(transformedVisualisation.series)) {
            transformedVisualisation.series = withSeriesEnumKeys(transformedVisualisation.series);
        }
    };

    return {
        getChartEnumKey,
        resolve,
        withSeriesEnumKeys,
        writeEnumKeys
    };
})();
