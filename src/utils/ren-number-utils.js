/**
 * Functions for working with numbers.
 */
Ren.NumberUtils = (() => {

    /**
     * Clamps a number between a minimum and maximum value.
     */
    const clamp = (number, min, max) => {

        return Math.min(Math.max(number, min), max);
    };

    /**
     * Parses a string to a float.  If the string is not a valid number, returns null.
     */
    const parseNum = (value) => {

        const float = parseFloat(value);

        return isNaN(float) ? null : float;
    };

    /**
     * If the value is a string ending with a percentage sign, strips off the percentage sign and
     * divides the number by 100.  Otherwise, returns the value as is.
     */
    const convertPercentageStringToNumber = (value) => {

        if (value.toString().endsWith("%")) {

            const newValue = parseFloat(value.toString().replace("%", "")) * 0.01;

            if (!isNaN(newValue)) value = newValue;
        }

        return value;
    };

    /**
     * Rounds a number to a specified precision (default is 2 decimal places).
     */
    const round = (value, precision = 2) => {

        if (typeof value !== "number") return value;
        return parseFloat(value.toFixed(precision));
    };

    return {
        clamp,
        parseNum,
        convertPercentageStringToNumber,
        round
    };
})();
