Ren.ShowAddDataSourceWindow = (triggeringElement) => {

    let content = null;
    let container = null;

    const update = () => {

        container.innerHTML = "";

        content = document.createElement("div");
        content.className = "ren-add-data-source-window__content";

        const form = document.createElement("form");
        form.className = "ren-add-data-source-window__form";
        content.appendChild(form);

        const sqlFilename = document.createElement("input");
        sqlFilename.type = "text";
        sqlFilename.className = "ren-add-data-source-window__sql-filename";
        sqlFilename.placeholder = "Data source name";
        form.appendChild(sqlFilename);

        const submitButton = document.createElement("button");
        submitButton.className = "ren-add-data-source-window__submit-button";
        submitButton.textContent = "Add";
        form.appendChild(submitButton);

        container.appendChild(content);

        form.addEventListener("submit", (e) => {

            e.preventDefault();
            Ren.Messages.Requests.addDataSource.notify(sqlFilename.value);
        });
    };

    const renderContent = (contentContainer) => {

        container = contentContainer;
        content && container.appendChild(content);
        update();
    };

    // Close any existing window.
    document.querySelectorAll(".ren-add-data-source-window").forEach(element => element.remove());

    let leftPos = 200;
    let topPos = 160;

    if (triggeringElement) {

        leftPos = triggeringElement.getBoundingClientRect().left + window.scrollX + 80;
        topPos = triggeringElement.getBoundingClientRect().top + window.scrollY + 80;
    }

    Ren.PopupWindow(
        "ren-add-data-source-window",
        renderContent,
        "Add Data Source",
        {
            leftPos,
            topPos
        }
    );
};

Ren.Messages.Requests.addDataSourceWindow.handle((triggeringElement) => {

    Ren.ShowAddDataSourceWindow(triggeringElement);
});
