/**
 * Works out the backgrounds of group row cells whose grouping column is set to merge those of the
 * data rows beneath them, grouping.columns[column].mergeDataRowBackgrounds.  The data rows' cell
 * backgrounds, as their style functions give them, are mixed equally by Ren.ColourMixer, a row
 * without one counting as transparent.  Rows the grid's filters leave out are not counted.
 *
 * A group's mix is summed from those of its child groups, and each is held until the grid's
 * settings, filters or groups change, so a data row's style functions are run once per column
 * however many groupings merge.
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
     * Gets the mix of a group's data rows' backgrounds in a column.
     *
     * @param {Function} getDataRowBackground - (rowIndex, columnIndex) => colour, or null.
     * @param {Uint8Array} excludedRowsMask - 1 for each row the data-row filter leaves out, or
     *     null.
     */
    const getGroupMix = (group, isOutermostGroup, columnIndex, getDataRowBackground,
        excludedRowsMask) => {

        let mixes = mixesByGroup.get(group);

        if (!mixes) {

            mixes = new Map();
            mixesByGroup.set(group, mixes);
        }

        let mix = mixes.get(columnIndex);

        if (mix) return mix;

        mix = Ren.ColourMixer.createMix();

        if (group.containedGroups.size > 0) {

            group.containedGroups.forEach((childGroup) => {

                if (childGroup.excludedByOuterFilter) return;

                Ren.ColourMixer.addMix(
                    mix,
                    getGroupMix(
                        childGroup,
                        false,
                        columnIndex,
                        getDataRowBackground,
                        excludedRowsMask
                    )
                );
            });
        }
        else {

            // The outermost group spans every row, and reading its buffer would build that range.
            const buffer = isOutermostGroup ? null : group.containedRowIndexBuffer;
            const start = group.containedRowIndexStart;
            const count = group.containedRowIndexCount;

            for (let index = 0; index < count; index++) {

                const rowIndex = buffer ? buffer[start + index] : index;

                if (excludedRowsMask && excludedRowsMask[rowIndex]) continue;

                Ren.ColourMixer.addColour(mix, getDataRowBackground(rowIndex, columnIndex));
            }
        }

        mixes.set(columnIndex, mix);

        return mix;
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
     * @param {Function} getDataRowBackground - (rowIndex, columnIndex) => colour, or null.
     */
    const getMergedBackground = (grouping, group, columnIndex, getDataRowBackground) => {

        // A settings change may change the data rows' styles.
        if (dataGroupingSettings.signifier !== mixesSignifier) {

            clear();
            mixesSignifier = dataGroupingSettings.signifier;
        }

        return Ren.ColourMixer.getMixedColour(
            getGroupMix(
                group,
                grouping.isOutermostGrouping,
                columnIndex,
                getDataRowBackground,
                getExcludedRowsMask()
            )
        );
    };

    return {
        clear,
        getMergedBackground
    };
};
