/**
 * The uploaded files module's view settings: which of its parts (the two buttons and the three
 * editable settings rows) are shown.  Reached from the module's context menu as a "View settings"
 * submenu, so a report author can pare the module down to just the parts a report needs - for
 * example only a Paste data button, with no filenames or delimiter on display.
 * Every part is shown by default, so only the parts the user has switched off are stored (in
 * visualisation.viewSettings, saved with the report settings - see the module's visualisation
 * type).  An untouched module therefore adds nothing to the saved settings.
 */
Ren.UploadedFilesModuleViewSettings = (visualisation, render) => {

    // The settings, in the order they appear in the submenu.  Each key is also the name the setting
    // is stored and looked up under.
    const settingDescriptors = [
        {
            key: "showUploadButton",
            text: "Show 'Upload files' button",
            id: "uploaded-files-module-show-upload-button"
        },
        {
            key: "showPasteDataButton",
            text: "Show 'Paste data' button",
            id: "uploaded-files-module-show-paste-data-button"
        },
        {
            key: "showFilenames",
            text: "Show filenames",
            id: "uploaded-files-module-show-filenames"
        },
        {
            key: "showDelimiter",
            text: "Show delimiter",
            id: "uploaded-files-module-show-delimiter"
        },
        {
            key: "showHeaderRows",
            text: "Show header rows option",
            id: "uploaded-files-module-show-header-rows"
        }
    ];

    // Read fresh each time rather than held in a variable: loading a different set of report
    // settings replaces the whole object on the visualisation.
    const getViewSettings = () => visualisation.viewSettings || {};

    // Whether a part is shown.  Anything not explicitly switched off is shown.
    const isShown = (key) => getViewSettings()[key] !== false;

    // Switches a part on or off, then re-renders the module.  Switching a part back on removes its
    // entry entirely (rather than storing true), so the saved settings only ever carry the parts
    // the user has hidden.
    const toggle = (key) => {

        const viewSettings = visualisation.viewSettings ?? (visualisation.viewSettings = {});

        if (isShown(key)) {
            viewSettings[key] = false;
        }
        else {

            delete viewSettings[key];
        }

        if (Ren.ObjectUtils.isEmptyObject(viewSettings)) delete visualisation.viewSettings;

        render();
    };

    // Submenu items (no section needed: submenus render in the given order rather than
    // being sorted), each ticked while its part is shown.
    const buildSubmenuItems = () => {

        const items = [];

        for (let index = 0; index < settingDescriptors.length; index++) {

            const descriptor = settingDescriptors[index];

            items.push({
                text: descriptor.text,
                id: descriptor.id,
                ticked: () => isShown(descriptor.key),
                action: () => toggle(descriptor.key)
            });
        }

        return items;
    };

    const getMenuItem = () => ({
        section: "Uploaded files",
        text: "View settings",
        id: "uploaded-files-module-view-settings",
        submenu: buildSubmenuItems()
    });

    return {
        isShown,
        getMenuItem
    };
};
