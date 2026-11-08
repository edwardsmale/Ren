/**
 * Writes renpack bodies for the decoding tests, following the layout RenPackFormat.cs documents
 * rather than the reader, so that a mistake in the reader isn't copied here.  It's deliberately
 * simple: it writes what it's given, and picks only the dictionary's length width and ASCII flag.
 */
const HEADER_LENGTH = 32;
const DICTIONARY_HEADER_LENGTH = 16;
const DESCRIPTOR_LENGTH = 16;

const ENCODING = { UINT8: 0, UINT16: 1, UINT32: 2, INT32: 3, FLOAT64: 4 };
const SCALE_CODE = { NONE: 0, SECONDS: 1, DAYS: 2 };

const BYTES_PER_VALUE = [1, 2, 4, 4, 8];

const align8 = (offset) => (offset + 7) & ~7;

const writeValue = (view, encoding, offset, value) => {

    switch (encoding) {

        case ENCODING.UINT8: view.setUint8(offset, value); break;
        case ENCODING.UINT16: view.setUint16(offset, value, true); break;
        case ENCODING.UINT32: view.setUint32(offset, value, true); break;
        case ENCODING.INT32: view.setInt32(offset, value, true); break;
        case ENCODING.FLOAT64: view.setFloat64(offset, value, true); break;
    }
};

/**
 * Writes a renpack body and returns its ArrayBuffer.
 *
 * @param {object} metadata - The collection, less its rows and dictionary.
 * @param {Array<string|null>} dictionary - The dictionary's strings.
 * @param {Array<object>} columns - Every tab's columns, in tab order, each as
 *   { encoding, scaleCode, values }, where a null value is a NULL.
 * @param {number} [version] - The version to write in the header.
 */
const writeRenPack = (metadata, dictionary, columns, version) => {

    const encoder = new TextEncoder();

    const metadataBytes = encoder.encode(JSON.stringify(metadata));

    const stringBytes = dictionary.map((value) => value === null ? null : encoder.encode(value));

    let blobLength = 0;
    let longestLength = 0;
    let isAscii = true;

    for (let i = 0; i < stringBytes.length; i++) {

        const bytes = stringBytes[i];

        if (bytes === null) continue;

        blobLength += bytes.length;
        longestLength = Math.max(longestLength, bytes.length);

        if (bytes.length !== dictionary[i].length) isAscii = false;
    }

    // Every bit set is a null, so the widest length has to stay below it.
    const lengthWidth = longestLength < 0xFF ? 1 : longestLength < 0xFFFF ? 2 : 4;

    const dictionaryOffset = align8(HEADER_LENGTH + metadataBytes.length);
    const lengthsOffset = dictionaryOffset + DICTIONARY_HEADER_LENGTH;
    const blobOffset = lengthsOffset + (stringBytes.length * lengthWidth);
    const descriptorsOffset = align8(blobOffset + blobLength);

    // Each column's values, then its null bitset when it has any nulls, each 8-aligned.
    let offset = descriptorsOffset + (columns.length * DESCRIPTOR_LENGTH);

    const layouts = columns.map((column) => {

        const valuesOffset = align8(offset);
        const hasNulls = column.values.some((value) => value === null);

        offset = valuesOffset + (column.values.length * BYTES_PER_VALUE[column.encoding]);

        let nullsOffset = 0;

        if (hasNulls) {

            nullsOffset = align8(offset);
            offset = nullsOffset + ((column.values.length + 7) >> 3);
        }

        return { valuesOffset, hasNulls, nullsOffset };
    });

    const totalLength = align8(offset);
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    bytes.set(encoder.encode("RENP"), 0);
    view.setUint32(4, version === undefined ? 2 : version, true);
    view.setUint32(8, metadataBytes.length, true);
    view.setUint32(12, dictionaryOffset, true);
    view.setUint32(16, descriptorsOffset, true);
    view.setUint32(20, columns.length, true);
    view.setUint32(24, totalLength, true);
    bytes.set(metadataBytes, HEADER_LENGTH);

    view.setUint32(dictionaryOffset, stringBytes.length, true);
    view.setUint32(dictionaryOffset + 4, isAscii ? 1 : 0, true);
    view.setUint32(dictionaryOffset + 8, blobLength, true);
    view.setUint32(dictionaryOffset + 12, lengthWidth, true);

    const lengthEncoding =
        lengthWidth === 1 ? ENCODING.UINT8 : lengthWidth === 2 ? ENCODING.UINT16 : ENCODING.UINT32;

    const nullLength = lengthWidth === 1 ? 0xFF : lengthWidth === 2 ? 0xFFFF : 0xFFFFFFFF;

    let blobPosition = blobOffset;

    for (let i = 0; i < stringBytes.length; i++) {

        writeValue(
            view,
            lengthEncoding,
            lengthsOffset + (i * lengthWidth),
            stringBytes[i] === null ? nullLength : stringBytes[i].length
        );

        if (stringBytes[i] === null) continue;

        bytes.set(stringBytes[i], blobPosition);
        blobPosition += stringBytes[i].length;
    }

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {

        const column = columns[columnIndex];
        const layout = layouts[columnIndex];
        const descriptorOffset = descriptorsOffset + (columnIndex * DESCRIPTOR_LENGTH);

        view.setUint8(descriptorOffset, column.encoding);
        view.setUint8(descriptorOffset + 1, layout.hasNulls ? 1 : 0);
        view.setUint16(descriptorOffset + 2, column.scaleCode || SCALE_CODE.NONE, true);
        view.setUint32(descriptorOffset + 4, column.values.length, true);
        view.setUint32(descriptorOffset + 8, layout.valuesOffset, true);
        view.setUint32(descriptorOffset + 12, layout.nullsOffset, true);

        const bytesPerValue = BYTES_PER_VALUE[column.encoding];

        for (let rowIndex = 0; rowIndex < column.values.length; rowIndex++) {

            const value = column.values[rowIndex];

            writeValue(
                view,
                column.encoding,
                layout.valuesOffset + (rowIndex * bytesPerValue),
                value === null ? 0 : value
            );

            if (value === null) bytes[layout.nullsOffset + (rowIndex >> 3)] |= 1 << (rowIndex & 7);
        }
    }

    return buffer;
};

module.exports = { ENCODING, SCALE_CODE, writeRenPack };
