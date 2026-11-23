/**
 * Transforms grid state ready for serialisation.
 *
 * Does various transformations, such as converting column indexes to IDs/headings.
 *
 * For the inverse transformations, see Ren.GridStateApplyer.
 */
Ren.GridStateTransformer = (() => {

    // The grid state is not always the live one: the visualisation collection debug window
    // transforms a clone of the collection, and cloning drops the helper functions off it.  Read
    // the plain column state in that case, as the width check does.
    const getColumnVisibilityCheck = (settings) => (columnIndex) => {

        if (settings.isColumnVisible) return settings.isColumnVisible(columnIndex);

        const columnState = settings.columns && settings.columns[columnIndex];
        return !!(columnState && columnState.visible);
    };

    // Widths are held per column in the columns array rather than as a columnWidths property of
    // their own, so they are looked up by the name the column is serialised under.
    const getChangedWidthsByColumnName = (tabularData, settings, isColumnVisible) => {

        const widthsByColumnName = {};

        for (let columnIndex = 0; columnIndex < settings.columnWidths.length; columnIndex++) {

            if (!isColumnVisible(columnIndex)) continue;

            if (settings.hasColumnWidthChanged && !settings.hasColumnWidthChanged(columnIndex)) {
                continue;
            }

            const columnName = tabularData.ColumnModels[columnIndex].ColumnIdOrHeading;
            widthsByColumnName[columnName] = settings.columnWidths[columnIndex];
        }

        return widthsByColumnName;
    };

    // Keyed by column index rather than by name, as two columns can share a name but never an
    // index.  The columns array is stored in data source order, so the index is its position in it.
    const getDisplayPositionsByColumnIndex = (settings) => {

        const displayPositions = new Map();

        if (settings.columnOrder && settings.columnOrder.length > 0) {

            settings.columnOrder.forEach((columnIndex, displayPosition) => {

                if (settings.columns[columnIndex]) {
                    displayPositions.set(columnIndex, displayPosition);
                }
            });
        }

        return displayPositions;
    };

    /**
     * Returns the column indexes in the order the columns are displayed in, hidden columns
     * included - a hidden column holds the position it reappears at when it is shown again.
     *
     * A column the display order does not cover keeps its data source position, which is the
     * position it would be displayed at were no columns reordered.
     */
    const getColumnIndexesInDisplayOrder = (settings) => {

        const displayPositionsByColumnIndex = getDisplayPositionsByColumnIndex(settings);

        const getDisplayPosition = (columnIndex) => displayPositionsByColumnIndex.has(columnIndex)
            ? displayPositionsByColumnIndex.get(columnIndex)
            : columnIndex;

        const columnIndexes = [];

        for (let columnIndex = 0; columnIndex < settings.columns.length; columnIndex++) {
            columnIndexes.push(columnIndex);
        }

        columnIndexes.sort((a, b) => getDisplayPosition(a) - getDisplayPosition(b));

        return columnIndexes;
    };

    const transformColumn = (column, columnIndex, tabularData, widthsByColumnName) => {

        const transformedColumn = {
            column: column.column
        };

        // Most columns are visible, so only a hidden one says so: a saved column with no visible
        // property reads back as visible.  See Ren.GridStateApplyer.
        if (!column.visible) {
            transformedColumn.visible = false;
        }

        if (widthsByColumnName[column.column]) {
            transformedColumn.width = widthsByColumnName[column.column];
        }

        if (column.displayHeadingOverride !== undefined) {

            const columnModel = tabularData.ColumnModels[columnIndex];
            const actualHeading = columnModel ? columnModel.Heading : null;

            // An override that says what the heading already says is nothing to save.
            if (column.displayHeadingOverride !== actualHeading) {
                transformedColumn.displayHeadingOverride = column.displayHeadingOverride;
            }
        }

        return transformedColumn;
    };

    const copyVariationMetadata = (settings, transformedSettings) => {

        if (settings.variationLabel !== undefined) {
            transformedSettings.variationLabel = settings.variationLabel;
        }

        if (settings.variationTooltip !== undefined) {
            transformedSettings.variationTooltip = settings.variationTooltip;
        }

        if (settings.variationClassName !== undefined) {
            transformedSettings.variationClassName = settings.variationClassName;
        }
    };

    /**
     * Returns a new object with column indexes replaced with column IDs/headings.  Builds the
     * object from scratch rather than cloning for better performance.
     */
    const transform = (tabularData, settings) => {

        if (!tabularData) {

            console.warn("tabularData is not present. Cannot transform grid state.");
            return null;
        }

        if (!tabularData.ColumnModels) {

            console.warn("tabularData.ColumnModels is not present. Cannot transform grid state.");
            return null;
        }

        const transformedSettings = {};

        // The embedding is what a saved grid state is matched to a report's data by.
        if (tabularData.QueryEmbedding) {

            transformedSettings.queryEmbedding =
                Ren.EmbeddingUtils.encodeEmbedding(tabularData.QueryEmbedding);
        }

        transformedSettings.showRowAndColumnHeadings = !!settings.showRowAndColumnHeadings;

        // Only saved when set, as it is off unless a report turns it on.
        if (settings.scrollToBottom) transformedSettings.scrollToBottom = true;

        const isColumnVisible = getColumnVisibilityCheck(settings);

        const widthsByColumnName =
            getChangedWidthsByColumnName(tabularData, settings, isColumnVisible);

        if (settings.columns && settings.columns.length > 0) {

            // The columns are serialised in display order, which is what records where each column
            // sits: there is no displayOrder property to say so.  The column index is kept for the
            // transform itself, as the column's data in tabularData is still found under it.
            const columnIndexes = getColumnIndexesInDisplayOrder(settings);

            const transformedColumns = [];

            for (let i = 0; i < columnIndexes.length; i++) {

                const columnIndex = columnIndexes[i];

                transformedColumns.push(transformColumn(
                    settings.columns[columnIndex],
                    columnIndex,
                    tabularData,
                    widthsByColumnName
                ));
            }

            transformedSettings.columns = transformedColumns;
        }

        // columnWidths property is no longer serialized - width is now stored in the columns array.
        // The applyer still supports loading columnWidths for backward compatibility.

        copyVariationMetadata(settings, transformedSettings);

        Ren.ObjectUtils.deleteAllEmptyObjects(transformedSettings);

        return transformedSettings;
    };

    return {
        transform
    };
})();
