/**
 * Provides access to the configuration settings in ren.config: the library's defaults, then any
 * given to Ren.configure(), then the page's .js-ren-config element, each merged over the last.
 * The element comes last so that the server's config file wins over code that configures Ren.
 */
Ren.Config = (() => {

    const DEFAULT_CONFIG = Object.freeze({
        endpoints: Object.freeze({ baseUrl: "" }),
        formatting: Object.freeze({
            currencyPrefix: "£",
            currencySuffix: "",
            decimalSeparator: ".",
            thousandsSeparator: ",",
            minusSign: "-",
            dateFormat: "dd/MM/yyyy",
            dateTimeFormat: "dd/MM/yyyy HH:mm:ss"
        }),
        links: Object.freeze({
            baseUrls: Object.freeze({}),
            liveRootUrls: Object.freeze({})
        }),
        linkFormats: Object.freeze([]),
        autoMenus: Object.freeze({}),
        semanticColumns: Object.freeze([]),
        cellMenuSections: Object.freeze([]),
        loggingEnabled: false,
        searchLinks: Object.freeze([]),
        theme: Object.freeze({
            accent: "#0288d1",
            standardColours: Object.freeze({})
        }),
        workingDays: Object.freeze({
            weekendDays: Object.freeze([0, 6]),
            nonWorkingDays: Object.freeze([]),
            workingDayWeights: Object.freeze([]),
            nonWorkingDayWeights: Object.freeze([
                Object.freeze({ name: "Non-working days", weight: 0 })
            ])
        })
    });

    const configured = [];
    const changeListeners = [];

    let config = null;
    let isFromConfigElement = false;

    const notifyChanged = () => {

        for (let i = 0; i < changeListeners.length; i++) {
            changeListeners[i]();
        }
    };

    const deepFreeze = (value) => {

        if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;

        const keys = Object.keys(value);

        for (let i = 0; i < keys.length; i++) {
            deepFreeze(value[keys[i]]);
        }

        return Object.freeze(value);
    };

    const isPlainObject = (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value);

    /**
     * Merges the source over the target, which it changes: objects merge key by key, and any
     * other value, arrays included, replaces the one it is merged over.
     */
    const mergeInto = (target, source) => {

        const keys = Object.keys(source);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];
            const value = source[key];

            if (isPlainObject(value)) {

                if (!isPlainObject(target[key])) target[key] = {};

                mergeInto(target[key], value);
            }
            else {

                target[key] = value;
            }
        }

        return target;
    };

    const buildConfig = (configElementConfig) => {

        const merged = mergeInto({}, DEFAULT_CONFIG);

        for (let i = 0; i < configured.length; i++) {
            mergeInto(merged, configured[i]);
        }

        if (configElementConfig) mergeInto(merged, configElementConfig);

        return deepFreeze(merged);
    };

    /**
     * Gets the config object, frozen so that it cannot be modified.  The page's config element is
     * merged in once found there.
     */
    const getConfig = () => {

        if (isFromConfigElement) return config;

        const configElement = document.querySelector(".js-ren-config");

        if (configElement) {

            config = buildConfig(JSON.parse(configElement.textContent) || {});
            isFromConfigElement = true;
            notifyChanged();
        }
        else if (!config) {
            
            config = buildConfig(null);
        }

        return config;
    };

    /**
     * Merges config over that given before, beneath the page's config element.  Takes data only,
     * which is copied: code is registered through Ren.Extensions.
     */
    const configure = (partialConfig) => {

        configured.push(JSON.parse(JSON.stringify(partialConfig || {})));

        config = null;
        isFromConfigElement = false;
        notifyChanged();
    };

    /**
     * Calls the callback whenever the config changes, so that what is derived from it and cached
     * can be derived again.
     */
    const onChange = (callback) => {

        changeListeners.push(callback);
    };

    /**
     * Gets a value indicating whether a feature is disabled in the Ren config file.
     *
     * Looks in the featureFlags subobject.  In order for a feature to be considered disabled, it
     * must exist in the featureFlags object and have a value of false.
     */
    const isFeatureDisabled = (featureFlagName) => {

        const featureFlags = getConfig().featureFlags;

        if (featureFlags && featureFlags[featureFlagName] === false) return true;

        return false;
    };

    /**
     * Gets the custom sort orders, each an object whose values array lists, in order, the values a
     * column sorts by in place of alphabetically.  An element of values may itself be an array of
     * values sharing that place.
     */
    const getCustomSortOrders = () => {

        return getConfig().customSortOrders || [];
    };

    return {
        configure,
        getConfig,
        onChange,
        isFeatureDisabled,
        getCustomSortOrders
    };
})();

Ren.configure = Ren.Config.configure;
