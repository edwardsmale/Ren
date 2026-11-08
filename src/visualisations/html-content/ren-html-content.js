/**
 * Renders a static blob of HTML held in the visualisation's contentHtml property.  Unlike the
 * content module, it is not data-driven - it simply renders the stored markup.
 */
Ren.CreateHtmlContent = (_tabularData, visualisation) => {

    const htmlContent = document.createElement("div");
    htmlContent.classList.add("ren-html-content");

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let i = 0; i < cssClasses.length; i++) {

            if (cssClasses[i]) htmlContent.classList.add(cssClasses[i]);
        }
    }

    Ren.HtmlUtils.setHTML(htmlContent, visualisation.contentHtml);

    // Right-click the module to edit the markup it renders.  Omitted in downloaded reports, whose
    // settings cannot be saved back, so there would be nothing to keep the edit.
    if (!Ren.UrlContext.isDownloadedReport()) {

        const editor = Ren.HtmlContentEditor(visualisation, htmlContent);

        Ren.AddContextMenuItems(htmlContent, () => [editor.getMenuItem()]);
    }

    return {
        element: htmlContent
    };
};
