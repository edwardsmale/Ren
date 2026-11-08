/**
 * Creates a small non-modal popup window of a slider for each of a visualisation's CSS filter
 * effects (see Ren.VisualisationEffects), which take effect as they are changed.  There is no OK
 * button: the window is closed by its title bar, or with Enter or Escape, and the effects are
 * committed as it closes.
 */
Ren.CreateVisualisationEffectsPopupWindow = (visualisation, centredOnPoint) => {

    const effects = Ren.VisualisationEffects.EFFECTS;

    let hasChanged = false;

    const setEffectValue = (effect, value) => {

        visualisation[effect.property] = value;
        hasChanged = true;

        Ren.VisualisationEffects.applyEffects(visualisation);
    };

    /**
     * Renders the row of one effect, returning a function that shows a value set elsewhere.
     */
    const renderEffectRow = (rowsElement, effect) => {

        const row = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("VisualisationEffectsPopupRow", {
            label: effect.label,
            unitLabel: effect.unitLabel,
            min: effect.min,
            max: effect.max
        });

        const inputField = row.querySelector(".js-ren-visualisation-effects-popup-input");
        const slider = row.querySelector(".js-ren-visualisation-effects-popup-slider");

        const showValue = (value) => {

            inputField.value = value;
            slider.value = value;
        };

        showValue(Ren.VisualisationEffects.getValue(visualisation, effect));

        slider.addEventListener("input", () => {

            inputField.value = slider.value;
            setEffectValue(effect, parseFloat(slider.value));
        });

        // Gets a value indicating whether a mouse event is over the slider's knob, which is as wide
        // as the range-slider is high.
        const isOverKnob = (e) => {

            const bounds = slider.getBoundingClientRect();
            const knobWidth = bounds.height;
            const fraction = (parseFloat(slider.value) - effect.min) / (effect.max - effect.min);
            const knobCentre = bounds.left + knobWidth / 2 + fraction * (bounds.width - knobWidth);

            return Math.abs(e.clientX - knobCentre) <= knobWidth / 2;
        };

        slider.addEventListener("dblclick", e => {

            if (!isOverKnob(e)) return;

            const defaultValue = Ren.VisualisationEffects.getDefaultValue(effect);

            showValue(defaultValue);
            setEffectValue(effect, defaultValue);
        });

        // A half-typed or out-of-range number is ignored rather than applied.
        inputField.addEventListener("input", () => {

            const value = parseFloat(inputField.value);

            if (isNaN(value) || value < effect.min || value > effect.max) return;

            slider.value = value;
            setEffectValue(effect, value);
        });

        rowsElement.appendChild(row);

        return showValue;
    };

    const renderContent = (contentContainer, popup) => {

        const content =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("VisualisationEffectsPopup", {});
        const rowsElement = content.querySelector(".js-ren-visualisation-effects-popup-rows");

        const showValues = [];

        for (let i = 0; i < effects.length; i++) {

            showValues.push(renderEffectRow(rowsElement, effects[i]));
        }

        const resetButton = content.querySelector(".js-ren-visualisation-effects-popup-reset");

        resetButton.addEventListener("click", () => {

            for (let i = 0; i < effects.length; i++) {

                const defaultValue = Ren.VisualisationEffects.getDefaultValue(effects[i]);

                visualisation[effects[i].property] = defaultValue;
                showValues[i](defaultValue);
            }

            hasChanged = true;

            Ren.VisualisationEffects.applyEffects(visualisation);
        });

        content.addEventListener("keydown", e => {

            e.stopPropagation();

            if (e.key === "Escape" || (e.key === "Enter" && e.target.tagName !== "BUTTON")) {

                e.preventDefault();
                popup.closeWindow();
            }
        });

        contentContainer.appendChild(content);
    };

    Ren.PopupWindow(
        "ren-visualisation-effects-popup",
        renderContent,
        "Effects",
        {
            width: 320,
            height: 248,
            centred: false,
            centredOnPoint: centredOnPoint || null,
            isResizable: false,
            verticalScrollbar: false,
            horizontalScrollbar: false,
            onClose: () => {

                if (hasChanged) Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }
        }
    );
};
