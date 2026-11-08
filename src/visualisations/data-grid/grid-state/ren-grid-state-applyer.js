/**
 * Applies the gridstate settings to the datagrid.
 */
Ren.GridStateApplyer = (tabularData, gridState, containingReportGuid, gridStateGroup) => {

    /**
     * Sets the width of all columns in the datagrid.
     *
     * @param {Object} columnWidths An object column IDs/headings as keys, and widths as values.
     */
    const setAllColumnsWidth = (columnWidths) => {

        const columnIndexWidths = new Map();

        for (const columnIdOrHeading in columnWidths) {

            const columnWidth = columnWidths[columnIdOrHeading];

            const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

            if (columnIndex === null) {

                console.warn(`[GridStateApplyer] Column not found for width setting: "${columnIdOrHeading}" in group "${gridStateGroup}"`);
                continue;
            }

            columnIndexWidths.set(columnIndex, columnWidth);
        }

        gridState.setColumnWidths(columnIndexWidths);
    };

    /**
     * Normalizes both old and new gridState formats to the new format.
     * Old format: { visibleColumns: [...columnIds], ...  }
     * New format: { columns: [{ column: columnId, visible: false }, ...], ...  }
     * where visible is only written for a hidden column.
     *
     * Both formats carry the display order in the order of their array, so converting is a matter
     * of naming each column's visibility rather than implying it by its presence.
     */
    const normaliseGridState = (deserializedGridState) => {

        if (!deserializedGridState) return deserializedGridState;

        if (deserializedGridState.columns) return deserializedGridState;

        if (deserializedGridState.visibleColumns) {

            const normalised = Object.assign({}, deserializedGridState);

            normalised.columns = deserializedGridState.visibleColumns.map((columnId) => ({
                column: columnId,
                visible: true
            }));

            delete normalised.visibleColumns;

            return normalised;
        }

        return deserializedGridState;
    };

    /**
     * Reads the saved columns array into one lookup per property, keyed by the name each column was
     * saved under - which can be a ColumnId, a Heading, or a ColumnIdOrHeading.
     *
     * The array is saved in display order, hidden columns included, so a column's position in it is
     * its display order.  Settings saved before that was so name their displayOrder outright.
     */
    const readSavedColumns = (savedColumns) => {

        const visibilityByName = new Map();
        const widthsByName = {};
        const displayOrderByName = new Map();
        const headingOverridesByName = new Map();

        for (let i = 0; i < savedColumns.length; i++) {

            const savedColumn = savedColumns[i];

            // Only a hidden column carries a visible property, so a column without one is visible.
            visibilityByName.set(savedColumn.column, savedColumn.visible !== false);

            if (savedColumn.width !== undefined) {
                widthsByName[savedColumn.column] = savedColumn.width;
            }

            displayOrderByName.set(
                savedColumn.column,
                savedColumn.displayOrder !== undefined ? savedColumn.displayOrder : i
            );

            if (savedColumn.displayHeadingOverride !== undefined) {
                headingOverridesByName.set(savedColumn.column, savedColumn.displayHeadingOverride);
            }
        }

        return { visibilityByName, widthsByName, displayOrderByName, headingOverridesByName };
    };

    // A column can have been saved under any of its identifiers, so a match on any of them counts.
    // One the saved state does not name at all is new since it was saved, and stays hidden.
    const isSavedAsVisible = (columnModel, visibilityByName) => Boolean(
        visibilityByName.get(columnModel.ColumnIdOrHeading) ||
        (columnModel.ColumnId && visibilityByName.get(columnModel.ColumnId)) ||
        (columnModel.Heading && visibilityByName.get(columnModel.Heading))
    );

    const isSaved = (columnModel, visibilityByName) =>
        visibilityByName.has(columnModel.ColumnIdOrHeading) ||
        (columnModel.ColumnId && visibilityByName.has(columnModel.ColumnId)) ||
        (columnModel.Heading && visibilityByName.has(columnModel.Heading));

    const getVisibleColumnsInDataSourceOrder = (visibilityByName, showsUnsavedColumns) => {

        const visibleColumns = [];

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const columnModel = tabularData.ColumnModels[columnIndex];

            const isVisible = isSavedAsVisible(columnModel, visibilityByName) ||
                (showsUnsavedColumns && !isSaved(columnModel, visibilityByName));

            // Whichever identifier the column was saved under, the grid state is applied with the
            // ColumnIdOrHeading, so that one identifier is used throughout.
            if (isVisible) {
                visibleColumns.push(columnModel.ColumnIdOrHeading);
            }
        }

        return visibleColumns;
    };

    const getSavedColumnIndexesInDisplayOrder = (displayOrderByName) => {

        const savedOrder = Array.from(displayOrderByName.entries());
        savedOrder.sort((a, b) => a[1] - b[1]);

        const columnOrder = [];

        for (let i = 0; i < savedOrder.length; i++) {

            const columnIndex = tabularData.columnResolver.getColumnIndex(savedOrder[i][0]);

            if (columnIndex !== null) {
                columnOrder.push(columnIndex);
            }
        }

        return columnOrder;
    };

    // A column the saved display order doesn't cover is new, and takes the place its data source
    // order gives it: after every saved column of a lower column index, before the first higher
    // one.
    const insertUnsavedColumnsInDataSourceOrder = (columnOrder) => {

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            if (columnOrder.includes(columnIndex)) continue;

            let insertPosition = columnOrder.length;

            for (let position = 0; position < columnOrder.length; position++) {

                if (columnOrder[position] > columnIndex) {

                    insertPosition = position;
                    break;
                }
            }

            columnOrder.splice(insertPosition, 0, columnIndex);
        }
    };

    const applyHeadingOverrides = (headingOverridesByName) => {

        headingOverridesByName.forEach((override, columnName) => {

            const columnIndex = tabularData.columnResolver.getColumnIndex(columnName);

            if (columnIndex !== null) {

                // Don't notify; the headings are rendered after the grid state has been applied.
                gridState.setDisplayHeadingOverride(columnIndex, override, true);
            }
        });
    };

    /**
     * Applies the deserialized gridstate to the datagrid.
     */
    // A column a grid state saved by the user doesn't name is new since, and stays hidden.  One a
    // replaced grid's state doesn't name was added with the replacement, such as by Duplicate
    // Column, so showsUnsavedColumns shows it.
    const applyDeserializedGridState = (deserializedGridState, showsUnsavedColumns) => {

        if (!deserializedGridState) {

            console.warn(`[GridStateApplyer] applyDeserializedGridState called with null/undefined for group "${gridStateGroup}"`);
            return;
        }

        deserializedGridState = normaliseGridState(deserializedGridState);

        if (deserializedGridState.columns?.length) {

            const savedColumns = readSavedColumns(deserializedGridState.columns);

            gridState.setAllColumnsVisibility(
                getVisibleColumnsInDataSourceOrder(
                    savedColumns.visibilityByName,
                    showsUnsavedColumns
                ),
                deserializedGridState.originalColumns
            );

            if (savedColumns.displayOrderByName.size > 0) {

                const columnOrder =
                    getSavedColumnIndexesInDisplayOrder(savedColumns.displayOrderByName);

                insertUnsavedColumnsInDataSourceOrder(columnOrder);

                if (columnOrder.length > 0) {
                    gridState.setColumnOrder(columnOrder);
                }
            }

            if (Object.keys(savedColumns.widthsByName).length > 0) {
                setAllColumnsWidth(savedColumns.widthsByName);
            }

            if (savedColumns.headingOverridesByName.size > 0) {
                applyHeadingOverrides(savedColumns.headingOverridesByName);
            }
        }

        // Legacy: also check for columnWidths at the root level for backward compatibility.
        if (deserializedGridState.columnWidths) setAllColumnsWidth(deserializedGridState.columnWidths);

        if (deserializedGridState.variationLabel) {
            gridState.variationLabel = deserializedGridState.variationLabel;
        }

        if (deserializedGridState.variationTooltip) {
            gridState.variationTooltip = deserializedGridState.variationTooltip;
        }

        if (deserializedGridState.showRowAndColumnHeadings !== undefined) {
            gridState.showRowAndColumnHeadings = deserializedGridState.showRowAndColumnHeadings ? 1 : 0;
        }
    };

    /**
     * Wires up messages so that when one datagrid's settings change, all datagrids with the same
     * settings group are updated.
     */
    Ren.Messages.Events.gridStateChanged.handle((newGridState) => {

        if (gridState.isDestroyed) {

            return false; // Remove this handler.
        }

        if (newGridState) {

            if (newGridState.containingReportGuid === containingReportGuid) {

                if (newGridState.gridStateGroup === gridStateGroup) {

                    Ren.ObjectUtils.syncObject(newGridState, gridState, ["containingReportGuid", "dataGridGuid"]);

                    Ren.Messages.Events.columnVisibilityChanged.notify();
                    Ren.Messages.Events.columnsMoved.notify();
                }
            }
        }

        Ren.Messages.Events.columnResized.notify();
    });

    return {
        applyDeserializedGridState
    };
};
