/**
 * Provides UI for editing axis labels in date-value charts.
 */
Ren.DateValueChart_AxisLabelEditor = (() => {

    const showAxisLabelEditor = (axisName, currentLabel, onSave) => {

        Ren.CreateTextEditorPopupWindow(
            "Edit Axis Label",
            currentLabel,
            (newLabel) => onSave(axisName, newLabel),
            { width: 320, height: 110 }
        );
    };

    return {
        showAxisLabelEditor
    };
})();
