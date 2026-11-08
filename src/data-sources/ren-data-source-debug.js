/**
 * Shows a window that displays a data source as syntax-highlighted JSON.
 */
Ren.DataSource_Debug = (() => {

    const showDataSourceDebugWindow = (dataSourceUri) => {

        const dataSourceDebugTransformer = Ren.DataSourceDebugTransformer();

        const dataSource = Ren.DataSources.getDataSource(dataSourceUri);

        Ren.JsonDebugWindow(
            "data-source-debug-window",
            "Data Source",
            200 - 120,
            200,
            () => ({
                pretty: dataSourceDebugTransformer.transform(dataSource, true),
                indented: dataSourceDebugTransformer.transform(dataSource, false),
                raw: dataSource
            })
        );
    };

    Ren.Messages.Requests.dataSourceDebugWindow.handle((dataSourceUri) => {

        showDataSourceDebugWindow(dataSourceUri);
    });
})();
