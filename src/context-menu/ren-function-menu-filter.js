/**
 * Takes the menu items built by a menu that sets format functions - the Format menu, the
 * Calculation menu - and drops the ones offering a function whose header does not say it is fit for
 * what that menu does (see Ren.FunctionTags).  Both menus are written as a tree of items naming the
 * functions they set, and both filter the finished tree through here, so a function is offered on a
 * menu only where its own TAGS: line puts it.
 *
 * The items are read rather than the specifications behind them, because every leaf that sets a
 * format function states it the same way whichever menu built it: an actionParameters list ending
 * in the { name } spec that will be stored.  A leaf that sets something else, or that acts through
 * a closure of its own - the binning submenus, which decide what they offer from the tags to begin
 * with - is left alone.
 */
Ren.FunctionMenuFilter = (() => {

    const SEPARATOR_TEXT = "-";

    // The format function name a menu item sets, or null for an item that sets none.  The spec is
    // the last of the item's action parameters, and is the same { name, parameters } object the
    // cell will store.
    const getFunctionName = (menuItem) => {

        const actionParameters = menuItem.actionParameters;

        if (!menuItem.action || !actionParameters || !actionParameters.length) return null;

        const specification = actionParameters[actionParameters.length - 1];

        if (!specification || typeof specification !== "object") return null;

        return typeof specification.name === "string" ? specification.name : null;
    };

    // Whether an item offers a function this menu is not for.  A function the client has never
    // heard of - one a report defined for itself, or a name left behind by a renamed file - is
    // kept: not knowing what a function is fit for is not the same as knowing it is unfit, and
    // silently dropping the item would hide the problem rather than show it.
    const isExcludedByTags = (menuItem, tag) => {

        const functionName = getFunctionName(menuItem);

        if (functionName === null) return false;
        if (!Ren.FunctionTags.isKnownFunction(functionName)) return false;

        return !Ren.FunctionTags.hasTag(functionName, tag);
    };

    const isSeparator = (menuItem) => menuItem.text === SEPARATOR_TEXT && !menuItem.submenu;

    /**
     * Drops the separators left with nothing to separate once items have been removed: runs of
     * them, and any at either end of the menu.  Without this, filtering a whole group out of the
     * middle of a menu would leave two rules against each other where the group used to be.
     *
     * @param {object[]} menuItems - The items to tidy.
     * @returns {object[]} The items, with the redundant separators gone.
     */
    const removeRedundantSeparators = (menuItems) => {

        const tidied = [];

        for (let i = 0; i < menuItems.length; i++) {

            const menuItem = menuItems[i];

            if (isSeparator(menuItem)) {

                if (!tidied.length) continue;
                if (isSeparator(tidied[tidied.length - 1])) continue;
            }

            tidied.push(menuItem);
        }

        while (tidied.length && isSeparator(tidied[tidied.length - 1])) tidied.pop();

        return tidied;
    };

    /**
     * Filters a list of menu items, and the submenus beneath them, to those offering functions
     * tagged for this menu.  A submenu left holding nothing but separators is dropped along with
     * the item that opened it, so a category whose every entry was filtered out does not appear as
     * an empty one.
     *
     * @param {object[]} menuItems - The menu items to filter.
     * @param {string} tag - The tag a function must carry to stay: "format", "calculation" and so
     *     on (see Ren.FunctionTags).
     * @returns {object[]} The items that survived.
     */
    const filterMenuItems = (menuItems, tag) => {

        if (!menuItems || !menuItems.length) return menuItems;

        const kept = [];

        for (let i = 0; i < menuItems.length; i++) {

            const menuItem = menuItems[i];

            if (menuItem.submenu && menuItem.submenu.length) {

                const filteredSubmenu = filterMenuItems(menuItem.submenu, tag);

                if (!filteredSubmenu.length) continue;

                menuItem.submenu = filteredSubmenu;
                kept.push(menuItem);
                continue;
            }

            if (isExcludedByTags(menuItem, tag)) continue;

            kept.push(menuItem);
        }

        return removeRedundantSeparators(kept);
    };

    return {
        filterMenuItems
    };
})();
