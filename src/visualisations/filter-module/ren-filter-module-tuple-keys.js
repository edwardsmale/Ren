/**
 * Filter Module: the algebra of a hierarchical item's tuple keys, the combinations its filter
 * states - those left out for a negative filter, those kept for a positive one (isPositive).  A
 * tuple naming only the leading columns stands for every combination beneath it.
 *
 * The key set is kept canonical, so a settings file stays small and a node's state reads without
 * walking the tree: no key is stored beneath a stated one, and no node whose children are all
 * stated is left stated child by child.  Operations that can unstate a node take its ancestors
 * (root first), as pushing a stated branch down needs the siblings at each level.
 */
Ren.FilterModule_TupleKeys = (() => {

    const SEPARATOR = Ren.FilterModule_Constants.NODE_KEY_SEPARATOR;

    const EXCLUDED = "excluded";
    const PARTLY_EXCLUDED = "partlyExcluded";
    const SELECTED = "selected";

    // Gets a value indicating whether a key names a combination beneath the given node's.
    const isWithin = (key, tupleKey) => key.startsWith(tupleKey + SEPARATOR);

    // Gets a value indicating whether the node itself, or a branch it sits under, is stated.
    const isStated = (keys, tupleKey) => {

        if (keys.has(tupleKey)) return true;

        let index = tupleKey.indexOf(SEPARATOR);

        while (index >= 0) {

            if (keys.has(tupleKey.slice(0, index))) return true;

            index = tupleKey.indexOf(SEPARATOR, index + 1);
        }

        return false;
    };

    // Gets a value indicating whether something below the node is stated.  Canonical keys make
    // that "partly" rather than "possibly all of it".
    const hasStatedWithin = (keys, tupleKey) => {

        let found = false;

        keys.forEach((key) => {

            if (!found && isWithin(key, tupleKey)) found = true;
        });

        return found;
    };

    // Gets a value indicating whether nothing under the node is left unstated, so that a
    // non-canonical set stating every leaf reads the same as one stating the branch.
    const isWhollyStated = (keys, node) => {

        if (isStated(keys, node.tupleKey)) return true;

        const children = node.children;

        if (children.length === 0) return false;

        for (let i = 0; i < children.length; i++) {

            if (!isWhollyStated(keys, children[i])) return false;
        }

        return true;
    };

    const removeWithin = (keys, tupleKey) => {

        const within = [];

        keys.forEach((key) => {

            if (isWithin(key, tupleKey)) within.push(key);
        });

        for (let i = 0; i < within.length; i++) keys.delete(within[i]);
    };

    const stateSiblings = (keys, siblings, pathNode) => {

        for (let i = 0; i < siblings.length; i++) {

            if (siblings[i].tupleKey !== pathNode.tupleKey) keys.add(siblings[i].tupleKey);
        }
    };

    // Restates an ancestor whose children are all stated as the ancestor itself, as far up as that
    // holds.  A root has no key of its own, so the top level is stated node by node.
    const collapseAncestors = (keys, ancestors) => {

        for (let i = ancestors.length - 1; i >= 0; i--) {

            const children = ancestors[i].children;
            let allStated = children.length > 0;

            for (let c = 0; c < children.length; c++) {

                if (!keys.has(children[c].tupleKey)) {

                    allStated = false;
                    break;
                }
            }

            if (!allStated) return;

            for (let c = 0; c < children.length; c++) keys.delete(children[c].tupleKey);

            keys.add(ancestors[i].tupleKey);
        }
    };

    // Pushes the stated branch the node sits under down to the node, the siblings off the path
    // taking the statement over at each level, so everything else stays stated as shallowly.
    const expandStatedAncestors = (keys, node, ancestors) => {

        let expanding = false;

        for (let i = 0; i < ancestors.length; i++) {

            const ancestor = ancestors[i];

            if (!expanding) {

                if (!keys.has(ancestor.tupleKey)) continue;

                keys.delete(ancestor.tupleKey);
                expanding = true;
            }

            stateSiblings(
                keys,
                ancestor.children,
                i + 1 < ancestors.length ? ancestors[i + 1] : node
            );
        }
    };

    const stateNode = (keys, node, ancestors) => {

        if (isStated(keys, node.tupleKey)) return;

        removeWithin(keys, node.tupleKey);
        keys.add(node.tupleKey);

        collapseAncestors(keys, ancestors);
    };

    const unstateNode = (keys, node, ancestors) => {

        expandStatedAncestors(keys, node, ancestors);

        keys.delete(node.tupleKey);
        removeWithin(keys, node.tupleKey);
    };

    // Gets a value indicating whether the whole of a node is ticked.
    const isNodeSelected = (keys, node, isPositive) => {

        if (isPositive) return isWhollyStated(keys, node);

        return !isStated(keys, node.tupleKey) && !hasStatedWithin(keys, node.tupleKey);
    };

    const selectNode = (keys, node, ancestors, isPositive) => {

        if (isPositive) {
            stateNode(keys, node, ancestors);
        }
        else {

            unstateNode(keys, node, ancestors);
        }
    };

    const deselectNode = (keys, node, ancestors, isPositive) => {

        if (isPositive) {
            unstateNode(keys, node, ancestors);
        }
        else {

            stateNode(keys, node, ancestors);
        }
    };

    // A partly ticked node reads as not selected, so toggling it ticks it fully, as checkboxes do.
    const toggleNode = (keys, node, ancestors, isPositive) => {

        if (isNodeSelected(keys, node, isPositive)) {
            deselectNode(keys, node, ancestors, isPositive);
        }
        else {

            selectNode(keys, node, ancestors, isPositive);
        }
    };

    // Narrows the whole tree to one node.  A negative set states everything off its path, as
    // shallowly as it can.
    const selectOnlyNode = (node, ancestors, rootNodes, isPositive) => {

        const keys = new Set();

        if (isPositive) {

            keys.add(node.tupleKey);

            return keys;
        }

        stateSiblings(keys, rootNodes, ancestors.length > 0 ? ancestors[0] : node);

        for (let i = 0; i < ancestors.length; i++) {

            stateSiblings(
                keys,
                ancestors[i].children,
                i + 1 < ancestors.length ? ancestors[i + 1] : node
            );
        }

        return keys;
    };

    // Gets the key set leaving nothing ticked; a positive filter's empty tuple list keeps no row.
    const excludeAllNodes = (rootNodes, isPositive) => {

        const keys = new Set();

        if (isPositive) return keys;

        for (let i = 0; i < rootNodes.length; i++) keys.add(rootNodes[i].tupleKey);

        return keys;
    };

    // Swaps what is stated for what is not, keeping the result canonical.  Reads the same in either
    // sense, so it both inverts a selection and restates one the other way round.
    const invert = (keys, rootNodes) => {

        const inverted = new Set();

        const walk = (nodes) => {

            for (let i = 0; i < nodes.length; i++) {

                const node = nodes[i];

                if (keys.has(node.tupleKey)) continue;

                if (hasStatedWithin(keys, node.tupleKey)) {
                    walk(node.children);
                }
                else {

                    inverted.add(node.tupleKey);
                }
            }
        };

        walk(rootNodes);

        return inverted;
    };

    // Restates a key set as shallowly as the tree on show allows, so a selection stated leaf by
    // leaf is written back the short way.
    const canonicalise = (keys, rootNodes, isPositive) => {

        const reader = createReader(keys, isPositive);
        const statedState = isPositive ? SELECTED : EXCLUDED;
        const canonical = new Set();

        const walk = (nodes) => {

            for (let i = 0; i < nodes.length; i++) {

                const state = reader.getNodeState(nodes[i]);

                if (state === statedState) {
                    canonical.add(nodes[i].tupleKey);
                }
                else if (state === PARTLY_EXCLUDED) {

                    walk(nodes[i].children);
                }
            }
        };

        walk(rootNodes);

        return canonical;
    };

    // Gets a value indicating whether exactly this node is selected across the whole tree.
    // Checking the node alone would read it as the sole selection whenever nothing is excluded, so
    // the first click could never narrow.
    const isSoleSelection = (keys, node, ancestors, rootNodes, isPositive) => {

        const soleKeys = selectOnlyNode(node, ancestors, rootNodes, isPositive);

        if (soleKeys.size !== keys.size) return false;

        let matches = true;

        soleKeys.forEach((key) => {

            if (!keys.has(key)) matches = false;
        });

        return matches;
    };

    /**
     * Builds a reader of one hierarchy's stated keys for a whole sync pass.  Every prefix of every
     * stored key is gathered up front, so a rendered node's state is a lookup rather than a scan of
     * the key set.
     */
    const createReader = (keys, isPositive) => {

        const partialPrefixes = new Set();

        keys.forEach((key) => {

            let index = key.indexOf(SEPARATOR);

            while (index >= 0) {

                partialPrefixes.add(key.slice(0, index));
                index = key.indexOf(SEPARATOR, index + 1);
            }
        });

        const whollyStatedByKey = new Map();

        // Cached, as a branch is asked about again by each of its own children.
        const isWhollyStatedNode = (node) => {

            const cached = whollyStatedByKey.get(node.tupleKey);
            if (cached !== undefined) return cached;

            const children = node.children;
            let wholly = children.length > 0;

            for (let i = 0; i < children.length; i++) {

                if (!keys.has(children[i].tupleKey) && !isWhollyStatedNode(children[i])) {

                    wholly = false;
                    break;
                }
            }

            whollyStatedByKey.set(node.tupleKey, wholly);

            return wholly;
        };

        // Gets how a node's checkbox should read: EXCLUDED, PARTLY_EXCLUDED or SELECTED.
        const getNodeState = (node) => {

            let isWholly = isStated(keys, node.tupleKey);

            if (!isWholly) {

                if (!partialPrefixes.has(node.tupleKey)) return isPositive ? EXCLUDED : SELECTED;

                isWholly = isWhollyStatedNode(node);

                if (!isWholly) return PARTLY_EXCLUDED;
            }

            return isPositive ? SELECTED : EXCLUDED;
        };

        // Gets a value indicating whether nothing in the tree is selected.
        const areAllNodesExcluded = (rootNodes) => {

            for (let i = 0; i < rootNodes.length; i++) {

                if (getNodeState(rootNodes[i]) !== EXCLUDED) return false;
            }

            return rootNodes.length > 0;
        };

        // Gets a value indicating whether the whole tree is selected, which is what a hierarchy
        // with no filter at all looks like.
        const areAllNodesSelected = (rootNodes) => {

            for (let i = 0; i < rootNodes.length; i++) {

                if (getNodeState(rootNodes[i]) !== SELECTED) return false;
            }

            return true;
        };

        return {
            getNodeState,
            areAllNodesExcluded,
            areAllNodesSelected
        };
    };

    return {
        EXCLUDED,
        PARTLY_EXCLUDED,
        SELECTED,
        isNodeSelected,
        selectNode,
        deselectNode,
        toggleNode,
        selectOnlyNode,
        excludeAllNodes,
        invert,
        canonicalise,
        isSoleSelection,
        createReader
    };
})();
