/**
 * A tick list over one column's value filter, stated in inclusion terms whichever way round the
 * filter is stored. Ticking every value back on removes the filter, so a value the data gains later
 * arrives ticked. A negated column stores the values it leaves out, so its list is flipped as it is
 * read and written; an empty exclusion list is no filter, an empty inclusion list keeps no value.
 */
Ren.ColumnValueSelection = (() => {

    const valuesEqual = (left, right) =>
        Ren.RowObjectFilter.toValueString(left) === Ren.RowObjectFilter.toValueString(right);

    /**
     * Gets a column's stored filter as the values it shows, or null where every value is shown.
     */
    const toShownValues = (tabularData, columnIdOrHeading, storedValues, isNegated) => {

        if (storedValues == null) return null;

        if (!isNegated) return storedValues;

        if (storedValues.length === 0) return null;

        return Ren.FilterNegation.toInclusionValues(tabularData, columnIdOrHeading, storedValues);
    };

    /**
     * Gets a selection in the form the column stores it.  A complement that cannot be worked out
     * leaves the selection stated positively rather than losing it.
     */
    const toStoredValues = (tabularData, columnIdOrHeading, shownValues, isNegated) => {

        if (!isNegated || shownValues == null) return shownValues;

        return Ren.FilterNegation.toExclusionValues(tabularData, columnIdOrHeading, shownValues)
            ?? shownValues;
    };

    /**
     * Gets a value indicating whether a value is one of those shown.
     */
    const isValueShown = (shownValues, value) => {

        if (shownValues == null) return true;

        for (let i = 0; i < shownValues.length; i++) {

            if (valuesEqual(shownValues[i], value)) return true;
        }

        return false;
    };

    /**
     * Gets the selection a click on one value's box leaves behind, or null where there is nothing
     * to write.  With no filter, a column whose values are not to hand is left alone rather than
     * filtered down to nothing.
     */
    const toggleValue = (shownValues, value, allValues) => {

        if (shownValues == null) {

            if (!allValues || allValues.length === 0) return null;

            const remaining = [];

            for (let i = 0; i < allValues.length; i++) {

                if (!valuesEqual(allValues[i], value)) remaining.push(allValues[i]);
            }

            return remaining;
        }

        const remaining = [];
        let wasShown = false;

        for (let i = 0; i < shownValues.length; i++) {

            if (valuesEqual(shownValues[i], value)) {
                wasShown = true;
            }
            else {

                remaining.push(shownValues[i]);
            }
        }

        if (!wasShown) remaining.push(value);

        return remaining;
    };

    /**
     * A tick list bound to a caller's read/write pair for an ordinary column value filter on the
     * data rows.  The optional getAllValues gives the column's values, for unticking one.
     */
    const create = (adapter) => {

        const { tabularData, columnIdOrHeading } = adapter;

        const getShownValues = () => toShownValues(
            tabularData,
            columnIdOrHeading,
            adapter.readStoredValues(),
            adapter.isNegated()
        );

        // Null, meaning every value, takes the filter off the column.
        const setShownValues = (shownValues) => {

            if (shownValues === null) {

                adapter.removeFilter();
                return;
            }

            adapter.writeStoredValues(
                toStoredValues(tabularData, columnIdOrHeading, shownValues, adapter.isNegated())
            );
        };

        const isShown = (value) => isValueShown(getShownValues(), value);

        const toggle = (value) => {

            const shownValues = toggleValue(
                getShownValues(),
                value,
                adapter.getAllValues ? adapter.getAllValues() : null
            );

            if (shownValues !== null) setShownValues(shownValues);
        };

        const setAllShown = (isEveryValueShown) => setShownValues(isEveryValueShown ? null : []);

        const showOnly = (value) => setShownValues([value]);

        return { getShownValues, setShownValues, isShown, toggle, setAllShown, showOnly };
    };

    return { toShownValues, toStoredValues, isValueShown, toggleValue, create };
})();
