/**
 * Filter Module: marking an item's filter as one to write out when the report's settings are
 * saved, unmarked, positive or negative.  The button switching between them only appears while the
 * report is being edited.
 */
Ren.FilterModule_IncludeWhenSaving = (s) => {

    const { columnInfo, filtering, filterTarget, markStylesheet } = s;

    let stateByKey = {};

    const refreshFunctions = [];

    const refresh = () => {

        for (let i = 0; i < refreshFunctions.length; i++) {

            refreshFunctions[i]();
        }
    };

    const reset = () => {

        refreshFunctions.length = 0;
        stateByKey = {};
        writeItemBorders();
    };

    // Gets the columns an item's filters are keyed on: its own, plus a hierarchy's leaf column.
    const getFilterColumnsForItem = (item) => {

        const leafColumnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);

        return leafColumnIdOrHeading === item.columnIdOrHeading
            ? [item.columnIdOrHeading]
            : [item.columnIdOrHeading, leafColumnIdOrHeading];
    };

    const isIncludedWhenSaving = (item) => {

        const columns = getFilterColumnsForItem(item);

        for (let i = 0; i < columns.length; i++) {

            if (!filterTarget.isIncludedWhenSavingColumn(columns[i])) return false;
        }

        return true;
    };

    const setIncludedWhenSaving = (item, isIncluded) => {

        const columns = getFilterColumnsForItem(item);

        for (let i = 0; i < columns.length; i++) {

            filterTarget.setIncludedWhenSavingColumn(columns[i], isIncluded);
        }
    };

    const toggleIncludedWhenSaving = (item) => {

        setIncludedWhenSaving(item, !isIncludedWhenSaving(item));

        refresh();
    };

    // Negation covers the item's ticks alone, a compare filter being a rule rather than a frozen
    // list of values.
    const INCLUDE_WHEN_SAVING_NONE = "none";
    const INCLUDE_WHEN_SAVING_POSITIVE = "positive";
    const INCLUDE_WHEN_SAVING_NEGATIVE = "negative";

    // Gets a value indicating whether the filter can be stored as an exclusion list.  A binned
    // item's ticks are bins, and a grouping level's group row values, so neither can be
    // complemented.
    const canIncludeWhenSavingAsNegative = (item) =>
        filtering.canNegateFilter(item.columnIdOrHeading);

    const getIncludedWhenSavingState = (item) => {

        if (!isIncludedWhenSaving(item)) return INCLUDE_WHEN_SAVING_NONE;

        const isNegative = canIncludeWhenSavingAsNegative(item)
            && filtering.isFilterNegated(item.columnIdOrHeading);

        return isNegative ? INCLUDE_WHEN_SAVING_NEGATIVE : INCLUDE_WHEN_SAVING_POSITIVE;
    };

    // Undoes any negation on the way back to unmarked, so a full cycle leaves the item as found.
    const cycleIncludedWhenSaving = (item) => {

        const state = getIncludedWhenSavingState(item);

        const goesNegative = state === INCLUDE_WHEN_SAVING_POSITIVE
            && canIncludeWhenSavingAsNegative(item);

        if (state === INCLUDE_WHEN_SAVING_NONE) {
            setIncludedWhenSaving(item, true);
        }
        else if (goesNegative) {

            filtering.setFilterNegated(item.columnIdOrHeading, true);
        }
        else {

            if (filtering.isFilterNegated(item.columnIdOrHeading)) {
                filtering.setFilterNegated(item.columnIdOrHeading, false);
            }

            setIncludedWhenSaving(item, false);
        }

        refresh();
    };

    // The editor's preview pane carries no edit toggle, everything done there being authoring.
    const isReportBeingEdited = () =>
        Ren.ReportEditModeModule.getIsEditModeFor(s.element) || Ren.UrlContext.onEditorPage();

    const getMenuItem = (item) => ({
        section: "Filter",
        text: "Include when saving settings",
        id: "filter-module-include-when-saving",
        visible: () => isReportBeingEdited(),
        ticked: () => isIncludedWhenSaving(item),
        action: () => toggleIncludedWhenSaving(item)
    });

    // Held as custom properties, so the theme states the colours themselves.
    const BORDER_COLOURS = {

        [INCLUDE_WHEN_SAVING_POSITIVE]: "var(--ren-filter-module-mark-colour)",
        [INCLUDE_WHEN_SAVING_NEGATIVE]: "var(--ren-filter-module-mark-negative-colour)"
    };

    // A key stated as the value of an attribute selector, so a heading carrying a quote or a
    // backslash still selects the item it belongs to.
    const quoteKey = (key) => key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

    // Drawn on whatever rectangles an item is made of, a panelled item having no border of its own.
    const writeItemBorders = () => {

        const keys = Object.keys(stateByKey);
        const styles = [];

        for (let i = 0; i < keys.length; i++) {

            const colour = BORDER_COLOURS[stateByKey[keys[i]]];

            if (!colour) continue;

            const selector = `.ren-filter-module__item[data-reorder-key="${quoteKey(keys[i])}"]`;

            styles.push(`${selector} { border-color: ${colour} }`);
            styles.push(`${selector} .ren-filter-module__panel { border-color: ${colour} }`);
        }

        markStylesheet.updateIfChanged(styles);
    };

    // Keyed on the item's reorder key, which for a hierarchy is the leaf column it is marked by.
    const applyItemBorder = (item) => {

        const key = item.columnIdOrHeading;

        const apply = () => {

            stateByKey[key] = getIncludedWhenSavingState(item);

            writeItemBorders();
        };

        refreshFunctions.push(apply);
        apply();
    };

    const describeIncludeWhenSavingState = (state) => {

        if (state === INCLUDE_WHEN_SAVING_NONE) {

            return {
                symbol: "\u{1F785}",
                title: "Click to include this filter when saving settings"
            };
        }

        if (state === INCLUDE_WHEN_SAVING_POSITIVE) {

            return {
                symbol: "\u{1F788}",
                title: "This filter will be included when saving settings"
            };
        }

        return {
            symbol: "\u{1F788}",
            title: "This filter will be included when saving settings, as a negative filter"
        };
    };

    const buildToggleButton = (item) => {

        const includeButton = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._addClass(
                "ren-filter-module__item-include-when-saving",
                "ren-link-button",
                "qa-ren-filter-module-item-include-when-saving"
            );

        const apply = () => {

            const state = getIncludedWhenSavingState(item);
            const appearance = describeIncludeWhenSavingState(state);

            includeButton.dataset.includeWhenSaving = state;

            includeButton.classList.toggle(
                "qa-ren-filter-module-item-include-when-saving-on",
                state !== INCLUDE_WHEN_SAVING_NONE
            );

            includeButton.classList.toggle(
                "qa-ren-filter-module-item-include-when-saving-negative",
                state === INCLUDE_WHEN_SAVING_NEGATIVE
            );

            includeButton.title = appearance.title;
            includeButton.textContent = appearance.symbol;
        };

        refreshFunctions.push(apply);
        apply();

        Ren.DomEventUtils.onClickWithoutSelectingContainer(
            includeButton,
            () => cycleIncludedWhenSaving(item)
        );

        return includeButton;
    };

    return {
        refresh,
        reset,
        isReportBeingEdited,
        applyItemBorder,
        buildToggleButton,
        getMenuItem
    };
};
