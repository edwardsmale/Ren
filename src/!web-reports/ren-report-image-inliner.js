/**
 * Inlines the images a report references into its download as base64 data URIs, so that they
 * still show when the download is opened without access to the servers they came from.
 *
 * Images in the downloaded markup have their sources replaced directly.  Images a visualisation
 * renders are gone from the download, which rebuilds its visualisations when opened, so they are
 * carried in a script element mapping each source to its data URI instead, and swapped in as the
 * downloaded report renders them.
 */
Ren.ReportImageInliner = (() => {

    const IMAGES_SCRIPT_CLASS = "ren-inlined-images";

    // Marks an image whose source was replaced in the download, holding the source it replaced.
    const ORIGINAL_SRC_ATTRIBUTE = "data-inlined-image-src";

    const cssUrlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;

    // Keyed by source as written in the markup, since the downloaded report renders it the same.
    let inlinedImages = {};

    // The images the download itself carried, which a download of it carries on in turn.
    let embeddedImages = {};

    const isInlinable = (source) => {

        return !!source && !/^(data|blob|javascript|about):/i.test(source.trim());
    };

    const getCssUrls = (styleText) => {

        const urls = [];

        if (!styleText || styleText.indexOf("url(") === -1) return urls;

        cssUrlPattern.lastIndex = 0;

        let match;

        while ((match = cssUrlPattern.exec(styleText)) !== null) {
            urls.push(match[2]);
        }

        return urls;
    };

    const replaceCssUrls = (styleText, getDataUri) => {

        return styleText.replace(cssUrlPattern, (match, quote, source) => {

            const dataUri = getDataUri(source);

            return dataUri ? "url(\"" + dataUri + "\")" : match;
        });
    };

    const collectImageSources = (root, sources) => {

        root.querySelectorAll("img[src]").forEach((image) => {

            const source = image.getAttribute("src");

            if (isInlinable(source)) sources.add(source);
        });

        root.querySelectorAll("[style*='url(']").forEach((element) => {

            const urls = getCssUrls(element.getAttribute("style"));

            for (let index = 0; index < urls.length; index++) {

                if (isInlinable(urls[index])) sources.add(urls[index]);
            }
        });
    };

    const readBlobAsDataUri = (blob) => {

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    };

    // Images on other domains are fetched through the reporting server, since their servers
    // don't allow the page to read them.
    const fetchImage = (source) => {

        const url = new URL(source, document.baseURI);

        if (url.origin === window.location.origin) {
            return Ren.FetchUtils.fetch(url.href);
        }

        return Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("fetchImage"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.href })
        });
    };

    /**
     * Resolves to the image at the passed source as a data URI, or to null if it couldn't be
     * fetched, in which case the download keeps referencing it where it is.
     */
    const getImageAsDataUri = (source) => {

        return fetchImage(source)
            .then((response) => {

                if (!response.ok) throw new Error("Status " + response.status);

                return response.blob();
            })
            .then((blob) => {

                if (!blob.type.startsWith("image/")) throw new Error("Not an image: " + blob.type);

                return readBlobAsDataUri(blob);
            })
            .catch((error) => {

                console.warn("[ReportImageInliner] Couldn't inline image " + source, error);

                return null;
            });
    };

    const replaceElementImageSources = (element, getDataUri, markReplaced) => {

        if (element.tagName === "IMG" && element.hasAttribute("src")) {

            const source = element.getAttribute("src");
            const dataUri = getDataUri(source);

            if (dataUri) {

                if (markReplaced) element.setAttribute(ORIGINAL_SRC_ATTRIBUTE, source);

                element.setAttribute("src", dataUri);
            }
        }

        const style = element.getAttribute("style");

        if (style && style.indexOf("url(") !== -1) {

            const inlinedStyle = replaceCssUrls(style, getDataUri);

            if (inlinedStyle !== style) element.setAttribute("style", inlinedStyle);
        }
    };

    // Replaces the sources of the passed element and of the images within it.
    const replaceImageSources = (root, getDataUri, markReplaced) => {

        replaceElementImageSources(root, getDataUri, markReplaced);

        root.querySelectorAll("img[src], [style*='url(']").forEach((element) => {

            replaceElementImageSources(element, getDataUri, markReplaced);
        });
    };

    const findReportContent = (doc) => doc.querySelector("htmlfile") || doc.body;

    /**
     * Resolves once the images referenced by the report have been inlined into the passed download
     * document: those in its own markup in place, and those only the live page's rendered
     * visualisations show in a script element for the download to swap in when it renders them.
     */
    const inlineImages = (downloadHtml) => {

        downloadHtml.querySelectorAll("script." + IMAGES_SCRIPT_CLASS).forEach((script) => {

            script.remove();
        });

        const downloadSources = new Set();
        const renderedSources = new Set();

        // A downloaded report can't fetch images, but has the ones it carried to carry on.
        if (!Ren.UrlContext.isDownloadedReport()) {

            collectImageSources(downloadHtml.body, downloadSources);
            collectImageSources(findReportContent(document), renderedSources);
        }

        const dataUris = {};

        const getDataUri = (source) => dataUris[source] || null;

        const sources = new Set(downloadSources);

        renderedSources.forEach((source) => { sources.add(source); });

        const imageFetches = Array.from(sources).map((source) => {

            return getImageAsDataUri(source).then((dataUri) => {

                if (dataUri) dataUris[source] = dataUri;
            });
        });

        return Promise.all(imageFetches).then(() => {

            replaceImageSources(downloadHtml.body, getDataUri, true);

            const imagesToEmbed = Object.assign({}, embeddedImages);

            renderedSources.forEach((source) => {

                if (dataUris[source] && !downloadSources.has(source)) {
                    imagesToEmbed[source] = dataUris[source];
                }
            });

            if (Ren.ObjectUtils.isEmptyObject(imagesToEmbed)) return;

            downloadHtml.body.appendChild(
                Ren.HtmlUtils.create("script")
                    ._addClass(IMAGES_SCRIPT_CLASS)
                    ._attr("type", "application/json")
                    ._textContent(Ren.JsonUtils.serialize(imagesToEmbed))
            );
        });
    };

    const replaceAddedImageSources = (mutations) => {

        const getDataUri = (source) => inlinedImages[source] || null;

        for (let index = 0; index < mutations.length; index++) {

            const mutation = mutations[index];

            if (mutation.type === "attributes") {

                replaceElementImageSources(mutation.target, getDataUri, false);
                continue;
            }

            const addedNodes = mutation.addedNodes;

            for (let nodeIndex = 0; nodeIndex < addedNodes.length; nodeIndex++) {

                const node = addedNodes[nodeIndex];

                if (node.nodeType === Node.ELEMENT_NODE) {
                    replaceImageSources(node, getDataUri, false);
                }
            }
        }
    };

    // Reads the images the downloaded report carries, and swaps them in for the sources the
    // report renders from then on.
    const loadInlinedImages = () => {

        if (!Ren.UrlContext.isDownloadedReport()) return;

        document.querySelectorAll("script." + IMAGES_SCRIPT_CLASS).forEach((script) => {

            Object.assign(embeddedImages, Ren.JsonUtils.parse(script.textContent));
        });

        inlinedImages = Object.assign({}, embeddedImages);

        document.querySelectorAll("img[" + ORIGINAL_SRC_ATTRIBUTE + "]").forEach((image) => {

            inlinedImages[image.getAttribute(ORIGINAL_SRC_ATTRIBUTE)] = image.getAttribute("src");
        });

        if (Ren.ObjectUtils.isEmptyObject(inlinedImages)) return;

        replaceImageSources(document.body, (source) => inlinedImages[source] || null, false);

        new MutationObserver(replaceAddedImageSources).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src", "style"]
        });
    };

    Ren.Messages.Events.pageLoaded.handle(() => {

        loadInlinedImages();
    });

    return {
        inlineImages
    };
})();
