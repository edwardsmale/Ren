/**
 * Edit Groupings: the group-by columns of one grouping, and the binning function each is grouped
 * by.  Built once per editor, and rendered per grouping tile.
 *
 * The columns available to add are the ones no grouping is grouping by yet, so the same column
 * can't be grouped twice, and removing a grouping's last column removes the grouping itself.
 */
Ren.DataGroupingSettingsEditorGroupBySection = (editor) => {

    const create = Ren.HtmlUtils.create;
    const CLASS = "ren-data-grouping-settings-editor-grouping";

    const {
        getGroupings,
        getDataRows,
        getColumnType,
        getColumnLabel,
        selectableColumns,
        applyChanges
    } = editor;

    const {
        buildSmallButton,
        buildRow,
        createSelect,
        createLabel,
        buildRemoveButton,
        buildAddMenuButton,
        openFunctionEditor
    } = Ren.DataGroupingSettingsEditorControls;

    const {
        specToCode,
        getBinningOptions,
        binningSpecToSelectValue
    } = Ren.DataGroupingSettingsEditorFunctionSpecs;

    const {
        ensureGroupByCalcFunctions,
        removeGroupByCalcFunctionsIfEmpty,
        resetBlankFormatsOfRemovedGroupByColumns
    } = Ren.DataGroupingSettingsEditorColumnMutations;

    // Group-by columns + their binning functions.  With a single group-by column, the column name
    // and its controls are inlined into the panel header (after the "Group by" heading) rather than
    // shown as a separate section; with multiple columns, each is shown as its own indented row in
    // a section below the header, as before.  Returns { element, isInline }.
    const buildGroupByColumnsSection = (grouping, entryIndex) => {

        const groupings = getGroupings();

        const groupByColumns = grouping.groupByColumns || [];
        const isSingleColumn = groupByColumns.length === 1;

        const section = isSingleColumn ? null : create("div")._addClass(`${CLASS}__section`);

        // Builds one group-by column row: the column name and its binning controls.  For a single
        // group-by column an existing binning reads "- binning function <select>"; for multiple
        // columns each row is indented and an existing binning reads "binning: <select>".  A column
        // with no binning shows only a pencil to add one.
        const buildColumnRow = (columnKey, columnIndexInGrouping, isIndented) => {

            const columnType = getColumnType(columnKey);

            const row = buildRow(isIndented);

            row._append(createLabel(getColumnLabel(columnKey)));

            const hasBinning =
                (grouping.groupByCalcFunctions?.[columnIndexInGrouping] ?? null) != null;

            const makeBinningSelect = () => createSelect(
                getBinningOptions(columnType),
                binningSpecToSelectValue(grouping.groupByCalcFunctions?.[columnIndexInGrouping] ?? null),
                (value, select) => {

                    if (value === "custom") {

                        select.value = binningSpecToSelectValue(
                            grouping.groupByCalcFunctions?.[columnIndexInGrouping] ?? null
                        );

                        openFunctionEditor(
                            () => specToCode(grouping.groupByCalcFunctions?.[columnIndexInGrouping]),
                            (code) => {

                                ensureGroupByCalcFunctions(grouping);
                                grouping.groupByCalcFunctions[columnIndexInGrouping] = code || null;
                                removeGroupByCalcFunctionsIfEmpty(grouping);
                                applyChanges();
                            },
                            "valueOnly",
                            "binning"
                        );

                        return;
                    }

                    ensureGroupByCalcFunctions(grouping);

                    grouping.groupByCalcFunctions[columnIndexInGrouping] =
                        value === "" ? null : { name: value.slice(5) };

                    removeGroupByCalcFunctionsIfEmpty(grouping);
                    applyChanges();
                },
                `${CLASS}__binning-select`
            );

            const makeRemoveColumnButton = () => buildRemoveButton(
                "Remove this group-by column", () => {

                    const [removedColumnKey] =
                        grouping.groupByColumns.splice(columnIndexInGrouping, 1);

                    if (grouping.groupByCalcFunctions) {
                        grouping.groupByCalcFunctions.splice(columnIndexInGrouping, 1);
                    }

                    // A grouping with no columns left is no longer meaningful — drop it entirely.
                    if (grouping.groupByColumns.length === 0) {
                        groupings.splice(entryIndex, 1);
                    }

                    resetBlankFormatsOfRemovedGroupByColumns(
                        groupings,
                        getDataRows(),
                        entryIndex,
                        [removedColumnKey]
                    );

                    applyChanges();
                }
            );

            const binningContainer = create("span")._addClass(`${CLASS}__binning-container`);

            // A column with a binning shows the editor straight away; one without shows just a
            // pencil that reveals the editor when clicked.  The "no binning" wording is
            // intentionally omitted.
            const renderBinning = (revealed) => {

                binningContainer._empty();

                if (hasBinning || revealed) {

                    binningContainer._append(
                        createLabel(isSingleColumn ? "- binning function" : "binning:")
                    );

                    const select = makeBinningSelect();
                    binningContainer._append(select);

                    // For multiple columns, removal is offered via a persistent button on the row
                    // itself (below) rather than duplicated here.
                    if (isSingleColumn) binningContainer._append(makeRemoveColumnButton());

                    if (revealed) select.focus();
                }
                else {

                    const pencil = buildSmallButton(`${CLASS}__pencil-button`, "Add binning", "✎");
                    pencil.addEventListener("click", () => renderBinning(true));
                    binningContainer._append(pencil);
                }
            };

            renderBinning(false);
            row._append(binningContainer);

            // With multiple group-by columns, each row gets its own persistent remove button, since
            // removing one column shouldn't require first revealing its binning controls.
            if (!isSingleColumn) row._append(makeRemoveColumnButton());

            return row;
        };

        // Columns not already grouped anywhere are available to add.
        const usedColumnKeys = new Set();

        for (let k = 0; k < groupings.length; k++) {

            const columns = groupings[k].groupByColumns;
            if (!columns) continue;
            for (let j = 0; j < columns.length; j++) usedColumnKeys.add(columns[j]);
        }

        const availableColumns = [];

        for (let i = 0; i < selectableColumns.length; i++) {

            if (usedColumnKeys.has(selectableColumns[i].value)) continue;
            availableColumns.push(selectableColumns[i]);
        }

        availableColumns.sort((a, b) => a.label.localeCompare(b.label));

        // A [+] button (shown next to the last column's controls) offers the available columns via
        // a click-triggered context menu, rather than a permanently visible dropdown.
        const buildAddColumnButton = () => {

            const menuItems = [{ heading: "Add group-by column" }];

            for (let i = 0; i < availableColumns.length; i++) {

                const columnKey = availableColumns[i].value;

                menuItems.push({
                    text: availableColumns[i].label,
                    action: () => {

                        grouping.groupByColumns = grouping.groupByColumns || [];
                        grouping.groupByColumns.push(columnKey);

                        if (grouping.groupByCalcFunctions) grouping.groupByCalcFunctions.push(null);

                        applyChanges();
                    }
                });
            }

            return buildAddMenuButton("Add a group-by column", menuItems);
        };

        let lastColumnRow = null;

        if (isSingleColumn) {

            lastColumnRow = buildColumnRow(groupByColumns[0], 0, false);
        }
        else {

            for (let j = 0; j < groupByColumns.length; j++) {

                lastColumnRow = buildColumnRow(groupByColumns[j], j, true);
                section._append(lastColumnRow);
            }
        }

        if (availableColumns.length > 0) {

            // Attach to the last column's row so it sits next to that row's binning pencil; if no
            // columns exist yet, host it in its own row.
            if (!lastColumnRow) {

                lastColumnRow = buildRow();
                if (!isSingleColumn) section._append(lastColumnRow);
            }

            lastColumnRow._append(buildAddColumnButton());
        }

        return isSingleColumn
            ? { element: lastColumnRow, isInline: true }
            : { element: section, isInline: false };
    };

    return buildGroupByColumnsSection;
};
