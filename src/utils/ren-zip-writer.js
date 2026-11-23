/**
 * Writes ZIP archives in the browser, as the container an Excel file is.  Each file is deflated
 * where the browser can do it (CompressionStream's "deflate-raw"), and otherwise stored as it is.
 */
Ren.ZipWriter = (() => {

    const METHOD_STORED = 0;
    const METHOD_DEFLATED = 8;

    // Bit 11 of the flags says the file names are UTF-8.
    const FLAG_UTF8_NAMES = 0x0800;

    // Made when first needed: the CRC-32 of each byte value, for the reversed polynomial.
    let crcTable = null;

    const getCrcTable = () => {

        if (crcTable) return crcTable;

        crcTable = new Uint32Array(256);

        for (let n = 0; n < 256; n++) {

            let c = n;

            for (let bit = 0; bit < 8; bit++) {

                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }

            crcTable[n] = c >>> 0;
        }

        return crcTable;
    };

    /**
     * Gets the CRC-32 of the given bytes, as an unsigned number.
     * @param {Uint8Array} bytes
     * @returns {number}
     */
    const crc32 = (bytes) => {

        const table = getCrcTable();

        let crc = 0xFFFFFFFF;

        for (let i = 0; i < bytes.length; i++) {

            crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }

        return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    const canDeflate = () => {

        if (typeof CompressionStream !== "function") return false;

        try {

            new CompressionStream("deflate-raw");

            return true;
        }
        catch {

            return false;
        }
    };

    const deflateRaw = (bytes) => {

        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));

        return new Response(stream).arrayBuffer().then(buffer => new Uint8Array(buffer));
    };

    /**
     * Gets a date and time in the form a ZIP entry holds them, local time to two seconds.
     */
    const toDosDateTime = (date) => {

        const year = Math.max(1980, Math.min(2107, date.getFullYear()));

        return {
            time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
            date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
        };
    };

    // Text in parts is joined by a Blob, so a file too large to hold as one string can be written.
    const toBytes = async (content) => {

        if (typeof content === "string") return new TextEncoder().encode(content);
        if (Array.isArray(content)) return new Uint8Array(await new Blob(content).arrayBuffer());

        return content;
    };

    /**
     * Makes a ZIP archive of the given files.
     * @param {{ name: string, content: string|string[]|Uint8Array }[]} files  Text, or text in
     * parts, is written as UTF-8.
     * @param {Date} [modified]  When the files were last changed: now, if not given.
     * @returns {Promise<Blob>}
     */
    const createZip = async (files, modified) => {

        const encoder = new TextEncoder();
        const dosDateTime = toDosDateTime(modified || new Date());
        const deflate = canDeflate();

        const parts = [];
        const centralParts = [];

        let offset = 0;

        for (const file of files) {

            const nameBytes = encoder.encode(file.name);
            const data = await toBytes(file.content);
            const crc = crc32(data);

            let method = METHOD_STORED;
            let stored = data;

            if (deflate) {

                const deflated = await deflateRaw(data);

                if (deflated.length < data.length) {

                    method = METHOD_DEFLATED;
                    stored = deflated;
                }
            }

            const local = new DataView(new ArrayBuffer(30));

            local.setUint32(0, 0x04034B50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, FLAG_UTF8_NAMES, true);
            local.setUint16(8, method, true);
            local.setUint16(10, dosDateTime.time, true);
            local.setUint16(12, dosDateTime.date, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, stored.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, nameBytes.length, true);
            local.setUint16(28, 0, true);

            const central = new DataView(new ArrayBuffer(46));

            central.setUint32(0, 0x02014B50, true);
            central.setUint16(4, 20, true);
            central.setUint16(6, 20, true);
            central.setUint16(8, FLAG_UTF8_NAMES, true);
            central.setUint16(10, method, true);
            central.setUint16(12, dosDateTime.time, true);
            central.setUint16(14, dosDateTime.date, true);
            central.setUint32(16, crc, true);
            central.setUint32(20, stored.length, true);
            central.setUint32(24, data.length, true);
            central.setUint16(28, nameBytes.length, true);
            central.setUint32(42, offset, true);

            parts.push(local, nameBytes, stored);
            centralParts.push(central, nameBytes);

            offset += 30 + nameBytes.length + stored.length;
        }

        const centralSize = centralParts.reduce((size, part) => size + part.byteLength, 0);
        const end = new DataView(new ArrayBuffer(22));

        end.setUint32(0, 0x06054B50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);

        return new Blob([...parts, ...centralParts, end], { type: "application/zip" });
    };

    return {
        crc32,
        createZip
    };
})();
