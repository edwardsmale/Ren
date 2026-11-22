/**
 * Formats numbers to specifiers of the form [+][$][0][width][,][.precision]
 * [~] then f (fixed point) or % (multiplied by 100), as in "$,.2f" or ".1~%".  The currency,
 * separators and minus sign come from the formatting settings in ren.config.
 */
Ren.NumberFormat = (() => {

    const SPECIFIER_PATTERN = /^(\+|-)?(\$)?(0)?(\d+)?(,)?(?:\.(\d+))?(~)?([f%])$/;

    const DEFAULT_PRECISION = 6;

    const groupThousands = (integerDigits, separator) => {

        const firstGroupLength = integerDigits.length % 3 || 3;

        let result = integerDigits.substring(0, firstGroupLength);

        for (let i = firstGroupLength; i < integerDigits.length; i += 3) {
            result += separator + integerDigits.substring(i, i + 3);
        }

        return result;
    };

    const trimInsignificantZeros = (digits) => {

        if (digits.indexOf(".") === -1) return digits;

        let end = digits.length;

        while (digits.charAt(end - 1) === "0") end--;

        if (digits.charAt(end - 1) === ".") end--;

        return digits.substring(0, end);
    };

    /**
     * Creates a function formatting a number to the specifier with the specified settings, the
     * formatting section of ren.config.
     */
    const create = (settings, specifier) => {

        const match = SPECIFIER_PATTERN.exec(specifier);

        if (!match) throw new Error(`Unsupported number format specifier "${specifier}"`);

        const isPlusShown = match[1] === "+";
        const isCurrency = match[2] === "$";
        const isZeroFilled = match[3] === "0";
        const width = match[4] === undefined ? 0 : Number(match[4]);
        const isGrouped = match[5] === ",";
        const precision = match[6] === undefined ? DEFAULT_PRECISION : Number(match[6]);
        const isTrimmed = match[7] === "~";
        const isPercentage = match[8] === "%";

        const prefix = isCurrency ? settings.currencyPrefix : "";
        const suffix = (isCurrency ? settings.currencySuffix : "") + (isPercentage ? "%" : "");

        return (value) => {

            let number = +value;

            if (isPercentage) number *= 100;

            if (!isFinite(number)) return String(number);

            let digits = Math.abs(number).toFixed(precision);

            if (isTrimmed) digits = trimInsignificantZeros(digits);

            // A value that rounds to zero loses its minus sign unless signs are shown.
            const isNegative = (number < 0 || 1 / number < 0) && (isPlusShown || +digits !== 0);

            const pointIndex = digits.indexOf(".");

            let integerDigits = pointIndex === -1 ? digits : digits.substring(0, pointIndex);

            if (isGrouped) {
                integerDigits = groupThousands(integerDigits, settings.thousandsSeparator);
            }

            const fraction = pointIndex === -1
                ? ""
                : settings.decimalSeparator + digits.substring(pointIndex + 1);

            const sign = isNegative ? settings.minusSign : isPlusShown ? "+" : "";

            const body = integerDigits + fraction + suffix;
            const padding = width - sign.length - prefix.length - body.length;

            if (padding <= 0) return sign + prefix + body;

            // Zeros go after the sign and currency, and spaces before them.
            return isZeroFilled
                ? sign + prefix + "0".repeat(padding) + body
                : " ".repeat(padding) + sign + prefix + body;
        };
    };

    return {
        create
    };
})();
