/**
 * The URLs of the server hosting the page, from the reportUrl(), imageUrl(), websiteUrl() and
 * hasDevelopmentUrls() globals the web report layout declares.  Without them, as on a page that
 * just includes ren.js, URLs are left as they are, relative to the page.
 */
Ren.HostUrls = (() => {

    // Gets a value indicating whether the page declares report URLs, which are absolute.
    const hasReportUrls = () => typeof window.reportUrl === "function";

    const reportUrl = (url, inheritParameters) =>
        hasReportUrls() ? window.reportUrl(url, inheritParameters) : url;

    const imageUrl = (imagePath) =>
        typeof window.imageUrl === "function" ? window.imageUrl(imagePath) : imagePath;

    const websiteUrl = (url) =>
        typeof window.websiteUrl === "function" ? window.websiteUrl(url) : url;

    // Gets a value indicating whether the page is served from a development server.
    const hasDevelopmentUrls = () =>
        typeof window.hasDevelopmentUrls === "function" && window.hasDevelopmentUrls();

    return {
        hasDevelopmentUrls,
        hasReportUrls,
        imageUrl,
        reportUrl,
        websiteUrl
    };
})();
