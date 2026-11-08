/**
 * Keeps report settings on the server, through its report settings endpoints.
 */
(() => {

    const LOAD_ENDPOINTS = {
        preset: "loadWebReportSettings",
        user: "loadUserReportSettings",
        default: "loadDefaultReportSettings",
        sqlBasedPreset: "loadSqlBasedReportPresetSettings"
    };

    const SAVE_ENDPOINTS = {
        preset: "saveWebReportSettings",
        user: "saveUserReportSettings",
        default: "saveDefaultReportSettings",
        sqlBasedPreset: "saveSqlBasedReportPresetSettings"
    };

    const getJsonHeaders = () => ({
        "Accept": "application/json",
        "Content-Type": "application/json"
    });

    const getUrl = (endpointName, reportName, settingsName) => {

        let url = Ren.Endpoints.getUrl(endpointName);

        if (!url) return null;

        url = Ren.UrlUtils.upsertQueryParameter(url, "reportName", reportName);

        if (settingsName && settingsName !== "null") {

            url = Ren.UrlUtils.upsertQueryParameter(url, "settingsName", settingsName);
        }

        return url;
    };

    const load = async (kind, reportName, settingsName) => {

        const url = getUrl(LOAD_ENDPOINTS[kind], reportName, settingsName);

        if (!url) return null;

        const response = await Ren.FetchUtils.fetch(url, {
            method: "GET",
            headers: getJsonHeaders()
        });

        if (response.status === 404) return null;

        if (!response.ok) throw new Error("Error loading report settings");

        // The server answers with nothing rather than a 404 where a report has no settings.
        const text = await response.text();

        return text === "" ? null : text;
    };

    const save = async (kind, reportName, settingsName, serializedReportSettings) => {

        const url = getUrl(SAVE_ENDPOINTS[kind], reportName, settingsName);

        if (!url) return null;

        const response = await Ren.FetchUtils.fetch(url, {
            method: "POST",
            headers: getJsonHeaders(),
            body: Ren.JsonUtils.serialize({ serializedReportSettings })
        });

        const errorDetails = response.ok ?
            null :
            await Ren.DataSourceErrorPopup.readErrorResponse(response);

        return { ok: response.ok, location: url, errorDetails };
    };

    const deleteSettings = async (reportName, settingsName) => {

        const url = Ren.Endpoints.getUrl("deleteUserReportSettings");

        if (!url) return null;

        const response = await Ren.FetchUtils.fetch(url, {
            method: "POST",
            body: JSON.stringify({ reportName, settingsName }),
            headers: getJsonHeaders()
        });

        return response.ok;
    };

    const list = async (reportName, onEditorPage) => {

        let url = Ren.Endpoints.getUrl("listReportSettingsFiles");

        if (!url) return null;

        url = Ren.UrlUtils.upsertQueryParameter(url, "reportName", encodeURIComponent(reportName));
        url = Ren.UrlUtils.upsertQueryParameter(
            url,
            "onEditorPage",
            onEditorPage ? "true" : "false"
        );

        const response = await Ren.FetchUtils.fetch(url, {
            method: "GET",
            headers: getJsonHeaders()
        });

        return response.ok ? await response.json() : null;
    };

    const canSave = () =>
        Ren.Endpoints.has(SAVE_ENDPOINTS.user) || Ren.Endpoints.has(SAVE_ENDPOINTS.default);

    const canList = () => Ren.Endpoints.has("listReportSettingsFiles");

    Ren.Extensions.registerSettingsStore("http", {
        canList,
        canSave,
        delete: deleteSettings,
        list,
        load,
        save
    });
})();
