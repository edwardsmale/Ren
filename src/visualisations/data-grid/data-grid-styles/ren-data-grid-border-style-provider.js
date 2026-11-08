/**
 * Calculates colours to use for the totals row of a datagrid.
 */
Ren.BorderStyleProvider = () => {

    const edgeBorder = () => Ren.Theme.cssValue("data-grid-edge-border", "1px #CCCCCC");

    const lastColumnBorder = () => "border-right: solid " + edgeBorder();
    const lastRowBorder = () => "border-bottom: solid " + edgeBorder();

    return {
        lastColumnBorder,
        lastRowBorder
    };
};
