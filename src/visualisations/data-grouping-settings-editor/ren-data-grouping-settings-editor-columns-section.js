/**
 * Edit Groupings: the per-column settings of one grouping - how each column is aggregated,
 * formatted and calculated.  Built once per editor, and rendered per grouping tile.
 */
Ren.DataGroupingSettingsEditorColumnsSection = (editor) => {

    const create = Ren.HtmlUtils.create;
    const CLASS = "ren-data-grouping-settings-editor-grouping";

    const {
        getGroupings,
        getColumnLabel,
        selectableColumns,
        applyChanges,
        rerender,
        buildCollapsible,
        openFunctionEditor
    } = editor;

    const {
        buildSmallButton,
        buildRow,
        createLabel,
        buildRevealPencil,
        buildRevealableSelectRow,
        buildAddMenuButton
    } = Ren.DataGroupingSettingsEditorControls;

    const {
        specToCode,
        functionSpecLabel,
        getFormatOptions,
        formatSpecToSelectValue,
        formatSpecLabel
    } = Ren.DataGroupingSettingsEditorFunctionSpecs;

    const {
        ensureColumnSettings,
        cleanupColumnSettings,
        getCumulativeGroupByColumns
    } = Ren.DataGroupingSettingsEditorColumnMutations;

    // Column settings rows switched into edit controls, including ones just added via [+], which
    // would otherwise vanish while all-default.  Keyed by "<entryIndex>:<columnKey>".
    const columnSettingsRevealed = new Set();

    // Fields of a revealed row whose dropdown has been revealed by their pencil; picking an option
    // removes the entry again.  Keyed by "<entryIndex>:<columnKey>:<fieldName>".
    const columnFieldRevealed = new Set();

    // Only columns with non-default settings are shown, plus a [+] to add another.  The data-rows
    // tile's leaf rows aren't aggregated, so it omits the aggregation fields and offers every
    // column.
    const buildColumnsSection = (grouping, entryIndex, isDataRows) => {

        const groupings = getGroupings();
        const cumulativeGroupBy = isDataRows
            ? new Set()
            : getCumulativeGroupByColumns(groupings, entryIndex);

        const body = create("div")._addClass(`${CLASS}__columns-body`);

        const aggregationOptions = [{ value: "", label: "(default)" }];
        const aggregationNames = Ren.AggregationTypeEnum.Names;

        for (let i = 0; i < aggregationNames.length; i++) {
            aggregationOptions.push({ value: aggregationNames[i], label: aggregationNames[i] });
        }

        const indicatorOptions = [{ value: "", label: "(default)" }];
        const indicatorModes = Ren.AggregationIndicator.MODES;

        for (let i = 0; i < indicatorModes.length; i++) {

            indicatorOptions.push({
                value: indicatorModes[i],
                label: Ren.AggregationIndicator.getModeDisplayName(indicatorModes[i])
            });
        }

        const wrtOptions = [{ value: "", label: "None" }];
        for (let i = 0; i < selectableColumns.length; i++) wrtOptions.push(selectableColumns[i]);

        // Gets a value indicating whether an aggregation type reads the "with respect to" column as
        // an order to pick a value by.  A settings file may hold the type by name or enum value.
        const ordersByWithRespectTo = (aggregationType) =>
            aggregationType === "First"
            || aggregationType === "Last"
            || aggregationType === "Median"
            || aggregationType === Ren.AggregationTypeEnum.First
            || aggregationType === Ren.AggregationTypeEnum.Last
            || aggregationType === Ren.AggregationTypeEnum.Median;

        const hasNonDefaultSettings = (columnSettings) =>
            !!columnSettings && Object.keys(columnSettings).length > 0;

        // Gets a plain-text summary of a column's settings, e.g. "aggregated as Sum, formatted as
        // Currency".
        const describeColumnSettings = (columnSettings) => {

            const parts = [];

            if (columnSettings.aggregationType) {
                parts.push(`aggregated as ${columnSettings.aggregationType}`);
            }

            if (columnSettings.aggregateWithRespectToColumn) {

                const wrtLabel = getColumnLabel(columnSettings.aggregateWithRespectToColumn);

                parts.push(ordersByWithRespectTo(columnSettings.aggregationType)
                    ? `ordered by ${wrtLabel}`
                    : `with respect to ${wrtLabel}`);
            }

            if (columnSettings.aggregationIndicator) {

                parts.push("aggregation shown as " +
                    Ren.AggregationIndicator.getModeDisplayName(columnSettings.aggregationIndicator));
            }

            if (columnSettings.valueFormatFunction) {
                parts.push(`formatted as ${formatSpecLabel(columnSettings.valueFormatFunction)}`);
            }

            if (columnSettings.calcFunction) {
                parts.push(`with calc function ${functionSpecLabel(columnSettings.calcFunction)}`);
            }

            return parts.length ? parts.join(", ") : "(default)";
        };

        // Builds one column-settings row: plain text with a pencil, or when revealed, a row per
        // field and a checkmark to collapse again.
        const buildColumnRow = (columnKey) => {

            const stateKey = `${entryIndex}:${columnKey}`;
            const container = create("div")._addClass(`${CLASS}__section`);

            const collapseField = (fieldName) =>
                columnFieldRevealed.delete(`${stateKey}:${fieldName}`);

            // Supplies the half of a revealable select row common to every field: whether it is
            // revealed, and what its pencil does.
            const buildFieldRow = (fieldName, field) => {

                const revealKey = `${stateKey}:${fieldName}`;

                field.revealed = columnFieldRevealed.has(revealKey);

                field.onReveal = () => {

                    columnFieldRevealed.add(revealKey);
                    renderRow(true);
                };

                return buildRevealableSelectRow(field);
            };

            const renderRow = (revealed) => {

                container._empty();

                const columnSettings = grouping.columns?.[columnKey] ?? {};

                if (!revealed) {

                    const summaryRow = buildRow();

                    summaryRow._append(create("span")
                        ._addClass(`${CLASS}__column-name`)
                        ._text(getColumnLabel(columnKey)));

                    summaryRow._append(createLabel(describeColumnSettings(columnSettings)));

                    summaryRow._append(buildRevealPencil("Edit this column's settings", () => {

                        columnSettingsRevealed.add(stateKey);
                        renderRow(true);
                    }));

                    container._append(summaryRow);
                    return;
                }

                const headerRow = buildRow();

                headerRow._append(create("span")
                    ._addClass(`${CLASS}__column-name`)
                    ._text(getColumnLabel(columnKey)));

                container._append(headerRow);

                // Omitted for the data-rows tile, whose leaf rows aren't aggregated.
                if (!isDataRows) {

                    container._append(buildFieldRow("agg", {
                        label: "agg type:",
                        options: aggregationOptions,
                        currentValue: columnSettings.aggregationType ?? "",
                        selectClass: `${CLASS}__aggregation-select`,
                        summaryText: columnSettings.aggregationType || "(default)",
                        pencilTitle: "Set aggregation type",
                        onChange: (value) => {

                            const settings = ensureColumnSettings(grouping, columnKey);

                            if (value === "") {
                                delete settings.aggregationType;
                            }
                            else {

                                settings.aggregationType = value;
                            }

                            cleanupColumnSettings(grouping, columnKey);
                            collapseField("agg");
                            applyChanges();
                        }
                    }));

                    // Under First, Last and Median the setting names the column the rows are
                    // ordered by, so the row says so rather than reading as deduplication.
                    const wrtOrders = ordersByWithRespectTo(columnSettings.aggregationType);

                    container._append(buildFieldRow("wrt", {
                        label: wrtOrders ? "ordered by:" : "wrt:",
                        options: wrtOptions,
                        currentValue: columnSettings.aggregateWithRespectToColumn ?? "",
                        selectClass: `${CLASS}__wrt-select`,
                        summaryText: columnSettings.aggregateWithRespectToColumn
                            ? getColumnLabel(columnSettings.aggregateWithRespectToColumn)
                            : (wrtOrders ? "None (row order)" : "None"),
                        pencilTitle: wrtOrders
                            ? "Set the column the rows are ordered by"
                            : "Set 'with respect to' column",
                        onChange: (value) => {

                            const settings = ensureColumnSettings(grouping, columnKey);

                            if (value === "") {
                                delete settings.aggregateWithRespectToColumn;
                            }
                            else {

                                settings.aggregateWithRespectToColumn = value;
                            }

                            cleanupColumnSettings(grouping, columnKey);
                            collapseField("wrt");
                            applyChanges();
                        }
                    }));

                    container._append(buildFieldRow("indicator", {
                        label: "shown as:",
                        options: indicatorOptions,
                        currentValue: columnSettings.aggregationIndicator ?? "",
                        selectClass: `${CLASS}__indicator-select`,
                        summaryText: columnSettings.aggregationIndicator
                            ? Ren.AggregationIndicator.getModeDisplayName(
                                columnSettings.aggregationIndicator
                            )
                            : "(default)",
                        pencilTitle: "Set how the aggregation type is shown",
                        onChange: (value) => {

                            const settings = ensureColumnSettings(grouping, columnKey);

                            if (value === "") {
                                delete settings.aggregationIndicator;
                            }
                            else {

                                settings.aggregationIndicator = value;
                            }

                            cleanupColumnSettings(grouping, columnKey);
                            collapseField("indicator");
                            applyChanges();
                        }
                    }));
                }

                // Picking "custom" opens the function editor, leaving the dropdown revealed until
                // it is saved.
                container._append(buildFieldRow("format", {
                    label: "format:",
                    options: getFormatOptions(),
                    currentValue: formatSpecToSelectValue(columnSettings.valueFormatFunction),
                    selectClass: `${CLASS}__format-select`,
                    summaryText: columnSettings.valueFormatFunction
                        ? formatSpecLabel(columnSettings.valueFormatFunction)
                        : "None",
                    pencilTitle: "Set format",
                    onChange: (value, select) => {

                        if (value === "custom") {

                            const current = grouping.columns?.[columnKey]?.valueFormatFunction;
                            select.value = formatSpecToSelectValue(current);

                            openFunctionEditor(
                                () => specToCode(current),
                                (code) => {

                                    const settings = ensureColumnSettings(grouping, columnKey);

                                    if (code) {
                                        settings.valueFormatFunction = [code];
                                    }
                                    else {

                                        delete settings.valueFormatFunction;
                                    }

                                    cleanupColumnSettings(grouping, columnKey);
                                    collapseField("format");
                                    applyChanges();
                                }
                            );

                            return;
                        }

                        const settings = ensureColumnSettings(grouping, columnKey);

                        if (value === "") {
                            delete settings.valueFormatFunction;
                        }
                        else {

                            settings.valueFormatFunction = [{ name: value.slice(5) }];
                        }

                        cleanupColumnSettings(grouping, columnKey);
                        collapseField("format");
                        applyChanges();
                    }
                }));

                const calcRow = buildRow(true);
                calcRow._append(createLabel("calc:"));
                calcRow._append(createLabel(columnSettings.calcFunction ? "Yes" : "No"));

                calcRow._append(buildRevealPencil("Edit calc function", () => {

                    openFunctionEditor(
                        () => specToCode(grouping.columns?.[columnKey]?.calcFunction),
                        (code) => {

                            const settings = ensureColumnSettings(grouping, columnKey);

                            if (code) {
                                settings.calcFunction = [code];
                            }
                            else {

                                delete settings.calcFunction;
                            }

                            cleanupColumnSettings(grouping, columnKey);
                            applyChanges();
                        },
                        "calc"
                    );
                }));

                container._append(calcRow);

                const actionsRow = buildRow(true);

                const doneButton = buildSmallButton(
                    `${CLASS}__pencil-button`,
                    "Done editing this column",
                    "✓"
                );

                doneButton.addEventListener("click", () => {

                    columnSettingsRevealed.delete(stateKey);
                    collapseField("agg");
                    collapseField("wrt");
                    collapseField("format");

                    // A row left at all-defaults has nothing to show once collapsed, so is dropped.
                    if (!hasNonDefaultSettings(grouping.columns?.[columnKey])) {
                        rerender();
                    }
                    else {

                        renderRow(false);
                    }
                });

                actionsRow._append(doneButton);
                container._append(actionsRow);
            };

            renderRow(columnSettingsRevealed.has(stateKey));
            return container;
        };

        const shownColumnKeys = [];
        const availableColumns = [];

        for (let i = 0; i < selectableColumns.length; i++) {

            const columnKey = selectableColumns[i].value;
            if (cumulativeGroupBy.has(columnKey)) continue;

            const stateKey = `${entryIndex}:${columnKey}`;

            if (hasNonDefaultSettings(grouping.columns?.[columnKey]) ||
                columnSettingsRevealed.has(stateKey)) {

                shownColumnKeys.push(columnKey);
            }
            else {

                availableColumns.push(selectableColumns[i]);
            }
        }

        for (let i = 0; i < shownColumnKeys.length; i++) body._append(buildColumnRow(shownColumnKeys[i]));

        if (shownColumnKeys.length === 0) {

            body._append(create("div")._addClass(`${CLASS}__empty`)._text("No column settings."));
        }

        availableColumns.sort((a, b) => a.label.localeCompare(b.label));

        if (availableColumns.length > 0) {

            const addRow = buildRow();

            const menuItems = [{ heading: "Add column settings" }];

            for (let i = 0; i < availableColumns.length; i++) {

                const columnKey = availableColumns[i].value;

                menuItems.push({
                    text: availableColumns[i].label,
                    action: () => {

                        columnSettingsRevealed.add(`${entryIndex}:${columnKey}`);
                        rerender();
                    }
                });
            }

            addRow._append(buildAddMenuButton("Add column settings", menuItems));
            body._append(addRow);
        }

        return buildCollapsible(
            "Column settings",
            body,
            `${entryIndex}:columns`
        );
    };

    return buildColumnsSection;
};
