/**
 * The standard colours for measures that appear across many reports, so that a measure looks the
 * same wherever it is plotted, from theme.standardColours in ren.config.  A visualisation refers
 * to a standard colour by its key and takes the colour from the config as it draws, so changing a
 * colour there changes it in every report using it.  Keys are saved in report settings, so must
 * not be renamed.
 */
Ren.StandardColoursConfig = (() => {

    const getStandardColours = () => Ren.Config.getConfig().theme.standardColours;

    /**
     * Gets the standard colour keys, in the order they are offered in.
     */
    const getKeys = () => Object.keys(getStandardColours());

    /**
     * Gets the colour for a standard colour key, or null if there is no such standard colour.
     */
    const getColour = (key) => getStandardColours()[key]?.colour ?? null;

    /**
     * Gets the name shown for a standard colour key.
     */
    const getName = (key) => getStandardColours()[key]?.name ?? key;

    return {
        getKeys,
        getColour,
        getName
    };
})();
