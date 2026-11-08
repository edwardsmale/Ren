Ren.LoadSaveReportSettingsWindow_ReportSettings = (settingsGroup) => {

    return {
        "settingsVersion": "Crocodile",
        "dataGroupingSettings": {

            [settingsGroup]: {
                "dataRows": {
                    "columns": {
                        " ": {
                            "valueFormatFunction": {
                                "name": "value-if",
                                "parameters": {
                                    "value": "<b>➤</b>"
                                }
                            }
                        },
                        "Report": {
                            "valueFormatFunction": {
                                "name": "append-string-if",
                                "parameters": {
                                    "sourceColumn": "IsPreset",
                                    "stringToAppend": " - <b>preset</b>"
                                }
                            }
                        },
                        "Name": {
                            "valueFormatFunction": {
                                "name": "replace-blanks",
                                "parameters": {
                                    "replacement": "<i style='color: gray'>none</i>"
                                }
                            }
                        },
                        "Load": {
                            "valueFormatFunction": {
                                "name": "load-save-report-settings-window-load-button"
                            }
                        },
                        "Save": {
                            "valueFormatFunction": {
                                "name": "load-save-report-settings-window-save-button"
                            }
                        },
                        "Delete": {
                            "valueFormatFunction": {
                                "name": "load-save-report-settings-window-delete-button"
                            }
                        }
                    }
                },
                "groupings": {
                    "entries": [
                        {
                            "groupByColumns": []
                        }
                    ]
                },
                "totalsRow": {
                    "position": "None"
                }
            }
        },
        "gridState": {

            [settingsGroup]: {
                "columnWidths": {
                    " ": "20",
                    "Report": "300",
                    "Load": "50",
                    "Save": "50",
                    "Delete": "60"
                },
                "visibleColumns": [
                    " ",
                    "Report",
                    "Name",
                    "Load",
                    "Save",
                    "Delete"
                ],
                "showRowAndColumnHeadings": 0
            }
        }
    };
};
