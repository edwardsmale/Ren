/**
 * Shows, on the visualisations a chart's cross filter applies to, a chip naming the column and
 * values filtered to, with a button that clears it.  Its title names the visualisation the filter
 * was set from and every value, where the chip has room for only the first.
 *
 * A filter is shown for as long as its column stays filtered, by whatever means, and goes once the
 * column is no longer filtered.  The visualisation the filter was set from isn't filtered by it,
 * so it shows no chip.
 */
Ren.VisualisationCrossFilterIndicators = (() => {

    const CONTAINER_CLASS = "ren-visualisation__cross-filters";

    // The values a chip names before it counts the rest.
    const SHOWN_VALUE_COUNT = 1;

    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

    // The filters shown, by settings group, report context, tab and column.
    const filters = new Map();

    // The signature of what each visualisation element's chips show, so they are rebuilt only
    // when it changes.
    const signaturesByElement = new WeakMap();

    const elementsShowingChips = new Set();

    let isRefreshPending = false;

    const getFilterKey = (filter) =>
        filter.group + "|" + filter.containingReportGuid + "|" + filter.tabTitle + "|" +
        filter.column;

    /**
     * Shows a filter just set from a visualisation.  Its settings are got through getSettings, and
     * its tabular data through getTabularData, as both are replaced while the page is open.  Its
     * optional onCleared is called once its chip's clear button has cleared it.
     */
    const addFilter = (filter) => {

        filters.set(getFilterKey(filter), filter);
        scheduleRefresh();
    };

    /**
     * Gets the values a filter's column is filtered to, as the values shown rather than those
     * stored, or null where it isn't filtered.
     */
    const getFilteredValues = (filter, settings, tabularData) => {

        const storedValues = settings?.dataRows?.filterSet?.[tabularData.Title]
            ?.columnValueFilters?.[filter.column];

        if (storedValues == null) return null;

        const isNegated =
            Ren.FilterNegation.isNegatedColumn(settings.dataRows, tabularData, filter.column);

        return Ren.ColumnValueSelection.toShownValues(
            tabularData,
            filter.column,
            storedValues,
            isNegated
        );
    };

    const getColumnHeading = (tabularData, column) => {

        const columnIndex = tabularData.columnResolver?.getColumnIndex(column);

        if (columnIndex == null) return column;

        return tabularData.columnResolver.getColumnHeading(columnIndex) ?? column;
    };

    const getValueLabels = (values) => values.map(value => Ren.ValueDisplayLabel(value));

    const getChipText = (columnHeading, valueLabels) => {

        const shownLabels = valueLabels.slice(0, SHOWN_VALUE_COUNT).join(", ");
        const hiddenCount = valueLabels.length - SHOWN_VALUE_COUNT;

        return columnHeading + ": " + (valueLabels.length === 0 ? "none" : shownLabels) +
            (hiddenCount > 0 ? " +" + hiddenCount : "");
    };

    const getChipTitle = (filter, columnHeading, valueLabels) => {

        const sourceTitle = filter.sourceVisualisation?.title;
        const setFrom = typeof sourceTitle === "string" && sourceTitle.trim()
            ? "\"" + sourceTitle.trim() + "\""
            : "a chart";

        return "Filtered from " + setFrom + " to " + columnHeading + " " +
            (valueLabels.length === 0 ? "matching nothing" : "= " + valueLabels.join(", ")) + ".";
    };

    /**
     * Gets the shown state of each filter still in place, dropping those whose column is no
     * longer filtered.
     */
    const getActiveFilters = () => {

        const activeFilters = [];

        filters.forEach((filter, key) => {

            const tabularData = filter.getTabularData();
            const settings = tabularData ? filter.getSettings() : null;
            const values = settings ? getFilteredValues(filter, settings, tabularData) : null;

            if (!values) {

                filters.delete(key);
                return;
            }

            const columnHeading = getColumnHeading(tabularData, filter.column);
            const valueLabels = getValueLabels(values);

            activeFilters.push({
                filter,
                settings,
                tabularData,
                text: getChipText(columnHeading, valueLabels),
                title: getChipTitle(filter, columnHeading, valueLabels)
            });
        });

        return activeFilters;
    };

    const isFilteredBy = (visualisation, activeFilter) => {

        const filter = activeFilter.filter;

        if (visualisation === filter.sourceVisualisation) return false;

        if (visualisation.isDestroyed || !visualisation.element) return false;

        if (!Ren.ReportContextMatch.isSameReportContext(
            filter.containingReportGuid,
            visualisation.containingReportGuid
        )) return false;

        const isFollowingGroup = visualisation.dataGroupingSettingsGroup === filter.group ||
            (visualisation.filterGroup ?? visualisation.dataGroupingSettingsGroup) === filter.group;

        if (!isFollowingGroup) return false;

        // A chart cross-filtering by the same column isn't filtered by it either.
        const unfilteredColumns = Ren.DateValueChart_CrossFiltering
            .getUnfilteredColumns(visualisation, activeFilter.tabularData);

        return !unfilteredColumns || unfilteredColumns.indexOf(filter.column) === -1;
    };

    /**
     * Gets the active filters to show on each visualisation element.  A visualisation drawn inside
     * another showing the same filter leaves it to that one.
     */
    const getFiltersByElement = (activeFilters) => {

        const filtersByElement = new Map();
        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < activeFilters.length; index++) {

            const activeFilter = activeFilters[index];
            const elements = new Set();

            for (let v = 0; v < visualisations.length; v++) {

                if (isFilteredBy(visualisations[v], activeFilter)) {
                    elements.add(visualisations[v].element);
                }
            }

            elements.forEach((element) => {

                let ancestor = element.parentElement;

                while (ancestor) {

                    if (elements.has(ancestor)) return;

                    ancestor = ancestor.parentElement;
                }

                if (!filtersByElement.has(element)) filtersByElement.set(element, []);

                filtersByElement.get(element).push(activeFilter);
            });
        }

        return filtersByElement;
    };

    const createFilterIcon = () => {

        const icon = document.createElementNS(SVG_NAMESPACE, "svg");
        const path = document.createElementNS(SVG_NAMESPACE, "path");

        icon.setAttribute("class", "ren-cross-filter-chip__icon");
        icon.setAttribute("viewBox", "0 0 16 16");
        icon.setAttribute("aria-hidden", "true");
        path.setAttribute("d", "M2 3h12l-4.5 5.5V13l-3 1.5V8.5z");
        icon.appendChild(path);

        return icon;
    };

    const clearFilter = (activeFilter) => {

        const settings = activeFilter.filter.getSettings() ?? activeFilter.settings;

        settings?.sortFilterGroup?.removeColumnFilter(activeFilter.filter.column);

        if (activeFilter.filter.onCleared) activeFilter.filter.onCleared();
    };

    const createChip = (activeFilter) => {

        const chip = document.createElement("span");
        const text = document.createElement("span");
        const clearButton = document.createElement("button");

        chip.className = "ren-cross-filter-chip";
        chip.title = activeFilter.title;

        text.className = "ren-cross-filter-chip__text";
        text.textContent = activeFilter.text;

        clearButton.type = "button";
        clearButton.className = "ren-cross-filter-chip__clear";
        clearButton.title = "Clear this filter";
        clearButton.textContent = "×";

        clearButton.addEventListener("click", (event) => {

            event.stopPropagation();
            clearFilter(activeFilter);
        });

        chip.appendChild(createFilterIcon());
        chip.appendChild(text);
        chip.appendChild(clearButton);

        return chip;
    };

    const getContainer = (element) => element.querySelector(":scope > ." + CONTAINER_CLASS);

    const removeChips = (element) => {

        getContainer(element)?.remove();
        signaturesByElement.delete(element);
        elementsShowingChips.delete(element);
    };

    const showChips = (element, activeFilters) => {

        const signature = activeFilters.map(f => f.text + "\u0001" + f.title).join("\u0002");
        const container = getContainer(element);

        if (container && signaturesByElement.get(element) === signature) return;

        container?.remove();

        const newContainer = document.createElement("div");

        newContainer.className = CONTAINER_CLASS;

        // Kept from the visualisation beneath, which may start a drag or selection on it.
        newContainer.addEventListener("mousedown", event => event.stopPropagation());

        for (let index = 0; index < activeFilters.length; index++) {

            newContainer.appendChild(createChip(activeFilters[index]));
        }

        element.appendChild(newContainer);
        signaturesByElement.set(element, signature);
        elementsShowingChips.add(element);
    };

    const refresh = () => {

        isRefreshPending = false;

        const filtersByElement = getFiltersByElement(getActiveFilters());

        Array.from(elementsShowingChips).forEach((element) => {

            if (!filtersByElement.has(element)) removeChips(element);
        });

        filtersByElement.forEach((activeFilters, element) => showChips(element, activeFilters));
    };

    /**
     * Refreshes the chips once the changes in hand have been made, as a filter change and the
     * redraws it causes arrive as a burst.
     */
    const scheduleRefresh = () => {

        if (isRefreshPending) return;

        isRefreshPending = true;
        setTimeout(refresh, 0);
    };

    const scheduleRefreshIfShowingAny = () => {

        if (filters.size || elementsShowingChips.size) scheduleRefresh();
    };

    Ren.Messages.Events.filterChanged.handle(() => {

        scheduleRefreshIfShowingAny();
    });

    Ren.Messages.Events.dataGroupingSettingsChanged.handle(() => {

        scheduleRefreshIfShowingAny();
    });

    Ren.Messages.Events.visualisationRendered.handle(() => {

        scheduleRefreshIfShowingAny();
    });

    return {
        addFilter,
        refresh
    };
})();
