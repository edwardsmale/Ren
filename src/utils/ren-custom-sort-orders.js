/**
 * The custom sort orders in the Ren config, each listing, in order, the values a column sorts by
 * in place of alphabetically.
 */
Ren.CustomSortOrders = (() => {

    let indexGetters = [];
    let indexGettersSource = null;

    const createIndexGetter = (customSortOrder) => {

        const values = customSortOrder.values || [];
        const indexes = new Map();

        for (let i = 0; i < values.length; i++) {

            const sharedValues = Array.isArray(values[i]) ? values[i] : [values[i]];

            for (let j = 0; j < sharedValues.length; j++) {
                indexes.set(String(sharedValues[j]).trim().toLowerCase(), i);
            }
        }

        return (value) => {

            if (typeof value !== "string") return -1;

            const index = indexes.get(value.trim().toLowerCase());

            return index === undefined ? -1 : index;
        };
    };

    /**
     * Gets one function per custom sort order, each giving a value's place in that order - in any
     * case - or -1 where it is not in it.
     */
    const getIndexGetters = () => {

        const customSortOrders = Ren.Config.getCustomSortOrders();

        if (customSortOrders === indexGettersSource) return indexGetters;

        indexGetters = [];

        for (let i = 0; i < customSortOrders.length; i++) {
            indexGetters.push(createIndexGetter(customSortOrders[i]));
        }

        indexGettersSource = customSortOrders;

        return indexGetters;
    };

    /**
     * Gets the index getter of the first custom sort order holding every value in the array,
     * ignoring nulls and empty strings, or null where there is none.  An array holding no value
     * at all matches none.
     */
    const findIndexGetter = (array, selector) => {

        const getters = getIndexGetters();

        for (let i = 0; i < getters.length; i++) {

            const getIndex = getters[i];

            let foundValue = false;
            let allFound = true;

            for (let j = 0; j < array.length; j++) {

                const value = selector(array[j]);

                if (value === null || value === "" || value === undefined) continue;

                if (getIndex(value) === -1) {

                    allFound = false;
                    break;
                }

                foundValue = true;
            }

            if (allFound && foundValue) return getIndex;
        }

        return null;
    };

    return {
        getIndexGetters,
        findIndexGetter
    };
})();
