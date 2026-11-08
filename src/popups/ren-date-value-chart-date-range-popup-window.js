/**
 * Creates a small non-modal popup window holding the date/value chart's own date range: the From
 * and To dates the chart is reduced to (see Ren.DateValueChart_DateRange).  As with the number
 * editor, there are no OK or Apply buttons - each end is reported as it is changed, so the chart
 * narrows as the dates are picked and the window is closed once it looks right.
 *
 * Either end can be left blank for an open one, and the Reset button clears both.
 *
 * Options: { from, to, min, max, onChange, centredOnPoint, onClose }.  min and max bound the
 * pickers to the dates the data actually holds.
 */
Ren.CreateDateValueChartDateRangePopupWindow = (options) => {

    const renderContent = (contentContainer, popup) => {

        const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "DateValueChartDateRangePopup",
            {
                min: options.min || "",
                max: options.max || ""
            }
        );

        contentContainer.appendChild(content);

        const fromInput = content.querySelector(".js-ren-date-range-popup-from");
        const toInput = content.querySelector(".js-ren-date-range-popup-to");
        const clearButton = content.querySelector(".js-ren-date-range-popup-clear");

        fromInput.value = options.from || "";
        toInput.value = options.to || "";

        // A date input reports an incomplete date as an empty value, which reads as an open end
        // rather than as a date to wait for, so a half-typed range simply leaves that end open.
        const applyRange = () => {

            options.onChange(fromInput.value || null, toInput.value || null);
        };

        fromInput.addEventListener("change", () => applyRange());
        toInput.addEventListener("change", () => applyRange());

        clearButton.addEventListener("click", () => {

            fromInput.value = "";
            toInput.value = "";
            applyRange();
        });

        const handleKeyDown = (e) => {

            e.stopPropagation();

            if (e.key === "Escape") {

                e.preventDefault();
                popup.closeWindow();
            }
            else if (e.key === "Enter") {

                e.preventDefault();
                applyRange();
                popup.closeWindow();
            }
        };

        fromInput.addEventListener("keydown", e => handleKeyDown(e));
        toInput.addEventListener("keydown", e => handleKeyDown(e));

        setTimeout(() => {

            window.getSelection()?.removeAllRanges();
            fromInput.focus();
        }, 0);
    };

    Ren.PopupWindow(
        "ren-date-range-popup",
        renderContent,
        "Date range",
        {
            width: options.width || 210,
            height: options.height || 130,
            centred: false,
            centredOnPoint: options.centredOnPoint || null,
            isResizable: false,
            verticalScrollbar: false,
            horizontalScrollbar: false,
            onClose: options.onClose
        }
    );
};
