/**
 * Functions for reading and writing the URL hash in the address bar.
 */
Ren.HashUtils = (() => {

    const getNonHashPart = (url) => url.split("#")[0];
    const getHashPart = (url) => url.split("#")[1];

    const serializeHash = (hashData) => {

        let hash = "";

        for (const h in hashData) {

            if (hash) hash += "&";

            hash += `${h}=${encodeURI(hashData[h])}`;
        }

        return hash;
    };

    const addHashParameter = (url, key, val) => {

        const hashData = parseHash(getHashPart(url));

        if (val) {
            hashData[key] = val;
        }
        else {

            delete hashData[key];
        }

        return getNonHashPart(url) + "#" + serializeHash(hashData);
    };

    /**
     * Adds the specified key and value to the hash in the address bar URL, or if the key already
     * exists, updates its value.
     */
    const updateHash = (key, val) => {

        const hashData = readHash();

        if (val) {
            hashData[key] = val;
        }
        else {

            delete hashData[key];
        }

        writeHash(hashData);
    };

    /**
     * Parses the key/value pairs from the hash in the passed URL.
     */
    const parseHash = (hash) => {

        if (!hash) return {};

        if (hash.startsWith("http") || hash.startsWith("/")) {
            hash = getHashPart(hash);
        }

        const hashData = {};

        if (hash) {

            const pairs = hash.split("&");

            for (let i = 0; i < pairs.length; i++) {

                const keyValue = splitHashPair(pairs[i]);

                hashData[keyValue.key] = keyValue.val;
            }
        }

        return hashData;
    };

    /**
     * Splits a key=value pair into its key and value components, decoding the value.  Allows the
     * value to contain the '=' character.
     */
    const splitHashPair = (pair) => {

        const index = pair.indexOf("=");

        const key = pair.substring(0, index);
        const val = pair.substring(index + 1);

        return { key: key, val: decodeURI(val) };
    };

    /**
     * Reads the key/value pairs from the hash in the address bar URL.  Returns an object.
     */
    const readHash = () => parseHash(getHashPart(window.location.href));

    /**
     * Updates the hash in the address bar URL.
     */
    const writeHash = hashData => {

        let hash = "";

        for (const h in hashData) {

            hash += "&" + h + "=" + hashData[h];
        }

        hash = "#" + hash.substring(1);

        location.href = location.href.split("#")[0] + hash;
    };

    /**
     * Updates the host page's links marked js-ren-report-generator-home-link, adding the hash to
     * them.  (The original URL is rendered in a data-* attribute to facilitate this.)
     */
    const updateHashInHyperlinks = () => {

        const hash = window.location.hash;

        document.querySelectorAll(".js-ren-report-generator-home-link").forEach((link) => {

            const url = link.getAttribute("data-original-url");
            link.href = url + hash;
        });
    };

    return {
        updateHash,
        addHashParameter,
        readHash,
        parseHash,
        writeHash,
        updateHashInHyperlinks
    };
})();
