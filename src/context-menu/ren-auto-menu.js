/**
 * Offers popup reports on the context menu of any element marked up as, for example:
 *
 *     <span class="ren-auto-menu ren-auto-menu--product-code">CO00816</span>
 *
 * Each menu name gets a "<Menu name> reports" item, whose submenu holds the reports and hyperlinks
 * listed for it in autoMenus in ren.config.  The value passed to them is the element's
 * data-auto-menu-value attribute where it has one, or else its text.
 *
 * Each report is opened in a popup, with the value passed as parameterName, and scaled by its
 * popupZoom where it has one.  Any queryParameters are added to the report's URL alongside it.  A
 * popupWidth or popupHeight (in pixels) sets the popup to that size, rather than fitting it to the
 * report.  With popupScaleContentToFit, resizing the popup scales the report to fit rather than
 * laying it out afresh.  Data grid cells in columns whose heading is one of the menu's
 * columnHeadings, or contains or ends with (ignoring spaces and case) one of its
 * columnHeadingContains or columnHeadingEndsWith, are given the menu automatically, provided the
 * column's format is one of its columnFormats (named as in Ren.SpreadsheetColumnFormatEnum).
 *
 * Each of a menu's hyperlinks opens its url in a new tab, with every "{value}" in the url replaced
 * by the (URL-encoded) value, and is listed under its section after the reports.  A url with a
 * baseUrl is relative to that named base URL (see Ren.Links).
 */
