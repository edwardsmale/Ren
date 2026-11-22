/**
 * Works out the backgrounds of group row cells whose grouping column is set to merge those of the
 * data rows beneath them, grouping.columns[column].mergeDataRowBackgrounds.  The data rows' cell
 * backgrounds, as their style functions give them, are mixed equally by Ren.ColourMixer, a row
 * without one counting as transparent.  Rows the grid's filters leave out are not counted.
 *
 * A group's mix is summed from those of its child groups, and each is held until the grid's
 * settings, filters or groups change, so a data row's style functions are run once per column
 * however many groupings merge.  An innermost group's mixes are made for all the columns its
 * grouping merges in one pass over its data rows, so each row's data is read once for them all.
 */
Ren.DataGridMergedBackgrounds = (tabularData, dataGroupingSettings) => {

    // Each group's mixes, by column index.
    let mixesByGroup = new WeakMap();
    let mixesSignifier = null;

    // The data-row filter's excluded rows mask, null where it has none, or undefined until read.
    let excludedRowsMask;

    const clear = () => {

        mixesByGroup = new WeakMap();
        excludedRowsMask = undefined;
    };

    /**
     * Makes an innermost group's mixes for the given columns in one pass over its data rows.
     */
    const addDataRowMixes = (group, isOutermostGroup, mixes, columnIndexes, request) => {

        const columnMixes = new Array(columnIndexes.length);

        for (let i = 0; i < columnIndexes.length; i++) {

            columnMixes[i] = Ren.ColourMixer.createMix();
            mixes.set(columnIndexes[i], columnMixes[i]);
        }

        const backgrounds = new Array(columnIndexes.length);

        // The outermost group spans every row, and reading its buffer would build that range.
        const buffer = isOutermostGroup ? null : group.containedRowIndexBuffer;
        const start = group.containedRowIndexStart;
        const count = group.containedRowIndexCount;
        const excludedRowsMask = request.excludedRowsMask;

        for (let index = 0; index < count; index++) {

            const rowIndex = buffer ? buffer[start + index] : index;

            if (excludedRowsMask && excludedRowsMask[rowIndex]) continue;

            request.getDataRowBackgrounds(rowIndex, columnIndexes, backgrounds);

            for (let i = 0; i < columnIndexes.length; i++) {

                Ren.ColourMixer.addColour(columnMixes[i], backgrounds[i]);
            }
        }
    };

    /**
     * Gets the mix of a group's data rows' backgrounds in a column.
     *
     * @param {Object} request - What getMergedBackground was given: getDataRowBackgrounds,
     *     mergingColumnIndexes, and the data-row filter's excludedRowsMask (1 for each row it
     *     leaves out), or null.
     */
    const getGroupMix = (group, isOutermostGroup, columnIndex, request) => {

        let mixes = mixesByGroup.get(group);

        if (!mixes) {

            mixes = new Map();
            mixesByGroup.set(group, mixes);
        }

        let mix = mixes.get(columnIndex);

        if (mix) return mix;

        if (group.containedGroups.size > 0) {

            mix = Ren.ColourMixer.createMix();

            group.containedGroups.forEach((childGroup) => {

                if (childGroup.excludedByOuterFilter) return;

                Ren.ColourMixer.addMix(mix, getGroupMix(childGroup, false, columnIndex, request));
            });

            mixes.set(columnIndex, mix);

            return mix;
        }

        // Made for this column and every other merged one the group has no mix for yet.
        const columnIndexes = [columnIndex];
        const mergingColumnIndexes = request.mergingColumnIndexes;

        for (let i = 0; i < mergingColumnIndexes.length; i++) {

            const mergingColumnIndex = mergingColumnIndexes[i];

            if (mergingColumnIndex !== columnIndex && !mixes.has(mergingColumnIndex)) {
                columnIndexes.push(mergingColumnIndex);
            }
        }

        addDataRowMixes(group, isOutermostGroup, mixes, columnIndexes, request);

        return mixes.get(columnIndex);
    };

    /**
     * Gets the excluded rows mask of the grid's data-row filter, or null where it has none.
     */
    const getExcludedRowsMask = () => {

        if (excludedRowsMask !== undefined) return excludedRowsMask;

        const compiledFilter = dataGroupingSettings.hasFilter()
            ? Ren.Filter.createCompiledFilter(tabularData, dataGroupingSettings)
            : null;

        excludedRowsMask = compiledFilter ? compiledFilter.getExcludedRowsMask() : null;

        return excludedRowsMask;
    };

    /**
     * Gets the background of a group row's cell merged from its data rows', or null where none of
     * them has one.
     *
     * @param {Function} getDataRowBackgrounds - (rowIndex, columnIndexes, backgrounds) => void,
     *     setting backgrounds[i] to the colour of the data row's cell in columnIndexes[i], or null.
     * @param {Array} columnMergesDataRowBackgrounds - true at the index of each column the
     *     grouping merges, which are given mixes together.
     */
    const getMergedBackground = (grouping, group, columnIndex, getDataRowBackgrounds,
        columnMergesDataRowBackgrounds) => {

        // A settings change may change the data rows' styles.
        if (dataGroupingSettings.signifier !== mixesSignifier) {

            clear();
            mixesSignifier = dataGroupingSettings.signifier;
        }

        const mergingColumnIndexes = [];

        for (let c = 0; c < columnMergesDataRowBackgrounds.length; c++) {

            if (columnMergesDataRowBackgrounds[c]) mergingColumnIndexes.push(c);
        }

        const request = {
            getDataRowBackgrounds,
            mergingColumnIndexes,
            excludedRowsMask: getExcludedRowsMask()
        };

        return Ren.ColourMixer.getMixedColour(
            getGroupMix(group, grouping.isOutermostGrouping, columnIndex, request)
        );
    };

    return {
        clear,
        getMergedBackground
    };
};
