/**
 * Provides the styles to use for the totals row of a datagrid.
 */
Ren.TotalsRowStyleProvider = () => {

    const getTotalsRowStyles = () => {

        const border = Ren.Theme.cssValue("data-grid-totals-row-border", "1px #BBBBBB");
        const background = Ren.Theme.cssValue("data-grid-totals-row-background", "#EEEEEE");

        return "border-top: solid " + border + "; border-bottom: solid " + border +
            "; background-color: " + background +
            "; font-weight: bold!important";
    };

    return {
        getTotalsRowStyles
    };
};
