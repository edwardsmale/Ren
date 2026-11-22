/**
 * Edit Groupings: the sort order of one grouping - the primary column, its direction and sort
 * function, and any "then by" levels breaking its ties.  Built once per editor, and rendered per
 * grouping tile.
 *
 * Which tiles have their sort row revealed for editing is this module's own business, so that
 * state lives here rather than with the editor as a whole.
 */
Ren.DataGroupingSettingsEditorSortSection = (editor) => {

    const create = Ren.HtmlUtils.create;
    const CLASS = "ren-data-grouping-settings-editor-grouping";

    const {
        getColumnLabel,
        selectableColumns,
        applyChanges,
        editControlsRevealedInitially
    } = editor;

    const {
        buildSmallButton,
        buildRow,
        createSelect,
        createLabel,
        buildRemoveButton,
        buildAddMenuButton,
        createFunctionButton,
        openFunctionEditor
    } = Ren.DataGroupingSettingsEditorControls;

    const { specToCode, functionSpecLabel } = Ren.DataGroupingSettingsEditorFunctionSpecs;

    // Remembers which groupings have their sort row switched from plain text into edit controls,
    // so the full re-render triggered by each edit doesn't drop back to plain text.  Keyed by
    // entryIndex.
    const sortSectionRevealed = {};

    // Sort column, direction and sort function, plus optional additional "then by" sort levels
    // for breaking ties in the primary sort.  Shown as plain text ("Sort by: <column> with sort
    // function <name> ascending, then <column> descending") with a pencil to reveal the edit
    // controls, in the same style as the group-by binning pencil.
    const buildSortSection = (grouping, entryIndex) => {

        const section = create("div")._addClass(`${CLASS}__section`);
        const container = create("div");

        // Plain-text description of one sort level (the primary sortOrder or a thenBy entry).
        const describeSortLevel = (sortLevel) => {

            let displayText = getColumnLabel(sortLevel.column);

            if (sortLevel.sortCalcFunction) {
                displayText += ` with sort function ${functionSpecLabel(sortLevel.sortCalcFunction)}`;
            }

            displayText += sortLevel.isDescending ? " descending" : " ascending";
            return displayText;
        };

        // Direction toggle shared by every sort level: a "desc" label plus a toggle switch (on =
        // descending).  Disabled when the level doesn't exist yet (the primary level while
        // unsorted).
        const buildDirectionButton = (sortLevel) => {

            const container = create("span")._addClass(`${CLASS}__direction-toggle`);

            container._append(createLabel("desc"));

            const toggle = Ren.ToggleSwitch.create(!!sortLevel?.isDescending);
            container._append(toggle.element);

            if (!sortLevel) {

                container._addClass(`${CLASS}__inline-control--disabled`);
            }
            else {

                toggle.onClick(() => {

                    sortLevel.isDescending = !sortLevel.isDescending;
                    applyChanges();
                });
            }

            return container;
        };

        // Sort-function editor control shared by every sort level, in the same style as the
        // group-by binning control: a set function shows its label alongside the button that
        // re-edits it, an unset one shows just the button on its own.  Both use the "ƒ" symbol to
        // launch the function editor.  Disabled when the level doesn't exist yet.
        const buildSortFunctionButton = (sortLevel) => {

            const container = create("span")._addClass(`${CLASS}__binning-container`);
            const hasSortFunction = !!sortLevel?.sortCalcFunction;

            const openEditor = () => {

                if (!sortLevel) return;

                openFunctionEditor(
                    () => specToCode(sortLevel.sortCalcFunction),
                    (code) => {

                        if (code) {
                            sortLevel.sortCalcFunction = code;
                        }
                        else {

                            delete sortLevel.sortCalcFunction;
                        }

                        applyChanges();
                    },
                    "valueOnly",
                    "sort"
                );
            };

            if (hasSortFunction) container._append(createLabel("sort function:"));
            container._append(createFunctionButton("ƒ", hasSortFunction, openEditor));

            if (!sortLevel) container._addClass(`${CLASS}__inline-control--disabled`);
            return container;
        };

        const renderSection = (revealed) => {

            container._empty();

            const sortOrder = grouping.sortOrder;
            const isSorted = !!sortOrder && sortOrder.column !== undefined;
            const thenBy = (isSorted && sortOrder.thenBy) ? sortOrder.thenBy : [];

            if (revealed) {

                const primaryRow = buildRow();

                primaryRow._append(create("b")
                    ._addClass(`${CLASS}__sort-lead-label`)
                    ._text("Sort by"));

                const sortOptions = [{ value: "", label: "(unsorted)" }];
                for (let i = 0; i < selectableColumns.length; i++) sortOptions.push(selectableColumns[i]);

                const currentColumn = sortOrder?.column ?? "";

                primaryRow._append(createSelect(sortOptions, currentColumn, (value) => {

                    if (value === "") {

                        // Removing the primary sort promotes the first "then by" level rather than
                        // silently discarding the remaining levels.
                        if (thenBy.length) {

                            const promoted = grouping.sortOrder.thenBy.shift();
                            const remainingLevels = grouping.sortOrder.thenBy;

                            grouping.sortOrder = { column: promoted.column };

                            if (promoted.isDescending) grouping.sortOrder.isDescending = true;

                            if (promoted.sortCalcFunction) {
                                grouping.sortOrder.sortCalcFunction = promoted.sortCalcFunction;
                            }

                            if (remainingLevels.length) grouping.sortOrder.thenBy = remainingLevels;
                        }
                        else {

                            delete grouping.sortOrder;
                        }
                    }
                    else {

                        grouping.sortOrder = grouping.sortOrder || {};
                        grouping.sortOrder.column = value;
                    }

                    applyChanges();
                }, `${CLASS}__sort-select`));

                primaryRow._append(buildDirectionButton(isSorted ? sortOrder : null));
                primaryRow._append(buildSortFunctionButton(isSorted ? sortOrder : null));

                const doneButton = buildSmallButton(
                    `${CLASS}__pencil-button`,
                    "Done editing sort",
                    "✓"
                );

                doneButton.addEventListener("click", () => {

                    sortSectionRevealed[entryIndex] = false;
                    renderSection(false);
                });

                primaryRow._append(doneButton);
                container._append(primaryRow);

                let lastRow = primaryRow;

                for (let levelIndex = 0; levelIndex < thenBy.length; levelIndex++) {

                    const sortLevel = thenBy[levelIndex];

                    const levelRow = buildRow(true);

                    levelRow._append(
                        createLabel("then by")._addClass(`${CLASS}__sort-lead-label`)
                    );

                    levelRow._append(createSelect(selectableColumns, sortLevel.column, (value) => {

                        sortLevel.column = value;
                        applyChanges();
                    }, `${CLASS}__then-by-select`));

                    levelRow._append(buildDirectionButton(sortLevel));
                    levelRow._append(buildSortFunctionButton(sortLevel));

                    levelRow._append(buildRemoveButton("Remove this sort level", () => {

                        grouping.sortOrder.thenBy.splice(levelIndex, 1);
                        if (grouping.sortOrder.thenBy.length === 0) delete grouping.sortOrder.thenBy;
                        applyChanges();
                    }));

                    container._append(levelRow);
                    lastRow = levelRow;
                }

                // A [+] on the last sort row offers the columns not already used by a sort level
                // as a new "then by" level, matching the group-by section's add button.
                const usedSortColumns = new Set();

                if (isSorted) usedSortColumns.add(sortOrder.column);
                for (let i = 0; i < thenBy.length; i++) usedSortColumns.add(thenBy[i].column);

                const availableSortColumns = [];

                for (let i = 0; i < selectableColumns.length; i++) {

                    if (usedSortColumns.has(selectableColumns[i].value)) continue;
                    availableSortColumns.push(selectableColumns[i]);
                }

                availableSortColumns.sort((a, b) => a.label.localeCompare(b.label));

                if (isSorted && availableSortColumns.length > 0) {

                    const menuItems = [{ heading: "Add sort level" }];

                    for (let i = 0; i < availableSortColumns.length; i++) {

                        const columnKey = availableSortColumns[i].value;

                        menuItems.push({
                            text: availableSortColumns[i].label,
                            action: () => {

                                grouping.sortOrder.thenBy = grouping.sortOrder.thenBy || [];
                                grouping.sortOrder.thenBy.push({ column: columnKey });
                                applyChanges();
                            }
                        });
                    }

                    lastRow._append(buildAddMenuButton("Add a sort level", menuItems));
                }
            }
            else {

                const summaryRow = buildRow();

                let displayText;

                if (!isSorted) {

                    displayText = "(unsorted)";
                }
                else {

                    displayText = describeSortLevel(sortOrder);

                    for (let i = 0; i < thenBy.length; i++) {
                        displayText += `, then ${describeSortLevel(thenBy[i])}`;
                    }
                }

                summaryRow._append(create("b")._text("Sort by"));
                summaryRow._append(createLabel(displayText));

                const pencil = buildSmallButton(`${CLASS}__pencil-button`, "Edit sort", "✎");

                pencil.addEventListener("click", () => {

                    sortSectionRevealed[entryIndex] = true;
                    renderSection(true);
                });

                summaryRow._append(pencil);
                container._append(summaryRow);
            }
        };

        renderSection(sortSectionRevealed[entryIndex] ?? editControlsRevealedInitially);
        section._append(container);
        return section;
    };

    return buildSortSection;
};
