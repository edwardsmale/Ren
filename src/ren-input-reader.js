/**
 * Functions for reading the inputs on the report generation Home and Editor pages.
 */
Ren.InputReader = () => {

    /**
    * Creates an object containing the data from the option inputs on the page.
    */
    const readInputs = () => {

        const readInput = (name) => {

            return document.querySelector(`[name="${name}"]:enabled`)?.value;
        };

        const data = {
            reportName: readInput("reportName"),
            startDate: readInput("startDate"),
            endDate: readInput("endDate"),
            uploadedFilesHaveHeaderRows: document.querySelector("[name=\"uploadedFilesHaveHeaderRows\"]")?.checked,
            uploadedFilesDelimiter: document.querySelector("[name=\"uploadedFilesDelimiter\"]")?.value,
            uploadedFilesSkipIISNoise: document.querySelector("[name=\"uploadedFilesSkipIISNoise\"]")?.checked,
            uploadedFilesApplyBSTCorrection: document.querySelector("[name=\"uploadedFilesApplyBSTCorrection\"]")?.checked
        };

        if (Ren.UrlContext.onEditorPage()) {

            // If the 'sql' input (the SQL editor textarea) exists, then persist that value,
            // otherwise retain the existing value.
            data.sql = readInput("sql");
        }

        if (data.uploadedFilesDelimiter === "\\t") {
            data.uploadedFilesDelimiter = "\t";
        }

        const hashData = Ren.HashUtils.readHash();

        data.sqlFilename = hashData.reportName ?? document.querySelector("select[name=\"reportName\"]")?.selectedOptions[0]?.value;

        data.isSqlBased =
            Ren.UrlContext.onEditorPage() ||
            document.querySelector("select[name=\"reportName\"]")?.selectedOptions[0]?.dataset?.sqlBased === "True";

        data.isFileUploadRequired =
            Ren.UrlContext.onEditorPage() ||
            document.querySelector("select[name=\"reportName\"]")?.selectedOptions[0]?.dataset?.isFileUploadRequired === "True";

        data.uploadedFiles = [];

        document.querySelectorAll("input[name=\"uploadedFiles\"]").forEach(input => {

            data.uploadedFiles.push(input.value);
        });

        if (!data.uploadedFiles.length) delete data.uploadedFiles;

        Ren.PageHooks.readInputs(data);

        return data;
    };

    // The data to return if there is nothing stored yet in local storage.
    const defaultData = {
        reportName: "",
        startDate: null,
        endDate: null,
        uploadedFilesHaveHeaderRows: true,
        uploadedFilesDelimiter: ",",
        uploadedFilesSkipIISNoise: true,
        uploadedFilesApplyBSTCorrection: true
    };

    /**
     * Retrieves from browser local storage the user's chosen settings.  This includes the SQL
     * entered into the editor.
     */
    const getReportGeneratorSettingsFromStorage = () => {

        return sessionStorage.reportGenerationSettings
            ? JSON.parse(sessionStorage.reportGenerationSettings)
            : defaultData;
    };

    /**
     * Saves the user's chosen setting to browser storage.
     */
    const saveSettingsToStorage = () => {

        const data = readInputs();
        sessionStorage.reportGenerationSettings = JSON.stringify(data);
    };

    return {
        readInputs,
        getReportGeneratorSettingsFromStorage,
        saveSettingsToStorage
    };
};
