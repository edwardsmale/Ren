/**
 * Function for showing a list of files to download.
 */
Ren.ReportDownloads = (() => {

    /**
     * Presents the files at the specified paths for download in the browser.
     */
    const presentFilesForDownload = (paths) => {

        const requestNextFile = () => {

            const path = paths.pop();
            if (!path) return;

            Ren.BrowserUtils.setCookie("DownloadReport", "");

            document.querySelector('input[name="path"]').value = path;
            document.querySelector(".js-ren-report-generator-form").submit();

            const interval = setInterval(() => {

                if (Ren.BrowserUtils.getCookie("DownloadReport") === path) {

                    clearInterval(interval);
                    requestNextFile();
                }
            }, 100);
        };

        requestNextFile();
    };

    return {
        presentFilesForDownload
    };
})();
