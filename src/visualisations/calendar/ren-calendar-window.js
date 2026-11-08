/**
 * Opens a calendar window just below the element it was asked for from.  Calendars already open
 * are left open, so that several ranges can be kept in view at once.
 */
Ren.Messages.Requests.calendarWindow.handle((
    calendarGroup,
    title,
    startDate,
    endDate,
    anchorElement,
    pickSingleDate
) => {

    const anchorBounds = anchorElement.getBoundingClientRect();

    // Each calendar opens a little down and across from the last, so that one opened from the
    // same button does not hide those before it.
    const cascadeOffset = Ren.VisualisationCollection.getVisualisations("Calendar").length * 24;

    const popupLeft = Math.round(anchorBounds.left + window.scrollX + cascadeOffset);
    // A popup's top is that of its content, with its 26px title bar drawn above it.
    const TITLE_BAR_HEIGHT = 26;

    const popupTop =
        Math.round(anchorBounds.bottom + window.scrollY + 8 + TITLE_BAR_HEIGHT + cascadeOffset);

    Ren.VisualisationCreator.createVisualisation({
        visualisationTypeName: "Calendar",
        popupTitle: "📅 " + title,
        isPopup: true,
        popupLeft,
        popupTop,
        calendarGroup,
        startDate,
        endDate,
        pickSingleDate: pickSingleDate ?? false,
        // Raising the popup to fit would cover the box or button it was opened from.
        raisePopupToFitContent: false
    });
});
