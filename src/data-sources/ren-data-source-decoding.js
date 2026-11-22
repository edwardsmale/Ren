/**
 * The parts of reading a data source response that are done both on the main thread and on a parse
 * worker: the RENP decoder and the escaped newline pass.
 *
 * Written as a factory that references neither Ren nor the DOM, so that Ren.DataSourceParseWorker
 * can stringify it into the worker's source; the main thread uses the instance made below.
 */
Ren.createDataSourceDecoding = () => {

    // A compressed collection holds no strings in its rows: every value is a dictionary index, a
    // number or null (see TabularDataSetCollectionCompressor), so the newline pass skips the rows,
    // by far the bulk of the payload.
    const NEWLINE_SKIPPED_KEYS_WHEN_COMPRESSED = { RowModels: true };

    // See RenPackFormat.cs for the layout.  Version 2 added the scale code, which version 1 wrote
    // as zero, so both read the same way.
    const RENPACK_MINIMUM_VERSION = 1;
    const RENPACK_VERSION = 2;
    const RENPACK_HEADER_LENGTH = 32;
    const RENPACK_DICTIONARY_HEADER_LENGTH = 16;
    const RENPACK_DESCRIPTOR_LENGTH = 16;
    const RENPACK_DICTIONARY_FLAG_ASCII = 1;

    // A null string's length, per length table width: every bit set.
    const RENPACK_NULL_STRING_LENGTHS = { 1: 255, 2: 65535, 4: 4294967295 };

    // The length a null string is given in a packed dictionary, whatever width it was written at.
    const PACKED_NULL_STRING_LENGTH = 4294967295;

    const RENPACK_ENCODING_UINT8 = 0;
    const RENPACK_ENCODING_UINT16 = 1;
    const RENPACK_ENCODING_UINT32 = 2;
    const RENPACK_ENCODING_INT32 = 3;
    const RENPACK_ENCODING_FLOAT64 = 4;

    const RENPACK_SCALE_CODE_NONE = 0;
    const RENPACK_SCALE_CODE_SECONDS = 1;
    const RENPACK_SCALE_CODE_DAYS = 2;

    /**
     * Replaces escaped newlines (\\n) with literal ones (\n) in every string value, in place.
     * skipKeys optionally names properties not to descend into, e.g. { RowModels: true }.
     */
    const replaceEscapedNewlines = (obj, skipKeys) => {

        if (obj === null || obj === undefined) return obj;

        if (typeof obj === "string") {

            return obj.indexOf("\\n") === -1 ? obj : obj.replace(/\\n/g, "\n");
        }

        if (typeof obj !== "object") return obj;

        if (Array.isArray(obj)) {

            for (let index = 0; index < obj.length; index++) {

                const item = obj[index];

                if (typeof item === "string") {

                    if (item.indexOf("\\n") !== -1) obj[index] = item.replace(/\\n/g, "\n");
                }
                else if (item !== null && typeof item === "object") {

                    replaceEscapedNewlines(item, skipKeys);
                }
            }

            return obj;
        }

        const keys = Object.keys(obj);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (skipKeys !== undefined && skipKeys[key] === true) continue;

            const value = obj[key];

            if (typeof value === "string") {

                if (value.indexOf("\\n") !== -1) obj[key] = value.replace(/\\n/g, "\n");
            }
            else if (value !== null && typeof value === "object") {

                replaceEscapedNewlines(value, skipKeys);
            }
        }

        return obj;
    };

    /**
     * Replaces escaped newlines throughout a tabular data set collection, skipping the rows of a
     * compressed one.
     */
    const replaceEscapedNewlinesInCollection = (collection) => replaceEscapedNewlines(
        collection,
        collection.CompressionDictionary ? NEWLINE_SKIPPED_KEYS_WHEN_COMPRESSED : undefined
    );

    const getRenPackScale = (scaleCode) => {

        switch (scaleCode) {

            case RENPACK_SCALE_CODE_NONE: return 1;
            case RENPACK_SCALE_CODE_SECONDS: return 1000;
            case RENPACK_SCALE_CODE_DAYS: return 86400000;
        }

        throw new Error(`[RenPack] Unknown scale code: ${scaleCode}.`);
    };

    const readDictionaryLengths = (buffer, offset, count, width) => {

        switch (width) {

            case 1: return new Uint8Array(buffer, offset, count);
            case 2: return new Uint16Array(buffer, offset, count);
            case 4: return new Uint32Array(buffer, offset, count);
        }

        throw new Error(`[RenPack] Unknown dictionary length width: ${width}.`);
    };

    /**
     * Reads the compression dictionary out of its block as every string decoded into one flat blob,
     * and a table of their character lengths.  Posting back an array of strings from a worker would
     * copy every one of them, where one blob is one copy.
     *
     * The blob is decoded in a single call whether or not it is ASCII, since decoding each string
     * separately costs far more.  Where it is not, the response's lengths are byte lengths, so the
     * character lengths are counted off the bytes: a character starts at every non-continuation
     * byte, and a four-byte one is two characters.
     */
    const readPackedDictionary = (buffer, view, blockOffset) => {

        const count = view.getUint32(blockOffset, true);
        const flags = view.getUint32(blockOffset + 4, true);
        const blobLength = view.getUint32(blockOffset + 8, true);
        const lengthWidth = view.getUint32(blockOffset + 12, true);

        const lengthsOffset = blockOffset + RENPACK_DICTIONARY_HEADER_LENGTH;

        const lengths = readDictionaryLengths(buffer, lengthsOffset, count, lengthWidth);
        const blobOffset = lengthsOffset + (count * lengthWidth);

        const nullLength = RENPACK_NULL_STRING_LENGTHS[lengthWidth];
        const isAscii = (flags & RENPACK_DICTIONARY_FLAG_ASCII) !== 0;

        const bytes = new Uint8Array(buffer, blobOffset, blobLength);
        const blob = new TextDecoder("utf-8").decode(bytes);

        const characterLengths = new Uint32Array(count);

        let bytePosition = 0;

        for (let index = 0; index < count; index++) {

            const length = lengths[index];

            if (length === nullLength) {

                characterLengths[index] = PACKED_NULL_STRING_LENGTH;
                continue;
            }

            if (isAscii) {

                characterLengths[index] = length;
                continue;
            }

            let characters = 0;

            for (let offset = 0; offset < length; offset++) {

                const byte = bytes[bytePosition + offset];

                if ((byte & 0xC0) === 0x80) continue;

                characters += byte >= 0xF0 ? 2 : 1;
            }

            characterLengths[index] = characters;
            bytePosition += length;
        }

        return { count, blob, lengths: characterLengths.buffer };
    };

    const readColumnValues = (buffer, encoding, offset, rowCount) => {

        switch (encoding) {

            case RENPACK_ENCODING_UINT8: return new Uint8Array(buffer, offset, rowCount);
            case RENPACK_ENCODING_UINT16: return new Uint16Array(buffer, offset, rowCount);
            case RENPACK_ENCODING_UINT32: return new Uint32Array(buffer, offset, rowCount);
            case RENPACK_ENCODING_INT32: return new Int32Array(buffer, offset, rowCount);
            case RENPACK_ENCODING_FLOAT64: return new Float64Array(buffer, offset, rowCount);
        }

        throw new Error(`[RenPack] Unknown column encoding: ${encoding}.`);
    };

    /**
     * Reads one tabular data's columns into the packed rows that
     * Ren.DataSourceParseWorker.unpackCollection rebuilds.
     */
    const readPackedRows = (buffer, view, descriptorsOffset, firstColumnIndex, columnCount) => {

        if (columnCount === 0) return null;

        const rowCount = view.getUint32(
            descriptorsOffset + (firstColumnIndex * RENPACK_DESCRIPTOR_LENGTH) + 4,
            true
        );

        if (rowCount === 0) return null;

        const values = new Float64Array(rowCount * columnCount);
        const rowHasNull = new Uint8Array(rowCount);

        // Allocated only if a null is actually met, which for many reports is never.
        let nullMask = null;

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

            const descriptorOffset =
                descriptorsOffset +
                ((firstColumnIndex + columnIndex) * RENPACK_DESCRIPTOR_LENGTH);

            const encoding = view.getUint8(descriptorOffset);
            const hasNulls = view.getUint8(descriptorOffset + 1) === 1;
            const scale = getRenPackScale(view.getUint16(descriptorOffset + 2, true));
            const valuesOffset = view.getUint32(descriptorOffset + 8, true);

            const columnValues = readColumnValues(buffer, encoding, valuesOffset, rowCount);

            // Written twice so that an unscaled column, nearly every one, pays no multiply.
            if (scale === 1) {

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                    values[(rowIndex * columnCount) + columnIndex] = columnValues[rowIndex];
                }
            }
            else {

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                    values[(rowIndex * columnCount) + columnIndex] =
                        columnValues[rowIndex] * scale;
                }
            }

            if (!hasNulls) continue;

            if (nullMask === null) nullMask = new Uint8Array(rowCount * columnCount);

            const nullsOffset = view.getUint32(descriptorOffset + 12, true);
            const nulls = new Uint8Array(buffer, nullsOffset, (rowCount + 7) >> 3);

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                if ((nulls[rowIndex >> 3] & (1 << (rowIndex & 7))) === 0) continue;

                nullMask[(rowIndex * columnCount) + columnIndex] = 1;
                rowHasNull[rowIndex] = 1;
            }
        }

        return {
            rowCount,
            columnCount,
            values: values.buffer,
            rowHasNull: rowHasNull.buffer,
            nullMask: nullMask === null ? null : nullMask.buffer
        };
    };

    /**
     * Gives each of the collection's tabs its rows, the column descriptors being in tab order, and
     * returns the buffers built along the way.
     */
    const readRenPackRows = (buffer, view, collection, descriptorsOffset, descriptorCount) => {

        const sets = collection.TabularDataSets;
        const transferables = [];

        let columnIndex = 0;

        for (let setIndex = 0; setIndex < sets.length; setIndex++) {

            const tabularDatas = sets[setIndex].TabularDatas;

            for (let tabIndex = 0; tabIndex < tabularDatas.length; tabIndex++) {

                const tabularData = tabularDatas[tabIndex];
                const columnCount = tabularData.ColumnModels.length;

                const packedRows = readPackedRows(
                    buffer,
                    view,
                    descriptorsOffset,
                    columnIndex,
                    columnCount
                );

                if (packedRows === null) {

                    tabularData.RowModels = [];
                }
                else {

                    tabularData.PackedRows = packedRows;

                    transferables.push(packedRows.values, packedRows.rowHasNull);

                    if (packedRows.nullMask !== null) transferables.push(packedRows.nullMask);
                }

                columnIndex += columnCount;
            }
        }

        // A mismatch means the rows were read against the wrong descriptors.
        if (columnIndex !== descriptorCount) {

            throw new Error(
                `[RenPack] The response describes ${descriptorCount} columns, but its tabs ` +
                `account for ${columnIndex}.`
            );
        }

        return transferables;
    };

    /**
     * Turns a RENP response into the collection it represents, with its dictionary and rows packed
     * into buffers for Ren.DataSourceParseWorker.unpackCollection to rebuild, and returns
     * { collection, transferables }, the latter being those buffers.  Throws on a body it cannot
     * read.
     */
    const decodeRenPack = (buffer) => {

        const view = new DataView(buffer);

        const version = view.getUint32(4, true);

        if (version < RENPACK_MINIMUM_VERSION || version > RENPACK_VERSION) {

            throw new Error(
                `[RenPack] Unsupported version: ${version}.  ` +
                `This client reads versions ${RENPACK_MINIMUM_VERSION} to ${RENPACK_VERSION}.`
            );
        }

        const metadataLength = view.getUint32(8, true);
        const dictionaryOffset = view.getUint32(12, true);
        const descriptorsOffset = view.getUint32(16, true);
        const descriptorCount = view.getUint32(20, true);

        const collection = JSON.parse(
            new TextDecoder("utf-8").decode(
                new Uint8Array(buffer, RENPACK_HEADER_LENGTH, metadataLength)
            )
        );

        collection.PackedDictionary = readPackedDictionary(buffer, view, dictionaryOffset);

        const transferables = readRenPackRows(
            buffer,
            view,
            collection,
            descriptorsOffset,
            descriptorCount
        );

        transferables.push(collection.PackedDictionary.lengths);

        return { collection, transferables };
    };

    return {
        RENPACK_HEADER_LENGTH,
        PACKED_NULL_STRING_LENGTH,
        replaceEscapedNewlines,
        replaceEscapedNewlinesInCollection,
        decodeRenPack
    };
};

Ren.DataSourceDecoding = Ren.createDataSourceDecoding();
