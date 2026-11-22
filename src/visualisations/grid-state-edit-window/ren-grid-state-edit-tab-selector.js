/**
 * Sets up the tab selector in the datagrid/gridset settings window.
 */
Ren.GridStateEditWindow_TabSelector = (visualisation) => {

    const selectTab = (tab) => {

        if (visualisation.visualisationTypeName === "GridSet") {

            visualisation.dataTabIndexes = [tab];
            delete visualisation.dataTabIndex;
        }

        visualisation.dataTabGroup = null;
        updateTabValue();
        visualisation.recreate();
    };

    const getTabMenuItems = (selectTab) => {

        const tabMenuItems = [];

        for (let i = 1; i <= 10; i++) {

            tabMenuItems.push({
                text: () => i.toString(),
                action: () => selectTab(i)
            });
        }

        return tabMenuItems;
    };

    const formatTabValue = () => {

        if (visualisation.dataTabGroup) {
            return "Tab Group: " + visualisation.dataTabGroup;
        }
        else if (visualisation.dataTabIndexes) {

            if (visualisation.dataTabIndexes.length === 1) {
                return "Tab Index: " + visualisation.dataTabIndexes[0];
            }
            else {

                return "Tab Indexes: " + visualisation.dataTabIndexes.join(", ");
            }
        }
        else {

            return "All Tabs";
        }
    };

    const tabValue = Ren.HtmlUtils.create("span")
        ._style("user-select", "none");

    const updateTabValue = () => {

        tabValue._text(formatTabValue(visualisation));
    };

    const renderTabSelector = (container) => {

        const tabSelector = document.createElement("div");
        const label = document.createElement("label");

        updateTabValue();

        label.appendChild(tabValue);

        const button = Ren.SmallEditButton.create("Select Tab");
        label.appendChild(button);

        tabSelector.appendChild(label);
        container.appendChild(tabSelector);

        const menuItems = getTabMenuItems(selectTab);
        Ren.AddButtonMenuItems(button, menuItems);
    };

    return {
        renderTabSelector
    };
};
