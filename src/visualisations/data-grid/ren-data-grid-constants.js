Ren.DataGridConstants = {
    rowHeight: 22, // The height of a datagrid row.
    scrollBarWidth: 17, // The width of a vertical scroll bar, in px.
    scrollBarHeight: 17, // The height of a horizontal scroll bar, in px.
    reportTabsHeight: 22,
    cellPadding: 4, // Padding inside each cell.  Must match the padding in the CSS.
    // The most the grid's content scrolls, in px.  Browsers draw content scrolled much further
    // imprecisely (Chrome loses cells or their borders from about 2^23 px), so a taller grid
    // scrolls this far and maps the scroll position across its rows in proportion.
    maxScrollableHeight: 4000000
};
