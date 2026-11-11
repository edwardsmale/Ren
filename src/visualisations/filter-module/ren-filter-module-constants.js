/**
 * Static constant tables shared across the Filter Module's sub-modules.
 */
Ren.FilterModule_Constants = (() => {

    // Boolean columns store "1" for true and "0" for false, shown as "Yes" / "No" checkboxes.
    const BOOLEAN_OPTIONS = [
        { value: "1", text: "Yes" },
        { value: "0", text: "No" }
    ];

    // The aggregation types offered in the "Value aggregation" submenus, each a key of
    // Ren.AggregationTypeEnum.
    const SORT_AGGREGATION_TYPES = [
        "Count", "CountDistinct", "Sum", "Average", "Min", "Max", "SingleValuesOnly",
        "First", "Last", "Median"
    ];

    // How each aggregation type reads as a submenu item.  Falls back to the key itself.
    const AGGREGATION_MENU_LABELS = {
        SingleValuesOnly: "SingleValue"
    };

    // How each aggregation type reads in an option's value title.  ("of <column heading>" is
    // appended by getValueTitle.)
    const AGGREGATION_TITLE_LABELS = {
        Count: "Count",
        CountDistinct: "Distinct count",
        Sum: "Sum",
        Average: "Average",
        Min: "Minimum",
        Max: "Maximum",
        SingleValuesOnly: "Single value",
        First: "First value",
        Last: "Last value",
        Median: "Median"
    };

    // The helper column carrying, for each row, the number of underlying rows it represents.
    const COUNT_COLUMN_HEADING = "__Count";

    // The default caption of an item's "All" checkbox.  With exactly two options to choose between,
    // "Both" reads better than "All".
    const DEFAULT_ALL_LABEL = "All";
    const DEFAULT_BOTH_LABEL = "Both";

    // Joins the values along a node's path from the root.  A unit separator, as no column value
    // holds one.
    const NODE_KEY_SEPARATOR = String.fromCharCode(31);

    // Joins a derived level's column identifier to the calc function deriving it, forming the level
    // key its settings are held under.  A unit separator again, so it can't collide with a column.
    const DERIVED_LEVEL_SEPARATOR = String.fromCharCode(31);

    // How a derived date-period level reads, in its heading and as its captions' default label
    // format.  A calc function absent from here derives a level shown as its own plain value.
    const DERIVED_DATE_LEVELS = {
        "date-week-start": { name: "Week", labelFormatFunction: null },
        "date-month-start": { name: "Month", labelFormatFunction: "date-MMM-yyyy" },
        "date-quarter-start": { name: "Quarter", labelFormatFunction: "date-quarter-name" },
        "date-year-start": { name: "Year", labelFormatFunction: "date-year-name" },
        "date-day-start": { name: "Date", labelFormatFunction: null }
    };

    // The tooltips of the toggles on an item's strip.
    const SORT_TOGGLE_TITLE =
        "On: order values by their figures.  Off: order them by the values themselves.";
    const SINGLE_SELECT_TOGGLE_TITLE =
        "On: only one value can be selected at a time.  Off: any number can be selected.";

    // How a hierarchy's tree is expanded when first shown, stored as its leaf column's
    // initialExpansion.  "None" is the default, so is never stored.
    const INITIAL_EXPANSION_OPTIONS = [
        {
            value: "None",
            text: "None",
            title: "Shows only the top-level options, every one collapsed"
        },
        {
            value: "FirstLevel",
            text: "Expand first level",
            title: "Expands every top-level option to show the level beneath it"
        },
        {
            value: "Full",
            text: "Expand fully",
            title: "Expands every option at every level"
        },
        {
            value: "FirstOption",
            text: "Expand first option",
            title: "Expands the first top-level option to show the level beneath it"
        },
        {
            value: "FirstOptionFully",
            text: "Expand first option fully",
            title: "Expands the first top-level option and every option beneath it"
        },
        {
            value: "FullyIfOneTopLevelOption",
            text: "Expand fully if only one top-level option",
            title: "Expands every option at every level when there is only one top-level "
                + "option, otherwise leaves them all collapsed"
        },
        {
            value: "FullyIfTwoOrFewerTopLevelOptions",
            text: "Expand fully if 2 or fewer top-level options",
            title: "Expands every option at every level when there are no more than two "
                + "top-level options, otherwise leaves them all collapsed"
        },
        {
            value: "FullyIfThreeOrFewerTopLevelOptions",
            text: "Expand fully if 3 or fewer top-level options",
            title: "Expands every option at every level when there are no more than three "
                + "top-level options, otherwise leaves them all collapsed"
        }
    ];

    // How a Boolean column's item can be shown as a single checkbox beside its heading, stored as
    // its showAsCheckbox.  "Off" is the default, so is never stored.
    const SHOW_AS_CHECKBOX_OPTIONS = [
        {
            value: "Off",
            text: "Off",
            title: "Shows the column's Yes and No values as checkboxes of their own"
        },
        {
            value: "YesOrNo",
            text: "Yes or No",
            title: "Ticked shows only Yes, unticked shows only No"
        },
        {
            value: "YesOrBoth",
            text: "Yes or both",
            title: "Ticked shows only Yes, unticked shows both Yes and No"
        }
    ];

    return {
        DERIVED_DATE_LEVELS,
        DERIVED_LEVEL_SEPARATOR,
        BOOLEAN_OPTIONS,
        SORT_AGGREGATION_TYPES,
        AGGREGATION_MENU_LABELS,
        AGGREGATION_TITLE_LABELS,
        COUNT_COLUMN_HEADING,
        DEFAULT_ALL_LABEL,
        DEFAULT_BOTH_LABEL,
        NODE_KEY_SEPARATOR,
        INITIAL_EXPANSION_OPTIONS,
        SHOW_AS_CHECKBOX_OPTIONS,
        SORT_TOGGLE_TITLE,
        SINGLE_SELECT_TOGGLE_TITLE
    };
})();
