/**
 * Renders the Markdown the docs use (headings, paragraphs, lists, fenced code, inline code, images,
 * links and __bold__) as HTML with the examples' classes, so the examples can show the docs
 * without a Markdown library.
 */
const Markdown = (() => {

    const escapeHtml = (text) => text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    // HTML code (an element, an attribute with a value, or a data- attribute) is coloured
    // differently to other code.
    const isHtmlCode = (code) => code.startsWith("<") || code.includes("=\"") ||
        code.startsWith("data-");

    const renderInline = (text) => {

        const parts = text.split(/(`[^`]+`)/);
        let html = "";

        for (let i = 0; i < parts.length; i++) {

            const part = parts[i];

            if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {

                const code = part.substring(1, part.length - 1);
                const className = isHtmlCode(code) ?
                    "ren-example__code ren-example__code--html" : "ren-example__code";

                html += "<code class=\"" + className + "\">" + escapeHtml(code) + "</code>";
            }
            else {

                // Images go first, so that the link pattern doesn't take their [alt](src).
                html += escapeHtml(part)
                    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img src=\"$2\" alt=\"$1\">")
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\">$1</a>")
                    .replace(/__([^_]+(?:_[^_]+)*)__/g, "<strong>$1</strong>");
            }
        }

        return html;
    };

    const render = (markdown) => {

        const lines = markdown.replace(/\r\n/g, "\n").split("\n");
        let html = "";
        let i = 0;

        while (i < lines.length) {

            const line = lines[i];

            if (line.trim() === "") {

                i++;
                continue;
            }

            if (line.startsWith("```")) {

                const language = line.substring(3).trim();
                const codeLines = [];

                i++;

                while (i < lines.length && !lines[i].startsWith("```")) {

                    codeLines.push(lines[i]);
                    i++;
                }

                i++;

                const className = language === "html" ?
                    "ren-example__code ren-example__code--html-block" : "ren-example__code";

                html += "<pre class=\"ren-example__code-block\">" +
                    "<code class=\"" + className + "\">" + escapeHtml(codeLines.join("\n")) +
                    "</code></pre>\n";
                continue;
            }

            const heading = /^(#{1,6}) (.*)$/.exec(line);

            if (heading) {

                const level = heading[1].length;

                const className = level === 1 ? " class=\"ren-example__title\"" : "";

                html += "<h" + level + className + ">" + renderInline(heading[2]) + "</h" + level +
                    ">\n";
                i++;
                continue;
            }

            const listItemPattern = /^(-|\d+\.) (.*)$/;

            if (listItemPattern.test(line)) {

                const tagName = line.startsWith("-") ? "ul" : "ol";
                const items = [];

                // An item carries on over the indented lines after it.
                while (i < lines.length && listItemPattern.test(lines[i])) {

                    let item = listItemPattern.exec(lines[i])[2];

                    i++;

                    while (i < lines.length && /^\s+\S/.test(lines[i])) {

                        item += " " + lines[i].trim();
                        i++;
                    }

                    items.push("<li>" + renderInline(item) + "</li>");
                }

                html += "<" + tagName + " class=\"ren-example__list\">\n" + items.join("\n") +
                    "\n</" + tagName + ">\n";
                continue;
            }

            const paragraphLines = [];

            while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") &&
                !/^#{1,6} /.test(lines[i]) && !listItemPattern.test(lines[i])) {

                paragraphLines.push(lines[i].trim());
                i++;
            }

            const paragraph = paragraphLines.join(" ");

            // An image on its own isn't a paragraph, so it isn't indented like one.
            if (/^!\[[^\]]*\]\([^)]+\)$/.test(paragraph)) {
                html += renderInline(paragraph) + "\n";
            }
            else {
                html += "<p class=\"ren-example__paragraph\">" + renderInline(paragraph) + "</p>\n";
            }
        }

        return html;
    };

    return {
        render
    };
})();
