/**
 * Enum for date/value chart bar layout modes.  Defines how bars are positioned when multiple series
 * are displayed: side-by-side, overlayed, or stacked.  On a chart split from several value columns,
 * the per-split layouts overlay or stack the series of each split value, and draw the split values
 * side-by-side.
 */
Ren.BarLayoutEnum = Ren.DefineEnum({
    SideBySide: 0,
    Overlayed: 1,
    Stacked: 2,
    OverlayedPerSplit: 3,
    StackedPerSplit: 4
});
