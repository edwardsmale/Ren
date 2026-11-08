/**
 * The formats the chart shows its values in: each series' own, and each value axis' tick format.
 *
 * An axis' format setting (its valueFormatFunction) is of the axis alone.  An axis saved before
 * axes had formats of their own has no setting, and its ticks take the format of the last series
 * drawn against it.  A setting of null is the axis' default: that of the series' column, as a
 * series without a format of its own is shown.
 *
 * A default format of numbers or currency is abbreviated (as £1.5m, 32k) on an axis reaching
 * over a thousand.
 */
Ren.DateValueChart_ValueFormats = (() => {

    const LARGE_VALUE_THRESHOLD = 1000;

    // The hidden axis is never drawn, so has no ticks to format.
    const FORMATTED_AXIS_NAMES = ["leftAxis", "rightAxis"];

    /**
     * Gets the format a format function shows values in, or the fallback where its name does not
     * say.
     */
    const getFormatForFunction = (valueFormatFunction, fallbackFormat) => {

        const name = Ren.ArrayUtils.ensureArray(valueFormatFunction)[0]?.name;

        if (name?.startsWith("currency")) return Ren.SpreadsheetColumnFormatEnum.Currency;
        if (name?.startsWith("percentage")) return Ren.SpreadsheetColumnFormatEnum.Percentage;

        if (name === "default" || name?.startsWith("number")) {
            return Ren.SpreadsheetColumnFormatEnum.Number;
        }

        return fallbackFormat;
    };

    const createFormatFunctions = (props, valueFormatFunction) => {

        const paras = Ren.ReportInputParameters.getInputParameters(
            props.visualisation?.containingReport
        );

        return Ren.ArrayUtils.ensureArray(valueFormatFunction)
            .map(f => Ren.FormatFunctions.createFunction(f, paras));
    };

    /**
     * Gets a value indicating whether a format's values are abbreviated when large.
     */
    const isAbbreviatable = (format) => format === Ren.SpreadsheetColumnFormatEnum.Number
        || format === Ren.SpreadsheetColumnFormatEnum.Integer
        || format === Ren.SpreadsheetColumnFormatEnum.Currency;

    /**
     * Gets the highest value an axis' scale reaches, by magnitude.
     */
    const getAxisMax = (axis) => {

        if (!axis?.yScale) return 0;

        const domain = axis.yScale.getDomain();

        return Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
    };

    /**
     * Gets the formats a default format shows values on an axis in: abbreviated where they are
     * numbers or currency and the axis reaches over a thousand, and otherwise as they are.
     */
    const applyLargeValueDefault = (props, defaultFormats, axis) => {

        if (defaultFormats.formatFunction != null
            || !isAbbreviatable(defaultFormats.format)
            || getAxisMax(axis) <= LARGE_VALUE_THRESHOLD) {

            return defaultFormats;
        }

        const name = defaultFormats.format === Ren.SpreadsheetColumnFormatEnum.Currency
            ? "currency-abbreviated-auto-dp"
            : "number-abbreviated-auto-dp";

        return {
            format: defaultFormats.format,
            formatFunction: createFormatFunctions(props, [{ name }])
        };
    };

    /**
     * Gets the index of the last enabled series drawn against an axis, or -1 where there is none.
     */
    const getLastSeriesIndexOnAxis = (props, axisName) => {

        let lastIndex = -1;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (series.isEnabled !== false && series.valueAxis === axisName) lastIndex = i;
        }

        return lastIndex;
    };

    /**
     * Gives the series without formats of their own their default formats, which depend on how
     * high their axes reach.  A series on the right axis of a chart without one is on the left
     * axis' scale.
     */
    const resolveSeriesFormats = (props) => {

        for (let i = 0; i < props.seriesCount; i++) {

            const defaultFormats = props.valueColumnDefaultFormats?.[i];

            if (!defaultFormats || props.valueColumnHasOwnFormat[i]) continue;

            const axis = props.axes[props.series[i].valueAxis || "leftAxis"];
            const formats = applyLargeValueDefault(props, defaultFormats, axis);

            props.valueColumnFormats[i] = formats.format;
            props.valueColumnFormatFunctions[i] = formats.formatFunction;
        }
    };

    /**
     * Gets the formats an axis' ticks are shown in, after its series' formats are resolved.
     */
    const getAxisTickFormats = (props, visualisation, axisName) => {

        const axis = props.axes[axisName];
        const setting = visualisation?.[axisName]?.valueFormatFunction;
        const seriesIndex = getLastSeriesIndexOnAxis(props, axisName);

        const seriesFormats = seriesIndex === -1
            ? { format: axis.format, formatFunction: axis.formatFunction }
            : {
                format: props.valueColumnFormats[seriesIndex],
                formatFunction: props.valueColumnFormatFunctions[seriesIndex]
            };

        if (setting === undefined) return seriesFormats;

        if (setting === null) {

            return applyLargeValueDefault(
                props,
                props.valueColumnDefaultFormats?.[seriesIndex] ?? seriesFormats,
                axis
            );
        }

        return {
            format: getFormatForFunction(setting, seriesFormats.format),
            formatFunction: createFormatFunctions(props, setting)
        };
    };

    /**
     * Resolves the formats of the series and of the axes' ticks, once the axes' scales are set.
     */
    const resolveFormats = (props) => {

        resolveSeriesFormats(props);

        for (let i = 0; i < FORMATTED_AXIS_NAMES.length; i++) {

            const axisName = FORMATTED_AXIS_NAMES[i];

            props.axes[axisName].tickFormats =
                getAxisTickFormats(props, props.visualisation, axisName);
        }
    };

    /**
     * Gives a new chart's axes format settings of their own, decided as their series' formats
     * are: a copy of the format of the last series drawn against the axis where it has one, and
     * otherwise the default.
     */
    const initialiseAxisFormats = (props, visualisation) => {

        const chartColumns =
            visualisation.chartDataGroupingSettings?.groupings?.entries?.[0]?.columns;

        for (let i = 0; i < FORMATTED_AXIS_NAMES.length; i++) {

            const axisName = FORMATTED_AXIS_NAMES[i];

            visualisation[axisName] ??= {};

            if (visualisation[axisName].valueFormatFunction !== undefined) continue;

            const seriesIndex = getLastSeriesIndexOnAxis(props, axisName);

            const seriesFormatFunction = seriesIndex !== -1
                && props.valueColumnHasOwnFormat[seriesIndex]
                ? chartColumns?.[props.seriesSourceHeadings[seriesIndex]]?.valueFormatFunction
                : null;

            visualisation[axisName].valueFormatFunction = seriesFormatFunction
                ? Ren.ArrayUtils.ensureArray(seriesFormatFunction).slice()
                : null;
        }
    };

    /**
     * Gets the formats the pies' totals are shown in where the chart has a pieTotalFormatFunction,
     * or null for the totals to take their slices' format.
     */
    const getPieTotalFormats = (props, slicesFormat) => {

        const setting = props.visualisation?.pieTotalFormatFunction;

        if (!setting) return null;

        return {
            format: getFormatForFunction(setting, slicesFormat),
            formatFunction: createFormatFunctions(props, setting)
        };
    };

    return {
        getFormatForFunction,
        getPieTotalFormats,
        resolveFormats,
        initialiseAxisFormats
    };
})();
