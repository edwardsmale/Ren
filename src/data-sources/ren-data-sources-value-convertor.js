/**
 * Used to convert values when converting tabular data set collections to data arrays.
 */
Ren.DataSourcesValueConvertor = (() => {

    /**
     * Convert the value to the specified data type.
     */
    const convertValue = (str, dataType) => {

        switch (dataType) {

            case "Date":
                return Ren.DateUtils.parseYYYYMMDD(str);
            case "DateTime":
                return Ren.DateUtils.parseDDMMYYYY_HHmmss(str);
            case "Number":
                return Ren.NumberUtils.parseNum(str);
            default:
                return str;
        }
    };

    return {
        convertValue
    };
})();
