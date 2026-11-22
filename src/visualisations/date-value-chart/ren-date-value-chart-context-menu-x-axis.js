/**
 * Adds context menu items to x-axis (date axis) for controlling how the axis updates when data
 * changes.
 */
Ren.DateValueChart_ContextMenu_XAxis = (props, visualisation) => {

    const setupXAxisContextMenu = () => {

        const containerElement = document.querySelector("." + props.guid);
        if (!containerElement) return;

        const setUpdateXScaleBehaviour = (behaviour) => {

            if (visualisation) {

                if (!visualisation.xAxis) visualisation.xAxis = {};
                visualisation.xAxis.updateXScaleBehaviour = behaviour;
            }

            if (props.axes.xAxis) {

                props.axes.xAxis.updateXScaleBehaviour = behaviour;
            }

            props.skipExtentRecalculation = false;

            if (typeof props.redrawChart === "function") {
                props.redrawChart();
            }

            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
        };

        const getUpdateXScaleBehaviour = () => {

            return props.axes.xAxis?.updateXScaleBehaviour || "AlwaysUpdate";
        };

        // Setup context menu for x-axis.
        const xAxisElement = containerElement.querySelector(".ren-x-axis.ren-date-axis");

        if (xAxisElement) {

            xAxisElement.addEventListener("contextmenu", (event) => {

                xAxisElement._lastContextMenuEvent = event;
            }, true);

            const menuItems = [
                {
                    section: "X-Axis",
                    text: "Scale behaviour",
                    id: "scale-behaviour-x",
                    submenu: [
                        {
                            text: "Always Update",
                            action: () => setUpdateXScaleBehaviour("AlwaysUpdate"),
                            ticked: () => getUpdateXScaleBehaviour() === "AlwaysUpdate"
                        },
                        {
                            text: "Ratchet",
                            action: () => setUpdateXScaleBehaviour("Ratchet"),
                            ticked: () => getUpdateXScaleBehaviour() === "Ratchet"
                        }
                    ]
                }
            ];
            Ren.AddContextMenuItems(xAxisElement, menuItems);
        }
    };

    return {
        setupXAxisContextMenu
    };
};
