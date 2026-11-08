Ren.TabularData_ColumnCvsPopulator = (() => {

    /**
     * Builds a date column's values in a Float64Array where every one is a date, which it must be
     * rather than an Int32Array even where every date fits one: an Int32Array column is taken to
     * hold dictionary indexes.  Null where the column holds a NULL or a literal.
     */
    const buildEpochColumnCV = (rowModels, rowCount, columnIndex) => {

        const buffer = new Float64Array(rowCount);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            const rowCV = rowModels[rowIndex].CV ?? rowModels[rowIndex].RowValues;
            const value = rowCV[columnIndex];

            if (typeof value !== "number") return null;

            buffer[rowIndex] = value;
        }

        return buffer;
    };

    /**
     * Builds a single column's compressed values.  A compressed column is stored in an Int32Array,
     * half the memory of a boxed array and cache-local, unless any value is not a storable 32-bit
     * integer, when a plain array preserves each value and its type.
     */
    const buildColumnCV = (tabularData, columnIndex) => {

        const rowModels = tabularData.RowModels;
        const rowCount = rowModels.length;

        if (tabularData.CompressionDictionary?.isEpochColumn?.(columnIndex)) {

            const buffer = buildEpochColumnCV(rowModels, rowCount, columnIndex);

            if (buffer !== null) return buffer;
        }
        else if (tabularData.IsColumnCompressed[columnIndex]) {

            const buffer = new Int32Array(rowCount);
            let allStorableInts = true;

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                const rowCV = rowModels[rowIndex].CV ?? rowModels[rowIndex].RowValues;
                const value = rowCV[columnIndex];

                // (value | 0) === value holds only for integers within the Int32 range.
                if (typeof value !== "number" || (value | 0) !== value) {

                    allStorableInts = false;
                    break;
                }

                buffer[rowIndex] = value;
            }

            if (allStorableInts) return buffer;
        }

        const array = new Array(rowCount);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            const rowCV = rowModels[rowIndex].CV ?? rowModels[rowIndex].RowValues;
            array[rowIndex] = rowCV[columnIndex];
        }

        return array;
    };

    /**
     * Installs a lazily-populated, cached per-column CV accessor, so that columns that are only
     * displayed never allocate a duplicate of the row-major CV data.
     */
    const installColumnCVAccessor = (tabularData) => {

        const cache = new Array(tabularData.ColumnModels.length);

        const getColumnCV = (columnIndex) => {

            let column = cache[columnIndex];

            if (column !== undefined) return column;

            column = buildColumnCV(tabularData, columnIndex);
            cache[columnIndex] = column;
            return column;
        };

        tabularData._columnCVCache = cache;
        tabularData.getColumnCV = getColumnCV;
    };

    /**
     * Installs a lazily-populated, cached per-column distinct-value accessor.  The arrays are never
     * rebuilt, so a returned array's identity is stable, which lets HasFilter key its
     * decompressed-value cache on the array itself.
     */
    const installDistinctColumnCVAccessor = (tabularData) => {

        const cache = new Array(tabularData.ColumnModels.length);

        // Shared between columns, as a build clears every index it stamped before returning.
        let seenStamp = null;

        /**
         * Builds a column's distinct values, in the order the rows first present them.  Dictionary
         * indexes are stamped into a byte array rather than hashed into a Set; anything else falls
         * back to a Set.
         */
        const buildDistinctColumnCV = (columnIndex) => {

            const rowModels = tabularData.RowModels;
            const rowCount = rowModels.length;

            const distinctCVs = [];

            if (rowCount === 0) return distinctCVs;

            const dictionarySize = tabularData.CompressionDictionary?.dictionarySize ?? 0;
            const isStamped = !!tabularData.IsColumnCompressed?.[columnIndex] && dictionarySize > 0;

            if (isStamped && seenStamp === null) seenStamp = new Uint8Array(dictionarySize);

            // Allocated only if a value that cannot be stamped turns up.
            let otherValues = null;

            const addValue = (value) => {

                if (isStamped && typeof value === "number"
                    && value >= 0 && value < dictionarySize && (value | 0) === value) {

                    if (seenStamp[value] !== 0) return;

                    seenStamp[value] = 1;
                    distinctCVs.push(value);
                    return;
                }

                if (otherValues === null) otherValues = new Set();

                const sizeBeforeAdd = otherValues.size;

                otherValues.add(value);

                if (otherValues.size !== sizeBeforeAdd) distinctCVs.push(value);
            };

            // An already-materialised dense column is faster to walk than every row model.
            const columnCV = tabularData._columnCVCache?.[columnIndex];

            if (columnCV !== undefined) {

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) addValue(columnCV[rowIndex]);
            }
            else {

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                    const row = rowModels[rowIndex];
                    const rowCV = row.CV ?? row.RowValues;

                    addValue(rowCV[columnIndex]);
                }
            }

            if (isStamped) {

                for (let i = 0; i < distinctCVs.length; i++) {

                    const value = distinctCVs[i];

                    if (typeof value === "number" && value >= 0 && value < dictionarySize) {

                        seenStamp[value] = 0;
                    }
                }
            }

            return distinctCVs;
        };

        const getDistinctColumnCV = (columnIndex) => {

            let distinctCVs = cache[columnIndex];

            if (distinctCVs !== undefined) return distinctCVs;

            distinctCVs = buildDistinctColumnCV(columnIndex);

            cache[columnIndex] = distinctCVs;
            return distinctCVs;
        };

        // Exposed under this name so that the debug transformer elides it.  Read it through
        // getDistinctColumnCV, as a column nothing has asked about yet is absent.
        tabularData.distinctColumnCVs = cache;
        tabularData.getDistinctColumnCV = getDistinctColumnCV;
    };

    /**
     * Installs the lazy getColumnCV and getDistinctColumnCV accessors on the given tabular data.
     */
    const populateColumnCVs = (tabularData) => {

        installColumnCVAccessor(tabularData);
        installDistinctColumnCVAccessor(tabularData);
    };

    return {
        populateColumnCVs
    };
})();
