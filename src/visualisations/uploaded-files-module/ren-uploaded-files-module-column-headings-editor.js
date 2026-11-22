/**
 * The editor for an uploaded files group's default column headings, reached from the uploaded
 * files module's context menu.
 *
 * The headings are what the data's columns are called when the files have no header rows of their
 * own - so a user can upload a headingless file, or paste headingless data into a paste data
 * module, and still see meaningful column names rather than Column1, Column2 and so on.  Columns
 * the headings don't cover keep their auto-generated names.
 *
 * The headings are entered one per line, as in the paste data module's own headings box, and are
 * stored as a single pipe-separated group setting.
 */
Ren.UploadedFilesModuleColumnHeadingsEditor = (visualisation) => {

    const group = visualisation.uploadedFilesGroup;

    // Turns the stored pipe-separated setting into the one-per-line text shown in the editor.
    const settingToText = (value) => {

        return Ren.DataSourcesUploadedFiles.columnHeadingsToArray(value).join("\n");
    };

    // Turns the editor's one-per-line text back into the stored setting.  Trailing blank lines are
    // dropped, but a blank line between two headings is kept: it leaves that column with its
    // auto-generated name, which is the only way to name (say) just the third column.
    const textToSetting = (text) => {

        const lines = text.split("\n");
        const headings = [];

        for (let index = 0; index < lines.length; index++) {
            headings.push(lines[index].trim());
        }

        while (headings.length && headings[headings.length - 1] === "") {
            headings.pop();
        }

        return Ren.DataSourcesUploadedFiles.columnHeadingsToSetting(headings);
    };

    const open = () => {

        const settings = Ren.UploadedFilesGroupsCollection.getGroupSettings(group);

        const onOk = (text) => {

            Ren.UploadedFilesModuleUpdater.updateSetting(
                visualisation,
                "uploadedFilesColumnHeadings",
                textToSetting(text)
            );
        };

        Ren.CreateOkCancelTextEditorPopupWindow("Default column headings", onOk, {
            label: "One column heading per line, in column order.  Used when Header rows is No; " +
                "leave a line blank to keep a column's default name.  A file whose first row is " +
                "these headings has that row skipped.",
            initialText: settingToText(settings.uploadedFilesColumnHeadings),
            multiline: true,
            width: 420,
            height: 360
        });
    };

    return {
        open
    };
};
