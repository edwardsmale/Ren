// Turns an HTML document into a self-extracting one: deflated, Base92-encoded, and wrapped with a
// decoder that writes the original back into the page when it is opened.  This is the algorithm
// of the CompressHtmlFile C++ tool, and the decoder is the one that tool embeds.
Ren.HtmlFileCompressor = (() => {

    const SCRIPT_END_TAG = "</scr" + "ipt>";

    // D is the encoded data and S the length of the deflated bytes it decodes to.  Built when first
    // needed, since Ren.Base92 is loaded after this.
    const getDecoderScript = () =>
        "!function(){for(var A=\"" + Ren.Base92.ALPHABET + "\",T={},j=0;j<92;)T[A[j]]=j++;" +
        "for(var o=new Uint8Array(S),p=0,q=0,n=0,i=0;i<D.length&&p<S;){var c=T[D[i++]];" +
        "if(i<D.length){var v=c+T[D[i++]]*92;q|=v<<n;n+=v<272||v>=8192?14:13}" +
        "else{q|=c<<n;n+=7}for(;n>=8&&p<S;)o[p++]=q&255,q>>>=8,n-=8}" +
        "new Response(new Blob([o.subarray(0,p)]).stream()" +
        ".pipeThrough(new DecompressionStream(\"deflate\"))).text()" +
        ".then(function(h){document.open();document.write(h);document.close()})}()";

    // The document is taken as the parts of a Blob, so that one too large to hold as a single
    // string can still be compressed.
    const deflate = (htmlParts) => {

        const stream = new Blob(htmlParts).stream().pipeThrough(new CompressionStream("deflate"));

        return new Response(stream).arrayBuffer().then((buffer) => new Uint8Array(buffer));
    };

    // Resolves to the parts of the compressed document, ready to be passed to the Blob
    // constructor.
    const compress = (htmlParts) => deflate(htmlParts).then((deflated) => {

        return [
            "<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n" +
            "<script>var D=\"",
            Ren.Base92.encode(deflated),
            "\",S=" + deflated.length + SCRIPT_END_TAG + "\n" +
            "<script>" + getDecoderScript() + SCRIPT_END_TAG + "\n</body>\n</html>\n"
        ];
    });

    return {
        compress
    };
})();
