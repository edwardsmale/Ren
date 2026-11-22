/**
 * The per-grouping flags that are either true or absent.  Every rebuild of the groupings carries
 * them across with Ren.GroupingsAdder_copyGroupingFlags, so a new flag only has to be listed here.
 */
Ren.GroupingsAdder_GROUPING_FLAGS = ["preventExpansion", "expandInitially"];

/**
 * Sets each grouping flag on the target that is set on the source, and removes the rest.
 */
Ren.GroupingsAdder_copyGroupingFlags = (source, target) => {

    const flags = Ren.GroupingsAdder_GROUPING_FLAGS;

    for (let i = 0; i < flags.length; i++) {

        if (source[flags[i]]) {
            target[flags[i]] = true;
        }
        else {

            delete target[flags[i]];
        }
    }

    return target;
};
