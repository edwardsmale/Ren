/**
 * Functions for working with text selection.
 */
Ren.TextSelectionUtils = (() => {

    const selectTextRange = (obj, start, stop) => {

        var endNode, startNode = endNode = obj.firstChild;

        startNode.nodeValue = startNode.nodeValue.trim();

        const range = document.createRange();
        range.setStart(startNode, start);
        range.setEnd(endNode, stop);

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    };

    return {
        selectTextRange
    };
})();
