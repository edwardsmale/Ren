Ren.GridState_Initial = (() => {

    /**
     * Gets any grid state loaded from the web report's JSON file.  Where the grid's
     * data tabs are given, a tab whose query has changed since its grid state was saved is given
     * the grid state saved against its query instead.
     *
     * @param {string} gridStateGroup - The grid state group to find settings for.
     * @param {Object} reportSettings - The report settings containing gridState entries.
     * @param {Object} tabs - The visualisation's data tabs (optional; see
     *   Ren.SettingsEmbeddingMatcher.findSettingsForTab).
     * @param {number} tabIndex - The index of the grid's data tab among them.
     * @returns {Object|null} The grid state settings or null if none found.
     */
    const getInitialGridState = (gridStateGroup, reportSettings, tabs, tabIndex) => {

        const allGridState = reportSettings?.gridState;

        if (!allGridState) return null;
        if (!tabs) return allGridState[gridStateGroup] ?? null;

        const match = Ren.SettingsEmbeddingMatcher.findSettingsForTab(
            tabIndex,
            tabs,
            allGridState
        );

        if (!match) return null;

        if (match.key === gridStateGroup && !match.columnNames) {
            return allGridState[gridStateGroup];
        }

        const matchedGridState = Ren.ObjectUtils.clone(allGridState[match.key]);

        // Include the columns the matched settings were saved against, so that new columns (not
        // among those) can remain visible instead of being hidden.  Taken from the settings rather
        // than the key, which only lists columns on the Editor path - a web report's key is its
        // SQL filename.
        if (match.columnNames?.length) {
            matchedGridState.originalColumns = match.columnNames;
        }

        return matchedGridState;
    };

    return {
        getInitialGridState
    };
})();

