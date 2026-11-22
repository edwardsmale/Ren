/**
 * Resolves the column references held in sort orders to column indexes.
 */
Ren.SortOrderResolver = (() => {

    /**
     * Resolves the "then by" sort levels of a sortOrder to column indexes, dropping any levels
     * whose column does not exist.  Levels may hold a columnIndex (runtime clones) or a column
     * ID/heading (transformed/serialised settings).  Returns null when no valid levels remain.
     */
    const resolveThenBySortLevels = (columnResolver, thenByToApply) => {

        if (!thenByToApply || !thenByToApply.length) return null;

        const thenBy = [];

        for (let i = 0; i < thenByToApply.length; i++) {

            const level = thenByToApply[i];

            if (!level) continue;

            const levelColumnIndex = level.columnIndex ??
                columnResolver.getColumnIndex(level.column);

            if (levelColumnIndex === null || levelColumnIndex === undefined ||
                levelColumnIndex === -1) {

                continue;
            }

            thenBy.push({
                columnIndex: levelColumnIndex,
                isDescending: level.isDescending ?? false,
                sortCalcFunction: level.sortCalcFunction ?? null
            });
        }

        return thenBy.length ? thenBy : null;
    };

    return {
        resolveThenBySortLevels
    };
})();
