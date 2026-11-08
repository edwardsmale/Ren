Ren.DataGridVariationsWindow_ReportSettings = () => {

    return {
        "settingsVersion": "Crocodile",
        "dataGroupingSettings": {
            "DataGridVariationsWindow": {
                "dataRows": {
                    "columns": {
                        "Tooltip": {
                            "valueFormatFunction": {
                                "name": "text-colour",
                                "parameters": {
                                    "colour": "#666666"
                                }
                            }
                        },
                        "Apply": {
                            "valueFormatFunction": {
                                "name": "data-grid-variations-window-apply-button"
                            }
                        },
                        "Update": {
                            "valueFormatFunction": {
                                "name": "data-grid-variations-window-update-button"
                            }
                        },
                        "Remove": {
                            "valueFormatFunction": {
                                "name": "data-grid-variations-window-remove-button"
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
            "DataGridVariationsWindow": {
                "columnWidths": {
                    "Index": 50,
                    "Apply": 50,
                    "Update": 60,
                    "Remove": 65
                },
                "visibleColumns": [
                    "Index",
                    "Label",
                    "Apply",
                    "Update",
                    "Remove"
                ]
            }
        }
    };
};
