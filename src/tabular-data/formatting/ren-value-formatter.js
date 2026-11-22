/**
 * Formats cell values for display in the report preview.
 */
Ren.ValueFormatter = (() => {

    const createFormatters = (settings) => {

        const create = (specifier) => Ren.NumberFormat.create(settings, specifier);

        return {
            settings,
            currency: create("$,.2f"),
            currencyNoDP: create("$,.0f"),
            percentage: create(".1%"),
            percentageNoDP: create(".0%"),
            integer: create(".0f"),
            integerPlus: create("+.0f"),
            number1DP: create(".1f"),
            number2DP: create(".2f"),
            numberPlus2DP: create("+.2f"),
            number3DP: create(".3f"),
            numberUpTo2DP: create(".2~f"),

            // The abbreviated formats state a value in the largest unit it reaches ("£32k",
            // "1.4m"), so group nothing: the scaled value they are handed is always under 1000.
            currencyAbbreviatedNoDP: create("$.0f"),
            currencyAbbreviated1DP: create("$.1f"),
            numberAbbreviatedNoDP: create(".0f"),
            numberAbbreviated1DP: create(".1f"),
            currencyAbbreviatedUpTo1DP: create("$.1~f"),
            numberAbbreviatedUpTo1DP: create(".1~f"),

            date: Ren.DatePattern.compile(settings.dateFormat),
            dateTime: Ren.DatePattern.compile(settings.dateTimeFormat)
        };
    };

    // Built from the formatting settings in ren.config when first needed, and again after the
    // config changes.
    let formatters = null;

    Ren.Config.onChange(() => {

        formatters = null;
    });

    const getFormatters = () =>
        formatters ??= createFormatters(Ren.Config.getConfig().formatting);

    /** Formats numbers to specifiers, such as ".1%", with the configured settings. */
    const locale = {
        format: (specifier) => Ren.NumberFormat.create(getFormatters().settings, specifier)
    };

    const currencyFormatter = value => getFormatters().currency(value);
    const currencyNoDPFormatter = value => getFormatters().currencyNoDP(value);
    const percentageFormatter = value => getFormatters().percentage(value);
    const percentageNoDPFormatter = value => getFormatters().percentageNoDP(value);
    const integerFormatter = value => getFormatters().integer(value);
    const integerPlusFormatter = value => getFormatters().integerPlus(value);
    const number1DPFormatter = value => getFormatters().number1DP(value);
    const number2DPFormatter = value => getFormatters().number2DP(value);
    const numberPlus2DPFormatter = value => getFormatters().numberPlus2DP(value);
    const number3DPFormatter = value => getFormatters().number3DP(value);
    const numberUpTo2DPFormatter = value => getFormatters().numberUpTo2DP(value);
    const currencyAbbreviatedNoDPFormatter =
        value => getFormatters().currencyAbbreviatedNoDP(value);
    const currencyAbbreviated1DPFormatter = value => getFormatters().currencyAbbreviated1DP(value);
    const numberAbbreviatedNoDPFormatter = value => getFormatters().numberAbbreviatedNoDP(value);
    const numberAbbreviated1DPFormatter = value => getFormatters().numberAbbreviated1DP(value);
    const currencyAbbreviatedUpTo1DPFormatter =
        value => getFormatters().currencyAbbreviatedUpTo1DP(value);
    const numberAbbreviatedUpTo1DPFormatter =
        value => getFormatters().numberAbbreviatedUpTo1DP(value);

    /** Gets the Excel number formats matching the configured currency and dates. */
    const getExcelFormats = () => {

        const settings = getFormatters().settings;
        const quote = text => text ? "\"" + text.replace(/"/g, "") + "\"" : "";

        return {
            currency: quote(settings.currencyPrefix) + "0.00" + quote(settings.currencySuffix),
            date: Ren.DatePattern.toExcelFormat(settings.dateFormat),
            dateTime: Ren.DatePattern.toExcelFormat(settings.dateTimeFormat)
        };
    };

    // Largest first.  The last is for a value too small to abbreviate, so 950 stays "950".
    const ABBREVIATION_UNITS = [
        { divisor: 1e12, suffix: "t" },
        { divisor: 1e9, suffix: "bn" },
        { divisor: 1e6, suffix: "m" },
        { divisor: 1e3, suffix: "k" },
        { divisor: 1, suffix: "" }
    ];

    const dateCache = new Map();

    const ensureTwoDigits = value => value == null ? "00" : String(value).padStart(2, "0");

    const parseDateParts = date => {

        if (typeof date === "string" && dateCache.has(date)) {
            return dateCache.get(date);
        }
        let d, m, y;

        if (typeof date === "object" && typeof date.getMonth === "function") {

            m = ensureTwoDigits(date.getMonth() + 1);
            d = ensureTwoDigits(date.getDate());
            y = date.getFullYear();
        }
        else if (typeof date === "string" && (date.length === 10 || date.length === 19)) {

            const [datePart] = date.split(" ");
            const parts = datePart.split("-");

            if (parts.length === 3) {

                d = ensureTwoDigits(parts[2].substring(0, 2));
                m = ensureTwoDigits(parts[1]);
                y = parts[0];
            }
            else {

                const slashParts = datePart.split("/");

                if (slashParts.length === 3) {

                    d = ensureTwoDigits(slashParts[0]);
                    m = ensureTwoDigits(slashParts[1]);
                    y = slashParts[2];
                }
            }
        }

        if (d && m && y) {

            const result = { day: d, month: m, year: y };
            if (typeof date === "string") dateCache.set(date, result);
            return result;
        }
        return null;
    };

    const parseDateTimeParts = date => {

        if (typeof date === "string" && dateCache.has(date + "_dt")) {
            return dateCache.get(date + "_dt");
        }
        let d, m, y, h = "00", min = "00", s = "00";

        if (typeof date === "object" && typeof date.getMonth === "function") {

            m = ensureTwoDigits(date.getMonth() + 1);
            d = ensureTwoDigits(date.getDate());
            y = date.getFullYear();
            h = ensureTwoDigits(date.getHours());
            min = ensureTwoDigits(date.getMinutes());
            s = ensureTwoDigits(date.getSeconds());
        }
        else if (typeof date === "string" && (date.length === 10 || date.length === 19)) {

            const [datePart, timePart] = date.split(" ");
            const parts = datePart.split("-");

            if (parts.length === 3) {

                d = ensureTwoDigits(parts[2].substring(0, 2));
                m = ensureTwoDigits(parts[1]);
                y = parts[0];
            }
            else {

                const slashParts = datePart.split("/");

                if (slashParts.length === 3) {

                    d = ensureTwoDigits(slashParts[0]);
                    m = ensureTwoDigits(slashParts[1]);
                    y = slashParts[2];
                }
            }

            if (timePart) {

                const timeParts = timePart.split(":");
                h = ensureTwoDigits(timeParts[0]);
                min = ensureTwoDigits(timeParts[1]);
                s = timeParts.length > 2 ? ensureTwoDigits(timeParts[2]) : "00";
            }
        }

        if (d && m && y) {

            const result = { day: d, month: m, year: y, hour: h, minute: min, second: s };
            if (typeof date === "string") dateCache.set(date + "_dt", result);
            return result;
        }
        return null;
    };

    /**
     * Gets a function that caches the results of the specified string-to-string function, which
     * must depend on nothing but its argument.  Parsing HTML is costly and the values a column
     * holds repeat, so most cells are rewritten from the cache.
     */
    const cacheHtmlRewrite = (rewrite) => {

        const cache = new Map();

        return (html) => {

            let result = cache.get(html);
            if (result !== undefined) return result;

            result = rewrite(html);

            if (cache.size >= 10000) cache.clear();
            cache.set(html, result);
            return result;
        };
    };

    const linkDiv = document.createElement("div");

    // Marks the links that open in a new window, so that they show an external-link icon.
    const markExternalLinks = cacheHtmlRewrite(htmlValue => {

        linkDiv.innerHTML = htmlValue;
        const links = linkDiv.querySelectorAll("a[target='_blank']");

        for (let i = 0; i < links.length; i++) {

            if (links[i].innerHTML.length) {
                links[i].classList.add("ren-external-link");
            }
        }
        return linkDiv.innerHTML;
    });

    const addExternalLinkClassToExternalLinks = htmlValue => {

        if (!htmlValue || typeof htmlValue !== "string" || htmlValue.charAt(0) !== "<" || htmlValue.indexOf("_blank") === -1) {
            return htmlValue;
        }

        return markExternalLinks(htmlValue);
    };

    // Marks a format function's own "#VALUE!" span as a cell error.
    const markCellError = cacheHtmlRewrite(html => {

        const error = Ren.HtmlUtils.create(html);
        error.classList.add("ren-data-grid__cell-error");
        return error.outerHTML;
    });

    const formatDate_dd_MMM_yyyy = date => {

        const dateParts = parseDateParts(date);
        if (!dateParts) return date;
        return dateParts.day + " " + Ren.DateUtils.monthNamesAbbrv[parseInt(dateParts.month, 10) - 1] + " " + dateParts.year;
    };

    const formatDate_MMM_yyyy = date => {

        const dateParts = parseDateParts(date);
        if (!dateParts) return date;
        return Ren.DateUtils.monthNamesAbbrv[parseInt(dateParts.month, 10) - 1] + " " + dateParts.year;
    };

    const formatDate_ddMMyyyy = date => {

        const dateParts = parseDateParts(date);
        if (!dateParts) return date;
        return dateParts.day + "/" + dateParts.month + "/" + dateParts.year;
    };

    const formatDate_ddMMyyyy_HHmmss = date => {

        const dateTimeParts = parseDateTimeParts(date);
        if (!dateTimeParts) return date;
        return dateTimeParts.day + "/" + dateTimeParts.month + "/" + dateTimeParts.year +
            " " + dateTimeParts.hour + ":" + dateTimeParts.minute + ":" + dateTimeParts.second;
    };

    const formatDate_HHmmss = date => {

        const dateTimeParts = parseDateTimeParts(date);
        if (!dateTimeParts) return date;
        return dateTimeParts.hour + ":" + dateTimeParts.minute + ":" + dateTimeParts.second;
    };

    /** Formats a date in the configured date format, leaving out any time of day. */
    const formatDate = date => {

        const dateTimeParts = parseDateTimeParts(date);
        if (!dateTimeParts) return date;
        return getFormatters().date(dateTimeParts);
    };

    /** Formats a date and its time of day in the configured date and time format. */
    const formatDateTime = date => {

        const dateTimeParts = parseDateTimeParts(date);
        if (!dateTimeParts) return date;
        return getFormatters().dateTime(dateTimeParts);
    };

    /**
     * Formats a Date or DateTime column's value: a yyyy-MM-dd date in the configured date format,
     * or with its time of day in the configured date and time format.  Other text is left as it is.
     */
    const formatDateColumnValue = value => {

        if (!value) return "";

        if (typeof value === "object" && typeof value.getMonth === "function") {
            return formatDate(value);
        }

        if (typeof value === "string" && (value.length === 10 || value.length === 19) &&
            value.split(" ")[0].split("-").length === 3) {

            return value.length === 19 && value.charAt(10) === " "
                ? formatDateTime(value)
                : formatDate(value);
        }
        return value;
    };

    const formatNumber = (value, formatter) => {

        // Number() is strict: "5，6，7" → NaN, returned as-is.  parseFloat would return 5 and
        // silently discard the remaining values in multi-value aggregation strings.
        const float = Number(value);
        if (isNaN(float)) return value;
        return formatter(float);
    };

    const formatGeneral = value => {

        let result = value.toString();

        if (result && result.charAt(0) === "<") {
            result = addExternalLinkClassToExternalLinks(result);
        }
        return result;
    };

    const formatValue = (value, columnIndex, format, formatFunction, rowVals, groupSummaryStats,
        overallSummaryStats, compressedRowVals) => {

        let formattedValue = doFormatValue(value, format, formatFunction, rowVals,
            columnIndex, groupSummaryStats, overallSummaryStats, compressedRowVals);

        if (formattedValue === undefined) {

            const error = Ren.HtmlUtils.create("span")
                ._text("#VALUE!")
                ._attr("title", "Format function didn't return a value");
            error.classList.add("ren-data-grid__cell-error");
            formattedValue = error.outerHTML;
        }
        else if (typeof formattedValue === "string" && formattedValue.endsWith("#VALUE!</span>")) {

            formattedValue = markCellError(formattedValue);
        }

        formattedValue = addExternalLinkClassToExternalLinks(formattedValue);

        return formattedValue;
    };

    const formatCurrency = value => formatNumber(value, currencyFormatter);
    const formatCurrencyNoDP = value => formatNumber(value, currencyNoDPFormatter);
    const formatNumberNoDP = value => formatNumber(value, integerFormatter);
    const formatNumber1DP = value => formatNumber(value, number1DPFormatter);
    const formatNumber2DP = value => formatNumber(value, number2DPFormatter);
    const formatNumber3DP = value => formatNumber(value, number3DPFormatter);
    const formatNumberAllDP = value => formatNumber(value, number => {

        const settings = getFormatters().settings;
        let text = String(number);

        if (settings.decimalSeparator !== ".") text = text.replace(".", settings.decimalSeparator);

        return text.replace(/^-/, settings.minusSign);
    });

    /**
     * Rounds a value half away from zero, with its binary representation error taken out first:
     * 1.45 is held as a shade under 1.45, so would otherwise round to "1.4".
     */
    const roundToDecimalPlaces = (value, decimalPlaces) => {

        const factor = Math.pow(10, decimalPlaces);

        // Twelve significant figures drop the representation error, so 14.499999999999998 rounds
        // as 14.5.
        const scaled = Number((Math.abs(value) * factor).toPrecision(12));

        const rounded = Math.round(scaled) / factor;

        return value < 0 ? -rounded : rounded;
    };

    /**
     * Gets the unit an unsigned magnitude is stated in: the largest it reaches, stepping up where
     * rounding would make it a thousand of that unit, so 999,960 reads as "1m" rather than "1000k".
     */
    const chooseAbbreviationUnit = (magnitude, decimalPlaces) => {

        for (let i = 0; i < ABBREVIATION_UNITS.length; i++) {

            const unit = ABBREVIATION_UNITS[i];

            if (magnitude < unit.divisor) continue;

            const rounded = roundToDecimalPlaces(magnitude / unit.divisor, decimalPlaces);

            if (rounded >= 1000 && i > 0) return ABBREVIATION_UNITS[i - 1];

            return unit;
        }

        return ABBREVIATION_UNITS[ABBREVIATION_UNITS.length - 1];
    };

    /**
     * Formats a value in the largest unit it reaches ("£32k" rather than "£32,000"), or returns
     * it as it is where it is not a number.
     */
    const formatAbbreviated = (value, decimalPlaces, formatter) => {

        if (value == null || value === "") return "";

        const float = Number(value);

        if (isNaN(float)) return value;

        const unit = chooseAbbreviationUnit(Math.abs(float), decimalPlaces);

        return formatter(roundToDecimalPlaces(float / unit.divisor, decimalPlaces)) +
            unit.suffix;
    };

    /**
     * Formats a value in the largest unit it reaches, keeping a decimal place only where the
     * figure has a single digit before it ("£1.5m", but "£600k" rather than "£600.1k").  A
     * trailing ".0" is dropped, so 2,000,000 reads as "£2m".
     */
    const formatAbbreviatedAutoDP = (value, upTo1DPFormatter, noDPFormatter) => {

        if (value == null || value === "") return "";

        const float = Number(value);

        if (isNaN(float)) return value;

        const unit = chooseAbbreviationUnit(Math.abs(float), 0);

        const scaled = float / unit.divisor;

        // Decided on the rounded figure, so 9.96k reads as "10k" rather than "10.0k".
        const rounded1DP = roundToDecimalPlaces(scaled, 1);

        if (Math.abs(rounded1DP) < 10) return upTo1DPFormatter(rounded1DP) + unit.suffix;

        return noDPFormatter(roundToDecimalPlaces(scaled, 0)) + unit.suffix;
    };

    const formatCurrencyAbbreviatedNoDP = value =>
        formatAbbreviated(value, 0, currencyAbbreviatedNoDPFormatter);

    const formatCurrencyAbbreviated1DP = value =>
        formatAbbreviated(value, 1, currencyAbbreviated1DPFormatter);

    const formatNumberAbbreviatedNoDP = value =>
        formatAbbreviated(value, 0, numberAbbreviatedNoDPFormatter);

    const formatNumberAbbreviated1DP = value =>
        formatAbbreviated(value, 1, numberAbbreviated1DPFormatter);

    const formatCurrencyAbbreviatedAutoDP = value => formatAbbreviatedAutoDP(
        value,
        currencyAbbreviatedUpTo1DPFormatter,
        currencyAbbreviatedNoDPFormatter
    );

    const formatNumberAbbreviatedAutoDP = value => formatAbbreviatedAutoDP(
        value,
        numberAbbreviatedUpTo1DPFormatter,
        numberAbbreviatedNoDPFormatter
    );

    /**
     * Formats a value in thousands, whatever its size, with no decimal places ("£32k", and
     * "£1,450k" rather than "£1.5m"), or returns it as it is where it is not a number.
     */
    const formatThousands = (value, formatter) => {

        if (value == null || value === "") return "";

        const float = Number(value);

        if (isNaN(float)) return value;

        return formatter(roundToDecimalPlaces(float / 1000, 0)) + "k";
    };

    const formatCurrencyThousands = value => formatThousands(value, currencyNoDPFormatter);

    const formatNumberThousands = value => formatThousands(value, integerFormatter);

    const formatNumberPlusNoDP = value => {

        const formattedNumber = formatNumber(value, integerPlusFormatter);
        return formattedNumber === "+0" ? "0" : formattedNumber;
    };

    const formatNumberPlus2DP = value => {

        const formattedNumber = formatNumber(value, numberPlus2DPFormatter);
        return formattedNumber === "+0.00" ? "0.00" : formattedNumber;
    };

    const formatPercentage = (value, formatter) => {

        if (value == null || value === "") return "";
        if (value === Ren.NullSentinel) return value;
        return formatNumber(value * 100, formatter) + "%";
    };

    const formatPercentageDiv100 = (value, formatter) => {

        if (value == null || value === "") return "";
        if (value === Ren.NullSentinel) return value;
        return formatNumber(value, formatter) + "%";
    };

    const formatPercentageNoDP = value => formatPercentage(value, integerFormatter);
    const formatPercentage1DP = value => formatPercentage(value, number1DPFormatter);
    const formatPercentage2DP = value => formatPercentage(value, number2DPFormatter);
    const formatPercentage3DP = value => formatPercentage(value, number3DPFormatter);

    const formatPercentageDiv100NoDP = value => formatPercentageDiv100(value, integerFormatter);
    const formatPercentageDiv1001DP = value => formatPercentageDiv100(value, number1DPFormatter);
    const formatPercentageDiv1002DP = value => formatPercentageDiv100(value, number2DPFormatter);
    const formatPercentageDiv1003DP = value => formatPercentageDiv100(value, number3DPFormatter);

    const nullsAsZero = value => (value === "" || value === Ren.NullSentinel ? "0" : value);

    const doFormatValue = (value, format, formatFunction, rowVals, columnIndex, groupSummaryStats,
        overallSummaryStats, compressedRowVals) => {

        if (!formatFunction?.length) return formatValueSimple(value, format);
        return formatValueWithFormatFunction(
            value,
            formatFunction,
            rowVals,
            columnIndex,
            groupSummaryStats,
            overallSummaryStats,
            compressedRowVals
        );
    };

    const formatValueWithFormatFunction = (value, formatFunction, rowVals, columnIndex,
        groupSummaryStats, overallSummaryStats, compressedRowVals) => {

        for (let i = 0, len = formatFunction.length; i < len; i++) {

            const func = formatFunction[i];

            try {

                value = func(
                    value,
                    rowVals,
                    (groupSummaryStats && groupSummaryStats[columnIndex]) || null,
                    (overallSummaryStats && overallSummaryStats[columnIndex]) || null,
                    compressedRowVals
                );

            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[ValueFormatter] Error executing format function:",
                    e
                );

                return `<span title="Error executing format function: ${e}">Error</span>`;
            }
        }

        // A binning function's "<sort key>¬<display text>" shows its text alone. Stripped once the
        // whole chain has run, so a function following a binning one still sees the sort key.
        return Ren.TextUtils.stripSortPrefix(value);
    };

    const formatValueSimple = (value, format) => {

        if (value == null || value === "") return "";

        if (typeof value === "string" && value.includes("¬")) {

            const sepIndex = value.indexOf("¬");
            return value.substring(sepIndex + 1);
        }

        if (format === Ren.SpreadsheetColumnFormatEnum.IndexedString) {

            if (typeof Ren.IndexedStringUtils !== 'undefined') {

                return Ren.IndexedStringUtils.getText(value);
            }
            else {

                if (typeof value === "string" && value.includes("¬")) {

                    const sepIndex = value.indexOf("¬");
                    return value.substring(sepIndex + 1);
                }
                return value;
            }
        }

        switch (format) {

            case Ren.SpreadsheetColumnFormatEnum.General:
                return formatGeneral(value);
            case Ren.SpreadsheetColumnFormatEnum.Number:
                return formatNumber(value, numberUpTo2DPFormatter);
            case Ren.SpreadsheetColumnFormatEnum.Integer:
                return formatNumber(value, integerFormatter);
            case Ren.SpreadsheetColumnFormatEnum.Currency:
                return formatNumber(value, currencyFormatter);
            case Ren.SpreadsheetColumnFormatEnum.Percentage:
                return formatNumber(value, v => number2DPFormatter(v * 100) + "%");
            case Ren.SpreadsheetColumnFormatEnum.Date:
                return formatDateColumnValue(value);
            case Ren.SpreadsheetColumnFormatEnum.DateTime:
                return formatDateColumnValue(value);
            case Ren.SpreadsheetColumnFormatEnum.Boolean:
                // A value is 1 or 0, but a total is by default their average.
                return formatNumber(value, numberUpTo2DPFormatter);
            default:
                return formatGeneral(value);
        }
    };

    return {
        locale,
        nullsAsZero,
        formatDate_dd_MMM_yyyy,
        formatDate_MMM_yyyy,
        formatDate_ddMMyyyy,
        formatDate_ddMMyyyy_HHmmss,
        formatDate_HHmmss,
        formatDate,
        formatDateTime,
        getExcelFormats,
        formatValue,
        formatValueSimple,
        formatCurrency,
        formatCurrencyNoDP,
        formatNumberNoDP,
        formatNumber1DP,
        formatNumber2DP,
        formatNumber3DP,
        formatNumberAllDP,
        formatCurrencyAbbreviatedNoDP,
        formatCurrencyAbbreviated1DP,
        formatNumberAbbreviatedNoDP,
        formatNumberAbbreviated1DP,
        formatCurrencyAbbreviatedAutoDP,
        formatNumberAbbreviatedAutoDP,
        formatCurrencyThousands,
        formatNumberThousands,
        formatNumberPlusNoDP,
        formatNumberPlus2DP,
        formatPercentageNoDP,
        formatPercentage1DP,
        formatPercentage2DP,
        formatPercentage3DP,
        formatPercentageDiv100NoDP,
        formatPercentageDiv1001DP,
        formatPercentageDiv1002DP,
        formatPercentageDiv1003DP,
        currencyFormatter,
        currencyNoDPFormatter,
        percentageFormatter,
        percentageNoDPFormatter,
        integerFormatter,
        integerPlusFormatter,
        number2DPFormatter,
        numberPlus2DPFormatter,
        number3DPFormatter,
        numberUpTo2DPFormatter
    };
})();
