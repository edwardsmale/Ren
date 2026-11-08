/**
 * Converts tabular data into an array of objects, where each object represents a row of data.
 *
 * Each value is keyed by its ColumnIdOrHeading.  keyByHeadingToo additionally keys it by its
 * Heading, which is opt-in because callers enumerating the row's keys would otherwise see a column
 * carrying a ColumnId twice.
 */
Ren.TabularDataAdapter_Array = (() => {

    // Generated per-row builder functions, keyed by a signature of the column layout.  A generated
    // object literal with literal keys lets V8 allocate each row object with its final shape, where
    // assigning cells by computed key forces a megamorphic keyed store and grows the shape one cell
    // at a time.  The layout changes rarely, so the codegen is amortised across the rows.
    const _rowBuilderCache = new Map();

    // Emits a safe object-literal key.  "__proto__" as a plain literal key would set the object's
    // prototype rather than create an own property, so it is emitted as a computed key.
    const keyLiteral = (key) =>
        key === "__proto__" ? "[" + JSON.stringify(key) + "]" : JSON.stringify(key);

    // Builds a function (row, decompressValue) => datum for the given layout by assigning each
    // cell, where the page's content security policy doesn't allow the generated one.  It has the
    // same keys in the same order, "__proto__" as an own property included.
    const buildAssigningRowBuilder = (columnsToIterate, columnIdsOrHeadings, compressedByColumn,
        headings) => (r, d) => {

        const datum = {};

        for (let i = 0; i < columnsToIterate.length; i++) {

            const columnIndex = columnsToIterate[i];
            const value = compressedByColumn[i] ? d(r[columnIndex], columnIndex) : r[columnIndex];

            Object.defineProperty(datum, columnIdsOrHeadings[i],
                { value, writable: true, enumerable: true, configurable: true });

            if (headings && headings[i] !== columnIdsOrHeadings[i]) {

                Object.defineProperty(datum, headings[i],
                    { value, writable: true, enumerable: true, configurable: true });
            }
        }

        return datum;
    };

    // Builds a function (row, decompressValue) => datum for the given layout.  "row" is either a
    // RowModel's CV array or a group's row of values: both decompress the same.
    const buildRowBuilder = (columnsToIterate, columnIdsOrHeadings, compressedByColumn, headings) => {

        const columnCount = columnsToIterate.length;
        const parts = [];

        for (let i = 0; i < columnCount; i++) {

            const columnIndex = columnsToIterate[i];

            // Non-compressed columns store their value directly, so the decompressValue call is
            // baked out of the generated body for them.
            const valueExpr = compressedByColumn[i]
                ? "d(r[" + columnIndex + "]," + columnIndex + ")"
                : "r[" + columnIndex + "]";

            parts.push(keyLiteral(columnIdsOrHeadings[i]) + ":" + valueExpr);

            if (headings && headings[i] !== columnIdsOrHeadings[i]) {

                parts.push(keyLiteral(headings[i]) + ":" + valueExpr);
            }
        }

        try {

            // eslint-disable-next-line no-new-func
            return new Function("r", "d", "return {" + parts.join(",") + "};");
        }
        catch (e) {

            return buildAssigningRowBuilder(
                columnsToIterate,
                columnIdsOrHeadings,
                compressedByColumn,
                headings
            );
        }
    };

    // Gets the row builder for the given layout, generating and caching it where needed.  The
    // signature is JSON-encoded so a separator inside a column ID or heading cannot collide two
    // layouts onto one builder.
    const getRowBuilder = (columnsToIterate, columnIdsOrHeadings, compressedByColumn, headings) => {

        const signature = JSON.stringify([
            columnsToIterate, columnIdsOrHeadings, compressedByColumn, headings
        ]);

        let builder = _rowBuilderCache.get(signature);

        if (!builder) {

            // Guard against unbounded growth if a session churns through many distinct layouts.
            if (_rowBuilderCache.size > 64) _rowBuilderCache.clear();

            builder = buildRowBuilder(
                columnsToIterate,
                columnIdsOrHeadings,
                compressedByColumn,
                headings
            );

            _rowBuilderCache.set(signature, builder);
        }

        return builder;
    };

    const getDataArray = (
        tabularData,
        sourceVisualisation,
        sourceDataGroupingSettings,
        formatValues,
        excludeHiddenColumns,
        startRowIndex,
        rowCount,
        keyByHeadingToo,
        columnIndexes
    ) => {

        startRowIndex = startRowIndex ?? 0;

        if (!tabularData || !tabularData.RowModels) return [];

        const columnResolver = Ren.DataGridColumnResolver(tabularData);

        // Resolving these builds a whole DataGroupingSettings, whose constructor runs an O(N)
        // initialisation, so the unformatted path - which re-runs on every filter change - skips
        // it.
        let columnValueFormats = null;
        let columnFormatFunctions = null;

        if (formatValues) {

            const dataGroupingSettings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
                tabularData,
                sourceVisualisation,
                null,
                false
            );

            const columnFormats = dataGroupingSettings.getDataRowsColumnFormats();
            columnValueFormats = columnFormats.columnValueFormats;
            columnFormatFunctions = columnFormats.columnFormatFunctions;
        }

        const ColumnModels = tabularData.ColumnModels;
        const ColumnCount = tabularData.ColumnCount;
        const CompressionDictionary = tabularData.CompressionDictionary;
        const decompressValue = CompressionDictionary.decompressValue;
        const isColumnCompressed = tabularData.IsColumnCompressed;

        rowCount = rowCount ?? (tabularData.RowModels.length - startRowIndex);

        let columnsToIterate;

        // Restricted to the given columns, so the rows carry only what their reader needs.
        if (columnIndexes) {

            columnsToIterate = columnIndexes;
        }
        else if (excludeHiddenColumns) {

            columnsToIterate = [];

            for (let columnIndex = 0; columnIndex < ColumnCount; columnIndex++) {

                if (ColumnModels[columnIndex].Visible) {

                    columnsToIterate.push(columnIndex);
                }
            }
        }
        else {

            columnsToIterate = new Array(ColumnCount);
            for (let i = 0; i < ColumnCount; i++) columnsToIterate[i] = i;
        }

        const columnCount = columnsToIterate.length;

        const columnIdsOrHeadings = columnResolver.getColumnIdsOrHeadings(columnsToIterate);

        const headings = keyByHeadingToo
            ? columnsToIterate.map(columnIndex => ColumnModels[columnIndex].Heading)
            : null;

        // Resolved once, aligned to columnsToIterate, so the row loop does not re-index
        // IsColumnCompressed per cell.
        const compressedByColumn = new Array(columnCount);

        for (let i = 0; i < columnCount; i++) {

            compressedByColumn[i] = isColumnCompressed[columnsToIterate[i]];
        }

        // Read once and compared inline, rather than calling isGroupRow for every row.
        const dataRowCount = tabularData.DataRowCount;
        const RowModels = tabularData.RowModels;

        const data = new Array(rowCount);

        // The builder handles group rows, which are never formatted, and unformatted data rows;
        // the formatValues path stays on the per-cell loop below.
        const buildRow = getRowBuilder(
            columnsToIterate,
            columnIdsOrHeadings,
            compressedByColumn,
            headings
        );

        for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {

            const rowIndex = startRowIndex + rowOffset;

            if (rowIndex >= dataRowCount) {

                const group = sourceDataGroupingSettings.groupings.getGroupWithRowIndex(rowIndex);

                data[rowOffset] = buildRow(
                    group.groupValues.getRow(group.position),
                    decompressValue
                );
            }
            else if (!formatValues) {

                data[rowOffset] = buildRow(RowModels[rowIndex].CV, decompressValue);
            }
            else {

                const compressedRow = RowModels[rowIndex].CV;
                const datum = {};

                for (let i = 0; i < columnCount; i++) {

                    const columnIndex = columnsToIterate[i];
                    const cv = compressedRow[columnIndex];

                    const cellValue = compressedByColumn[i]
                        ? decompressValue(cv, columnIndex)
                        : cv;

                    const value = Ren.ValueFormatter.formatValue(
                        cellValue,
                        columnIndex,
                        columnValueFormats[columnIndex],
                        columnFormatFunctions[columnIndex]
                    );

                    datum[columnIdsOrHeadings[i]] = value;

                    if (headings && headings[i] !== columnIdsOrHeadings[i]) {
                        datum[headings[i]] = value;
                    }
                }

                data[rowOffset] = datum;
            }
        }

        return data;
    };

    return {
        getDataArray
    };
})();
