/**
 * Creates a small non-modal popup window holding a single number, with spinners, for the settings
 * that are a number and are worth seeing take effect as they are changed.  There are no OK or Apply
 * buttons: the number is reported as it changes, so the window is closed by its title bar - or with
 * Enter or Escape - once the value looks right.
 *
 * Options: { label, min, max, step, width, height, centredOnPoint, onClose,
 * applyTypedValuesOnEnter, showSlider, closeWhenFocusLost }.  applyTypedValuesOnEnter reports a
 * typed number only on Enter, for settings too costly to apply on every keystroke.  showSlider
 * adds a slider beneath the field, kept in step with it.  closeWhenFocusLost closes the window
 * when anything outside it is clicked.
 */
Ren.CreateNumberEditorPopupWindow = (title, initialValue, onChange, options) => {

    const width = (options && options.width) || 160;
    const height = (options && options.height) || 100;
    const min = options && options.min !== undefined ? options.min : 1;
    const max = options && options.max !== undefined ? options.max : 100;
    const step = (options && options.step) || 1;

    const renderContent = (contentContainer, popup) => {

        const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("NumberEditorPopup", {
            label: (options && options.label) || "",
            min: min,
            max: max,
            step: step
        });

        contentContainer.appendChild(content);

        const inputField = content.querySelector(".js-ren-number-editor-popup-input");
        inputField.value = initialValue;

        // The input reports every change - a keystroke, a spinner click, an arrow key - and an
        // incomplete or out-of-range one is ignored rather than reported, so that a half-typed
        // number does not take effect on the way to the one being typed.
        const applyValue = () => {

            const value = parseFloat(inputField.value);

            if (isNaN(value) || value < min || value > max) return;

            onChange(value);
        };

        // Typing and pasting report an insert or delete inputType; a spinner click or arrow key
        // step reports none, so is still applied at once.
        const isTypedChange = e => /^(insert|delete)/.test(e.inputType || "");

        const slider = content.querySelector(".js-ren-number-editor-popup-slider");

        if (options && options.showSlider) {

            slider.hidden = false;
            slider.value = initialValue;

            slider.addEventListener("input", () => {

                inputField.value = slider.value;
                applyValue();
            });
        }

        inputField.addEventListener("input", e => {

            const value = parseFloat(inputField.value);

            if (!slider.hidden && !isNaN(value) && value >= min && value <= max) {

                slider.value = value;
            }

            if (options && options.applyTypedValuesOnEnter && isTypedChange(e)) return;

            applyValue();
        });

        inputField.addEventListener("keydown", e => {

            e.stopPropagation();

            if (e.key === "Escape") {

                e.preventDefault();
                popup.closeWindow();
            }
            else if (e.key === "Enter") {

                e.preventDefault();
                applyValue();
                popup.closeWindow();
            }
        });

        setTimeout(() => {

            window.getSelection()?.removeAllRanges();
            inputField.focus();
            inputField.select();
        }, 0);
    };

    Ren.PopupWindow(
        "ren-number-editor-popup",
        renderContent,
        title,
        {
            width: width,
            height: height,
            centred: false,
            centredOnPoint: (options && options.centredOnPoint) || null,
            isResizable: false,
            verticalScrollbar: false,
            horizontalScrollbar: false,
            onClose: options && options.onClose,
            closeWhenFocusLost: !!(options && options.closeWhenFocusLost)
        }
    );
};
