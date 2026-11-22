/**
 * Creates a small non-modal popup window of a slider choosing a date/value chart's colour scheme
 * (see Ren.DateValueChart_ColourSchemes), which recolours the chart as it is slid.  There is no
 * OK button: the window is closed by its title bar, a click outside it, or Enter or Escape, and
 * onClose is called as it closes.
 *
 * @param {number} schemeIndex - The index of the scheme the chart has now.
 * @param {function} applyScheme - Recolours the chart in the scheme at the index passed.
 * @param {function} onClose - Called as the window closes, with whether the scheme was changed.
 */
Ren.CreateDateValueChartColourSchemePopupWindow = (
    schemeIndex,
    applyScheme,
    onClose,
    centredOnPoint) => {

    const schemes = Ren.DateValueChart_ColourSchemes;

    let hasChanged = false;

    const renderContent = (contentContainer, popup) => {

        const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "DateValueChartColourSchemePopup",
            { max: schemes.length - 1 }
        );

        const slider = content.querySelector(".js-ren-colour-scheme-popup-slider");
        const numberElement = content.querySelector(".js-ren-colour-scheme-popup-number");
        const nameElement = content.querySelector(".js-ren-colour-scheme-popup-name");
        const swatchesElement = content.querySelector(".js-ren-colour-scheme-popup-swatches");

        const showScheme = (index) => {

            const scheme = schemes[index];

            numberElement.textContent = index;
            nameElement.textContent = scheme.name;
            swatchesElement.replaceChildren();

            for (let i = 0; i < scheme.palette.length; i++) {

                const swatch = document.createElement("span");

                swatch.className = "ren-date-value-chart-colour-scheme-popup__swatch";
                swatch.style.backgroundColor = scheme.palette[i];
                swatchesElement.appendChild(swatch);
            }
        };

        slider.value = schemeIndex;
        showScheme(schemeIndex);

        slider.addEventListener("input", () => {

            const index = parseInt(slider.value, 10);

            if (index === schemeIndex) return;

            schemeIndex = index;
            hasChanged = true;

            showScheme(index);
            applyScheme(index);
        });

        content.addEventListener("keydown", e => {

            e.stopPropagation();

            if (e.key === "Escape" || e.key === "Enter") {

                e.preventDefault();
                popup.closeWindow();
            }
        });

        contentContainer.appendChild(content);

        slider.focus();
    };

    Ren.PopupWindow(
        "ren-date-value-chart-colour-scheme-popup",
        renderContent,
        "Colours",
        {
            width: 260,
            height: 96,
            centred: false,
            centredOnPoint: centredOnPoint || null,
            isResizable: false,
            verticalScrollbar: false,
            horizontalScrollbar: false,
            closeWhenFocusLost: true,
            onClose: () => onClose(hasChanged)
        }
    );
};
