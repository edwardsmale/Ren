/**
 * Works out how a group cell shows the aggregation type its value was made with.  The mode is set
 * by name (one of MODES) on a grouping's column, on the column's defaults, or on the layout for the
 * whole grid, the first of which that is set winning.
 */
Ren.AggregationIndicator = (() => {

    const MODES = [
        "None",
        "Hover",
        "Symbol",
        "SymbolOnHover",
        "Label",
        "LabelOnHover"
    ];

    const DEFAULT_MODE = "LabelOnHover";

    const MODE_DISPLAY_NAMES = {
        None: "None",
        Hover: "Hover",
        Symbol: "Symbol",
        SymbolOnHover: "Symbol on hover",
        Label: "Label",
        LabelOnHover: "Label on hover"
    };

    const CLASS_NAMES_BY_MODE = {
        Hover: "ren-data-grid__cell--agg-hover",
        Symbol: "ren-data-grid__cell--agg-symbol",
        SymbolOnHover: "ren-data-grid__cell--agg-symbol-on-hover",
        Label: "ren-data-grid__cell--agg-label",
        LabelOnHover: "ren-data-grid__cell--agg-label-on-hover"
    };

    const ALL_CLASS_NAMES = [
        CLASS_NAMES_BY_MODE.Hover,
        CLASS_NAMES_BY_MODE.Symbol,
        CLASS_NAMES_BY_MODE.SymbolOnHover,
        CLASS_NAMES_BY_MODE.Label,
        CLASS_NAMES_BY_MODE.LabelOnHover
    ];

    let textsByAggregationType = null;

    // Built on first use, as the aggregation type enum's file is loaded after this one.  Only the
    // types that pick or compute a single value are shown.
    const getTextsByAggregationType = () => {

        if (textsByAggregationType) return textsByAggregationType;

        const types = Ren.AggregationTypeEnum;

        textsByAggregationType = {

            [types.Sum]: { symbol: "Σ", label: "Sum", title: "Sum" },
            [types.Average]: { symbol: "x̄", label: "Avg", title: "Average" },
            [types.Count]: { symbol: "#", label: "Count", title: "Count" },
            [types.CountDistinct]: { symbol: "#≠", label: "Distinct", title: "Count distinct" },
            [types.Min]: { symbol: "↓", label: "Min", title: "Minimum" },
            [types.Max]: { symbol: "↑", label: "Max", title: "Maximum" },
            [types.First]: { symbol: "⇤", label: "First", title: "First" },
            [types.Last]: { symbol: "⇥", label: "Last", title: "Last" },
            [types.Median]: { symbol: "x̃", label: "Median", title: "Median" },
            [types.MostCommon]: { symbol: "Mo", label: "Most", title: "Most common" }
        };

        return textsByAggregationType;
    };

    const isMode = (value) => MODES.includes(value);

    /**
     * Gets the name a mode is shown by in menus and dropdowns.
     */
    const getModeDisplayName = (mode) => MODE_DISPLAY_NAMES[mode] ?? mode;

    /**
     * Gets the mode a grouping's column uses, from the most specific setting given.
     */
    const resolveMode = (groupingColumn, columnDefault, layout) => {

        if (isMode(groupingColumn?.aggregationIndicator)) {
            return groupingColumn.aggregationIndicator;
        }

        if (isMode(columnDefault?.aggregationIndicator)) {
            return columnDefault.aggregationIndicator;
        }

        if (isMode(layout?.aggregationIndicator)) {
            return layout.aggregationIndicator;
        }

        return DEFAULT_MODE;
    };

    /**
     * Gets { className, text, title } for a cell, or null where it shows nothing.  text is what the
     * stylesheet draws beside the value, and is empty for the modes that draw no text.  title is
     * the tooltip, which the label modes go without.
     */
    const getIndicator = (mode, aggregationType) => {

        if (mode === "None" || aggregationType == null) return null;

        const texts = getTextsByAggregationType()[aggregationType];

        if (!texts) return null;

        let text = "";
        let title = texts.title;

        if (mode === "Symbol" || mode === "SymbolOnHover") {
            text = texts.symbol;
        }
        else if (mode === "Label" || mode === "LabelOnHover") {

            text = texts.label;
            title = "";
        }

        return {
            className: CLASS_NAMES_BY_MODE[mode],
            text,
            title
        };
    };

    /**
     * Shows the indicator on a cell, or clears one left by an earlier render where it is null.
     */
    const applyToCell = (cell, indicator, isEmpty) => {

        if (cell.dataset.agg !== undefined) {

            for (let i = 0; i < ALL_CLASS_NAMES.length; i++) {
                cell.classList.remove(ALL_CLASS_NAMES[i]);
            }

            delete cell.dataset.agg;
            cell.removeAttribute("title");
        }

        if (!indicator || isEmpty) return;

        cell.classList.add(indicator.className);
        cell.dataset.agg = indicator.text;

        if (indicator.title) cell.title = indicator.title;
    };

    return {
        DEFAULT_MODE,
        MODES,
        applyToCell,
        getIndicator,
        getModeDisplayName,
        resolveMode
    };
})();
