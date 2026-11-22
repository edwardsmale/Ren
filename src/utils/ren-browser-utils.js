/**
 * Functions for doing things with the browser.
 */
Ren.BrowserUtils = (() => {

    /**
     * Opens a new browser tab with the given URL.
     */
    const openNewBrowserTab = (url) => {

        // Use timeout to ensure that the new tab is switched to (by calling .focus()).
        setTimeout(() => window.open(url, "_blank")?.focus(), 10);
    };

    /**
     * Gets a cookie by name.
     */
    const getCookie = (name) => {

        if (!document.cookie) return null;

        const cookies = document.cookie.split("; ").reduce((acc, cookie) => {

            const [key, value] = cookie.split("=");
            acc[key] = value;
            return acc;
        }, {});

        return cookies[name];
    };

    const setCookie = (name, value) => {

        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    };

    return {
        openNewBrowserTab,
        getCookie,
        setCookie
    };
})();
