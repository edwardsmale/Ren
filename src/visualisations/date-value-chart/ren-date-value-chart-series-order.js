/**
 * Moves a date/value chart's series among those it draws, which orders its bars side by side and
 * its stacks.  The legend runs by height, so stays as it was.  The series are drawn in the order
 * of their settings, so the settings are moved, and each series takes its colour and everything
 * else with it.
 */
Ren.DateValueChart_SeriesOrder = (() => {

    /**
     * Gets the series settings with the one at an index moved to another, among the first as many
     * as there are value headings, which are the series drawn.  Those after them, kept for series
     * not drawn, are left where they are.  Each series drawn is named by its column, as series
     * are ordered by their columns' names.  The settings given are left as they were.
     */
    const moveSeries = (seriesSettings, valueHeadings, fromIndex, toIndex) => {

        const settings = (seriesSettings || []).slice();
        const drawnCount = valueHeadings.length;

        if (fromIndex === toIndex
            || fromIndex < 0 || fromIndex >= drawnCount
            || toIndex < 0 || toIndex >= drawnCount) {

            return settings;
        }

        for (let i = 0; i < drawnCount; i++) {

            settings[i] = Object.assign({}, settings[i]);

            if (!settings[i].column) settings[i].column = valueHeadings[i];
        }

        const moved = settings.splice(fromIndex, 1)[0];

        settings.splice(toIndex, 0, moved);

        return settings;
    };

    return {
        moveSeries
    };
})();