Ren.AutoMenu = (() => {

    const MENU_CLASS_NAME = "ren-auto-menu";
    const MENU_NAME_CLASS_PREFIX = MENU_CLASS_NAME + "--";

    const getMenuConfigs = () => Ren.Config.getConfig().autoMenus;

    const getMenuNames = (element) => {

        const menuNames = [];

        for (let i = 0; i < element.classList.length; i++) {

            const className = element.classList[i];

            if (className.startsWith(MENU_NAME_CLASS_PREFIX)) {
                menuNames.push(className.substring(MENU_NAME_CLASS_PREFIX.length));
            }
        }

        return menuNames;
    };

    const getValue = (element) => {

        const value = element.hasAttribute("data-auto-menu-value")
            ? element.getAttribute("data-auto-menu-value")
            : element.textContent;

        return value.trim();
    };

    const buildReportUrl = (menuConfig, report, value) => {

        let url = `${report.reportName}?${menuConfig.parameterName}=${encodeURIComponent(value)}`;

        const queryParameters = report.queryParameters;

        if (queryParameters) {

            const names = Object.keys(queryParameters);

            for (let i = 0; i < names.length; i++) {

                url += `&${encodeURIComponent(names[i])}=` +
                    encodeURIComponent(queryParameters[names[i]]);
            }
        }

        return url;
    };

    const buildReportItem = (menuConfig, report, value) => {

        const text = report.text || report.reportName;

        return {
            text,
            id: `auto-menu-${report.reportName}`,
            popupReport: () => buildReportUrl(menuConfig, report, value),
            popupReportTitle: () => `${text} - ${value}`,
            popupReportZoom: report.popupZoom,
            popupReportWidth: report.popupWidth,
            popupReportHeight: report.popupHeight,
            popupReportScaleContentToFit: report.popupScaleContentToFit
        };
    };

    const buildHyperlinkUrl = (hyperlink, value) => {

        const url = hyperlink.url.split("{value}").join(encodeURIComponent(value));

        return Ren.Links.resolveUrl(url, hyperlink.baseUrl);
    };

    const buildHyperlinkItem = (hyperlink, value) => ({
        section: hyperlink.section,
        text: hyperlink.text,
        id: `auto-menu-link-${hyperlink.text}`,
        hyperlink: () => buildHyperlinkUrl(hyperlink, value)
    });

    const IDENTIFIER_MENU_NAME_WORDS = ["code", "id", "ref", "guid"];
    const UPPER_CASE_MENU_NAME_WORDS = ["ip"];

    /**
     * Gets the name of the thing the menu's value identifies, e.g. "Product" for "product-code" or
     * "Order" for "order-id".
     */
    const getIdentifiedThingName = (menuName) => {

        const words = menuName.split("-");

        if (words.length > 1 && IDENTIFIER_MENU_NAME_WORDS.includes(Ren.ArrayUtils.last(words))) {
            words.pop();
        }

        for (let i = 0; i < words.length; i++) {

            if (UPPER_CASE_MENU_NAME_WORDS.includes(words[i])) {
                words[i] = words[i].toUpperCase();
            }
        }

        return Ren.TextUtils.makeFirstCharUpperCase(words.join(" "));
    };

    const buildMenuItem = (menuName, menuConfig, value) => {

        const submenu = [{ heading: value }];

        for (let i = 0; i < menuConfig.reports.length; i++) {

            submenu.push(buildReportItem(menuConfig, menuConfig.reports[i], value));
        }

        const hyperlinks = menuConfig.hyperlinks || [];

        for (let i = 0; i < hyperlinks.length; i++) {

            submenu.push(buildHyperlinkItem(hyperlinks[i], value));
        }

        return {
            text: `${getIdentifiedThingName(menuName)} reports`,
            id: `auto-menu-${menuName}-reports`,
            submenu
        };
    };

    const buildMenuItems = () => {

        const element = Ren.LastRightClickTarget?.closest("." + MENU_CLASS_NAME);

        if (!element) return [];

        const value = getValue(element);

        if (!value) return [];

        const menuNames = getMenuNames(element);
        const menuItems = [];

        for (let i = 0; i < menuNames.length; i++) {

            const menuConfig = getMenuConfigs()[menuNames[i]];

            if (!menuConfig) continue;

            menuItems.push(buildMenuItem(menuNames[i], menuConfig, value));
        }

        return menuItems;
    };

    const hasColumnFormat = (menuConfig, columnFormat) => {

        const columnFormats = menuConfig.columnFormats || [];

        for (let i = 0; i < columnFormats.length; i++) {

            if (Ren.SpreadsheetColumnFormatEnum[columnFormats[i]] === columnFormat) return true;
        }

        return false;
    };

    /**
     * Gets a value indicating whether the heading is one of the menu's columnHeadings, or contains
     * or ends with (ignoring spaces and case) one of its columnHeadingContains or
     * columnHeadingEndsWith.
     */
    const headingMatches = (menuConfig, heading) => {

        if (menuConfig.columnHeadings && menuConfig.columnHeadings.includes(heading)) {
            return true;
        }

        if (!heading) {
            return false;
        }

        const normalisedHeading = heading.split(" ").join("").toLowerCase();
        const headingContains = menuConfig.columnHeadingContains || [];

        for (let i = 0; i < headingContains.length; i++) {

            if (normalisedHeading.includes(headingContains[i].toLowerCase())) {
                return true;
            }
        }

        const headingEndsWith = menuConfig.columnHeadingEndsWith || [];

        for (let i = 0; i < headingEndsWith.length; i++) {

            if (normalisedHeading.endsWith(headingEndsWith[i].toLowerCase())) {
                return true;
            }
        }

        return false;
    };

    /**
     * Gets the name of the menu whose columnHeadings, columnHeadingContains or
     * columnHeadingEndsWith match the column's heading and whose columnFormats include its format,
     * or null if none do.
     */
    const getMenuNameForColumn = (columnModel) => {

        const menuConfigs = getMenuConfigs();
        const menuNames = Object.keys(menuConfigs);

        for (let i = 0; i < menuNames.length; i++) {

            const menuConfig = menuConfigs[menuNames[i]];

            if (headingMatches(menuConfig, columnModel.Heading) &&
                hasColumnFormat(menuConfig, columnModel.ColumnFormat)) {

                return menuNames[i];
            }
        }

        return null;
    };

    /**
     * Gets the name of the menu whose parameterName is the report parameter's name (ignoring case),
     * or null if none is.
     */
    const getMenuNameForParameter = (parameterName) => {

        const lowerCaseParameterName = parameterName.toLowerCase();
        const menuConfigs = getMenuConfigs();
        const menuNames = Object.keys(menuConfigs);

        for (let i = 0; i < menuNames.length; i++) {

            const menuConfig = menuConfigs[menuNames[i]];

            if (menuConfig.parameterName.toLowerCase() === lowerCaseParameterName) {
                return menuNames[i];
            }
        }

        return null;
    };

    /**
     * Gives the element the named menu for the value, or takes it away if there is no value.  The
     * value is held on the element, so that whatever the element displays doesn't matter.
     */
    const applyMenu = (element, menuName, value) => {

        const hasValue = value !== null && value !== undefined && value !== "" &&
            value !== Ren.NullSentinel;

        element.classList.toggle(MENU_CLASS_NAME, hasValue);
        element.classList.toggle(MENU_NAME_CLASS_PREFIX + menuName, hasValue);

        if (hasValue) {
            element.setAttribute("data-auto-menu-value", value);
        }
        else {

            element.removeAttribute("data-auto-menu-value");
        }
    };

    // Contributed on the body, so that marked-up elements anywhere on the page - however they came
    // to be rendered - need nothing wired up to them.
    Ren.Messages.Events.pageLoaded.handle(() => {

        Ren.AddStandingContextMenuItems(document.body, "auto-menu", buildMenuItems);

    }, true);

    return {
        buildMenuItems,
        getMenuNameForColumn,
        getMenuNameForParameter,
        applyMenu
    };
})();
