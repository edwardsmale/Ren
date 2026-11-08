/**
 * Saves the data a date/value chart plots as a CSV or Excel file, or copies it as tab-separated
 * text for pasting into a spreadsheet: a row per period, with a column for its date then one for
 * each series shown.  The values are those drawn, so running totals and shares are saved as such,
 * and are kept as numbers so that a spreadsheet can work with them, rounded to the places their
 * format shows, as a total of the data's rows can carry many more than the chart shows.  Any one
 * of a multi-chart's charts exports them all.
 */
Ren.DateValueChart_DataExport = (() => {

    const LINE_END = "\r\n";

    // Excel reads a file as UTF-8 only where it starts with a byte order mark.
    const BYTE_ORDER_MARK = "﻿";

    // A spreadsheet takes a text starting with one of these for a formula.
    const FORMULA_STARTS = "=+-@";

    // A value in no format of its own keeps this many significant figures, losing only the
    // noise adding fractions leaves, and staying within the 15 a spreadsheet can hold as a number.
    const SIGNIFICANT_FIGURES = 12;

    const pad = (value) => (value < 10 ? "0" : "") + value;

    /**
     * Formats a date as yyyy-MM-dd, with the time where it has one.
     */
    const formatDate = (date) => {

        const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

        if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            return day;
        }

        return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    /**
     * Writes a value as a CSV field: quoted where it holds a comma, a quote or a line break, and
     * a text that a spreadsheet would run as a formula made plain text.
     */
    const toField = (value) => {

        if (value === null || value === undefined) return "";

        if (value instanceof Date) return isNaN(value.getTime()) ? "" : formatDate(value);

        if (typeof value === "number") return isFinite(value) ? String(value) : "";

        let text = String(value);

        if (text.length > 0 && FORMULA_STARTS.indexOf(text[0]) !== -1) text = "'" + text;

        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };

    /**
     * Writes a value as a field of tab-separated text, as a spreadsheet takes it from the
     * clipboard: a tab or line break within it becomes a space, as it would split the field.
     */
    const toTabField = (value) => {

        let text = toField(value);

        if (text[0] === "\"") text = text.slice(1, -1).replace(/""/g, "\"");

        return text.replace(/[\t\r\n]+/g, " ");
    };

    /**
     * Gets the series shown, as { index, heading, name }.
     */
    const getShownSeries = (props) => {

        const shown = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!series || series.isEnabled === false) continue;

            shown.push({
                index: i,
                heading: props.valueHeadings[i],
                name: series.label || props.valueHeadings[i],
                format: props.valueColumnFormats?.[i]
            });
        }

        return shown;
    };

    /**
     * Gets a value rounded to the places its format shows: money to pence, a whole number to
     * units and a percentage, held as a fraction, to hundredths of a percent.  Anything else keeps
     * as many significant figures as a spreadsheet can hold.  A non-number is left as it is.
     */
    const roundValue = (value, format) => {

        if (typeof value !== "number" || !isFinite(value)) return value;

        switch (format) {

            case Ren.SpreadsheetColumnFormatEnum.Currency:
                return Math.round(value * 100) / 100;

            case Ren.SpreadsheetColumnFormatEnum.Integer:
                return Math.round(value);

            case Ren.SpreadsheetColumnFormatEnum.Percentage:
                return Math.round(value * 10000) / 10000;

            default:
                return Number(value.toPrecision(SIGNIFICANT_FIGURES));
        }
    };

    /**
     * Gets the chart's plotted data as lines of fields, over the series shown.
     */
    const buildText = (props, rows, separator, writeField) => {

        const shown = getShownSeries(props);
        const names = [props.dateHeading || "Date"].concat(shown.map(series => series.name));

        const lines = [names.map(writeField).join(separator)];

        for (let i = 0; i < (rows || []).length; i++) {

            const fields = [writeField(rows[i][props.dateHeading])];

            for (let j = 0; j < shown.length; j++) {
                fields.push(writeField(roundValue(rows[i][shown[j].heading], shown[j].format)));
            }

            lines.push(fields.join(separator));
        }

        return lines.join(LINE_END) + LINE_END;
    };

    const buildCsv = (props, rows) => buildText(props, rows, ",", toField);

    const buildTsv = (props, rows) => buildText(props, rows, "\t", toTabField);

    /**
     * Gets what a chart exports: the chart itself, or where it is one of a multi-chart's charts,
     * every chart's rows, oldest first, over every series any of them shows, as each chart holds
     * only its own period's rows and series.
     */
    const getExportedChart = (props) => {

        const legendProps = Ren.DateValueChart_MultiChart.getSharedLegendProps(props);
        const charts = legendProps?.sharedLegendCharts;

        if (!charts || charts.length < 2) return props;

        const exported = {
            dateHeading: props.dateHeading,
            seriesCount: 0,
            series: [],
            valueHeadings: [],
            valueColumnFormats: [],
            plottedData: []
        };

        for (let chartIndex = 0; chartIndex < charts.length; chartIndex++) {

            const shown = getShownSeries(charts[chartIndex]);

            exported.plottedData = exported.plottedData.concat(
                charts[chartIndex].plottedData || []
            );

            for (let i = 0; i < shown.length; i++) {

                if (exported.valueHeadings.indexOf(shown[i].heading) !== -1) continue;

                exported.series.push({ label: shown[i].name });
                exported.valueHeadings.push(shown[i].heading);
                exported.valueColumnFormats.push(shown[i].format);
                exported.seriesCount++;
            }
        }

        return exported;
    };

    const downloadCsv = (props) => {

        if (!props.plottedData) return;

        const chart = getExportedChart(props);

        Ren.DateValueChart_ImageExport.saveBlob(
            new Blob(
                [BYTE_ORDER_MARK + buildCsv(chart, chart.plottedData)],
                { type: "text/csv;charset=utf-8" }
            ),
            Ren.DateValueChart_ImageExport.getFileName(props, "csv")
        );
    };

    /**
     * Gets a value indicating whether the browser lets a page put text on the clipboard.
     */
    const canCopyText = () => typeof navigator.clipboard?.writeText === "function";

    /**
     * Puts the chart's plotted data on the clipboard as tab-separated text, which a spreadsheet
     * pastes into a cell each.
     */
    const copyTsv = (props) => {

        if (!props.plottedData) return Promise.resolve();

        const chart = getExportedChart(props);

        return navigator.clipboard.writeText(buildTsv(chart, chart.plottedData));
    };

    /**
     * Gets the Excel number format a series' values are shown in, or null for a plain number.
     */
    const getExcelNumberFormat = (format, excelFormats) => {

        switch (format) {

            case Ren.SpreadsheetColumnFormatEnum.Integer: return "0";
            case Ren.SpreadsheetColumnFormatEnum.Currency: return excelFormats.currency;
            case Ren.SpreadsheetColumnFormatEnum.Percentage: return "0.00%";
            default: return null;
        }
    };

    const isValidDate = (value) => value instanceof Date && !isNaN(value.getTime());

    const hasTime = (date) =>
        date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;

    /**
     * Gets a date at the same wall-clock time in UTC, as the Excel writer reads a date in UTC, so
     * that a period starting at midnight in summer time isn't written as the day before.
     */
    const toExcelDate = (date) => new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    ));

    /**
     * Gets the chart's plotted data as an Excel sheet, as { schema, objects }: a column for the
     * dates, shown with their times where any has one, then a column for each series shown, in
     * the series' own format.  Each object is keyed by its column's place, so that a series named
     * as the dates are can't take their column.
     */
    const buildExcelSheet = (props, rows, excelFormats) => {

        const shown = getShownSeries(props);
        const dates = (rows || []).map(row => row[props.dateHeading]);
        const dateFormat = dates.some(date => isValidDate(date) && hasTime(date))
            ? excelFormats.dateTime
            : excelFormats.date;

        const schema = [{
            column: props.dateHeading || "Date",
            type: Date,
            format: dateFormat,
            width: 14,
            value: object => object[0]
        }];

        for (let i = 0; i < shown.length; i++) {

            const column = {
                column: shown[i].name,
                type: Number,
                width: Math.max(12, Math.min(String(shown[i].name).length + 2, 40)),
                value: object => object[i + 1]
            };

            const numberFormat = getExcelNumberFormat(
                props.valueColumnFormats?.[shown[i].index],
                excelFormats
            );

            if (numberFormat) column.format = numberFormat;

            schema.push(column);
        }

        const objects = (rows || []).map((row, rowIndex) => {

            const object = [isValidDate(dates[rowIndex]) ? toExcelDate(dates[rowIndex]) : null];

            for (let i = 0; i < shown.length; i++) {

                const value = roundValue(row[shown[i].heading], shown[i].format);

                object.push(typeof value === "number" && isFinite(value) ? value : null);
            }

            return object;
        });

        return { schema, objects };
    };

    /**
     * Gets a value indicating whether the page has the Excel writer the data grids save with.
     */
    const canDownloadExcel = () => typeof window.writeXlsxFile === "function";

    /**
     * Saves the chart's plotted data as an Excel file, its sheet named as the file is.
     */
    const downloadExcel = (props) => {

        if (!props.plottedData || !canDownloadExcel()) return;

        const chart = getExportedChart(props);
        const sheet = buildExcelSheet(
            chart,
            chart.plottedData,
            Ren.ValueFormatter.getExcelFormats()
        );

        const fileName = Ren.DateValueChart_ImageExport.getFileName(props, "xlsx");

        // A sheet's name can't hold some characters, nor run past 31.
        const sheetName = fileName
            .replace(/\.xlsx$/, "")
            .replace(/[\\/*?:[\]]/g, " ")
            .substring(0, 31);

        window.writeXlsxFile(sheet.objects, {
            schema: sheet.schema,
            sheet: sheetName,
            fileName,
            fontFamily: "Calibri",
            fontSize: 11,
            stickyRowsCount: 1
        });
    };

    return {
        formatDate,
        toField,
        toTabField,
        buildCsv,
        buildTsv,
        buildExcelSheet,
        roundValue,
        downloadCsv,
        canCopyText,
        copyTsv,
        canDownloadExcel,
        downloadExcel
    };
})();
