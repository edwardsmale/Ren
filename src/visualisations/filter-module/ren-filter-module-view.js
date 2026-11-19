/**
 * Filter Module: the panel's own DOM, built from the included columns and kept in sync with the
 * live filter.
 */
Ren.FilterModule_View = (s) => {

    const {
        element,
        compareControlRefs,
        hierCheckboxRefs,
        hierAllCheckboxRefs
    } = s;

    const {
        binning,
        busyIndicator,
        columnInfo,
        counts,
        filtering,
        fixedDimensions,
        hierarchyView,
        includeWhenSaving,
        itemSettings,
        menu,
        reorder,
        showRows,
        totalRowView,
        virtualOptions
    } = s;

    const reify = Ren.HtmlTemplateFunctions.reifyHtmlTemplate;
    const checkboxBehaviour = Ren.FilterModule_CheckboxBehaviour;

    const checkboxRefs = []; // { input, item, value }
    const allCheckboxRefs = []; // { input, item }
    const booleanCheckboxRefs = []; // { input, item }

    // Each column's selection is read at most once per sync, so a scroll rebuilding a window of
    // option rows doesn't rebuild the sets behind them.
    let columnFilterReader = null;

    const createColumnFilterReader = () => {

        const filtersByColumn = new Map();

        return (columnIdOrHeading) => {

            let entry = filtersByColumn.get(columnIdOrHeading);

            if (!entry) {

                const filter = filtering.getColumnFilter(columnIdOrHeading);
                const selectedValues = filter == null ? null : new Set();

                if (filter != null) {

                    for (let i = 0; i < filter.length; i++) selectedValues.add(String(filter[i]));
                }

                entry = { filter, selectedValues };
                filtersByColumn.set(columnIdOrHeading, entry);
            }

            return entry;
        };
    };

    const getColumnFilterReader = () => {

        if (!columnFilterReader) columnFilterReader = createColumnFilterReader();

        return columnFilterReader;
    };

    const invalidateColumnFilterReader = () => {

        columnFilterReader = null;
    };

    const isSelectedByColumnFilter = (selectedValues, value) =>
        selectedValues == null || selectedValues.has(String(value));

    const applyFilterToOptionRefs = (refs, getFilterForColumn) => {

        for (let i = 0; i < refs.length; i++) {

            const ref = refs[i];
            const selectedValues = getFilterForColumn(ref.item.columnIdOrHeading).selectedValues;

            ref.input.checked = isSelectedByColumnFilter(selectedValues, ref.value);
        }
    };

    const syncNewlyRenderedOptionRows = (refs) => applyFilterToOptionRefs(
        refs,
        getColumnFilterReader()
    );

    const syncCheckboxes = () => {

        invalidateColumnFilterReader();

        for (let i = 0; i < compareControlRefs.length; i++) {

            compareControlRefs[i].refresh();
        }

        const getFilterForColumn = getColumnFilterReader();

        applyFilterToOptionRefs(checkboxRefs, getFilterForColumn);

        // Only the rows on show; the rest have no checkbox to tick until a scroll builds one.
        const virtualLists = virtualOptions.getLists();

        for (let i = 0; i < virtualLists.length; i++) {
            applyFilterToOptionRefs(virtualLists[i].getRenderedRefs(), getFilterForColumn);
        }

        for (let i = 0; i < allCheckboxRefs.length; i++) {

            const ref = allCheckboxRefs[i];
            const currentFilter = getFilterForColumn(ref.item.columnIdOrHeading).filter;

            ref.input.checked = filtering.areAllOptionsSelected(ref.item, currentFilter);
        }

        for (let i = 0; i < booleanCheckboxRefs.length; i++) {

            const ref = booleanCheckboxRefs[i];
            const currentFilter = getFilterForColumn(ref.item.columnIdOrHeading).filter;

            ref.input.checked = filtering.isYesOnlyFilter(currentFilter);
        }

        includeWhenSaving.refresh();

        if (hierCheckboxRefs.length === 0 && hierAllCheckboxRefs.length === 0) return;

        // Hierarchical checkboxes reflect the combination filter, so each hierarchy's selection
        // is read once, keyed by its chain, and read through a reader that answers a node's state
        // without scanning the set (see Ren.FilterModule_TupleKeys).  The selection is read in
        // whichever sense it is stored in, so nothing here has to restate it.
        const selectionsByChainKey = new Map();

        const getSelection = (chain) => {

            const key = filtering.columnsKeyOf(chain);
            let selection = selectionsByChainKey.get(key);

            if (!selection) {

                const stored = filtering.getHierarchySelection(chain);

                selection = {
                    reader: Ren.FilterModule_TupleKeys.createReader(
                        stored.keys,
                        stored.isPositive
                    )
                };

                selectionsByChainKey.set(key, selection);
            }

            return selection;
        };

        const TupleKeys = Ren.FilterModule_TupleKeys;

        for (let i = 0; i < hierAllCheckboxRefs.length; i++) {

            const ref = hierAllCheckboxRefs[i];
            const reader = getSelection(ref.chain).reader;

            // Read from the top-level nodes rather than by walking every combination.
            const isEverythingSelected = reader.areAllNodesSelected(ref.rootNodes);

            ref.input.checked = isEverythingSelected;

            ref.input.indeterminate =
                !isEverythingSelected && !reader.areAllNodesExcluded(ref.rootNodes);
        }

        for (let i = 0; i < hierCheckboxRefs.length; i++) {

            const ref = hierCheckboxRefs[i];
            const state = getSelection(ref.chain).reader.getNodeState(ref.node);

            ref.input.checked = state === TupleKeys.SELECTED;
            ref.input.indeterminate = state === TupleKeys.PARTLY_EXCLUDED;
        }
    };

    const buildRemoveColumnButton = (item) => {

        const removeButton = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._addClass(
                "ren-filter-module__item-remove",
                "ren-link-button",
                "qa-ren-filter-module-item-remove"
            )
            ._attr(
                "title",
                menu.removingItemClearsFilter()
                    ? "Clear this filter"
                    : "Remove this filter from the filter module"
            )
            ._textContent("✕");

        Ren.DomEventUtils.onClickWithoutSelectingContainer(
            removeButton,
            () => menu.removeFilterModuleItem(item)
        );

        return removeButton;
    };

    // Gives the heading any tooltip set through "Filter heading tooltip..." in its view settings.
    const applyFilterHeadingTooltip = (headingElement, columnIdOrHeading) => {

        const filterHeadingTooltip = itemSettings.getFilterHeadingTooltip(columnIdOrHeading);

        if (filterHeadingTooltip) headingElement.title = filterHeadingTooltip;
    };

    /**
     * Builds an item's heading row.  getLevelMenus, for a hierarchy, gets the menus of its levels
     * above the leaf, so that its settings window sets theirs too (see
     * Ren.FilterModule_SettingsWindow.addSettingsButton).
     */
    const buildHeadingRow = (headingElement, item, itemLinks, getLevelMenus) => {

        const headingRow = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__item-heading-row")
            ._append(headingElement);

        if (itemLinks) headingRow._append(itemLinks);

        // Just after the heading, so it reads as the heading's own.
        Ren.FilterModule_SettingsWindow.addSettingsButton(
            s.visualisation,
            headingRow,
            headingElement,
            item.columnIdOrHeading,
            getLevelMenus
        );

        return headingRow._append(
            includeWhenSaving.buildToggleButton(item),
            buildRemoveColumnButton(item)
        );
    };

    const buildItemLinks = (item) => {

        const links = reify("FilterModuleItemLinks");
        const isBinned = binning.hasBinning(item.columnIdOrHeading);
        const showAddLink = itemSettings.showBinningFunctionLink(item.columnIdOrHeading);

        const addLink = links.querySelector(".js-ren-binning-link");
        const functionButton = links.querySelector(".js-ren-binning-function");
        const clearButton = links.querySelector(".js-ren-binning-clear");

        addLink.style.display = isBinned || !showAddLink ? "none" : "";
        functionButton.style.display = isBinned ? "" : "none";
        clearButton.style.display = isBinned ? "" : "none";

        Ren.AddButtonMenuItems(addLink, () => binning.buildBinningMenuItems(item));

        if (!isBinned) return links;

        functionButton.textContent = binning.getBinningLabel(item.columnIdOrHeading);
        Ren.AddButtonMenuItems(functionButton, () => binning.buildBinningMenuItems(item));

        Ren.DomEventUtils.onClickWithoutSelectingContainer(
            clearButton,
            () => binning.clearBinningFunction(item.columnIdOrHeading)
        );

        return links;
    };

    let compareFilterToFocus = null;

    let compareControlToFocus = null;

    const focusCompareFilterOnNextRender = (settingsKey, slot) => {

        compareFilterToFocus = { settingsKey, slot };
    };

    let openingFocusOffered = false;
    let openingFocusPending = false;

    const holdOpeningFocus = (control, framesLeft) => {

        if (framesLeft <= 0 || element.contains(document.activeElement)) return;

        control.focusValue();

        requestAnimationFrame(() => holdOpeningFocus(control, framesLeft - 1));
    };

    const focusFirstCompareFilter = (attemptsLeft) => {

        if (openingFocusOffered) return;

        if (!element.isConnected || element.offsetWidth === 0) {

            if (attemptsLeft > 0) {
                requestAnimationFrame(() => focusFirstCompareFilter(attemptsLeft - 1));
            }
            else {

                openingFocusPending = false;
            }

            return;
        }

        openingFocusOffered = true;
        openingFocusPending = false;

        if (!element.closest(".ren-report-popup-window")) return;

        for (let i = 0; i < compareControlRefs.length; i++) {

            if (compareControlRefs[i].focusValue()) {

                holdOpeningFocus(compareControlRefs[i], 5);
                return;
            }
        }
    };

    const resizeContainersToFitItem = (descendant) => {

        const item = descendant.closest(".ren-filter-module__item");

        if (!item) return;

        const popupWindow = element.closest(".ren-report-popup-window");

        const popupWidth = popupWindow ? popupWindow.getBoundingClientRect().width : 0;

        const widthChange = fixedDimensions.repinItemToContent(item);

        if (widthChange === 0) return;

        if (!popupWindow) return;

        popupWindow.style.width = (popupWidth + widthChange) + "px";

        Ren.Messages.Events.popupManuallyResized.notify(popupWindow, "width");
    };

    // The widest an item can be dragged out to, matching a popup's initial width cap.
    const maximumPanelWidth = 1000;

    let panelContentWidth;

    const getPanelContentWidth = () => {

        if (panelContentWidth !== undefined) return panelContentWidth;

        const panelStyle = window.getComputedStyle(element);

        panelContentWidth = maximumPanelWidth
            - (parseFloat(panelStyle.paddingLeft) || 0)
            - (parseFloat(panelStyle.paddingRight) || 0);

        return panelContentWidth;
    };

    // The narrowest an item can be dragged to, keeping room for its grip and a few characters.
    const MINIMUM_ITEM_WIDTH_PX = 60;

    const applyItemWidth = (itemElement, widthPx) => {

        itemElement.style.width = widthPx ? widthPx + "px" : "";
        itemElement.classList.toggle("ren-filter-module__item--fixed-width", !!widthPx);
    };

    // Widens the popup by as much as the panel overflows it, as a dragged item's own change in
    // width needn't be the panel's: stacked in a column, it is the widest item that counts.
    const widenPopupToFitPanel = () => {

        const popupWindow = element.closest(".ren-report-popup-window");

        if (!popupWindow) return;

        const overflow = element.scrollWidth - element.clientWidth;

        if (overflow <= 0) return;

        popupWindow.style.width = (popupWindow.getBoundingClientRect().width + overflow) + "px";

        Ren.Messages.Events.popupManuallyResized.notify(popupWindow, "width");
    };

    const resizeItemTo = (itemElement, widthPx) => {

        applyItemWidth(itemElement, widthPx);
        fixedDimensions.repinItemToContent(itemElement);
        widenPopupToFitPanel();
    };

    /**
     * Hides the item's border and unbolds its heading where its column settings say to, the border
     * keeping the room it takes.
     */
    const applyItemAppearance = (itemElement, columnIdOrHeading) => {

        if (!itemSettings.showBorder(columnIdOrHeading)) {

            itemElement._addClass("ren-filter-module__item--borderless");
        }

        if (!itemSettings.showHeadingInBold(columnIdOrHeading)) {

            itemElement._addClass("ren-filter-module__item--plain-heading");
        }
    };

    /**
     * Gives an item the grip on its right edge that sets it to a fixed width, kept in the item's
     * column settings, and sizes it to any width already kept.
     */
    const decorateItemForWidthResize = (itemElement, columnIdOrHeading) => {

        applyItemWidth(itemElement, itemSettings.getItemWidth(columnIdOrHeading));

        const handle = reify("FilterModuleItemResizeHandle");

        handle.addEventListener("mousedown", (event) => {

            // The drag is the grip's alone, not the start of a reorder or a text selection.
            event.preventDefault();
            event.stopPropagation();

            const startX = event.pageX;
            const startWidth = itemElement.offsetWidth;
            let width = startWidth;

            const onMouseMove = (moveEvent) => {

                width = Math.max(
                    MINIMUM_ITEM_WIDTH_PX,
                    Math.min(startWidth + moveEvent.pageX - startX, getPanelContentWidth())
                );

                resizeItemTo(itemElement, width);
            };

            const onMouseUp = () => {

                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);

                document.body.style.userSelect = previousUserSelect;
                document.body.style.cursor = previousCursor;

                if (width !== startWidth) itemSettings.setItemWidth(columnIdOrHeading, width);
            };

            const previousUserSelect = document.body.style.userSelect;
            const previousCursor = document.body.style.cursor;

            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        handle.addEventListener("dblclick", (event) => {

            event.stopPropagation();

            if (itemSettings.getItemWidth(columnIdOrHeading) === null) return;

            itemSettings.setItemWidth(columnIdOrHeading, null);
            resizeItemTo(itemElement, null);
        });

        // The click the drag ends on is the grip's too.
        Ren.DomEventUtils.stopClickSelectingContainer(handle);

        itemElement.appendChild(handle);
    };

    /**
     * Gets the maximum width a compare filter's value box can be dragged to.
     */
    const getMaximumCompareValueWidth = (strip, currentWidth) => {

        const item = strip.closest(".ren-filter-module__item");

        if (!item) return null;

        return currentWidth + getPanelContentWidth() - item.offsetWidth;
    };

    const buildAllRow = (allOptionLabel, onInvert, invertBusyKey) => {

        const row = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__all-row")
            ._append(allOptionLabel);

        if (!onInvert) return row;

        const invertLink = Ren.HtmlUtils.create("button")
            ._addClass(
                "ren-filter-module__invert-link",
                "ren-link-button",
                "qa-ren-filter-module-invert"
            )
            ._attr("type", "button")
            ._attr("title", "Select every unselected value and deselect every selected one")
            ._textContent("Invert");

        const invert = busyIndicator.wrapAction(invertLink, invertBusyKey, onInvert);

        Ren.DomEventUtils.onClickWithoutSelectingContainer(invertLink, (event) => {

            event.preventDefault();
            invert(event);
        });

        row._append(invertLink);

        return row;
    };

    const buildCompareStrips = (headerTarget, extraStripTarget, config) => {

        const groups = itemSettings.getCompareFilterGroups(config.settingsKey);
        const slotCount = itemSettings.getCompareFilterSlots(config.settingsKey).length;

        const columnCompareControls = [];

        // Every group has a panel of its own, so the heading row's buttons sit apart from the
        // compare filters and read as acting on the whole item.
        const buildGroupTarget = () => {

            if (!extraStripTarget) return headerTarget;

            const panel = Ren.HtmlUtils.create("div")._addClass("ren-filter-module__panel");

            extraStripTarget._append(panel);

            return panel;
        };

        for (let g = 0; g < groups.length; g++) {

            const group = groups[g];
            const isLastGroup = g === groups.length - 1;
            const groupTarget = buildGroupTarget();

            for (let i = 0; i < group.length; i++) {

                const slot = group[i];
                const isLastInGroup = i === group.length - 1;
                const strip = reify("FilterModuleCompareStrip");

                const compareControl = Ren.CompareFilterControl.create({
                    column: config.filterColumn,
                    slot,
                    orGroup: i === 0 ? null : group[0],
                    compact: true,
                    useContextMenuOperatorPicker: true,
                    columnKind: binning.hasBinning(config.settingsKey)
                        ? binning.getCompareColumnKind(config.settingsKey)
                        : filtering.getColumnKindForColumnIndex(config.columnIndex),
                    pendingInputs: s.getComparePendingInputs(config.filterColumn, slot),
                    getPredicate: () =>
                        filtering.getComparePredicateForColumn(config.filterColumn, slot),
                    onApply: (predicate) =>
                        filtering.applyComparePredicate(config.filterColumn, slot, predicate),
                    onRemove: slotCount > 1
                        ? () => itemSettings.removeCompareFilterSlot(config.settingsKey, slot)
                        : null,
                    onAddAnother: isLastInGroup && isLastGroup
                        ? () => itemSettings.addCompareFilter(config.settingsKey)
                        : null,
                    onAddOr: isLastInGroup
                        ? () => itemSettings.addOrCompareFilter(config.settingsKey, slot)
                        : null,
                    joinWord: isLastInGroup ? null : "or",
                    valueWidth: itemSettings.getCompareFilterValueWidth(config.settingsKey),
                    getMaximumValueWidth: (currentWidth) =>
                        getMaximumCompareValueWidth(strip, currentWidth),
                    onValueWidthChanging: (width) => {

                        for (let c = 0; c < columnCompareControls.length; c++) {

                            columnCompareControls[c].setValueWidth(width);
                        }

                        resizeContainersToFitItem(strip);
                    },
                    onValueWidthChanged: (width) =>
                        itemSettings.setCompareFilterValueWidth(config.settingsKey, width),

                    // A "between" filter's second box would otherwise overflow the pinned item.
                    onOperatorChanged: () => resizeContainersToFitItem(strip)
                });

                Ren.HtmlUtils.enrich(strip.querySelector(".js-ren-compare-control"))
                    ._append(compareControl.element);

                Ren.AddContextMenuItems(
                    strip,
                    () => menu.buildColumnActionMenuItems(config.menuTarget, false, false, false)
                );

                groupTarget._append(strip);

                if (compareFilterToFocus
                    && compareFilterToFocus.settingsKey === config.settingsKey
                    && compareFilterToFocus.slot === slot) {

                    compareControlToFocus = compareControl;
                }

                compareControlRefs.push(compareControl);
                columnCompareControls.push(compareControl);
            }
        }
    };

    // A Boolean column shown as one checkbox with its heading beside it, in place of its values
    // and total.
    const buildCheckboxItem = (item) => {

        const itemElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__item", "qa-ren-filter-module-item");

        Ren.AddContextMenuItems(
            itemElement,
            () => menu.buildColumnActionMenuItems(item, false, false, false)
        );

        const input = Ren.HtmlUtils.create("input")
            ._addClass("ren-filter-module__checkbox")
            ._attr("type", "checkbox");

        const headingElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__item-heading", "qa-ren-filter-module-item-heading")
            ._textContent(columnInfo.resolveHeading(item));

        applyFilterHeadingTooltip(headingElement, item.columnIdOrHeading);

        const checkboxLabel = Ren.HtmlUtils.create("label")
            ._addClass("ren-filter-module__option", "ren-filter-module__checkbox-heading")
            ._append(input, headingElement);

        checkboxBehaviour.letFilterDriveCheckedState(
            input,
            busyIndicator.wrapCheckboxAction(
                input,
                busyIndicator.keyOf("booleanCheckbox", item.columnIdOrHeading),
                () => filtering.onBooleanCheckboxToggled(item)
            )
        );

        booleanCheckboxRefs.push({ input, item });

        const headingRow = buildHeadingRow(checkboxLabel, item, null);

        Ren.AddContextMenuItems(headingRow, () => {

            const editHeadingItem = {
                section: "View settings",
                text: "Edit heading...",
                id: "filter-module-edit-heading",
                action: () => menu.openColumnHeadingEditor(item, headingElement)
            };

            return [editHeadingItem].concat(
                menu.buildColumnActionMenuItems(item, true, true, false)
            );
        });

        itemElement._append(headingRow);

        reorder.decorateItemForReorder(itemElement, item.columnIdOrHeading);
        decorateItemForWidthResize(itemElement, item.columnIdOrHeading);
        applyItemAppearance(itemElement, item.columnIdOrHeading);
        includeWhenSaving.applyItemBorder(item);

        element._append(itemElement);
    };

    const buildItem = (item) => {

        if (item.isBoolean && itemSettings.getShowAsCheckbox(item.columnIdOrHeading) !== "Off") {

            buildCheckboxItem(item);
            return;
        }

        const itemElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__item", "qa-ren-filter-module-item");

        Ren.AddContextMenuItems(
            itemElement,
            () => menu.buildColumnActionMenuItems(item, false, false, false)
        );

        const compareGroups = itemSettings.getCompareFilterGroups(item.columnIdOrHeading);
        const compareFilterShown = compareGroups.length > 0;

        const valueCheckboxesShown = itemSettings.showValueCheckboxes(item.columnIdOrHeading);

        const isPanelled = compareFilterShown;

        const createPanel = () => Ren.HtmlUtils.create("div")._addClass("ren-filter-module__panel");

        const headerTarget = isPanelled ? createPanel() : itemElement;
        const optionsTarget = isPanelled ? createPanel() : itemElement;

        if (isPanelled) {

            itemElement._addClass("ren-filter-module__item--panelled");
            itemElement._append(headerTarget);
        }

        // Hidden where toggling it would leave the order as it is.
        const showSortToggle = item.options.sortToggleChangesOrder === true
            && itemSettings.showSortToggle(item.columnIdOrHeading);
        const showSingleSelectToggle = itemSettings.showSingleSelectToggle(item.columnIdOrHeading);

        const appendStripToggle = (stripElement, caption, title, isOn, onToggle, pinnedLeft) => {

            const group = Ren.HtmlUtils.create("div")
                ._addClass("ren-filter-module__item-strip-group")
                ._attr("title", title);

            if (pinnedLeft) group._addClass("ren-filter-module__item-strip-group--left");

            const label = Ren.HtmlUtils.create("span")
                ._addClass("ren-filter-module__item-strip-label")
                ._textContent(caption);

            const toggle = Ren.ToggleSwitch.create(isOn);

            toggle.onClick(() => onToggle());
            label.addEventListener("click", () => onToggle());

            group._append(label);
            group._append(toggle.element);
            stripElement._append(group);
        };

        if (showSortToggle || showSingleSelectToggle) {

            const stripElement = Ren.HtmlUtils.create("div")._addClass("ren-filter-module__item-strip");

            if (showSortToggle) {

                appendStripToggle(
                    stripElement,
                    "Sort",
                    s.SORT_TOGGLE_TITLE,
                    !itemSettings.isItemSortedByValue(item.columnIdOrHeading),
                    () => itemSettings.setItemSortMode(
                        item.columnIdOrHeading,
                        !itemSettings.isItemSortedByValue(item.columnIdOrHeading)
                    ),
                    true
                );
            }

            if (showSingleSelectToggle) {

                appendStripToggle(
                    stripElement,
                    "Single",
                    s.SINGLE_SELECT_TOGGLE_TITLE,
                    itemSettings.isSingleSelect(item.columnIdOrHeading),
                    () => itemSettings.toggleSingleSelect(item.columnIdOrHeading),
                    false
                );
            }

            Ren.AddContextMenuItems(
                stripElement,
                () => menu.buildColumnActionMenuItems(item, false, false, false)
            );

            headerTarget._append(stripElement);
        }

        const headingElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__item-heading", "qa-ren-filter-module-item-heading")
            ._textContent(columnInfo.resolveHeading(item));

        applyFilterHeadingTooltip(headingElement, item.columnIdOrHeading);

        const buildHeadingMenuItems = () => {

            const editHeadingItem = {
                section: "View settings",
                text: "Edit heading...",
                id: "filter-module-edit-heading",
                action: () => menu.openColumnHeadingEditor(item, headingElement)
            };

            return [editHeadingItem].concat(menu.buildColumnActionMenuItems(item, true, true, false));
        };

        const headingRow = buildHeadingRow(headingElement, item, buildItemLinks(item));

        Ren.AddContextMenuItems(headingRow, buildHeadingMenuItems);

        headerTarget._append(headingRow);

        buildCompareStrips(headerTarget, isPanelled ? itemElement : null, {
            settingsKey: item.columnIdOrHeading,
            filterColumn: item.columnIdOrHeading,
            columnIndex: item.columnIndex,
            menuTarget: item
        });

        const valueTitle = columnInfo.getValueTitle(item.columnIdOrHeading);
        const totalsShown = itemSettings.showOptionTotals(item.columnIdOrHeading);

        const valueSummaryStats = counts.getValueSummaryStats(item.columnIdOrHeading);

        const formatOptionValue = (aggregatedValue) =>
            columnInfo.formatDisplayValue(item.columnIdOrHeading, aggregatedValue, valueSummaryStats);

        const optionsElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-filter-module__options")
            ._addClass("ren-filter-module__options--vertical");

        if (valueCheckboxesShown && itemSettings.showAllCheckbox(item.columnIdOrHeading)) {

            const allOptionLabel = Ren.HtmlUtils.create("label")
                ._addClass("ren-filter-module__option", "qa-ren-filter-module-option")
                ._addClass("ren-filter-module__all-option", "qa-ren-filter-module-all-option");

            const allInput = Ren.HtmlUtils.create("input")
                ._addClass("ren-filter-module__checkbox")
                ._attr("type", "checkbox");

            allOptionLabel._append(allInput);

            const allTextElement = Ren.HtmlUtils.create("span")
                ._addClass("ren-filter-module__option-text", "qa-ren-filter-module-option-text")
                ._textContent(columnInfo.resolveAllLabel(item.columnIdOrHeading, item.options.length));

            allOptionLabel._append(allTextElement);

            Ren.AddContextMenuItems(allOptionLabel, () => {

                const editAllLabelItem = {
                    section: "Labels",
                    text: "Edit label...",
                    id: "filter-module-edit-all-label",
                    action: () => menu.openAllLabelEditor(item, allTextElement, item.options.length)
                };

                return [editAllLabelItem].concat(
                    menu.buildColumnActionMenuItems(item, true, false, false)
                );
            });

            checkboxBehaviour.letFilterDriveCheckedState(
                allInput,
                busyIndicator.wrapCheckboxAction(
                    allInput,
                    busyIndicator.keyOf("all", item.columnIdOrHeading),
                    () => filtering.onAllToggled(item)
                )
            );

            allCheckboxRefs.push({ input: allInput, item });

            optionsElement._append(buildAllRow(
                allOptionLabel,
                itemSettings.isSingleSelect(item.columnIdOrHeading)
                    ? null
                    : () => filtering.onInvertToggled(item),
                busyIndicator.keyOf("invert", item.columnIdOrHeading)
            ));
            optionsElement._append(
                Ren.HtmlUtils.create("div")._addClass("ren-filter-module__divider")
            );
        }

        const singleSelect = itemSettings.isSingleSelect(item.columnIdOrHeading);
        const optionCount = valueCheckboxesShown ? item.options.length : 0;
        const autoMenuName = columnInfo.getAutoMenuName(item.columnIdOrHeading);

        const createOptionRowElements = (option, forSizer) => {

            const optionLabel = Ren.HtmlUtils.create("label");

            if (forSizer) {

                optionLabel._addClass("ren-filter-module__option-sizer-row");
            }
            else {

                optionLabel
                    ._addClass("ren-filter-module__option", "qa-ren-filter-module-option")
                    ._attr("data-value", option.value);
            }

            const input = Ren.HtmlUtils.create("input")
                ._addClass("ren-filter-module__checkbox")
                ._attr("type", singleSelect ? "radio" : "checkbox");

            optionLabel._append(input);

            const optionTextElement = Ren.HtmlUtils.create("span")
                ._addClass("ren-filter-module__option-text");

            if (!forSizer) optionTextElement._addClass("qa-ren-filter-module-option-text");

            columnInfo.setFormattedText(
                optionTextElement,
                columnInfo.resolveOptionText(item.columnIdOrHeading, item.columnIndex, option)
            );

            optionLabel._append(optionTextElement);

            let optionCountElement = null;

            if (totalsShown) {

                optionCountElement = Ren.HtmlUtils.create("span")
                    ._addClass("ren-filter-module__option-count")
                    ._attr("title", valueTitle);

                columnInfo.setFormattedText(
                    optionCountElement,
                    `${formatOptionValue(option.aggregatedValue)}`
                );

                optionLabel._append(optionCountElement);
            }

            return { optionLabel, input, optionTextElement, optionCountElement };
        };

        const buildOptionRow = (index) => {

            const option = item.options[index];
            const parts = createOptionRowElements(option, false);
            const { optionLabel, input, optionTextElement, optionCountElement } = parts;

            if (autoMenuName) Ren.AutoMenu.applyMenu(optionLabel, autoMenuName, option.value);

            const showRowsItem = showRows.getOptionMenuItem(item, option, optionTextElement);

            Ren.AddContextMenuItems(
                optionLabel,
                () => [showRowsItem]
                    .concat(menu.buildColumnActionMenuItems(item, true, false, false))
            );

            if (optionCountElement) {

                Ren.AddContextMenuItems(
                    optionCountElement,
                    () => [showRowsItem]
                        .concat(menu.buildColumnActionMenuItems(item, true, false, true))
                );
            }

            Ren.AddContextMenuItems(optionTextElement, () => {

                const editLabelItem = {
                    section: "Labels",
                    text: "Edit Label...",
                    id: "filter-module-edit-label",
                    action: () => menu.editOptionText(item, option, optionTextElement)
                };

                return [showRowsItem, editLabelItem]
                    .concat(menu.buildColumnActionMenuItems(item, true, true, false));
            });

            const busyKey = busyIndicator.keyOf("option", item.columnIdOrHeading, option.value);

            checkboxBehaviour.letFilterDriveCheckedState(
                input,
                busyIndicator.wrapCheckboxAction(
                    input,
                    busyKey,
                    (event) => filtering.onCheckboxToggled(item, option.value, event.ctrlKey)
                )
            );

            checkboxBehaviour.letRightClickFilterRatherThanOpenMenu(
                input,
                busyIndicator.wrapCheckboxAction(
                    input,
                    busyKey,
                    () => filtering.onCheckboxRightClicked(item, option.value)
                )
            );

            return {
                element: optionLabel,
                ref: { input, item, value: option.value }
            };
        };

        const buildOptionSizerRow = (index) =>
            createOptionRowElements(item.options[index], true).optionLabel;

        if (virtualOptions.isVirtualised(optionCount)) {

            itemElement._addClass("ren-filter-module__item--scrolling");

            optionsElement._append(virtualOptions.createList({
                key: item.columnIdOrHeading,
                options: item.options,
                buildRow: buildOptionRow,
                buildSizerRow: buildOptionSizerRow,
                onRowsRendered: (refs) => syncNewlyRenderedOptionRows(refs)
            }).element);
        }
        else {

            for (let i = 0; i < optionCount; i++) {

                const row = buildOptionRow(i);

                checkboxRefs.push(row.ref);
                optionsElement._append(row.element);
            }
        }

        if (item.options.length > 0 && itemSettings.showTotal(item.columnIdOrHeading)) {

            const totalValue = counts.getTotalDisplayValue(item);

            if (totalValue != null) {

                const totalRow = totalRowView.buildTotalRow(
                    itemSettings.getTotalRowLabel(item.columnIdOrHeading),
                    formatOptionValue(totalValue),
                    columnInfo.getTotalValueTitle(item.columnIdOrHeading)
                );

                // Right-click the totals row to reach the "Total value" aggregation actions.
                Ren.AddContextMenuItems(
                    totalRow,
                    () => menu.buildColumnActionMenuItems(item, true, false, true)
                );

                optionsElement._append(totalRow);
            }
        }

        optionsTarget._append(optionsElement);

        if (isPanelled && optionsElement.childElementCount > 0) itemElement._append(optionsTarget);

        reorder.decorateItemForReorder(itemElement, item.columnIdOrHeading);
        decorateItemForWidthResize(itemElement, item.columnIdOrHeading);
        applyItemAppearance(itemElement, item.columnIdOrHeading);
        includeWhenSaving.applyItemBorder(item);

        element._append(itemElement);
    };

    const clearElement = (targetElement) => {

        while (targetElement.firstChild) targetElement.removeChild(targetElement.firstChild);
    };

    const appendRightClickHint = () => {

        element._append(
            Ren.HtmlUtils.create("div")
                ._addClass("ren-filter-module__empty")
                ._textContent("Right-click to add filters")
        );
    };

    const getIncludedColumns = () => {

        const includedColumns = [];
        const eligibleColumns = s.eligibleColumns;

        for (let i = 0; i < eligibleColumns.length; i++) {

            if (itemSettings.isColumnIncluded(eligibleColumns[i])) {
                includedColumns.push(eligibleColumns[i]);
            }
        }

        return includedColumns;
    };

    const findHierarchies = (includedColumns) => {

        const gridChain = counts.getHierarchyColumns();
        const ancestorsByLeafColumn = new Map();
        const ancestorColumnIds = new Set();

        for (let i = 0; i < includedColumns.length; i++) {

            const column = includedColumns[i];
            const ancestors = counts.getAncestorColumnsForLeaf(column, gridChain);

            if (ancestors.length === 0) continue;

            ancestorsByLeafColumn.set(column.columnIdOrHeading, ancestors);

            for (let j = 0; j < ancestors.length; j++) {
                ancestorColumnIds.add(ancestors[j].columnIdOrHeading);
            }
        }

        return { ancestorsByLeafColumn, ancestorColumnIds };
    };

    const collectTopLevelItems = (includedColumns, hierarchies) => {

        const { ancestorsByLeafColumn, ancestorColumnIds } = hierarchies;
        const topLevelItems = [];

        for (let i = 0; i < includedColumns.length; i++) {

            const column = includedColumns[i];

            if (ancestorColumnIds.has(column.columnIdOrHeading)) continue;

            const ancestors = ancestorsByLeafColumn.get(column.columnIdOrHeading);

            if (ancestors) {

                const hierarchyColumns = ancestors.concat(column);

                topLevelItems.push({
                    key: column.columnIdOrHeading,
                    build: () => hierarchyView.buildHierarchicalItem(hierarchyColumns)
                });

                continue;
            }

            topLevelItems.push({
                key: column.columnIdOrHeading,
                build: () => buildItem({
                    columnIdOrHeading: column.columnIdOrHeading,
                    columnIndex: column.columnIndex,
                    options: counts.buildOptions(column),
                    fallbackHeading: column.fallbackHeading,
                    isBoolean: column.isBoolean === true
                })
            });
        }

        return topLevelItems;
    };

    /**
     * (Re)builds the panel from the included columns, reflecting the source filter onto the fresh
     * checkboxes.
     */
    const render = () => {

        const reuseDimensions = s.reuseDimensionsOnNextRender === true;

        s.reuseDimensionsOnNextRender = false;

        const panelScrollTop = element.scrollTop;

        clearElement(element);
        invalidateColumnFilterReader();
        virtualOptions.reset();
        checkboxRefs.length = 0;
        allCheckboxRefs.length = 0;
        booleanCheckboxRefs.length = 0;
        includeWhenSaving.reset();
        hierCheckboxRefs.length = 0;
        hierAllCheckboxRefs.length = 0;
        filtering.forgetHierarchies();
        compareControlRefs.length = 0;

        element.classList.toggle("ren-filter-module--column-flow", itemSettings.isColumnFlow());

        const includedColumns = getIncludedColumns();

        if (includedColumns.length === 0) {

            appendRightClickHint();

            return;
        }

        const topLevelItems = collectTopLevelItems(
            includedColumns,
            findHierarchies(includedColumns)
        );

        reorder.orderReorderableItems(topLevelItems);

        for (let i = 0; i < topLevelItems.length; i++) topLevelItems[i].build();

        if (itemSettings.showRightClickHint()) appendRightClickHint();

        syncCheckboxes();

        fixedDimensions.stabiliseItemDimensions(reuseDimensions);

        if (panelScrollTop > 0) element.scrollTop = panelScrollTop;

        const controlToFocus = compareControlToFocus;

        compareFilterToFocus = null;
        compareControlToFocus = null;

        if (controlToFocus) controlToFocus.focusValue();

        if (controlToFocus) {

            openingFocusOffered = true;
            openingFocusPending = false;
        }
        else if (!openingFocusOffered && !openingFocusPending) {

            openingFocusPending = true;
            focusFirstCompareFilter(60);
        }

        counts.releaseSettingsBuiltForRender();
    };

    return {
        render,
        syncCheckboxes,
        buildHeadingRow,
        applyFilterHeadingTooltip,
        buildAllRow,
        buildCompareStrips,
        decorateItemForWidthResize,
        applyItemAppearance,
        focusCompareFilterOnNextRender
    };
};
