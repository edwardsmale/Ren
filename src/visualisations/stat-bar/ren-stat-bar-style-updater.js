/**
 * Maintains the stat bar's dynamic stylesheet.
 */
Ren.StatBarStyleUpdater = (statBarVisualisation) => {

    const statBarStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        statBarVisualisation.visualisationGuid,
        "StatBar"
    );

    const updateStylesheet = () => {

        if (!statBarVisualisation.gridSetVisualisation.instance) return; // e.g. Editor page

        const styles = [];

        const activeDataGridGuid = statBarVisualisation.gridSetVisualisation.instance.getActiveDataGridGuid();

        const isDataGridVisible = activeDataGridGuid === statBarVisualisation.sourceVisualisationGuid;

        const statBarVisibility = (statBarVisualisation.gridSetVisualisation.statBar && isDataGridVisible) ? "visible" : "hidden";
        const statBarPointerEvents = (statBarVisualisation.gridSetVisualisation.statBar && isDataGridVisible) ? "auto" : "none";

        styles.push(` { visibility: ${statBarVisibility}; pointer-events: ${statBarPointerEvents} }`);

        statBarStylesheet.updateIfChanged(styles);
    };

    Ren.Messages.Events.visualisationSettingsChanged.handle(changedVisualisation => {

        if (statBarVisualisation.isDestroyed) return false;

        if (changedVisualisation.visualisationSettingsGroup !== statBarVisualisation.visualisationSettingsGroup) return;

        updateStylesheet();
    });

    Ren.Messages.Events.dataGridTabChanged.handle(() => {

        if (statBarVisualisation.isDestroyed) return false;

        //if (dataGridGuid !== statBarVisualisation.sourceVisualisationGuid) return;

        updateStylesheet();
    });

    return {
        updateStylesheet
    };
};
