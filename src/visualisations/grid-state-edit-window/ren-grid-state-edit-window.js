/**
 * Sets up the window for editing a datagrid or gridset visualisation's settings.
 */
Ren.GridStateEditWindow = (visualisation) => {

    const renderContent = (contentContainer) => {

        const content = document.createElement("div");
        content.classList.add("ren-visualisation-settings-window");
        contentContainer.appendChild(content);
        tabSelector.renderTabSelector(content);
        showRowAndColumnHeadingsCheckbox.renderShowRowAndColumnHeadingsCheckbox(content);
    };

    const tabSelector = Ren.GridStateEditWindow_TabSelector(visualisation);
    const showRowAndColumnHeadingsCheckbox = Ren.GridStateEditWindow_ShowRowAndColumnHeadingsCheckbox(visualisation);

    const title = visualisation.visualisationTypeName + " Settings";

    let popupWindow = null;

    const openSettingsWindow = (triggeringElement) => {

        popupWindow?.closeWindow();

        const triggeringElementRect = triggeringElement.getBoundingClientRect();

        const leftPos = triggeringElementRect.left + window.scrollX + 20;
        const topPos =  triggeringElementRect.top + window.scrollY + 40;

        popupWindow = Ren.PopupWindow(
            "ren-grid-state-edit-window",
            renderContent,
            title,
            {
                width: 400,
                height: 80,
                leftPos,
                topPos,
                verticalScrollbar: false,
                horizontalScrollbar: false
            }
        );
    };

    const settingsButton = Ren.SmallEditButton.create(title);
    settingsButton.style.position = "absolute";
    settingsButton.style.top = "-18px";
    settingsButton.style.right = "180px";

    settingsButton.addEventListener("click", () => {

        openSettingsWindow(settingsButton);
    });

    if (!visualisation.instance) return;

    if (!visualisation.element) return;

    const quickLinksElement = visualisation.element.querySelector(".js-ren-dataGrid-quick-links");

    if (quickLinksElement) {
        quickLinksElement.appendChild(settingsButton);
    }
};
