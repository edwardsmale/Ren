// The Base92 encoding of the CompressHtmlFile C++ tool: bytes packed 13 or 14 bits to a pair of
// printable ASCII characters, which makes it denser than Base64 and safe inside a <script> element.
Ren.Base92 = (() => {

    // Every printable ASCII character except ", \ and <, so the encoded data can sit in a JS string
    // literal inside a <script> element.  The first character is a space.
    const ALPHABET = " !#$%&'()*+,-./0123456789:;=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";

    const BASE = 92;

    // A pair of characters holds 13 bits, or 14 when the 13-bit value falls below this.
    const THRESHOLD = BASE * BASE - 8192;

    // The encoded data are ASCII, so they are written as bytes rather than built up as a string.
    const encode = (bytes) => {

        const alphabetCodes = new Uint8Array(BASE);

        for (let index = 0; index < BASE; index++) {
            alphabetCodes[index] = ALPHABET.charCodeAt(index);
        }

        const encoded = new Uint8Array(Math.ceil(bytes.length * 16 / 13) + 4);
        const length = bytes.length;

        let encodedLength = 0;
        let queue = 0;
        let bitCount = 0;

        for (let index = 0; index < length; index++) {

            queue |= bytes[index] << bitCount;
            bitCount += 8;

            if (bitCount > 13) {

                let value = queue & 8191;

                if (value >= THRESHOLD) {

                    queue >>>= 13;
                    bitCount -= 13;
                }
                else {

                    value = queue & 16383;
                    queue >>>= 14;
                    bitCount -= 14;
                }

                encoded[encodedLength++] = alphabetCodes[value % BASE];
                encoded[encodedLength++] = alphabetCodes[(value / BASE) | 0];
            }
        }

        if (bitCount > 0) {

            encoded[encodedLength++] = alphabetCodes[queue % BASE];

            if (bitCount > 6 || queue >= BASE) {
                encoded[encodedLength++] = alphabetCodes[(queue / BASE) | 0];
            }
        }

        return encoded.subarray(0, encodedLength);
    };

    // The reverse of encode, given the number of bytes that were encoded.  This is the algorithm of
    // the decoder Ren.HtmlFileCompressor embeds in a compressed report.
    const decode = (text, byteLength) => {

        const values = new Uint8Array(128);

        for (let index = 0; index < BASE; index++) {
            values[ALPHABET.charCodeAt(index)] = index;
        }

        const bytes = new Uint8Array(byteLength);
        const length = text.length;

        let byteIndex = 0;
        let queue = 0;
        let bitCount = 0;
        let index = 0;

        while (index < length && byteIndex < byteLength) {

            const low = values[text.charCodeAt(index++)];

            if (index < length) {

                const value = low + values[text.charCodeAt(index++)] * BASE;

                queue |= value << bitCount;
                bitCount += value < THRESHOLD || value >= 8192 ? 14 : 13;
            }
            else {

                queue |= low << bitCount;
                bitCount += 7;
            }

            while (bitCount >= 8 && byteIndex < byteLength) {

                bytes[byteIndex++] = queue & 255;
                queue >>>= 8;
                bitCount -= 8;
            }
        }

        return bytes;
    };

    return {
        ALPHABET,
        decode,
        encode
    };
})();
