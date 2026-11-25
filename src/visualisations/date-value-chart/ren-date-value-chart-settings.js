/**
 * The date/value chart's chart-wide settings, each with its default and how it is saved, so that
 * the props it is drawn from, its persistedProperties and its context menu's toggles all take a
 * setting's default from one place.  A setting added here must also be declared in the chart's
 * availableOptions, to be set by a <ren-date-value-chart> attribute, and, unless it is never saved,
 * listed in its persistedProperties, as date-value-chart-settings.test.js checks.
 */
Ren.DateValueChart_Settings = (() => {

    /**
     * How a setting is saved: always as it is; unlessDefault, left out where it reads as its
     * default; byPersistedProperty, by a transform of its own in persistedProperties; or never.
     */
    const Saved = Object.freeze({
        always: "always",
        unlessDefault: "unlessDefault",
        byPersistedProperty: "byPersistedProperty",
        never: "never"
    });

    /**
     * A Boolean setting, only turned off (or on, where it is off by default) by false (or true)
     * itself.
     */
    const booleanSetting = (name, defaultValue, saved = Saved.unlessDefault) => ({
        name,
        defaultValue,
        saved,
        read: defaultValue
            ? value => value !== false
            : value => value === true
    });

    /**
     * A setting whose default stands in for any falsy value, such as an empty title.
     */
    const stringSetting = (name, defaultValue, saved = Saved.unlessDefault) => ({
        name,
        defaultValue,
        saved,
        read: value => value || defaultValue
    });

    /**
     * A number, left undefined when unset, for the code drawing it to apply its own default.
     * Numbers are read from a <ren-date-value-chart> attribute's text.
     */
    const numberSetting = (name, saved = Saved.always) => ({
        name,
        defaultValue: undefined,
        saved,
        read: value => value !== undefined ? Number(value) : undefined
    });

    const arraySetting = (name, saved = Saved.byPersistedProperty) => ({
        name,
        defaultValue: [],
        saved,
        read: value => Array.isArray(value) ? value : []
    });

    /**
     * A setting read its own way.
     */
    const customSetting = (name, defaultValue, read, saved = Saved.byPersistedProperty) => ({
        name,
        defaultValue,
        saved,
        read
    });

    /**
     * Reads a setting a <ren-date-value-chart> attribute states by its enum key name.
     */
    const readEnum = (enumObject, defaultValue) => value => typeof value === "string"
        ? Ren.ObjectUtils.getEnumValue(enumObject, value)
        : value ?? defaultValue;

    // In the order they are applied to the props, which gives the props the same shape each time.
    const SETTINGS = [
        customSetting(
            "barLayout",
            Ren.BarLayoutEnum.SideBySide,
            value => value || Ren.BarLayoutEnum.SideBySide
        ),

        // The screen pixels left clear between one period's bars and the next's; none by default.
        customSetting("periodGap", 0, value => value > 0 ? Number(value) : 0),

        customSetting(
            "lineLayout",
            Ren.LineLayoutEnum.Overlayed,
            readEnum(Ren.LineLayoutEnum, Ren.LineLayoutEnum.Overlayed)
        ),

        booleanSetting("shadeLines", false, Saved.always),

        stringSetting("subdivideColumn", null),
        stringSetting("subdivisionLabels", "names"),
        stringSetting("subdivisionLabelPlacement", "inside"),
        customSetting("subdivisionLimit", null, value => value > 0 ? value : null),

        // A share of each pie's radius; unset, for no hole.
        numberSetting("pieHoleRadius", Saved.byPersistedProperty),

        stringSetting("pieLabels", "outside"),
        booleanSetting("pieLabelNames", true),
        booleanSetting("pieLabelValues", false),
        stringSetting("pieValuePosition", "inline"),
        booleanSetting("pieLabelPercentages", true),
        booleanSetting("pieSharesInside", true),
        booleanSetting("pieHoleTotals", true),

        numberSetting("lineShadingOpacity"),

        customSetting(
            "showLegend",
            true,
            value => value !== undefined ? value : true,
            Saved.always
        ),
        stringSetting("chartTitle", ""),
        stringSetting("chartSubtitle", ""),
        stringSetting("barValueLabelLayout", "auto"),
        stringSetting("lineNames", "auto"),
        booleanSetting("showValueLabelsWhenHighlighted", false, Saved.always),

        // Hiding an axis leaves its heading alone; the two are settled separately.
        booleanSetting("showLeftAxis", true, Saved.always),
        booleanSetting("showRightAxis", true, Saved.always),
        booleanSetting("showDateAxis", true, Saved.always),
        booleanSetting("showLeftAxisHeading", true, Saved.always),
        booleanSetting("showRightAxisHeading", true, Saved.always),
        booleanSetting("showGridlines", false, Saved.always),

        booleanSetting("showHoverDateLine", false, Saved.always),
        booleanSetting("hoverDateLineFullHeight", false, Saved.always),
        booleanSetting("showHoverValues", false, Saved.always),
        booleanSetting("showHoverChange", false, Saved.always),
        booleanSetting("enableCrossFiltering", false, Saved.always),
        stringSetting("periodSlider", null, Saved.always),
        stringSetting("multiChartPeriod", null, Saved.always),
        customSetting("multiChartMaxCount", null, value => value ?? null, Saved.always),
        booleanSetting("multiChartShowDateRange", true),
        booleanSetting("multiChartSlider", false),
        booleanSetting("multiChartKeepEmptyPeriods", true),

        customSetting(
            "showIncompleteLastPeriod",
            Ren.ShowIncompleteLastPeriodEnum.Always,
            readEnum(Ren.ShowIncompleteLastPeriodEnum, Ren.ShowIncompleteLastPeriodEnum.Always)
        ),

        booleanSetting("seasonallyAdjustEstimate", true),
        booleanSetting("showAsShareOfTotal", false),
        booleanSetting("showAsIndex", false),
        booleanSetting("showAsChange", false),
        booleanSetting("showAsYearOnYearChange", false),
        booleanSetting("showPerDay", false),
        arraySetting("valueLines"),
        arraySetting("valueBands"),

        // In px.
        numberSetting("valueLabelFontSize"),
        numberSetting("axisLabelFontSize"),
        numberSetting("seriesNamesInBarsFontSize"),
        numberSetting("lineNamesFontSize"),
        numberSetting("pieLabelFontSize"),

        // Marker line columns are deliberately not selected columns; they are resolved from the
        // raw rows at render time.
        customSetting("markerLines", null, value => value || null, Saved.never)
    ];

    const settingsByName = new Map(SETTINGS.map(setting => [setting.name, setting]));

    /**
     * Applies the chart-wide settings from the visualisation to the props, each as its default
     * where unset.
     */
    const applySettings = (props, visualisation) => {

        if (visualisation.barNarrowingRatio) {

            // Rounded on the visualisation too, as a client-side chart is written to settings
            // whole.
            visualisation.barNarrowingRatio =
                Ren.NumberUtils.round(visualisation.barNarrowingRatio, 4);

            props.barNarrowingRatio = Ren.NumberUtils.round(visualisation.barNarrowingRatio, 2);
        }

        for (let i = 0; i < SETTINGS.length; i++) {

            const setting = SETTINGS[i];

            props[setting.name] = setting.read(visualisation[setting.name]);
        }
    };

    /**
     * Gets a chart-wide setting's default, or undefined for one this does not hold.
     */
    const getDefaultValue = (name) => settingsByName.get(name)?.defaultValue;

    /**
     * Gives each setting persistedProperties names that is saved unlessDefault the transform
     * leaving it out where it reads as its default.
     */
    const withSavedTransforms = (persistedProperties) => persistedProperties.map(property => {

        const setting = typeof property === "string" ? settingsByName.get(property) : null;

        if (setting?.saved !== Saved.unlessDefault) return property;

        return {
            name: property,
            transform: value => setting.read(value) === setting.defaultValue ? undefined : value
        };
    });

    return {
        Saved,
        SETTINGS,
        applySettings,
        getDefaultValue,
        withSavedTransforms
    };
})();
