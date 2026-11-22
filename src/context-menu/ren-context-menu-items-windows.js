/**
 * Functions to add items to the context menu which show settings.
 */
Ren.ContextMenuItems_Windows = (visualisation, tabularDataGuid, gridSetGuid, dataGridGuid) => {

    const getMenuItems = () => {

        const debugMenuItems = [];

        if (tabularDataGuid && dataGridGuid) {

            debugMenuItems.push({
                text: "Data grouping settings",
                id: "show-data-grouping-settings",
                action: () => {

                    Ren.Messages.Requests.dataGroupingSettingsDebugWindow.notify(dataGridGuid);
                }
            });

            debugMenuItems.push({
                text: "Grid state",
                id: "show-data-grid-settings",
                action: () => {

                    Ren.Messages.Requests.gridStateDebugWindow.notify(dataGridGuid);
                }
            });
        }

        if (visualisation) {

            debugMenuItems.push({
                text: "Visualisation settings",
                id: "show-visualisation-settings",
                action: () => {

                    Ren.Messages.Requests.visualisationSettingsDebugWindow.notify(visualisation.visualisationGuid);
                }
            });
        }

        debugMenuItems.push(Ren.MENU_SEPARATOR);

        debugMenuItems.push({
            text: "Data grouping settings collection",
            action: () => {

                Ren.Messages.Requests.dataGroupingSettingsCollectionDebugWindow.notify();
            }
        });

        debugMenuItems.push({
            text: "Grid state collection",
            action: () => {

                Ren.Messages.Requests.gridStateCollectionDebugWindow.notify();
            }
        });

        debugMenuItems.push({
            text: "Report context collection",
            id: "show-report-context-collection",
            action: () => {

                Ren.Messages.Requests.reportContextCollectionDebugWindow.notify();
            }
        });

        debugMenuItems.push({
            text: "Visualisation collection",
            id: "show-visualisation-collection",
            action: () => {

                Ren.Messages.Requests.visualisationCollectionDebugWindow.notify();
            }
        });

        const subMenuItems = [];

        subMenuItems.push({
            text: "JSON settings",
            id: "json-report-settings",
            className: "json-report-settings",
            action: () => {

                // Edit the settings of the report context the menu was opened from - the popup
                // report the click landed in, or the page's own report.
                Ren.ShowJsonReportSettingsEditorForElement(Ren.LastRightClickTarget);
            }
        });

        subMenuItems.push({
            text: "Data sources",
            id: "show-data-sources-window",
            action: () => {

                Ren.Messages.Requests.dataSourcesWindow.notify(Ren.LastRightClickTarget);
            }
        });

        subMenuItems.push(Ren.MENU_SEPARATOR);

        subMenuItems.push({
            text: "Debug",
            id: "debug-menu",
            submenu: debugMenuItems
        });

        const menuItems = [
            {
                section: "Tech",
                text: "Windows",
                id: "windows-menu",
                positionAtEndOfSection: true,
                techOnly: true,
                submenu: subMenuItems
            }
        ];

        if (gridSetGuid) {

            menuItems.push({
                section: "Other",
                text: "Export data",
                action: () => Ren.Messages.Requests.exportData.notify(gridSetGuid)
            });
        }

        if (visualisation && Ren.DataSources.isServerSideDataSource(visualisation.dataSourceUri)) {

            menuItems.push({
                section: "Other",
                text: "Settings groups...",
                id: "settings-groups",
                action: () => {

                    Ren.ShowSettingsGroupsPopupWindow(visualisation);
                }
            });
        }

        return menuItems;
    };

    return {
        getMenuItems
    };
};
