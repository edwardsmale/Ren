/**
 * Generates HTML to display report generation errors on the Home and Editor pages.
 */
Ren.ReportRunner_ErrorHtmlGenerator = (() => {

    const generateErrorHtml = (error, details, sqlThatFailed) => {

        const element = Ren.HtmlUtils.create("div")
            ._addClass("ren-report-editor__error-details-container");

        element._append(
            Ren.HtmlUtils.create("h3")
                ._addClass("ren-report-editor__preview-content_error-heading")
                ._addClass("qa-ren-report-editor-preview-content_error-heading")
                ._text("An error occurred while generating the report")
        );

        error = Ren.TextUtils.removeTrailing(error, ".");

        element._append(
            Ren.HtmlUtils.create("div")
                ._addClass("ren-report-editor__preview-content_error-message")
                ._addClass("qa-ren-report-editor-preview-content_error-message")
                ._text(error)
        );

        if (details) {

            const detailsElement = Ren.HtmlUtils.create("div");

            detailsElement._append(
                Ren.HtmlUtils.create("h4")
                    ._addClass("ren-report-editor__preview-content_error-details-heading")
                    ._text("Details")
            );

            detailsElement._append(
                Ren.HtmlUtils.create("pre")
                    ._addClass("ren-report-editor__preview-content_error-details")
                    ._text(details)
            );

            element._append(detailsElement);
        }

        if (sqlThatFailed) {

            const sqlElement = Ren.HtmlUtils.create("div");

            sqlElement._append(
                Ren.HtmlUtils.create("h4")
                    ._addClass("ren-report-editor__preview-content_error-sql-heading")
                    ._text("SQL")
            );

            sqlElement._append(
                Ren.HtmlUtils.create("pre")
                    ._addClass("ren-report-editor__preview-content_error-sql")
                    ._text(sqlThatFailed)
            );

            element._append(sqlElement);
        }

        return element.outerHTML;
    };

    return {
        generateErrorHtml
    };
})();
