Ren.CreateDataGridVariationsWindow = (_tabularData, visualisation) => {

    // Currently this visualisation doesn't work if saved and reloaded, since it depends on the
    // source visualisation GUID, which is random and therefore not predictable.
    visualisation.excludeFromSerialization = true;

    // Make the visualisation stay on the page when new report settings are loaded.
    visualisation.isTransitive = true;

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-data-grid-variations-window");

    const reportSettings = Ren.DataGridVariationsWindow_ReportSettings();

    let contents;

    const updateContents = () => {

        if (contents) {
            contents.remove();
        }

        // The window is a popup of its own, so its report context is taken from the data grid it
        // was opened from rather than from where the window itself sits.
        const containingReportGuid = visualisation.sourceVisualisation?.containingReportGuid;

        const dataSourceUri = Ren.DataGridVariationsWindow_Data.createDataGridVariationsDataSource(
            visualisation.dataGroupingSettingsGroup,
            visualisation.gridStateGroup,
            visualisation.sourceVisualisationGuid,
            containingReportGuid
        );

        const anyData = !!dataSourceUri;

        const newContent =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("DataGridVariationsWindow", {
                anyData,
                dataSourceUri,
                reportSettings: Ren.JsonUtils.serialize(reportSettings)
            });

        element._append(newContent);

        contents = element.children[0];

        const createButton = element.querySelector( ".js-ren-data-grid-variations-window-create-button");
        const createInput = element.querySelector(".js-ren-data-grid-variations-window-create-input");

        createButton.addEventListener("click", () => {

            const settingsName = createInput.value.trim();

            if (!settingsName) return;

            Ren.Messages.Requests.createOrUpdateVariation.notify(
                visualisation.dataGroupingSettingsGroup,
                visualisation.gridStateGroup,
                settingsName,
                visualisation.sourceVisualisationGuid
            );
        });

        createInput.addEventListener("keypress", (event) => {

            if (event.key === "Enter") {

                event.preventDefault();
                createButton.click();
            }
        });

        Ren.Messages.Events.reportAddedToDom.notify();
    };

    updateContents();

    Ren.Messages.Events.variationsChanged.handle(() => {

        updateContents();
    });

    return {
        element
    };
};
