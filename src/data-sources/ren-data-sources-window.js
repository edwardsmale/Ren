Ren.ShowDataSourcesWindow = (triggeringElement) => {

    let content = null;
    let container = null;

    const update = () => {

        container.innerHTML = "";

        content = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-sources-window__content");

        const dataSourceList = Ren.HtmlUtils.create("ul")
            ._addClass("ren-data-sources-window__data-source-list");

        const contextMenu = Ren.SetUpContextMenu();

        const clonedTabularDatas = Ren.TabularDataPool.getAll();

        Ren.DataSources.getDataSources().forEach(dataSource => {

            const dataSourceSqlFilenameElement = Ren.HtmlUtils.create("span")
                ._addClass("ren-data-sources-window__sql-filename")
                ._text(dataSource.dataSourceUri);

            const dataSourceElement = Ren.HtmlUtils.create("li")
                ._addClass("ren-data-sources-window__data-source")
                ._append(dataSourceSqlFilenameElement);

            const clonedTabularDataElements = Ren.HtmlUtils.create("div")
                ._addClass("ren-data-sources-window__cloned-tabular-data-models");

            for (const key in clonedTabularDatas) {

                const clonedTabularData = clonedTabularDatas[key];

                if (clonedTabularData.DataSourceUri === dataSource.dataSourceUri) {

                    clonedTabularDataElements._append(
                        Ren.HtmlUtils.create("span")._text(clonedTabularData.Title),
                        Ren.HtmlUtils.create("small")._text(`${clonedTabularData.DataRowCount} rows`)
                    );
                }
            }

            dataSourceElement.appendChild(clonedTabularDataElements);
            dataSourceList.appendChild(dataSourceElement);

            // Add 'add visualisation' menu item per data source.
            const visualisationMenuItems = Ren.ContextMenuItems_Visualisations.getMenuItems(
                dataSource.dataSourceUri,
                dataSource.sqlFilename
            );

            contextMenu.addMenuItems(dataSourceElement, visualisationMenuItems);

            contextMenu.addMenuItems(dataSourceElement, [{
                section: "Other",
                text: "Data source settings",
                id: "show-data-source-debug-window",
                action: () => {

                    Ren.Messages.Requests.dataSourceDebugWindow.notify(dataSource.dataSourceUri);
                }
            }]);
        });

        content.appendChild(dataSourceList);

        // Add the data sources menu items to the window as a whole.
        contextMenu.addMenuItems(content, Ren.ContextMenuItems_DataSourcesWindow.getMenuItems());

        container.appendChild(content);
    };

    const renderContent = (contentContainer) => {

        container = contentContainer;

        // Registered from here rather than up front so that it is tagged with the window's content
        // owner, and goes when the window closes.  Left on the bus it would rebuild a container
        // that is no longer on screen, holding on to it and to everything the rebuild reads.
        Ren.Messages.Events.dataSourcesChanged.handle(() => {

            update();
        });

        update();
    };

    Ren.ClosePopupWindows(".ren-data-sources-window"); // Close any existing window.

    let leftPos = 40;
    let topPos = 60;

    if (triggeringElement) {

        const triggeringElementRect = triggeringElement.getBoundingClientRect();

        leftPos = triggeringElementRect.left + window.scrollX + 40;
        topPos = triggeringElementRect.top + window.scrollY + 60;
    }

    Ren.PopupWindow(
        "ren-data-sources-window",
        renderContent,
        "Data Sources",
        {
            leftPos,
            topPos,
            width: 640,
            height: 240
        }
    );
};

Ren.Messages.Requests.dataSourcesWindow.handle((triggeringElement) => {

    Ren.ShowDataSourcesWindow(triggeringElement);
});
