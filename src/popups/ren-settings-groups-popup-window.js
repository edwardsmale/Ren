/**
 * Creates a non-modal popup window for viewing and editing a visualisation's data grouping
 * settings group and filter group.  On OK, the visualisation's groups are updated and it is
 * redrawn; on Cancel, no change is made.
 *
 * A visualisation type with groups of its own beyond those two - a date/value chart's date markers
 * filter group and date range group - is offered a field each, but only where its type declares
 * them: the window is shown for every visualisation, and a field for a setting a visualisation has
 * no use for is a field that does nothing.
 */
Ren.ShowSettingsGroupsPopupWindow = (visualisation) => {

    const fieldStyle = `
        padding: 6px;
        border: 1px solid #999;
        font-family: Calibri, Arial, sans-serif;
        box-sizing: border-box;
        margin-bottom: 10px;
        outline: none;
    `;

    const visualisationType =
        Ren.VisualisationTypes.getByTypeName(visualisation.visualisationTypeName);

    const hasDateMarkersFilterGroup = !!visualisationType?.availableOptions?.dateMarkersFilterGroup;
    const hasDateRangeGroup = !!visualisationType?.availableOptions?.dateRangeGroup;

    const renderContent = (contentContainer, popup) => {

        contentContainer.style.cssText += "display: flex; flex-direction: column; height: 100%; overflow: hidden;";

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display: flex; flex-direction: column; flex: 1; padding: 12px; min-height: 0;";

        const createField = (labelText, initialValue) => {

            const label = document.createElement("label");
            label.style.cssText = "font-size: 0.875rem; margin-bottom: 4px;";
            label.textContent = labelText;

            const input = document.createElement("input");
            input.type = "text";
            input.value = initialValue || "";
            input.style.cssText = fieldStyle;

            wrapper.appendChild(label);
            wrapper.appendChild(input);

            return input;
        };

        const dataGroupingSettingsGroupInput = createField(
            "Data Grouping Settings Group:",
            visualisation.dataGroupingSettingsGroup
        );

        const filterGroupInput = createField(
            "Filter Group:",
            visualisation.filterGroup
        );

        // The group a date/value chart's dates grid keeps its marker filter under, which is what
        // ties the two together (see Ren.DateValueChart_DateMarkersGrid).
        const dateMarkersFilterGroupInput =
            hasDateMarkersFilterGroup
                ?createField("Date Markers Filter Group:", visualisation.dateMarkersFilterGroup)
                : null;

        // The group a date/value chart shares its date range under, which defaults to its filter
        // group (see Ren.DateValueChart_DateRange_Following).
        const dateRangeGroupInput =
            hasDateRangeGroup
                ?createField("Date Range Group:", visualisation.dateRangeGroup)
                : null;

        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.cssText = "display: flex; gap: 6px; justify-content: flex-end;";

        const createButton = (text, onClick) => {

            const button = document.createElement("button");
            button.textContent = text;
            button.addEventListener("click", onClick);
            return button;
        };

        const applySettingsGroups = () => {

            visualisation.dataGroupingSettingsGroup = dataGroupingSettingsGroupInput.value.trim();
            visualisation.filterGroup = filterGroupInput.value.trim();

            if (dateMarkersFilterGroupInput) {

                // Emptied means "no group of its own", which is a chart falling back to a group
                // named after itself - not a chart whose group is the empty string.
                visualisation.dateMarkersFilterGroup =
                    dateMarkersFilterGroupInput.value.trim() || null;
            }

            if (dateRangeGroupInput) {

                // Emptied means "follow the filter group", not a group named the empty string.
                visualisation.dateRangeGroup = dateRangeGroupInput.value.trim() || null;
            }

            visualisation.recreate();
        };

        const okButton = createButton("OK", () => {

            applySettingsGroups();
            popup.closeWindow();
        });

        const cancelButton = createButton("Cancel", () => {

            popup.closeWindow();
        });

        buttonsDiv.appendChild(okButton);
        buttonsDiv.appendChild(cancelButton);

        wrapper.appendChild(buttonsDiv);
        contentContainer.appendChild(wrapper);
    };

    // Each optional field (label, input and its margin) needs about 64px on top of the two
    // fields every visualisation has.
    const optionalFieldCount = (hasDateMarkersFilterGroup ? 1 : 0) + (hasDateRangeGroup ? 1 : 0);

    Ren.PopupWindow(
        "ren-settings-groups-popup",
        renderContent,
        "Settings groups",
        {
            width: 320,
            height: 280 + optionalFieldCount * 64,
            centred: true,
            isResizable: true,
            verticalScrollbar: false,
            horizontalScrollbar: false
        }
    );
};
