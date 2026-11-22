/**
 * Filter Module: which of an item's columns each of its settings is held on.  A flat item has one
 * column, so holds them all there; a hierarchical item has a column per level, top to leaf, and
 * each setting is held on one of them or on every one.  Code acting on an item asks here rather
 * than assuming the column it was handed is the one, so a hierarchy is handled as a flat item is.
 */
Ren.FilterModule_ItemLevels = (() => {

    // Each level has its own: set from a right-click on that level's options, and shown on them.
    const EACH_LEVEL = "eachLevel";

    // The whole item's, held on its leaf, which a hierarchy's heading menu acts on.
    const LEAF = "leaf";

    // The whole item's, held on its top level, as a hierarchy is named after it.
    const TOP = "top";

    // The menu sections whose settings each level has its own of, and the settings they make.
    const LEVEL_SETTINGS_BY_SECTION = {
        Values: [
            "valueColumn",
            "valueAggregationType",
            "valueAggregateWithRespectToColumn",
            "valueFormatFunction"
        ],
        Labels: ["labelFormatFunction", "labelCalcFunction", "ValueOverrides"],
        Sort: [
            "sortByValue",
            "sortColumn",
            "sortAggregationType",
            "sortDescending",
            "sortValueDescending"
        ]
    };

    // Every column override setting, by where an item holds it.  A setting missing from here is
    // caught by a unit test, so that a new one is always given a place.
    const SCOPES = {
        HeadingOverride: TOP,
        included: LEAF,
        AllLabelOverride: LEAF,
        filterHeadingTooltip: LEAF,
        singleSelect: LEAF,
        showSingleSelectToggle: LEAF,
        showSortToggle: LEAF,
        showOptionTotals: LEAF,
        showAllCheckbox: LEAF,
        showValueCheckboxes: LEAF,
        showCompareFilter: LEAF,
        compareFilterSlots: LEAF,
        compareFilterValueWidth: LEAF,
        showBinningFunctionLink: LEAF,
        binningFunction: LEAF,
        showTotal: LEAF,
        showBorder: LEAF,
        showHeadingInBold: LEAF,
        initialExpansion: LEAF,
        showAsCheckbox: LEAF,
        itemWidth: LEAF,
        totalAggregationType: LEAF,
        totalAggregateWithRespectToColumn: LEAF,
        parentGroupings: LEAF
    };

    Object.values(LEVEL_SETTINGS_BY_SECTION).flat().forEach(name => SCOPES[name] = EACH_LEVEL);

    const getScope = (settingName) => {

        const scope = SCOPES[settingName];

        if (!scope) throw new Error(`Filter module setting "${settingName}" has no scope.`);

        return scope;
    };

    /**
     * Gets the keys of the columns a setting is held on, of an item's columns' keys, top to leaf.
     */
    const getSettingKeys = (levelKeys, settingName) => {

        switch (getScope(settingName)) {

            case EACH_LEVEL: return levelKeys.slice();
            case TOP: return [levelKeys[0]];
            default: return [levelKeys[levelKeys.length - 1]];
        }
    };

    /**
     * Gets the key of the column a setting is read from, of an item's columns' keys, top to leaf:
     * for one each level has, its top level's, the one seen without expanding anything.
     */
    const getShownSettingKey = (levelKeys, settingName) =>
        getSettingKeys(levelKeys, settingName)[0];

    // Gets a value indicating whether a menu item, in the given section, sets something each level
    // has its own of.  An item in such a section acting on the item as a whole says so with
    // perLevel: false.
    const isPerLevelMenuItem = (menuItem, section) =>
        Object.hasOwn(LEVEL_SETTINGS_BY_SECTION, section) && menuItem?.perLevel !== false;

    return {
        SCOPES,
        LEVEL_SETTINGS_BY_SECTION,
        getScope,
        getSettingKeys,
        getShownSettingKey,
        isPerLevelMenuItem
    };
})();
