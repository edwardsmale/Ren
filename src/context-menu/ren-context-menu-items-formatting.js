/**
 * Functions to add formatting menu items to the context menu.  Every leaf sets a named format
 * function on the cell, so the menu is written as a tree of specifications, turned into menu items
 * once the cell and its format are known.  Which functions are offered is determined by special
 * comments in the format functions' code.
 */
Ren.ContextMenuItems_Formatting = (setFormatFunction, options) => {

    const summaryStatsAvailable = options?.summaryStatsAvailable !== false;

    const isGridContext = options?.gridContext !== false;

    const columnHasNulls = (columnIndex) => options.columnHasNulls?.(columnIndex) ?? true;

    // Null where the host cannot say which format is set, so no listed format is ticked.
    const getCurrentFunctionName = options?.getFormatFunction
        ? (columnIndex, rowIndex) => Ren.FormatFunctionUtils.getFunctionName(
            options.getFormatFunction(columnIndex, rowIndex)
        )
        : null;

    const decimalPlaceText = (suffix) =>
        suffix === "no-dp" ? "No DP" : suffix.replace("-dp", " DP");

    /**
     * Creates a list of format specifications for the DP variations of a format function.
     */
    const createDecimalPlaceSpecs = (suffixes, section, idPrefix, formatPrefix) => {

        const specs = [];

        for (let i = 0; i < suffixes.length; i++) {

            const suffix = suffixes[i];

            specs.push({
                section: section,
                text: decimalPlaceText(suffix),
                id: idPrefix + suffix,
                name: formatPrefix + suffix
            });
        }

        return specs;
    };

    const decimalPlaceSuffixes = ["no-dp", "1-dp", "2-dp", "3-dp"];

    const createShowAsSpec = (label, baseFormatName) => {

        return {
            section: "Show as",
            text: label,
            id: "format-show-as-" + baseFormatName,
            submenu: [
                {
                    text: "No DP",
                    id: "format-show-as-" + baseFormatName + "-no-dp",
                    name: baseFormatName + "-no-dp"
                },
                {
                    text: "2 DP",
                    id: "format-show-as-" + baseFormatName + "-2-dp",
                    name: baseFormatName + "-2-dp"
                }
            ]
        };
    };

    const showAsSpecs = [
        createShowAsSpec("% of group total", "percentage-of-group-sum"),
        createShowAsSpec("% of overall total", "percentage-of-overall-sum"),
        createShowAsSpec("% of group maximum", "percentage-of-group-max"),
        createShowAsSpec("% of overall maximum", "percentage-of-overall-max"),
        createShowAsSpec("Difference from group average", "difference-from-group-avg"),
        createShowAsSpec("Difference from overall average", "difference-from-overall-avg")
    ];

    const showNullAsSpecs = [
        { text: "NULL", id: "format-show-null-as-null", name: "default" },
        { text: "Blank", id: "format-show-null-as-blank", name: "show-null-as-blank" },
        { text: "None", id: "format-show-null-as-none", name: "show-null-as-none" },
        { text: "N/A", id: "format-show-null-as-na", name: "show-null-as-na" },
        { text: "Dash", id: "format-show-null-as-dash", name: "show-null-as-dash" },
        { text: "0", id: "format-show-null-as-zero", name: "show-null-as-zero" }
    ];

    // The currency IDs and format names predate the "-<n>-dp" convention, so are written out.
    const formatting = Ren.Config.getConfig().formatting;

    const currencyText = (amount) =>
        formatting.currencyPrefix + amount + formatting.currencySuffix;

    const currencySpecs = [
        {
            section: "Currency",
            text: "No DP",
            id: "format-as-currency-no-dp",
            name: "currency-no-dp"
        },
        {
            section: "Currency",
            text: "2 DP",
            id: "format-as-currency-2dp",
            name: "currency"
        },
        {
            section: "Currency",
            text: `Abbreviated (${currencyText("32k")})`,
            id: "format-as-currency-abbreviated-no-dp",
            name: "currency-abbreviated-no-dp"
        },
        {
            section: "Currency",
            text: `Abbreviated, 1 DP (${currencyText("32.2k")})`,
            id: "format-as-currency-abbreviated-1-dp",
            name: "currency-abbreviated-1-dp"
        },
        {
            section: "Currency",
            text: `Abbreviated, auto DP (${currencyText("1.5m")}, ${currencyText("32k")})`,
            id: "format-as-currency-abbreviated-auto-dp",
            name: "currency-abbreviated-auto-dp"
        },
        {
            section: "Currency",
            text: `Thousands (${currencyText("32k")})`,
            id: "format-as-currency-thousands",
            name: "currency-thousands"
        }
    ];

    const numberAllDPSpec = {
        section: "Number",
        text: "All DP",
        id: "format-as-number-all-dp",
        name: "number-all-dp"
    };

    const numberAbbreviatedSpecs = [
        {
            section: "Number",
            text: "Abbreviated (32k)",
            id: "format-as-number-abbreviated-no-dp",
            name: "number-abbreviated-no-dp"
        },
        {
            section: "Number",
            text: "Abbreviated, 1 DP (32.2k)",
            id: "format-as-number-abbreviated-1-dp",
            name: "number-abbreviated-1-dp"
        },
        {
            section: "Number",
            text: "Abbreviated, auto DP (1.5m, 32k)",
            id: "format-as-number-abbreviated-auto-dp",
            name: "number-abbreviated-auto-dp"
        },
        {
            section: "Number",
            text: "Thousands (32k)",
            id: "format-as-number-thousands",
            name: "number-thousands"
        }
    ];

    const percentageSpecs =
        createDecimalPlaceSpecs(
            decimalPlaceSuffixes,
            "Percentage",
            "format-as-percentage-",
            "percentage-"
        ).concat(
            createDecimalPlaceSpecs(
                decimalPlaceSuffixes,
                "Divided by 100",
                "format-as-percentage-div-100-",
                "percentage-div-100-"
            )
        );

    // The library's own link formats, then those in ren.config.
    const linkSpecs = [
        {
            text: "Link (cell value)",
            id: "cell-link",
            name: "cell-link"
        }
    ].concat(Ren.Config.getConfig().linkFormats);

    const dateTimeSpecs = [
        {
            text: "Date",
            id: "format-as-date",
            className: "qa-ren-date-format-menu-item",
            name: "date"
        },
        {
            text: "Date with day name",
            id: "format-as-date-with-day-name",
            className: "qa-ren-date-with-day-name-format-menu-item",
            name: "date-with-day-name"
        },
        {
            text: "Time",
            id: "format-as-time",
            className: "qa-ren-time-format-menu-item",
            name: "time"
        },
        {
            text: "Date and time",
            id: "format-as-date-time",
            className: "qa-ren-date-time-format-menu-item",
            name: "date-time"
        },
        {
            text: "Date and time with day name",
            id: "format-as-date-time-with-day-name",
            className: "qa-ren-date-time-with-day-name-format-menu-item",
            name: "date-time-with-day-name"
        },
        Ren.MENU_SEPARATOR,
        {
            text: "Month name and year",
            name: "date-MMM-yyyy"
        },
        {
            text: "Quarter name",
            name: "date-quarter-name"
        }
    ];

    const formatMenuSpec = {
        section: "Functions",
        text: "Format",
        id: "format-menu",
        className: "qa-ren-formatting-menu-item",
        submenu: [
            {
                text: "Normal",
                id: "format-as-default",
                name: "default"
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Blank",
                id: "format-as-blank",
                name: "blank"
            },
            {
                text: "Expand Icon",
                id: "format-as-expand-icon",
                name: "expand-icon",
                gridOnly: true
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Show as",
                id: "format-show-as",
                isVisible: (valueFormat) =>
                    summaryStatsAvailable &&
                    Ren.SpreadsheetColumnFormatEnum.IsNumeric(valueFormat),
                submenu: showAsSpecs
            },
            {
                text: "Number",
                id: "format-as-number",
                isVisible: (valueFormat) =>
                    Ren.SpreadsheetColumnFormatEnum.IsArithmetic(valueFormat),
                submenu: createDecimalPlaceSpecs(
                    decimalPlaceSuffixes,
                    "Number",
                    "format-as-number-",
                    "number-"
                ).concat(numberAllDPSpec, numberAbbreviatedSpecs)
            },
            {
                text: "Show NULL as",
                id: "format-show-null-as",
                requiresNulls: true,
                submenu: showNullAsSpecs
            },
            {
                text: "Currency",
                id: "format-as-currency",
                isVisible: (valueFormat) =>
                    Ren.SpreadsheetColumnFormatEnum.IsArithmetic(valueFormat),
                submenu: currencySpecs
            },
            {
                text: "Percentage",
                id: "format-as-percentage",
                isVisible: (valueFormat) =>
                    Ren.SpreadsheetColumnFormatEnum.IsArithmetic(valueFormat),
                submenu: percentageSpecs
            },
            {
                text: "Nulls",
                id: "format-null-values",
                requiresNulls: true,
                isVisible: (valueFormat) =>
                    Ren.SpreadsheetColumnFormatEnum.IsNumeric(valueFormat),
                submenu: [
                    {
                        text: "Show nulls as zero",
                        id: "format-null-values-as-zero",
                        name: "nulls-as-zero"
                    }
                ]
            },
            {
                text: "Date range",
                id: "format-as-date-range",
                name: "date-range",
                isVisible: (valueFormat) =>
                    valueFormat === Ren.SpreadsheetColumnFormatEnum.General
            },
            {
                text: "Links",
                id: "format-as-links",
                isVisible: (valueFormat) =>
                    valueFormat === Ren.SpreadsheetColumnFormatEnum.General,
                submenu: linkSpecs
            },
            {
                text: "Date/Time",
                id: "format-as-date-time",
                className: "qa-ren-date-time-menu-item",
                isVisible: (valueFormat) => Ren.SpreadsheetColumnFormatEnum.IsDate(valueFormat),
                submenu: dateTimeSpecs
            }
        ]
    };

    /**
     * Builds a menu item for each specification, in the order they are written.  Specifications the
     * host has no use for are left out rather than built and hidden, as the host cannot change
     * while the menu is open.
     */
    const createFormatMenuItems = (specs, columnIndex, rowIndex, valueFormat) => {

        const menuItems = [];

        for (let i = 0; i < specs.length; i++) {

            const spec = specs[i];

            if (spec.gridOnly && !isGridContext) continue;

            menuItems.push(createFormatMenuItem(spec, columnIndex, rowIndex, valueFormat));
        }

        return menuItems;
    };

    /**
     * Turns one format specification into a menu item, recursing into its submenu.  One with
     * neither a submenu nor a name - just a "-" - becomes a separator.
     */
    const createFormatMenuItem = (spec, columnIndex, rowIndex, valueFormat) => {

        const menuItem = { text: spec.text };

        if (spec.section) menuItem.section = spec.section;
        if (spec.id) menuItem.id = spec.id;
        if (spec.className) menuItem.className = spec.className;
        // Asked as the menu opens, as the host may only be able to answer requiresNulls by looking
        // through its data.
        if (spec.isVisible || spec.requiresNulls) {

            menuItem.visible = () =>
                (!spec.isVisible || spec.isVisible(valueFormat)) &&
                (!spec.requiresNulls || columnHasNulls(columnIndex));
        }

        if (spec.submenu) {

            menuItem.submenu =
                createFormatMenuItems(spec.submenu, columnIndex, rowIndex, valueFormat);
        }
        else if (spec.name) {

            const valueFormatFunction = { "name": spec.name };

            if (spec.parameters) valueFormatFunction["parameters"] = spec.parameters;

            menuItem.actionParameters = [columnIndex, rowIndex, valueFormatFunction];
            menuItem.action = setFormatFunction;

            if (getCurrentFunctionName) {
                menuItem.ticked = () => getCurrentFunctionName(columnIndex, rowIndex) === spec.name;
            }
        }

        return menuItem;
    };

    const getMenuItems = (columnIndex, rowIndex, _grouping, valueFormat) => {

        const formatMenuItem =
            createFormatMenuItem(formatMenuSpec, columnIndex, rowIndex, valueFormat);

        formatMenuItem.submenu =
            Ren.FunctionMenuFilter.filterMenuItems(formatMenuItem.submenu, "format");

        return [formatMenuItem];
    };

    return {
        getMenuItems
    };
};
