/**
 * Context menu items that can't be expressed as an auto menu (see Ren.AutoMenu), because they
 * depend on more than the clicked cell's value: the other values in its row.  Entries are given in
 * semanticColumns in ren.config, or added with Ren.Extensions.registerCellMenuItems where they
 * need code.
 *
 * Each entry names the column model properties that mark such a column (any one of them is enough)
 * and gives the items to offer for the right-clicked cell.  Every item is added to the root menu
 * rather than a submenu, so each carries the section that places it there, and is written in the
 * order it is to be shown in.  In ren.config, an item's text, popupReportTitle, popupReport and
 * hyperlink are templates (see Ren.Links), and an item is left out where a row value one of them
 * takes is missing.
 */
Ren.ContextMenuItems_SemanticColumns = (() => {

    // Links in the Search submenu after Google's and those of searchLinks in ren.config, added by
    // Ren.Extensions.registerSearchLink.
    const searchLinks = [];

    const buildConfiguredSearchLinkItems = (cellValue) => {

        const configuredSearchLinks = Ren.Config.getConfig().searchLinks;
        const items = [];

        for (let i = 0; i < configuredSearchLinks.length; i++) {

            const searchLink = configuredSearchLinks[i];
            const url = Ren.Links.fillTemplate(searchLink.url, cellValue, null, true);

            items.push({
                text: searchLink.text,
                id: searchLink.id,
                hyperlink: () => Ren.Links.resolveUrl(url, searchLink.baseUrl)
            });
        }

        return items;
    };

    // Items offered for any column with a value, whatever it holds.  Shared with the word cloud,
    // which searches on a clicked word rather than a cell.
    const buildStringSearchItems = (cellValue) => {

        if (!cellValue) return [];

        const submenu = [{
            text: "Google this",
            id: "google-this-link",
            hyperlink: () => `https://www.google.com/search?q=${cellValue}`
        }];

        const configuredSearchLinkItems = buildConfiguredSearchLinkItems(cellValue);

        for (let i = 0; i < configuredSearchLinkItems.length; i++) {

            submenu.push(configuredSearchLinkItems[i]);
        }

        for (let i = 0; i < searchLinks.length; i++) {

            const searchLink = searchLinks[i];

            submenu.push({
                text: searchLink.text,
                id: searchLink.id,
                hyperlink: () => searchLink.getUrl(cellValue)
            });
        }

        return [{
            text: "Search",
            id: "search-string",
            submenu
        }];
    };

    // columnProperties of null means the entry applies to every column.  Registered entries go
    // before the Search item, which comes last.
    const semanticColumnMenus = [
        {
            columnProperties: null,
            buildItems: buildStringSearchItems
        }
    ];

    Ren.Extensions.handle("cellMenuItems", (registration) =>
        semanticColumnMenus.splice(semanticColumnMenus.length - 1, 0, registration)
    );

    Ren.Extensions.handle("searchLink", (registration) => searchLinks.push(registration));

    /**
     * Gets the item a ren.config item template gives for a cell, or null where a row value one of
     * its templates takes is missing.
     */
    const buildConfiguredItem = (itemTemplate, cellValue, rowVals) => {

        const fill = (template, isUrl) =>
            Ren.Links.fillTemplate(template, cellValue, rowVals, isUrl);

        const text = fill(itemTemplate.text, false);

        if (text === null) return null;

        const item = { section: itemTemplate.section, text, id: itemTemplate.id };

        if (itemTemplate.popupReport) {

            const popupReport = fill(itemTemplate.popupReport, true);
            const popupReportTitle =
                fill(itemTemplate.popupReportTitle || itemTemplate.text, false);

            if (popupReport === null || popupReportTitle === null) return null;

            item.popupReport = () => popupReport;
            item.popupReportTitle = () => popupReportTitle;
        }

        if (itemTemplate.hyperlink) {

            const hyperlink = fill(itemTemplate.hyperlink, true);

            if (hyperlink === null) return null;

            item.hyperlink = () => Ren.Links.resolveUrl(hyperlink, itemTemplate.baseUrl);
        }

        return item;
    };

    const buildConfiguredItems = (semanticColumn, cellValue, rowVals) => {

        const items = [];

        for (let i = 0; i < semanticColumn.items.length; i++) {

            const item = buildConfiguredItem(semanticColumn.items[i], cellValue, rowVals);

            if (item) items.push(item);
        }

        return items;
    };

    const columnHasAnyProperty = (columnModel, propertyNames) => {

        if (!columnModel) return false;

        for (let i = 0; i < propertyNames.length; i++) {

            if (columnModel[propertyNames[i]]) return true;
        }

        return false;
    };

    const createModule = (tabularData) => {

        const columnModels = tabularData.ColumnModels;

        const getMenuItems = (cellValue, columnIndex, rowVals) => {

            const columnModel = columnModels[columnIndex];
            const menuItems = [];
            const semanticColumns = Ren.Config.getConfig().semanticColumns;

            for (let i = 0; i < semanticColumns.length; i++) {

                const semanticColumn = semanticColumns[i];

                if (!columnHasAnyProperty(columnModel, semanticColumn.columnProperties)) continue;

                const items = buildConfiguredItems(semanticColumn, cellValue, rowVals);

                for (let j = 0; j < items.length; j++) menuItems.push(items[j]);
            }

            for (let i = 0; i < semanticColumnMenus.length; i++) {

                const semanticColumnMenu = semanticColumnMenus[i];
                const columnProperties = semanticColumnMenu.columnProperties;

                if (columnProperties && !columnHasAnyProperty(columnModel, columnProperties)) {
                    continue;
                }

                const items = semanticColumnMenu.buildItems(cellValue, rowVals) || [];

                for (let j = 0; j < items.length; j++) menuItems.push(items[j]);
            }

            return menuItems;
        };

        return { getMenuItems };
    };

    // The "Search" items on their own, for hosts that search on something other than a grid cell.
    createModule.getStringSearchMenuItems = buildStringSearchItems;

    return createModule;
})();
