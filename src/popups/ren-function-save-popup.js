/**
 * Asks for the name, description and tags a function editor's code is saved under.
 */
Ren.FunctionSavePopup = (() => {

    /**
     * Shows the popup.
     * @param {string} title - The window title.
     * @param {object} defaults - { name, description, tags } to fill the popup with.
     * @param {function} onSave - Called with (name, description, tags); returns, or resolves to,
     *     whether it saved, the popup staying open where it did not.
     */
    const show = (title, defaults, onSave) => {

        const renderContent = (contentContainer, popup) => {

            const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("FunctionSavePopup", {});

            contentContainer.appendChild(content);

            const nameInput = content.querySelector(".js-ren-function-save-popup-name");
            const descriptionInput = content.querySelector(".js-ren-function-save-popup-description");
            const tagCheckboxes = content.querySelectorAll(".js-ren-function-save-popup-tag");

            nameInput.value = defaults.name;
            descriptionInput.value = defaults.description;

            for (let index = 0; index < tagCheckboxes.length; index++) {

                tagCheckboxes[index].checked =
                    defaults.tags.indexOf(tagCheckboxes[index].value) !== -1;
            }

            const save = async () => {

                const name = Ren.FunctionLibrary.toFunctionName(nameInput.value);

                if (!name) {

                    Ren.PopupErrorMessage("Give the function a name.");
                    return;
                }

                const tags = [];

                for (let index = 0; index < tagCheckboxes.length; index++) {

                    if (tagCheckboxes[index].checked) tags.push(tagCheckboxes[index].value);
                }

                if (await onSave(name, descriptionInput.value.trim(), tags)) popup.closeWindow();
            };

            content.querySelector(".js-ren-function-save-popup-save").addEventListener("click", save);

            content.querySelector(".js-ren-function-save-popup-cancel")
                .addEventListener("click", () => popup.closeWindow());

            // Kept from the function editor behind, whose own Enter and Escape would act on it.
            content.addEventListener("keydown", (e) => {

                e.stopPropagation();

                if (e.key === "Escape") {

                    e.preventDefault();
                    popup.closeWindow();
                }
                else if (e.key === "Enter") {

                    e.preventDefault();
                    save();
                }
            });

            setTimeout(() => {

                nameInput.focus();
                nameInput.select();
            }, 0);
        };

        Ren.PopupWindow(
            "ren-function-save-popup",
            renderContent,
            title,
            {
                centred: true,
                autoSized: true,
                isResizable: false,
                verticalScrollbar: false,
                horizontalScrollbar: false
            }
        );
    };

    return {
        show
    };
})();
