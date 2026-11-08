/**
 * Lets a visualisation contain others.  A container is known by its visualisationId, and each of
 * its children names it with containerVisualisationId and is placed among the others by its
 * containerOrder.  The container's create function hands over the element its children go in, by
 * calling registerChildrenElement, and each child is put in it there rather than at a
 * targetSelector.  A child created before its container has rendered is held until it has, and
 * isn't rendered until it is in the page, so containers can be nested to any depth.
 *
 * A container can have more than one element for its children, each a slot it names (as a task
 * lane has a cell per column).  A child says which it goes in with containerSlot, and one naming
 * none, or one the container doesn't have, goes in the first.  Orders are within a slot.
 */
Ren.VisualisationContainers = (() => {

    const CHILDREN_ATTRIBUTE_NAME = "data-container-children-of";
    const SLOT_ATTRIBUTE_NAME = "data-container-slot";

    // The children elements of each container, by slot, in the order they were registered.
    const slotsByVisualisationId = new Map();

    const getOrder = (visualisation) => visualisation.containerOrder ?? Infinity;

    /**
     * Gets the visualisation whose visualisationId is the given one, or undefined.
     */
    const getVisualisationById = (visualisationId) => Ren.VisualisationCollection
        .getVisualisations()
        .find(visualisation => visualisation.visualisationId === visualisationId);

    /**
     * Gets the container the given visualisation names, or undefined for one that names none or
     * whose container hasn't been created.
     */
    const getContainer = (visualisation) => visualisation.containerVisualisationId
        ? getVisualisationById(visualisation.containerVisualisationId)
        : undefined;

    /**
     * Gets the slot the given child goes in: its containerSlot if its container has that slot,
     * and otherwise the container's first.  "" is the slot of a container that names none.
     */
    const getChildSlot = (visualisation) => {

        const slots = slotsByVisualisationId.get(visualisation.containerVisualisationId);
        const slot = visualisation.containerSlot ?? "";

        if (!slots || slots.has(slot)) return slot;

        return slots.keys().next().value ?? slot;
    };

    /**
     * Gets the visualisations in the given container, in order, or only those in the given slot.
     */
    const getChildren = (container, slot) => {

        if (!container.visualisationId) return [];

        return Ren.VisualisationCollection
            .getVisualisations()
            .filter(visualisation =>
                visualisation.containerVisualisationId === container.visualisationId &&
                !visualisation.isPopup &&
                (slot === undefined || getChildSlot(visualisation) === slot)
            )
            .sort((first, second) => getOrder(first) - getOrder(second));
    };

    /**
     * Puts the given child's element among the children in its slot by its order, after any with
     * the same order.  A child whose container hasn't registered its children element is left
     * where it is, to be placed when it does.
     */
    const placeChild = (visualisation) => {

        const childrenElement = slotsByVisualisationId
            .get(visualisation.containerVisualisationId)
            ?.get(getChildSlot(visualisation));

        if (!childrenElement || !visualisation.element) return;

        const order = getOrder(visualisation);
        const element = visualisation.element;

        element.setAttribute("data-container-order", String(order));

        let nextElement = null;

        for (let index = 0; index < childrenElement.children.length; index++) {

            const sibling = childrenElement.children[index];

            if (sibling === element || !sibling.hasAttribute("data-container-order")) continue;

            if (Number(sibling.getAttribute("data-container-order")) > order) {

                nextElement = sibling;
                break;
            }
        }

        childrenElement.insertBefore(element, nextElement);

        Ren.VisualisationContainerEditing.setUpChild(visualisation);
    };

    /**
     * Called by a container's create function with the element its children are to go in, or
     * those of the given slot, each time it renders.  Gives the container a visualisationId if it
     * has none, and moves the children it already has into the element.
     */
    const registerChildrenElement = (container, childrenElement, slot) => {

        if (!container.visualisationId) {

            container.visualisationId = Ren.RandomUtils.generateRandomClassName("container");
        }

        childrenElement.setAttribute(CHILDREN_ATTRIBUTE_NAME, container.visualisationId);
        childrenElement.setAttribute(SLOT_ATTRIBUTE_NAME, slot ?? "");

        if (!slotsByVisualisationId.has(container.visualisationId)) {

            slotsByVisualisationId.set(container.visualisationId, new Map());
        }

        slotsByVisualisationId.get(container.visualisationId).set(slot ?? "", childrenElement);

        Ren.VisualisationContainerEditing.setUpContainer(container);

        const children = getChildren(container);

        for (let index = 0; index < children.length; index++) {
            placeChild(children[index]);
        }
    };

    /**
     * Gets the element the given container's children go in, or those of the given slot, or
     * undefined before it has rendered.
     */
    const getChildrenElement = (container, slot) =>
        slotsByVisualisationId.get(container.visualisationId)?.get(slot ?? "");

    /**
     * Gets the slots of the given container, in the order they were registered.
     */
    const getSlots = (container) =>
        Array.from(slotsByVisualisationId.get(container.visualisationId)?.keys() ?? []);

    /**
     * Gets a value indicating whether the given visualisation is a child that can't be rendered
     * yet, because its container (or one containing that) hasn't rendered.
     */
    const isAwaitingContainer = (visualisation) =>
        !!visualisation.containerVisualisationId &&
        !visualisation.isPopup &&
        !visualisation.element?.isConnected;

    /**
     * Called as a container is destroyed, before its element is removed, to forget its children
     * elements.  Those registered since by another container with the same ID are kept.
     */
    const forgetContainer = (container) => {

        const slots = slotsByVisualisationId.get(container.visualisationId);

        if (!slots) return;

        slots.forEach((childrenElement, slot) => {

            if (container.element?.contains(childrenElement)) {
                slots.delete(slot);
            }
        });

        if (slots.size === 0) {
            slotsByVisualisationId.delete(container.visualisationId);
        }
    };

    return {
        CHILDREN_ATTRIBUTE_NAME,
        SLOT_ATTRIBUTE_NAME,
        forgetContainer,
        getChildSlot,
        getChildren,
        getChildrenElement,
        getContainer,
        getSlots,
        getVisualisationById,
        isAwaitingContainer,
        placeChild,
        registerChildrenElement
    };
})();
