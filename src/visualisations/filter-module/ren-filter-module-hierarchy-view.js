/**
 * Filter Module: the rendering of a hierarchical item, a chain of grouping columns shown as a tree
 * of checkboxes whose ticks drive the hierarchy's own combination row filter.  The tree itself
 * is built by ren-filter-module-counts.js; this module turns it into DOM.
 */
Ren.FilterModule_HierarchyView = (s) => {

    const {
        element,
        hierCheckboxRefs,
        hierAllCheckboxRefs,
        expandedNodeKeys
    } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const {
        busyIndicator,
        columnInfo,
        counts,
        filtering,
        fixedDimensions,
        includeWhenSaving,
        itemSettings,
        menu,
        reorder,
        showRows,
        totalRowView,
        view
    } = s;

    const checkboxBehaviour = Ren.FilterModule_CheckboxBehaviour;
    const reify = Ren.HtmlTemplateFunctions.reifyHtmlTemplate;
    const render = Ren.HtmlTemplateFunctions.renderHtmlTemplate;

    // A root node's ancestors, shared rather than made per node.
    const NO_ANCESTORS = [];

    // Adds or removes the keys of nodes and, where deep, every parent node beneath them.
    const setNodesExpanded = (nodes, isExpanded, deep) => {

        for (let i = 0; i < nodes.length; i++) {

            if (nodes[i].isLeaf) continue;

            if (isExpanded) {
                expandedNodeKeys.add(nodes[i].key);
            }
            else {

                expandedNodeKeys.delete(nodes[i].key);
            }

            if (deep) setNodesExpanded(nodes[i].children, isExpanded, deep);
        }
    };

    // Applied once per hierarchy, or again when the setting changes, so a redraw keeps the
    // branches the user has since opened or closed.  An empty tree waits for one with options.
    const applyInitialExpansion = (tree, leafColumnIdOrHeading) => {

        const appliedLeaves = s.initialExpansionAppliedLeaves;

        if (appliedLeaves.has(leafColumnIdOrHeading) || tree.length === 0) return;

        appliedLeaves.add(leafColumnIdOrHeading);

        setNodesExpanded(tree, false, true);

        switch (itemSettings.getInitialExpansion(leafColumnIdOrHeading)) {

            case "FirstLevel":
                setNodesExpanded(tree, true, false);
                break;

            case "Full":
                setNodesExpanded(tree, true, true);
                break;

            case "FirstOption":
                setNodesExpanded([tree[0]], true, false);
                break;

            case "FirstOptionFully":
                setNodesExpanded([tree[0]], true, true);
                break;

            case "FullyIfOneTopLevelOption":
                if (tree.length === 1) setNodesExpanded(tree, true, true);
                break;

            case "FullyIfTwoOrFewerTopLevelOptions":
                if (tree.length <= 2) setNodesExpanded(tree, true, true);
                break;

            case "FullyIfThreeOrFewerTopLevelOptions":
                if (tree.length <= 3) setNodesExpanded(tree, true, true);
                break;
        }
    };

    const buildHierarchicalItem = (hierarchyColumns) => {

        const topColumn = hierarchyColumns[0];
        const leafColumn = hierarchyColumns[hierarchyColumns.length - 1];
        const tree = counts.buildHierarchyTree(hierarchyColumns);

        applyInitialExpansion(tree, leafColumn.columnIdOrHeading);

        // The key of the hierarchy's combination filter.
        const hierarchyChain = columnInfo.chainOf(hierarchyColumns);
        const chainKey = filtering.columnsKeyOf(hierarchyChain);

        // Marking the item positive or negative restates the filter, which needs the tree again.
        filtering.registerHierarchy(
            hierarchyChain,
            leafColumn.columnIdOrHeading,
            () => counts.buildHierarchyTree(hierarchyColumns)
        );

        // How many combinations the tree holds, which is what the "All" row's label counts.
        const countLeaves = (nodes) => {

            let count = 0;

            for (let i = 0; i < nodes.length; i++) {
                count += nodes[i].isLeaf ? 1 : countLeaves(nodes[i].children);
            }

            return count;
        };

        const leafCount = countLeaves(tree);

        const autoMenuNamesByColumn = new Map();

        for (let i = 0; i < hierarchyColumns.length; i++) {

            const columnIdOrHeading = hierarchyColumns[i].columnIdOrHeading;

            autoMenuNamesByColumn.set(
                columnIdOrHeading,
                columnInfo.getAutoMenuName(columnIdOrHeading)
            );
        }

        // "Group by" always targets the leaf, so grouping applies to the whole hierarchy.
        const menuItem = (columnIdOrHeading, columnIndex) => ({
            columnIdOrHeading,
            columnIndex,
            groupByLeafColumnIdOrHeading: leafColumn.columnIdOrHeading,
            sortToggleChangesOrder: tree.sortToggleChangesOrder === true
        });

        const compareGroups = itemSettings.getCompareFilterGroups(leafColumn.columnIdOrHeading);
        const compareFilterShown = compareGroups.length > 0;

        // The "All" checkbox and the tree are hidden together; the totals row keeps its own
        // setting.
        const valueCheckboxesShown = itemSettings.showValueCheckboxes(leafColumn.columnIdOrHeading);

        // A rectangle per part, as each compare filter is drawn in one of its own.
        const isPanelled = compareFilterShown;

        const itemElement = reify("FilterModuleItem", { isPanelled });

        // Held against the whole item, so no part of it falls through to the module's own menu.
        // The parts within contribute their more specific menus over this one.
        Ren.AddContextMenuItems(
            itemElement,
            () => menu.buildColumnActionMenuItems(
                menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                false,
                false,
                false
            )
        );

        const headerTarget = isPanelled ? reify("FilterModulePanel") : itemElement;
        const optionsTarget = isPanelled ? reify("FilterModulePanel") : itemElement;

        if (isPanelled) itemElement._append(headerTarget);

        // Hidden where toggling it would leave the order as it is.
        const showSortToggle = tree.sortToggleChangesOrder === true
            && itemSettings.showSortToggle(leafColumn.columnIdOrHeading);

        // The single-select toggle is keyed on the leaf column, to match the "View settings" menu.
        const showSingleSelectToggle =
            itemSettings.showSingleSelectToggle(leafColumn.columnIdOrHeading);

        if (showSortToggle || showSingleSelectToggle) {

            const stripElement = reify(
                "FilterModuleItemStrip",
                { showSortToggle, showSingleSelectToggle }
            );

            if (showSortToggle) {

                const sortGroup = stripElement.querySelector(".js-ren-sort-toggle-group");
                const sortLabel = stripElement.querySelector(".js-ren-sort-toggle-label");

                sortGroup.title = s.SORT_TOGGLE_TITLE;

                const sortToggle = Ren.ToggleSwitch.create(
                    !itemSettings.isSortedByValue(leafColumn.columnIdOrHeading)
                );

                sortToggle.onClick(() => itemSettings.toggleSortMode(leafColumn.columnIdOrHeading));

                sortLabel.addEventListener(
                    "click",
                    () => itemSettings.toggleSortMode(leafColumn.columnIdOrHeading)
                );

                sortGroup.appendChild(sortToggle.element);
            }

            if (showSingleSelectToggle) {

                const singleGroup = stripElement.querySelector(".js-ren-single-select-toggle-group");
                const stripLabel = stripElement.querySelector(".js-ren-single-select-toggle-label");

                singleGroup.title = s.SINGLE_SELECT_TOGGLE_TITLE;

                const singleSelectToggle =
                    Ren.ToggleSwitch.create(itemSettings.isSingleSelect(leafColumn.columnIdOrHeading));
                singleSelectToggle.onClick(
                    () => itemSettings.toggleSingleSelect(leafColumn.columnIdOrHeading)
                );

                stripLabel.addEventListener(
                    "click",
                    () => itemSettings.toggleSingleSelect(leafColumn.columnIdOrHeading)
                );

                singleGroup.appendChild(singleSelectToggle.element);
            }

            Ren.AddContextMenuItems(
                stripElement,
                () => menu.buildColumnActionMenuItems(
                    menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                    false,
                    false,
                    false
                )
            );

            headerTarget._append(stripElement);
        }

        const topHeadingItem = {
            columnIdOrHeading: topColumn.columnIdOrHeading,
            fallbackHeading: topColumn.fallbackHeading
        };

        const headingElement = reify("FilterModuleItemHeading")
            ._textContent(columnInfo.resolveHeading(topHeadingItem));

        const buildHeadingMenuItems = () => {

            const editHeadingItem = {
                section: "View settings",
                text: "Edit heading...",
                id: "filter-module-edit-heading",
                action: () => menu.openColumnHeadingEditor(topHeadingItem, headingElement)
            };

            return [editHeadingItem].concat(menu.buildColumnActionMenuItems(
                menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                true,
                true,
                false
            ));
        };

        // The cross button sharing the heading's row acts on the leaf column, as "Remove filter"
        // does.
        const headingRow = view.buildHeadingRow(
            headingElement,
            menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
            // No binning links: a hierarchy has no column of its own to bin.
            null
        );

        // Held against the whole row rather than the heading, which is only as wide as its text.
        Ren.AddContextMenuItems(headingRow, buildHeadingMenuItems);

        headerTarget._append(headingRow);

        // The filters target the top column, the one named in the heading, so they read as
        // filtering it rather than the hidden leaf.  A derived top level filters the date column
        // behind it, as a compare filter states a column's own values.
        view.buildCompareStrips(headerTarget, isPanelled ? itemElement : null, {
            settingsKey: leafColumn.columnIdOrHeading,
            filterColumn: columnInfo.getDataColumnId(topColumn),
            columnIndex: topColumn.columnIndex,
            menuTarget: menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex)
        });

        const optionsElement = reify("FilterModuleOptions");

        if (valueCheckboxesShown && itemSettings.showAllCheckbox(leafColumn.columnIdOrHeading)) {

            const allOptionLabel = reify("FilterModuleAllOption");
            const allInput = allOptionLabel.querySelector(".js-ren-all-input");

            // Enriched for the label editor, which updates it through _textContent.
            const allTextElement = Ren.HtmlUtils
                .enrich(allOptionLabel.querySelector(".js-ren-all-text"))
                ._textContent(columnInfo.resolveAllLabel(leafColumn.columnIdOrHeading, leafCount));

            Ren.AddContextMenuItems(allOptionLabel, () => {

                const editAllLabelItem = {
                    section: "Labels",
                    text: "Edit label...",
                    id: "filter-module-edit-all-label",
                    action: () => menu.openAllLabelEditor(
                        menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                        allTextElement,
                        leafCount
                    )
                };

                return [editAllLabelItem].concat(menu.buildColumnActionMenuItems(
                    menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                    true,
                    false,
                    false
                ));
            });

            checkboxBehaviour.letFilterDriveCheckedState(
                allInput,
                busyIndicator.wrapCheckboxAction(
                    allInput,
                    busyIndicator.keyOf("hierarchyAll", chainKey),
                    () => filtering.onHierarchyAllToggled(hierarchyChain, tree)
                )
            );

            hierAllCheckboxRefs.push({
                input: allInput,
                chain: hierarchyChain,
                rootNodes: tree
            });

            optionsElement._append(view.buildAllRow(
                allOptionLabel,
                itemSettings.isSingleSelect(leafColumn.columnIdOrHeading)
                    ? null
                    : () => filtering.onHierarchyInvertToggled(hierarchyChain, tree),
                busyIndicator.keyOf("hierarchyInvert", chainKey)
            ));
            optionsElement._append(reify("FilterModuleDivider"));
        }

        const totalsShown = itemSettings.showOptionTotals(leafColumn.columnIdOrHeading);

        // A parent's children are rendered the first time it is expanded rather than with it.
        // A level's rows are rendered as one HTML string and parsed in one go, then wired up.
        const renderNodes = (nodes, container, ancestors) => {

            // No "name" attribute: a radio group's own exclusivity would fight syncCheckboxes, a
            // tree's rows spanning sibling groups across levels rather than one exclusive set.
            const inputType = itemSettings.isSingleSelect(leafColumn.columnIdOrHeading)
                ? "radio"
                : "checkbox";

            let html = "";

            for (let i = 0; i < nodes.length; i++) {

                // A leaf gets a same-width spacer, so its checkbox lines up beneath the icons.
                // max-height animates between concrete pixel values, as "none" does not animate.
                html += render("FilterModuleHierarchyNode", {
                    isLeaf: nodes[i].isLeaf,
                    // Taken from expandedNodeKeys, so a re-render restores the open branches.
                    expanded: expandedNodeKeys.has(nodes[i].key),
                    inputType,
                    totalsShown
                });
            }

            const firstIndex = container.childElementCount;

            container.insertAdjacentHTML("beforeend", html);

            // Each node renders its row, then a parent its children's container.
            let nodeRow = container.children[firstIndex];

            for (let i = 0; i < nodes.length; i++) {

                const childrenContainer = nodes[i].isLeaf ? null : nodeRow.nextElementSibling;
                const nextNodeRow = (childrenContainer || nodeRow).nextElementSibling;

                wireNode(nodes[i], nodeRow, childrenContainer, ancestors);

                nodeRow = nextNodeRow;
            }
        };

        const wireNode = (node, nodeRow, childrenContainer, ancestors) => {

            let buildChildren = null;

            if (childrenContainer) {

                let expanded = expandedNodeKeys.has(node.key);

                const expandIcon = nodeRow.querySelector(".js-ren-expand-icon");

                // An expanded node settles back at "none", or a descendant expanding further would
                // be clipped by a stale cap.  Unless the node has since been collapsed, whose cap
                // must stay put at 0, and whose item is pinned again at the height it's left with.
                const onExpandTransitionEnd = (event) => {

                    if (event.target !== childrenContainer || event.propertyName !== "max-height") return;

                    if (expanded) {

                        childrenContainer.style.maxHeight = "none";
                        return;
                    }

                    const item = nodeRow.closest(".ren-filter-module__item");

                    if (item) fixedDimensions.repinItemToContent(item);
                };

                childrenContainer.addEventListener("transitionend", onExpandTransitionEnd);

                // Built on first expansion, as three levels over a few hundred values each is
                // hundreds of thousands of rows, nearly all behind a collapsed parent.  syncAfter
                // reflects the filter onto them, the render's own sync pass having been and gone.
                let childrenBuilt = false;

                buildChildren = (syncAfter) => {

                    if (childrenBuilt) return;

                    childrenBuilt = true;

                    renderNodes(node.children, childrenContainer, ancestors.concat([node]));

                    if (syncAfter) view.syncCheckboxes();
                };

                expandIcon.addEventListener("click", (event) => {

                    event.preventDefault();
                    event.stopPropagation();
                    expanded = !expanded;
                    expandIcon.textContent = expanded ? "−" : "+"; // Minus when expanded.

                    if (expanded) {

                        // Built before the height they make up is measured.
                        buildChildren(true);

                        // The pinned width would clip rows wider than anything measured so far.
                        const item = nodeRow.closest(".ren-filter-module__item");

                        if (item) fixedDimensions.repinItemToContent(item);

                        // scrollHeight ignores the clipping, so it is safe to read first.
                        childrenContainer.style.maxHeight = childrenContainer.scrollHeight + "px";
                    }
                    else {

                        const item = nodeRow.closest(".ren-filter-module__item");

                        if (item) fixedDimensions.unpinItem(item);

                        // A max-height of "none" cannot be transitioned from, so it is pinned
                        // to the measured height and committed by a reflow before collapsing.
                        childrenContainer.style.maxHeight = childrenContainer.scrollHeight + "px";
                        childrenContainer.offsetHeight;
                        childrenContainer.style.maxHeight = "0px";
                    }

                    if (expanded) {
                        expandedNodeKeys.add(node.key);
                    }
                    else {

                        expandedNodeKeys.delete(node.key);
                    }
                });
            }

            const optionLabel = nodeRow.querySelector(".js-ren-option-label");
            const input = nodeRow.querySelector(".js-ren-option-input");
            const optionTextElement = nodeRow.querySelector(".js-ren-option-text");

            columnInfo.setFormattedText(optionTextElement, columnInfo.resolveNodeText(node));

            const autoMenuName = autoMenuNamesByColumn.get(node.columnIdOrHeading);

            if (autoMenuName) Ren.AutoMenu.applyMenu(optionLabel, autoMenuName, node.valueString);

            const showRowsItem =
                showRows.getNodeMenuItem(node, hierarchyColumns, optionTextElement);

            // Shown first; the more specific handlers below replace it where a click lands on one.
            Ren.AddContextMenuItems(optionLabel, () => [showRowsItem].concat(
                menu.buildColumnActionMenuItems(
                    menuItem(node.columnIdOrHeading, node.columnIndex),
                    true,
                    false,
                    false
                )
            ));

            let optionCountElement = null;

            if (totalsShown) {

                // A node's stats are its own level's, so a "Show as" format states it against its
                // parent's total.
                const formattedValue = columnInfo.formatDisplayValue(
                    node.columnIdOrHeading,
                    node.aggregatedValue,
                    node.summaryStats
                );

                optionCountElement = nodeRow.querySelector(".js-ren-option-count");
                optionCountElement.title = columnInfo.getValueTitle(node.columnIdOrHeading);

                columnInfo.setFormattedText(optionCountElement, `${formattedValue}`);

                // The value, unlike the label, additionally reaches the "Total value" actions.
                Ren.AddContextMenuItems(optionCountElement, () => [showRowsItem].concat(
                    menu.buildColumnActionMenuItems(
                        menuItem(node.columnIdOrHeading, node.columnIndex),
                        true,
                        false,
                        true
                    )
                ));
            }

            // Right-click the label text to override its caption or reach "Labels" actions.
            Ren.AddContextMenuItems(optionTextElement, () => {

                const editLabelItem = {
                    section: "Labels",
                    text: "Edit Label...",
                    id: "filter-module-edit-label",
                    action: () => menu.editNodeText(node, optionTextElement)
                };

                return [showRowsItem, editLabelItem].concat(menu.buildColumnActionMenuItems(
                    menuItem(node.columnIdOrHeading, node.columnIndex),
                    true,
                    true,
                    false
                ));
            });

            const onToggled = (event) => {

                if (itemSettings.isSingleSelect(leafColumn.columnIdOrHeading)) {

                    // Single-select is global: it deselects every other node in the tree.
                    filtering.toggleHierarchySingleSelect(
                        hierarchyChain,
                        tree,
                        node,
                        ancestors,
                        event.ctrlKey
                    );
                }
                else {

                    filtering.toggleHierarchyNode(hierarchyChain, tree, node, ancestors);
                }
            };

            // A right-click reads the opposite way round from a left-click, as the flat view's
            // does.
            const onRightClicked = () => {

                if (!itemSettings.isSingleSelect(leafColumn.columnIdOrHeading)) {

                    filtering.onHierarchyNodeRightClicked(
                        hierarchyChain,
                        tree,
                        node,
                        ancestors
                    );
                }
                else {

                    filtering.toggleHierarchyNode(hierarchyChain, tree, node, ancestors);
                }
            };

            const busyKey = busyIndicator.keyOf("node", chainKey, node.key);

            checkboxBehaviour.letFilterDriveCheckedState(
                input,
                busyIndicator.wrapCheckboxAction(input, busyKey, onToggled)
            );

            checkboxBehaviour.letRightClickFilterRatherThanOpenMenu(
                input,
                busyIndicator.wrapCheckboxAction(input, busyKey, onRightClicked)
            );

            hierCheckboxRefs.push({
                input,
                chain: hierarchyChain,
                node
            });

            // Built with the tree, so the render's own sync pass reaches them.
            if (childrenContainer && expandedNodeKeys.has(node.key)) buildChildren(false);
        };

        if (valueCheckboxesShown) renderNodes(tree, optionsElement, NO_ANCESTORS);

        // The hierarchy's grand total, the top column's value aggregated across every row by the
        // outermost totals grouping.
        if (tree.length > 0 && itemSettings.showTotal(leafColumn.columnIdOrHeading)) {

            const totalValue = counts.getHierarchyTotalDisplayValue(hierarchyColumns);

            if (totalValue != null) {

                const formattedTotal = columnInfo.formatDisplayValue(
                    topColumn.columnIdOrHeading,
                    totalValue,
                    counts.getHierarchyValueSummaryStats(hierarchyColumns)
                );

                const totalRow = totalRowView.buildTotalRow(
                    itemSettings.getTotalRowLabel(leafColumn.columnIdOrHeading),
                    formattedTotal,
                    columnInfo.getTotalValueTitle(
                        topColumn.columnIdOrHeading,
                        leafColumn.columnIdOrHeading
                    )
                );

                Ren.AddContextMenuItems(totalRow, () => menu.buildColumnActionMenuItems(
                    menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex),
                    true,
                    false,
                    true
                ));

                optionsElement._append(totalRow);
            }
        }

        optionsTarget._append(optionsElement);

        if (isPanelled && optionsElement.childElementCount > 0) itemElement._append(optionsTarget);

        // Keyed on the leaf column, to match the item's other column-level state.
        reorder.decorateItemForReorder(itemElement, leafColumn.columnIdOrHeading);
        view.decorateItemForWidthResize(itemElement, leafColumn.columnIdOrHeading);

        // The whole tree is one item, marked by the leaf column its combination filter is keyed on.
        includeWhenSaving.applyItemBorder(
            menuItem(leafColumn.columnIdOrHeading, leafColumn.columnIndex)
        );

        element._append(itemElement);
    };

    return {
        buildHierarchicalItem
    };
};
