Ren.CreateStatBar = (_tabularData, visualisation) => {

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-stat-bar");

    const updateContents = (statBarValues) => {

        element.innerHTML = "";

        statBarValues = statBarValues
            .map((value) => `<div class="ren-stat-bar__value">${value}</div>`)
            .join("");

        const container = Ren.HtmlUtils.create("div")
            ._addClass("ren-stat-bar__container")
            ._append(Ren.HtmlUtils.create("div")
                ._addClass("ren-stat-bar__contents")
                ._append(Ren.HtmlUtils.create("div")
                    ._addClass("ren-stat-bar__items")
                    ._html(statBarValues)
                )
            );

        element._append(container);

        const statBarMenuItems = [{
            text: "Hide Stat Bar",
            action: () => {

                if (visualisation.gridSetVisualisation) {
                    visualisation.gridSetVisualisation.statBar = false;
                }

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }
        }];

        Ren.AddContextMenuItems(container, statBarMenuItems);
    };

    Ren.Messages.Events.selectedValuesChanged.handle((dataGridGuid, getStatBarValues) => {

        if (visualisation.isDestroyed) return false;

        if (dataGridGuid !== visualisation.sourceVisualisationGuid) return;

        const statBarValues = getStatBarValues();

        updateContents(statBarValues);
    });

    return {
        element
    };
};
