/**
 * State that applies to data rows i.e. leaf rows, not group rows.
 */
Ren.DataGroupingSettingsDataRows = () => {

    const columns = {};
    const filter = [];
    const sortOrder = {
        columnIndex: -1,
        isDescending: false,
        sortCalcFunction: null,
        thenBy: null
    };

    return {
        columns,
        filter,
        sortOrder
    };
};
