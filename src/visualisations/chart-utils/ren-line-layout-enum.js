/**
 * Enum for date/value chart line layout modes.  Defines how the lines of several series are drawn
 * together: overlayed, each from zero, or stacked, each standing on the line below it on its axis.
 */
Ren.LineLayoutEnum = Ren.DefineEnum({
    Overlayed: 0,
    Stacked: 1
});
