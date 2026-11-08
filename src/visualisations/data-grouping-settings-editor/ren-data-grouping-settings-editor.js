Ren.CreateDataGroupingSettingsEditor = (tabularData, visualisation) => {

    const sourceVisualisation = visualisation.sourceVisualisation;

    let transformedSettings = null;
    let dataGroupingSettingsApplyer = null;

    const create = Ren.HtmlUtils.create;
    const reify = Ren.HtmlTemplateFunctions.reifyHtmlTemplate;
    const CLASS = "ren-data-grouping-settings-editor-grouping";

    // Mirrors the data grid's group expand/collapse button, with "−" a vertically-centred minus.
    const TILE_COLLAPSED_SYMBOL = "+";
    const TILE_EXPANDED_SYMBOL = "−";

    // --- Section visibility and initial state -----------------------------------------------

    // A caller can narrow the editor to a subset of these with the editorSections setting, as
    // "Multi-level sort..." does.
    const SECTION_GROUP_BY = "groupBy";
    const SECTION_SORT = "sort";
    const SECTION_COLUMN_SETTINGS = "columnSettings";
    const SECTION_GROUP_FILTERS = "groupFilters";

    const ALL_SECTIONS =
        [SECTION_GROUP_BY, SECTION_SORT, SECTION_COLUMN_SETTINGS, SECTION_GROUP_FILTERS];

    const requestedSections = visualisation.editorSections;

    const shownSections = (Array.isArray(requestedSections) && requestedSections.length)
        ? requestedSections
        : ALL_SECTIONS;

    const isSectionShown = (sectionName) => shownSections.indexOf(sectionName) !== -1;

    // Reordering, disabling and inserting groupings change the structure the group-by section is
    // about, so these controls come and go with it.
    const showStructuralControls = isSectionShown(SECTION_GROUP_BY);

    // A filters-only editor shows its filter sections bare, as a collapsible header would name the
    // only thing on show and could only hide it.
    const filtersOnlyEditor =
        shownSections.length === 1 && isSectionShown(SECTION_GROUP_FILTERS);

    const tilesExpandedInitially = !!visualisation.tilesExpandedInitially;
    const expandedTileKey = visualisation.expandedTileKey;

    const isTileExpandedInitially = (tileKey) => expandedTileKey == null
        ? tilesExpandedInitially
        : String(tileKey) === String(expandedTileKey);
    const sectionsExpandedInitially = !!visualisation.sectionsExpandedInitially;
    const editControlsRevealedInitially = !!visualisation.editControlsRevealedInitially;

    const { buildAddMenuLink } = Ren.DataGroupingSettingsEditorControls;

    const {
        disableGroupingEntry,
        enableDisabledGroupingEntry
    } = Ren.DataGroupingSettingsEditorColumnMutations;

    // Everything in the editor is authoring, so its filter modules show their edit-mode controls.
    const element = create("div")._addClass(
        "ren-data-grouping-settings-editor",
        Ren.ReportEditModeModule.ALWAYS_EDIT_MODE_CLASS_NAME
    );

    // Deferred so it measures the content once the change has been laid out.
    const resizePopup = () => {

        Ren.FnUtils.defer(() => {

            if (visualisation.popup?.resizeToMatchContent) {
                visualisation.popup.resizeToMatchContent(true);
            }
        });
    };

    // Kept so the full re-render after each edit doesn't collapse what the user has opened.  Keyed
    // by "<entryIndex>:<sectionName>".
    const sectionExpandedState = {};

    // Likewise for whole tiles, keyed by entryIndex (or "dataRows").
    const tileExpandedState = {};

    // --- Column metadata --------------------------------------------------------------------

    const columnModels = tabularData.ColumnModels;
    const tabTitle = tabularData.Title;

    // Keyed by ColumnIdOrHeading.
    const columnTypeByKey = {};
    const columnLabelByKey = {};

    // Columns the user can pick in dropdowns (excludes internal "__" columns).
    const selectableColumns = [];

    for (let i = 0; i < columnModels.length; i++) {

        const model = columnModels[i];
        const key = model.ColumnIdOrHeading;
        const label = model.Heading || model.ColumnId || key;

        columnTypeByKey[key] = model.ColumnType;
        columnLabelByKey[key] = label;

        if (model.Heading && model.Heading.includes("__")) continue;

        selectableColumns.push({ value: key, label });
    }

    const getColumnLabel = (key) => columnLabelByKey[key] ?? key;

    // --- Apply ------------------------------------------------------------------------------

    // Validation happens before any runtime mutation, so an invalid edit leaves the model untouched
    // and re-rendering from it resets the controls.
    const applyChanges = () => {

        delete transformedSettings.signifier;

        try {

            dataGroupingSettingsApplyer.applyDataGroupingSettings(transformedSettings);
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError("Edit Groupings: failed to apply settings", error);

            updateContents(getRuntimeDataGroupingSettings());
            return;
        }

        getRuntimeDataGroupingSettings().fireChangedEvent();
    };

    const getRuntimeDataGroupingSettings = () => Ren.DataGroupingSettingsCollection.getDataGroupingSettings(
        sourceVisualisation.dataGroupingSettingsGroup,
        sourceVisualisation.visualisationGuid
    );

    // --- Transform --------------------------------------------------------------------------

    const updateTransformedDataGroupingSettings = (dataGroupingSettings) => {

        transformedSettings = Ren.DataGroupingSettingsTransformer.transform(
            tabularData,
            dataGroupingSettings,
            false
        );

        dataGroupingSettingsApplyer = Ren.DataGroupingSettingsApplyer(
            tabularData,
            dataGroupingSettings
        );
    };

    // --- Section builders -------------------------------------------------------------------

    // Group-level filters, shown as a Filter Module pointed at this grouping. The values ticked are
    // the group rows' own (binned values, aggregated figures), as a group filter matches on those.
    const buildFilterSection = (grouping, entryIndex) => {

        const body = getFilterModuleHost(buildFilterTarget(grouping), entryIndex).render(grouping);

        if (filtersOnlyEditor) return body;

        return buildCollapsible("Column filters", body, `${entryIndex}:filters`);
    };

    // The open/closed state is kept under stateKey so it survives the re-render after every edit.
    const buildCollapsible = (titleText, bodyElement, stateKey) => {

        const startCollapsed = !(sectionExpandedState[stateKey] ?? sectionsExpandedInitially);

        const wrap = reify("DataGroupingSettingsEditorCollapsible", {
            title: titleText,
            startCollapsed,
            arrow: startCollapsed ? "▸" : "▾"
        });

        const header = wrap.querySelector(`.${CLASS}__collapsible-header`);
        const arrow = wrap.querySelector(`.${CLASS}__collapsible-arrow`);
        const body = wrap.querySelector(`.${CLASS}__collapsible-body`);

        body.appendChild(bodyElement);

        header.addEventListener("click", () => {

            const collapsed = wrap.classList.toggle(`${CLASS}__collapsible--collapsed`);
            arrow.textContent = collapsed ? "▸" : "▾";
            sectionExpandedState[stateKey] = !collapsed;

            resizePopup();
        });

        return wrap;
    };

    // --- Section modules ----------------------------------------------------------------------

    // The group-by, sort and column-settings sections each live in their own module.  This is what
    // they need of the editor around them.
    const sectionEditor = {
        getGroupings: () => transformedSettings.groupings.entries,
        getDataRows: () => transformedSettings.dataRows,
        getColumnType: (columnKey) => columnTypeByKey[columnKey],
        getColumnLabel,
        selectableColumns,
        applyChanges,
        rerender: () => updateContents(getRuntimeDataGroupingSettings()),
        buildCollapsible,
        editControlsRevealedInitially,
        openFunctionEditor: (getInitial, onSave, parameterSet, functionTag) =>
            Ren.DataGroupingSettingsEditorControls.openFunctionEditor(
                getInitial,
                onSave,
                parameterSet,
                functionTag,
                tabularData
            )
    };

    const buildGroupByColumnsSection = Ren.DataGroupingSettingsEditorGroupBySection(sectionEditor);
    const buildSortSection = Ren.DataGroupingSettingsEditorSortSection(sectionEditor);
    const buildColumnsSection = Ren.DataGroupingSettingsEditorColumnsSection(sectionEditor);

    // --- Disable / enable groupings ---------------------------------------------------------

    // Disabled groupings are held aside from the applied entries but kept on the settings, each as
    // { index, grouping }, where index is the entry position to restore it to.
    const getDisabledGroupings = () => {

        transformedSettings.groupings ??= { entries: [] };
        transformedSettings.groupings.disabledGroupings ??= [];
        return transformedSettings.groupings.disabledGroupings;
    };

    const disableGrouping = (entryIndex) => {

        disableGroupingEntry(
            transformedSettings.groupings,
            entryIndex,
            transformedSettings.dataRows
        );

        applyChanges();
    };

    const enableGrouping = (disabledEntry) => {

        enableDisabledGroupingEntry(transformedSettings.groupings, disabledEntry);
        applyChanges();
    };

    const removeDisabledGrouping = (disabledEntry) => {

        const disabledGroupings = getDisabledGroupings();
        const position = disabledGroupings.indexOf(disabledEntry);
        if (position !== -1) disabledGroupings.splice(position, 1);

        applyChanges();
    };

    const buildDisabledGroupingPanel = (disabledEntry) => {

        const grouping = disabledEntry.grouping;

        const groupByColumns = grouping.groupByColumns || [];
        const labels = [];
        for (let i = 0; i < groupByColumns.length; i++) labels.push(getColumnLabel(groupByColumns[i]));

        const panel = reify("DataGroupingSettingsEditorDisabledPanel", {
            title: labels.length ? `${labels.join(", ")} grouping` : "Grouping"
        });

        panel.querySelector(".js-ren-data-grouping-settings-editor-grouping-remove-grouping")
            .addEventListener("click", () => removeDisabledGrouping(disabledEntry));

        panel.querySelector(".js-ren-data-grouping-settings-editor-grouping-enable-grouping")
            .addEventListener("click", () => enableGrouping(disabledEntry));

        return panel;
    };

    const wireTileCollapse = (panel, stateKey) => {

        const collapseToggle = panel.querySelector(`.${CLASS}__collapse-toggle`);
        const titleElement = panel.querySelector(`.${CLASS}__tile-title-clickable`);

        const toggle = () => {

            const collapsed = panel.classList.toggle(`${CLASS}--collapsed`);
            collapseToggle.textContent = collapsed ? TILE_COLLAPSED_SYMBOL : TILE_EXPANDED_SYMBOL;
            tileExpandedState[stateKey] = !collapsed;

            resizePopup();
        };

        collapseToggle.addEventListener("click", toggle);
        titleElement.addEventListener("click", toggle);
    };

    // Gets a tile's heading: "Totals row" for the outermost grouping, otherwise "<columns>
    // grouping", as the bold column names plus the lead the heading renders un-emboldened.
    const buildGroupingTitle = (grouping, isOutermost) => {

        if (isOutermost) return { lead: "Totals row", columns: "" };

        const groupByColumns = grouping.groupByColumns || [];
        if (!groupByColumns.length) return { lead: "Grouping", columns: "" };

        const labels = [];
        for (let i = 0; i < groupByColumns.length; i++) labels.push(getColumnLabel(groupByColumns[i]));

        return { lead: "grouping", columns: labels.join(", ") };
    };

    // A filter module host is built once per level and re-parented into each newly built tile, so
    // the module and its value counts survive the editor's re-renders.  Levels are keyed by the
    // columns they group by, since entry indexes shift as groupings are reordered.
    const filterModuleHostsByLevelKey = {};

    const getLevelKey = (filterTarget) => filterTarget.level === "dataRows"
        ? "dataRows"
        : `group:${filterTarget.groupByColumns.join(",")}`;

    // Handed only to the expanded tile's host, and only once, so that a level created later at the
    // same entry index doesn't pick it up too.
    let pendingIncludedColumnKey = expandedTileKey == null ? null : visualisation.includedColumnKey;

    const getFilterModuleHost = (filterTarget, tileKey) => {

        const levelKey = getLevelKey(filterTarget);

        if (!filterModuleHostsByLevelKey[levelKey]) {

            const isExpandedTile = String(tileKey) === String(expandedTileKey);

            filterModuleHostsByLevelKey[levelKey] = Ren.DataGroupingSettingsEditorFilterModuleHost({
                tabularData,
                tabTitle,
                visualisation,
                sourceVisualisation,
                filterTarget,
                initiallyIncludedColumnKey: isExpandedTile ? pendingIncludedColumnKey : null
            });

            if (isExpandedTile) pendingIncludedColumnKey = null;
        }

        return filterModuleHostsByLevelKey[levelKey];
    };

    // Drops the host of any level that has since gone: its grouping removed, disabled or regrouped.
    const pruneRemovedLevelHosts = () => {

        const entries = transformedSettings.groupings?.entries ?? [];
        const levelKeys = { dataRows: true };

        for (let i = 0; i < entries.length; i++) {

            levelKeys[getLevelKey(buildFilterTarget(entries[i]))] = true;
        }

        const hostKeys = Object.keys(filterModuleHostsByLevelKey);

        for (let i = 0; i < hostKeys.length; i++) {

            if (!levelKeys[hostKeys[i]]) delete filterModuleHostsByLevelKey[hostKeys[i]];
        }
    };

    // Gets the filter target naming a grouping level; the Totals Row groups by no columns.
    const buildFilterTarget = (grouping) => ({
        level: "grouping",
        groupByColumns: grouping.groupByColumns ?? []
    });

    // The Totals Row is always expanded, so has no toggle, and a narrowed view drops it with the
    // other structural controls.
    const wirePreventExpansionToggle = (panel, grouping, isOutermost) => {

        const toggle =
            panel.querySelector(".js-ren-data-grouping-settings-editor-grouping-prevent-expansion");

        if (isOutermost || !showStructuralControls) {

            toggle.remove();
            return;
        }

        const checkbox = toggle.querySelector("input");
        checkbox.checked = !!grouping.preventExpansion;

        checkbox.addEventListener("change", () => {

            if (checkbox.checked) {
                grouping.preventExpansion = true;
            }
            else {

                delete grouping.preventExpansion;
            }

            applyChanges();
        });
    };

    // Builds a whole grouping panel, or null when the shown sections leave the tile with nothing to
    // edit (the Totals Row in a sort-only editor, for instance).
    const buildGroupingPanel = (grouping, entryIndex, isOutermost) => {

        // The Totals Row is a single aggregate row, so has no group-by columns, sort levels or
        // sibling groups to filter between.
        const bodySections = [];

        const groupByResult = (isOutermost || !isSectionShown(SECTION_GROUP_BY))
            ? null
            : buildGroupByColumnsSection(grouping, entryIndex);

        if (groupByResult) bodySections.push(groupByResult.element);

        if (!isOutermost && isSectionShown(SECTION_SORT)) {
            bodySections.push(buildSortSection(grouping, entryIndex));
        }

        if (isSectionShown(SECTION_COLUMN_SETTINGS)) {
            bodySections.push(buildColumnsSection(grouping, entryIndex));
        }

        if (!isOutermost && isSectionShown(SECTION_GROUP_FILTERS)) {
            bodySections.push(buildFilterSection(grouping, entryIndex));
        }

        if (bodySections.length === 0) return null;

        const collapsed =
            !(tileExpandedState[entryIndex] ?? isTileExpandedInitially(entryIndex));
        const title = buildGroupingTitle(grouping, isOutermost);

        const panel = reify("DataGroupingSettingsEditorPanel", {
            lead: title.lead,
            columns: title.columns,
            gripSymbol: "⠿",
            toggleSymbol: collapsed ? TILE_COLLAPSED_SYMBOL : TILE_EXPANDED_SYMBOL
        });

        if (collapsed) panel.classList.add(`${CLASS}--collapsed`);

        let grip = panel.querySelector(`.${CLASS}__drag-grip`);
        let disableLink =
            panel.querySelector(".js-ren-data-grouping-settings-editor-grouping-disable-grouping");

        // The Totals Row can't be reordered or disabled, and a view narrowed away from the group-by
        // section doesn't show the grouping structure.
        if (isOutermost || !showStructuralControls) {

            grip.remove();
            disableLink.remove();
            grip = null;
            disableLink = null;
        }

        wirePreventExpansionToggle(panel, grouping, isOutermost);

        // Held in a body so the whole set can be hidden when the tile is collapsed.
        const body = create("div")._addClass(`${CLASS}__tile-body`);

        for (let i = 0; i < bodySections.length; i++) body.appendChild(bodySections[i]);

        panel.appendChild(body);

        wireTileCollapse(panel, entryIndex);

        return { panel, disableLink, grip };
    };

    // The data rows' own column filters, as set from a grid column heading or any filter module.
    const buildDataRowsFilterSection = (dataRows) => {

        const body = getFilterModuleHost({ level: "dataRows" }, "dataRows").render(dataRows);

        if (filtersOnlyEditor) return body;

        return buildCollapsible("Column filters", body, "dataRows:filters");
    };

    // Builds the data-rows tile, for the ungrouped leaf rows beneath every grouping, or null when
    // the shown sections leave it nothing to edit.  The section builders treat dataRows as they do
    // a grouping, keyed "dataRows" rather than by an entry index.
    const buildDataRowsPanel = () => {

        transformedSettings.dataRows ??= {};
        const dataRows = transformedSettings.dataRows;

        const bodySections = [];

        if (isSectionShown(SECTION_SORT)) bodySections.push(buildSortSection(dataRows, "dataRows"));

        if (isSectionShown(SECTION_COLUMN_SETTINGS)) {
            bodySections.push(buildColumnsSection(dataRows, "dataRows", true));
        }

        if (isSectionShown(SECTION_GROUP_FILTERS)) {
            bodySections.push(buildDataRowsFilterSection(dataRows));
        }

        if (bodySections.length === 0) return null;

        const collapsed =
            !(tileExpandedState["dataRows"] ?? isTileExpandedInitially("dataRows"));

        const panel = reify("DataGroupingSettingsEditorDataRowsPanel", {
            toggleSymbol: collapsed ? TILE_COLLAPSED_SYMBOL : TILE_EXPANDED_SYMBOL
        });

        if (collapsed) panel.classList.add(`${CLASS}--collapsed`);

        const body = create("div")._addClass(`${CLASS}__tile-body`);

        for (let i = 0; i < bodySections.length; i++) body.appendChild(bodySections[i]);

        panel.appendChild(body);

        wireTileCollapse(panel, "dataRows");

        return panel;
    };

    // --- Insert-grouping buttons ------------------------------------------------------------

    // Gets the columns not yet used as a group-by column in any grouping.
    const getUnusedGroupByColumns = () => {

        const groupings = transformedSettings.groupings.entries;
        const usedColumnKeys = new Set();

        for (let k = 0; k < groupings.length; k++) {

            const columns = groupings[k].groupByColumns;
            if (!columns) continue;
            for (let j = 0; j < columns.length; j++) usedColumnKeys.add(columns[j]);
        }

        const available = [];

        for (let i = 0; i < selectableColumns.length; i++) {

            if (usedColumnKeys.has(selectableColumns[i].value)) continue;
            available.push(selectableColumns[i]);
        }

        return available;
    };

    // Copies the column's data-rows calc function onto the new grouping, as "add grouping" does.
    const createGroupingForColumn = (columnKey) => {

        const grouping = { groupByColumns: [columnKey] };

        const columnCalcFunction =
            transformedSettings.dataRows?.columns?.[columnKey]?.calcFunction;

        if (columnCalcFunction && columnCalcFunction.length) {
            grouping.groupByCalcFunctions = [columnCalcFunction[0]];
        }

        return grouping;
    };

    // An "insert grouping" link for the gap between two tiles, inserting at insertIndex (entries
    // run innermost-first).  Returns null when every column is already grouped.
    const buildInsertGroupingButton = (insertIndex) => {

        const availableColumns = getUnusedGroupByColumns();
        if (availableColumns.length === 0) return null;

        availableColumns.sort((a, b) => a.label.localeCompare(b.label));

        const menuItems = [{ heading: "Insert Grouping - Select Column" }];

        for (let i = 0; i < availableColumns.length; i++) {

            const columnKey = availableColumns[i].value;

            menuItems.push({
                text: availableColumns[i].label,
                action: () => {

                    transformedSettings.groupings.entries.splice(
                        insertIndex,
                        0,
                        createGroupingForColumn(columnKey)
                    );

                    applyChanges();
                }
            });
        }

        const row = create("div")._addClass("ren-data-grouping-settings-editor__insert-grouping");
        row._append(buildAddMenuLink(
            "insert grouping",
            "ren-data-grouping-settings-editor__insert-grouping-link",
            menuItems
        ));
        return row;
    };

    // --- Main render ------------------------------------------------------------------------

    const updateContents = (dataGroupingSettings) => {

        updateTransformedDataGroupingSettings(dataGroupingSettings);

        pruneRemovedLevelHosts();

        const groupings = transformedSettings.groupings.entries;

        const groupingsContainer = create("div")
            ._addClass("ren-data-grouping-settings-editor__groupings");

        let groupingCount = 0;
        let dragSourceIndex = null;
        let lastHoverIndex = null;

        // Draggable items in visual order (top to bottom = descending entry index).
        const draggableItems = [];
        const totalEntries = groupings.length;

        // Disabled groupings render as placeholder panels near their former positions, but take no
        // stagger slot and aren't draggable, so the drag maths is unaffected.  Each is bucketed by
        // the active entry index it renders just inside of.
        const disabledGroupings = getDisabledGroupings();
        const disabledByActiveIndex = {};

        for (let d = 0; d < disabledGroupings.length; d++) {

            const disabledEntry = disabledGroupings[d];

            let bucket = disabledEntry.index;
            if (bucket < 0) bucket = 0;
            if (bucket > totalEntries - 1) bucket = totalEntries - 1;

            (disabledByActiveIndex[bucket] ??= []).push(disabledEntry);
        }

        const applyReorderedGroupings = () => {

            applyChanges();
        };

        // Gets the entry index that entry i lands at after splicing s to t.
        const computeNewEntryIndex = (i, s, t) => {

            if (i === s) return t;
            const p1 = i < s ? i : i - 1; // position after removing s
            return p1 < t ? p1 : p1 + 1;  // position after inserting at t
        };

        // Applies translateX (stagger) + translateY (slot offset) to show the new order.
        const updateDragPreview = (s, t) => {

            draggableItems.forEach(item => {

                const newEntryIndex = computeNewEntryIndex(item.entryIndex, s, t);
                const newSlot = totalEntries - 1 - newEntryIndex; // 1-based visual slot
                const targetTop = draggableItems[newSlot - 1].naturalTop;
                const deltaY = targetTop - item.naturalTop;
                item.element.style.transform =
                    `translateX(${newSlot}rem) translateY(${deltaY}px)`;
            });
        };

        const resetDragPreview = () => {

            groupingsContainer._removeClass(
                "ren-data-grouping-settings-editor__groupings--reordering"
            );

            draggableItems.forEach(item => {

                const slot = totalEntries - 1 - item.entryIndex;
                item.element.style.transform = `translateX(${slot}rem)`;
            });
        };

        for (let i = groupings.length - 1; i >= 0; i--) {

            const grouping = groupings[i];
            const isOutermostGrouping = i === groupings.length - 1;

            const builtPanel = buildGroupingPanel(grouping, i, isOutermostGrouping);

            if (builtPanel) {

                groupingsContainer._append(builtPanel.panel);

                // Stagger the grouping panels to indicate the hierarchy.
                builtPanel.panel._style("transform", `translateX(${groupingCount}rem)`);
            }

            // While tiles can be reordered, one left out still takes its stagger slot, so the rest
            // keep the indents the drag preview's slot maths assumes.
            if (builtPanel || showStructuralControls) groupingCount++;

            // Disabled groupings offer nothing but structural controls, so a narrowed view omits
            // them.
            const disabledHere = showStructuralControls ? disabledByActiveIndex[i] : null;

            if (disabledHere) {

                for (let d = 0; d < disabledHere.length; d++) {

                    const disabledPanel = buildDisabledGroupingPanel(disabledHere[d]);
                    groupingsContainer._append(disabledPanel);
                    disabledPanel._style("transform", `translateX(${groupingCount}rem)`);
                }
            }

            // Entries run innermost-first, so inserting at i lands the new level in the gap below.
            const insertButton = showStructuralControls ? buildInsertGroupingButton(i) : null;

            if (insertButton) {

                groupingsContainer._append(insertButton);
                insertButton._style("transform", `translateX(${groupingCount}rem)`);
            }

            if (isOutermostGrouping || !showStructuralControls || !builtPanel) continue;

            const panel = builtPanel.panel;
            const { disableLink, grip } = builtPanel;

            // Register in visual order before attaching event listeners.
            draggableItems.push({ element: panel, entryIndex: i });

            disableLink.addEventListener("click", () => disableGrouping(i));

            grip.draggable = true;
            panel._addClass(`${CLASS}--draggable`);

            grip.addEventListener("dragstart", (event) => {

                dragSourceIndex = i;
                lastHoverIndex = null;
                event.dataTransfer.effectAllowed = "move";

                // Dim the dragged tile so it stands out from its shuffling neighbours.
                panel.classList.add(`${CLASS}--dragging`);

                // Suppress the browser ghost image so our CSS animation is the only feedback.
                const ghost = document.createElement("div");
                ghost.style.cssText = "position:absolute;top:-9999px;left:-9999px";
                const ghostParent = panel.closest(".js-ren-report-context") || document.body;
                ghostParent.appendChild(ghost);
                event.dataTransfer.setDragImage(ghost, 0, 0);
                requestAnimationFrame(() => ghost.remove());

                // Snapshot layout positions before any transform changes.
                draggableItems.forEach(item => {

                    const rect = item.element.getBoundingClientRect();
                    item.naturalTop = rect.top;
                    item.naturalMid = rect.top + rect.height / 2;
                });

                // Enable CSS transitions now that positions are measured.
                groupingsContainer._addClass(
                    "ren-data-grouping-settings-editor__groupings--reordering"
                );
            });

            grip.addEventListener("dragend", () => {

                dragSourceIndex = null;
                lastHoverIndex = null;
                panel.classList.remove(`${CLASS}--dragging`);
                resetDragPreview();
            });
        }

        // The data-rows tile is always the innermost leaf, so it isn't draggable.
        const dataRowsPanel = buildDataRowsPanel();

        if (dataRowsPanel) {

            groupingsContainer._append(dataRowsPanel);
            dataRowsPanel._style("transform", `translateX(${groupingCount}rem)`);
        }

        // translateX doesn't contribute to layout width, so without this padding the popup's
        // fit-content measurement would open too narrow and clip the most-indented panels.
        groupingsContainer._style("padding-right", `${groupingCount}rem`);

        const getTargetIndexFromClientY = (clientY) => {

            let bestIndex = draggableItems[0].entryIndex;
            let bestDist = Infinity;

            draggableItems.forEach(item => {

                const dist = Math.abs(clientY - item.naturalMid);

                if (dist < bestDist) {

                    bestDist = dist;
                    bestIndex = item.entryIndex;
                }
            });

            return bestIndex;
        };

        if (draggableItems.length > 0) {

            groupingsContainer.addEventListener("dragover", (event) => {

                if (dragSourceIndex === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";

                const targetIndex = getTargetIndexFromClientY(event.clientY);

                if (lastHoverIndex === targetIndex) return;
                lastHoverIndex = targetIndex;

                if (dragSourceIndex === targetIndex) {

                    draggableItems.forEach(item => {

                        const slot = totalEntries - 1 - item.entryIndex;
                        item.element.style.transform = `translateX(${slot}rem)`;
                    });
                }
                else {

                    updateDragPreview(dragSourceIndex, targetIndex);
                }
            });

            groupingsContainer.addEventListener("drop", (event) => {

                event.preventDefault();

                if (dragSourceIndex === null) return;

                const targetIndex = getTargetIndexFromClientY(event.clientY);

                if (dragSourceIndex === targetIndex) return;

                const entries = transformedSettings.groupings.entries;
                const [removed] = entries.splice(dragSourceIndex, 1);
                entries.splice(targetIndex, 0, removed);
                applyReorderedGroupings();
            });
        }

        element.innerHTML = "";
        element._append(groupingsContainer);

        Ren.Messages.Events.reportAddedToDom.notify();

        resizePopup();
    };

    updateContents(getRuntimeDataGroupingSettings());

    let lastProcessedEditorSignifier = null;

    Ren.Messages.Events.dataGroupingSettingsChanged.handle((changedDataGroupingSettings) => {

        // The editor follows the visualisation it was opened from, not the same visualisation in
        // another open instance of the same report.
        if (!Ren.ReportContextMatch.isSameDataGroupingSettingsGroup(
            changedDataGroupingSettings,
            sourceVisualisation
        )) return;

        if (changedDataGroupingSettings.signifier === lastProcessedEditorSignifier) return;
        if (changedDataGroupingSettings.isDestroyedCleanup) return;

        lastProcessedEditorSignifier = changedDataGroupingSettings.signifier;

        updateContents(changedDataGroupingSettings);
    });

    return {
        element
    };
};
