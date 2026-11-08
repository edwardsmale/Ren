/**
 * Functions for generating random data.
 */
Ren.RandomUtils = (() => {

    const rand8 = () => Math.floor(100000 + Math.random() * 900000);

    const generateRandomClassName = (prefix) => {

        prefix = prefix || "r";

        prefix = Ren.TextUtils.replaceNonWordChars(prefix, '-');

        if (!prefix.endsWith("-")) prefix += "-";

        if (prefix.length > 2) {

            prefix = prefix.replace(/[^a-zA-Z0-9-]/g, "-");
            prefix = prefix.replace(/--+/g, "-");
        }

        return prefix + rand8() + rand8();
    };

    /**
     * Simple seeded random number generator (mulberry32).
     */
    const mulberry32 = (seed) => {

        return function () {

            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    };

    return {
        generateRandomClassName,
        mulberry32
    };
})();
