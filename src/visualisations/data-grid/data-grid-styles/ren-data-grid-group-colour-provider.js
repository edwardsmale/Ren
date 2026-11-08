/**
 * Calculates colours to use for the groups in a datagrid.
 */
Ren.GroupColourProvider = (dataGroupingSettings) => {

    const maxGroupLevel = () => dataGroupingSettings.groupings.numGroupings();

    let isLightColourCache = {};

    const isLightColour = (colour) => {

        isLightColourCache[colour] =
            isLightColourCache[colour] || Ren.Colours.lightnessOfColour(colour) > 0.5;
        return isLightColourCache[colour];
    };

    const suitableTextColor = (backgroundColour, groupLevel) => {

        const colour = isLightColour(backgroundColour) ? "#000000" : "#EFEFEF";

        if (groupLevel === 0) return colour;

        return colour + "DD";
    };

    const lightSuitableTextColor = (backgroundColour) => {

        return isLightColour(backgroundColour) ? "#333333" : "#BBBBBB";
    };

    const background = () => Ren.Theme.getValue("data-grid-background", "#FFFFFF");

    const topRowBackground = () => Ren.Theme.getValue("data-grid-group-background", "#F4F4F4");

    const childRowBackground = () => {

        return maxGroupLevel() === 1 ? getGroupBackground(1) : background();
    };

    let childRowForegroundCache = {};

    const childRowForeground = (groupLevel) => {

        if (childRowForegroundCache[groupLevel]) return childRowForegroundCache[groupLevel];

        const result = suitableTextColor(childRowBackground(groupLevel), groupLevel);

        childRowForegroundCache[groupLevel] = result;

        return result;
    };

    let lightChildRowForegroundCache = {};

    const lightChildRowForeground = (groupLevel) => {

        if (lightChildRowForegroundCache[groupLevel]) {
            return lightChildRowForegroundCache[groupLevel];
        }

        const result = lightSuitableTextColor(childRowBackground(groupLevel));

        lightChildRowForegroundCache[groupLevel] = result;

        return result;
    };

    let getGroupBackgroundCache = {};

    const getGroupBackground = (groupLevel) => {

        if (getGroupBackgroundCache[groupLevel]) return getGroupBackgroundCache[groupLevel];

        const interpolate = Ren.Colours.interpolateLab(background(), topRowBackground());

        // Group levels from 0 to the deepest map onto 0.25 to 1, the deeper ones nearer the
        // background.  With no groupings, it is half way along.
        const maxLevel = maxGroupLevel();
        const position = maxLevel === 0 ? 0.5 : (0.5 + maxLevel - groupLevel) / maxLevel;

        const result = interpolate(0.25 + 0.75 * position);

        getGroupBackgroundCache[groupLevel] = result;

        return result;
    };

    let getGroupForegroundCache = {};

    const getGroupForeground = (groupLevel) => {

        if (getGroupForegroundCache[groupLevel]) return getGroupForegroundCache[groupLevel];

        const result = suitableTextColor(getGroupBackground(groupLevel), groupLevel);

        getGroupForegroundCache[groupLevel] = result;

        return result;
    };

    const invalidateCachedColours = () => {

        getGroupBackgroundCache = {};
        getGroupForegroundCache = {};
        childRowForegroundCache = {};
        lightChildRowForegroundCache = {};
        isLightColourCache = {};
    };

    return {
        background,
        childRowBackground,
        childRowForeground,
        lightChildRowForeground,
        getGroupBackground,
        getGroupForeground,
        invalidateCachedColours
    };
};
