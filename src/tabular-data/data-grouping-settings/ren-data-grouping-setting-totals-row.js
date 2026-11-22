Ren.DataGroupingSettings_TotalsRow = (() => {

    /**
     * Sets the totals row position according to the visualisation's setting (i.e. passed as an
     * attribute of the ren-data-grid element).
     */
    const setTotalsRowPositionAccordingToVisualisation = (visualisation, setTotalsRowPosition) => {

        const value = visualisation.totalsRow;

        if (value === false) {
            setTotalsRowPosition(Ren.DataGridTotalsRowPositionEnum.None);
        }
        else if (value === true) {

            setTotalsRowPosition(Ren.DataGridTotalsRowPositionEnum.Bottom);
        }
        else {

            const enumValue = Ren.ObjectUtils.getEnumValue(
                Ren.DataGridTotalsRowPositionEnum,
                value,
                Ren.DataGridTotalsRowPositionEnum.Bottom
            );

            setTotalsRowPosition(enumValue);
        }
    };

    return {
        setTotalsRowPositionAccordingToVisualisation
    };
})();
