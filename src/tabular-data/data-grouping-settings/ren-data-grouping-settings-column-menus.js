/**
 * The kind of filter window a column's down-arrow "Filter..." item opens.
 */
Ren.DefaultFilterTypeEnum = Ren.DefineEnum({
    DataRows: 0,
    Groups: 1
});

/**
 * Per-column down-arrow menu settings, keyed by column ID/heading, e.g.
 * { "Name": { defaultFilterType: Ren.DefaultFilterTypeEnum.DataRows } }.  Where none is set,
 * date and number columns default to filtering groups, and all others to filtering data rows.
 * Settings store only a column's default filter type that differs from that, as its enum key.
 */
Ren.DataGroupingSettingsColumnMenus = (() => {

    const getColumnModel = (tabularData, columnIdOrHeading) =>
        tabularData.ColumnModels[tabularData.columnResolver.getColumnIndex(columnIdOrHeading)];

    const getDefaultDefaultFilterType = (columnModel) => {

        const columnFormat = columnModel?.ColumnFormat;

        const isDateOrNumber = Ren.SpreadsheetColumnFormatEnum.IsDate(columnFormat) ||
            (Ren.SpreadsheetColumnFormatEnum.IsArithmetic(columnFormat) &&
                columnFormat !== Ren.SpreadsheetColumnFormatEnum.Boolean);

        return isDateOrNumber
            ? Ren.DefaultFilterTypeEnum.Groups
            : Ren.DefaultFilterTypeEnum.DataRows;
    };

    /**
     * Gets the column's default filter type, falling back to the one for its column type.
     */
    const getDefaultFilterType = (tabularData, columnMenus, columnIdOrHeading) =>
        columnMenus?.[columnIdOrHeading]?.defaultFilterType ??
            getDefaultDefaultFilterType(getColumnModel(tabularData, columnIdOrHeading));

    const setDefaultFilterType = (columnMenus, columnIdOrHeading, defaultFilterType) => {

        (columnMenus[columnIdOrHeading] ??= {}).defaultFilterType = defaultFilterType;
    };

    /**
     * Creates the runtime column menus from the settings' ones, giving every column a default
     * filter type.
     */
    const createColumnMenus = (tabularData, settingsColumnMenus) => {

        const columnMenus = Ren.ObjectUtils.clone(settingsColumnMenus ?? {});

        for (const columnIdOrHeading in columnMenus) {

            const columnMenu = columnMenus[columnIdOrHeading];

            if (columnMenu.defaultFilterType != null) {

                columnMenu.defaultFilterType = Ren.ObjectUtils.getEnumValue(
                    Ren.DefaultFilterTypeEnum,
                    columnMenu.defaultFilterType
                );
            }
        }

        const columnModels = tabularData.ColumnModels;

        for (let i = 0, len = columnModels.length; i < len; i++) {

            const columnMenu = (columnMenus[columnModels[i].ColumnIdOrHeading] ??= {});

            columnMenu.defaultFilterType ??= getDefaultDefaultFilterType(columnModels[i]);
        }

        return columnMenus;
    };

    /**
     * Transforms cloned column menus ready for serialisation, writing a column's default filter
     * type as its enum key, or dropping it where it is the one for the column type.
     */
    const transformColumnMenus = (tabularData, columnMenus) => {

        for (const columnIdOrHeading in columnMenus) {

            const columnMenu = columnMenus[columnIdOrHeading];

            const defaultFilterType = Ren.ObjectUtils.getEnumKey(
                Ren.DefaultFilterTypeEnum,
                getDefaultFilterType(tabularData, columnMenus, columnIdOrHeading)
            );

            const defaultForColumnType = Ren.ObjectUtils.getEnumKey(
                Ren.DefaultFilterTypeEnum,
                getDefaultDefaultFilterType(getColumnModel(tabularData, columnIdOrHeading))
            );

            if (defaultFilterType === defaultForColumnType) {

                delete columnMenu.defaultFilterType;

                if (Ren.ObjectUtils.isEmptyObject(columnMenu)) {
                    delete columnMenus[columnIdOrHeading];
                }
            }
            else {

                columnMenu.defaultFilterType = defaultFilterType;
            }
        }
    };

    return {
        getDefaultFilterType,
        setDefaultFilterType,
        createColumnMenus,
        transformColumnMenus
    };
})();
