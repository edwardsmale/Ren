/**
 * Shows, on the visualisations a chart's cross filter applies to, a chip naming the column and
 * values filtered to, with a button that clears it.  Its title names the visualisation the filter
 * was set from and every value, where the chip has room for only the first.
 *
 * A filter is shown for as long as its column stays filtered, by whatever means, and goes once the
 * column is no longer filtered.  The visualisation the filter was set from isn't filtered by it,
 * so it shows no chip.
 *
 * A visualisation that names its filters in words, as a date/value chart's subtitle can, shows its
 * cross filters there instead, as inline chips (see createInlineChip), and so has no chip of its
 * own for them.
 */
Ren.VisualisationCrossFilterIndicators = (() => {

    const CONTAINER_CLASS = "ren-visualisation__cross-filters";
    const INLINE_CHIP_CLASS = "ren-cross-filter-chip--inline";

    // The attribute naming the filter an inline chip shows, by its key.
    const KEY_ATTRIBUTE = "data-ren-cross-filter";

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

    // Names the filter with its own text, or with the content given.
    const createChip = (activeFilter, content) => {

        const chip = document.createElement("span");
        const text = document.createElement("span");
        const clearButton = document.createElement("button");

        chip.className = "ren-cross-filter-chip";
        chip.title = activeFilter.title;

        text.className = "ren-cross-filter-chip__text";

        if (content) text.appendChild(content);
        else text.textContent = activeFilter.text;

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

    /**
     * Gets the cross filters a visualisation is filtered by, as they are shown: each with its
     * filter, whose column is the column filtered, its text and its title.
     */
    const getCrossFilters = (visualisation) => {

        if (!visualisation || !filters.size) return [];

        return getActiveFilters().filter(activeFilter => isFilteredBy(visualisation, activeFilter));
    };

    /**
     * Creates a chip for a cross filter of getCrossFilters, to stand in a line of text naming it
     * with the content given.  Its clear button shows while its visualisation is hovered.  The
     * visualisation it stands in shows no other chip for the filter, once the chips are next
     * refreshed, which creating it schedules.
     */
    const createInlineChip = (activeFilter, content) => {

        const chip = createChip(activeFilter, content);

        chip.classList.add(INLINE_CHIP_CLASS);
        chip.setAttribute(KEY_ATTRIBUTE, getFilterKey(activeFilter.filter));

        // Kept from the visualisation beneath, which may start a drag or selection on it.
        chip.addEventListener("mousedown", event => event.stopPropagation());

        // Takes away the chip the visualisation may already show for the filter.  A redraw, as
        // when the filter is set, comes after the chips were last refreshed and doesn't refresh
        // them itself.
        scheduleRefresh();

        return chip;
    };

    const isShownInline = (element, activeFilter) => {

        const key = getFilterKey(activeFilter.filter);
        const inlineChips = element.querySelectorAll("." + INLINE_CHIP_CLASS);

        for (let index = 0; index < inlineChips.length; index++) {

            if (inlineChips[index].getAttribute(KEY_ATTRIBUTE) === key) return true;
        }

        return false;
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

        filtersByElement.forEach((activeFilters, element) => {

            const shownApart = activeFilters.filter(f => !isShownInline(element, f));

            if (shownApart.length) filtersByElement.set(element, shownApart);
            else filtersByElement.delete(element);
        });

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
        createInlineChip,
        getCrossFilters,
        refresh
    };
})();
