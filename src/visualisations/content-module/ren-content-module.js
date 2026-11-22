Ren.CreateContentModule = (tabularData, visualisation) => {

    const data = Ren.TabularDataAdapter_Array.getDataArray(
        tabularData,
        visualisation,
        null,
        false,
        false,
        undefined,
        undefined,
        true // Key values by heading too, so format functions can read columns that carry a
             // ColumnId.
    );

    const contentModule = document.createElement("div");
    contentModule.classList.add("ren-content-module");

    if (visualisation.moduleCssClass) {

        const split = visualisation.moduleCssClass.split(" ");
        split.forEach((cssClass) => {

            contentModule.classList.add(cssClass);
        });
    }

    const formatFunction = Ren.ArrayUtils.ensureArray(Ren.FormatFunctions.createFunction(
        { html: visualisation.formatFunction },
        Ren.ReportInputParameters.getInputParameters(visualisation.containingReport)
    ));

    let result = "";

    const dataLength = visualisation.maxRows !== undefined ?
        Math.min(visualisation.maxRows, data.length) :
        data.length;

    for (let i = 0; i < dataLength; i++) {

        const row = data[i];

        const formattedValue = Ren.ValueFormatter.formatValue(
            "",
            Object.keys(row).length,
            Ren.SpreadsheetColumnFormatEnum.General,
            formatFunction,
            row
        );

        result += formattedValue;
    }

    Ren.HtmlUtils.setHTML(contentModule, result);

    Ren.FnUtils.defer(() => {

        Ren.PopupReports.setupPopupReports();
    });

    return {
        element: contentModule
    };
};
