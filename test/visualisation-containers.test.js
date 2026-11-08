describe("Visualisation containers", () => {

    let visualisations;

    beforeEach(() => {

        visualisations = [];

        jest.spyOn(Ren.VisualisationCollection, "getVisualisations")
            .mockImplementation(() => visualisations);
        jest.spyOn(Ren.VisualisationContainerEditing, "setUpContainer")
            .mockImplementation(() => {});
        jest.spyOn(Ren.VisualisationContainerEditing, "setUpChild")
            .mockImplementation(() => {});
    });

    afterEach(() => {

        jest.restoreAllMocks();
    });

    /**
     * Gets a child of the given container, with an element marked with its name, as a
     * visualisation that has rendered.
     */
    const createChild = (name, containerVisualisationId, containerOrder, containerSlot) => {

        const element = document.createElement("div");
        element.setAttribute("data-name", name);

        return {
            name,
            containerVisualisationId,
            containerOrder,
            containerSlot,
            element
        };
    };

    const getNames = (children) => children.map(child => child.name);

    const getElementNames = (childrenElement) => Array.prototype.map.call(
        childrenElement.children,
        element => element.getAttribute("data-name")
    );

    test("getChildren_UnorderedChildren_SortedByContainerOrder", () => {

        const container = { visualisationId: "sorted" };

        visualisations.push(
            container,
            createChild("third", "sorted", 3),
            createChild("unordered", "sorted", undefined),
            createChild("first", "sorted", 1),
            createChild("second", "sorted", 2)
        );

        expect(getNames(Ren.VisualisationContainers.getChildren(container)))
            .toEqual(["first", "second", "third", "unordered"]);
    });

    test("getChildren_OtherContainersAndPopups_LeftOut", () => {

        const container = { visualisationId: "mine" };
        const popup = createChild("popup", "mine", 2);

        popup.isPopup = true;

        visualisations.push(
            container,
            createChild("own", "mine", 1),
            createChild("other", "theirs", 1),
            popup
        );

        expect(getNames(Ren.VisualisationContainers.getChildren(container))).toEqual(["own"]);
    });

    test("getChildren_ContainerWithoutId_NoChildren", () => {

        visualisations.push(createChild("orphan", undefined, 1));

        expect(Ren.VisualisationContainers.getChildren({})).toEqual([]);
    });

    test("getContainer_NamedContainer_ResolvedById", () => {

        const container = { visualisationId: "resolved" };
        const child = createChild("child", "resolved", 1);

        visualisations.push(container, child);

        expect(Ren.VisualisationContainers.getContainer(child)).toBe(container);
    });

    test("getContainer_NoneNamedOrNotCreated_Undefined", () => {

        visualisations.push({ visualisationId: "elsewhere" });

        expect(Ren.VisualisationContainers.getContainer(createChild("top", undefined, 1)))
            .toBeUndefined();
        expect(Ren.VisualisationContainers.getContainer(createChild("early", "missing", 1)))
            .toBeUndefined();
    });

    test("registerChildrenElement_ExistingChildren_PlacedInOrder", () => {

        const container = { visualisationId: "placed" };
        const childrenElement = document.createElement("div");

        visualisations.push(
            container,
            createChild("b", "placed", 2),
            createChild("c", "placed", 3),
            createChild("a", "placed", 1)
        );

        Ren.VisualisationContainers.registerChildrenElement(container, childrenElement);

        expect(getElementNames(childrenElement)).toEqual(["a", "b", "c"]);
        expect(childrenElement.getAttribute("data-container-children-of")).toBe("placed");
        expect(Ren.VisualisationContainers.getChildrenElement(container)).toBe(childrenElement);
    });

    test("registerChildrenElement_ContainerWithoutId_GivenOne", () => {

        const container = {};

        Ren.VisualisationContainers.registerChildrenElement(
            container,
            document.createElement("div")
        );

        expect(container.visualisationId).toMatch(/^container/);
    });

    test("placeChild_SameOrderAsSibling_PlacedAfterIt", () => {

        const container = { visualisationId: "ties" };
        const childrenElement = document.createElement("div");

        visualisations.push(
            container,
            createChild("first", "ties", 1),
            createChild("last", "ties", 2)
        );

        Ren.VisualisationContainers.registerChildrenElement(container, childrenElement);

        const added = createChild("added", "ties", 1);

        visualisations.push(added);
        Ren.VisualisationContainers.placeChild(added);

        expect(getElementNames(childrenElement)).toEqual(["first", "added", "last"]);
    });

    test("placeChild_ContainerNotRendered_LeftWhereItIs", () => {

        const child = createChild("waiting", "unrendered", 1);
        const holder = document.createElement("div");

        holder.appendChild(child.element);
        visualisations.push(child);

        Ren.VisualisationContainers.placeChild(child);

        expect(child.element.parentNode).toBe(holder);
    });

    test("getChildSlot_NamedOrUnknownSlot_NamedOrFirstSlot", () => {

        const container = { visualisationId: "slotted" };

        Ren.VisualisationContainers.registerChildrenElement(
            container,
            document.createElement("div"),
            "start"
        );
        Ren.VisualisationContainers.registerChildrenElement(
            container,
            document.createElement("div"),
            "next"
        );

        const getChildSlot = Ren.VisualisationContainers.getChildSlot;

        expect(getChildSlot(createChild("named", "slotted", 1, "next"))).toBe("next");
        expect(getChildSlot(createChild("unknown", "slotted", 1, "later"))).toBe("start");
        expect(getChildSlot(createChild("unnamed", "slotted", 1))).toBe("start");
        expect(Ren.VisualisationContainers.getSlots(container)).toEqual(["start", "next"]);
    });

    test("getChildren_Slot_OnlyThatSlotsChildren", () => {

        const container = { visualisationId: "cells" };
        const startElement = document.createElement("div");
        const nextElement = document.createElement("div");

        visualisations.push(
            container,
            createChild("a", "cells", 1, "start"),
            createChild("b", "cells", 1, "next"),
            createChild("c", "cells", 2)
        );

        Ren.VisualisationContainers.registerChildrenElement(container, startElement, "start");
        Ren.VisualisationContainers.registerChildrenElement(container, nextElement, "next");

        expect(getNames(Ren.VisualisationContainers.getChildren(container, "start")))
            .toEqual(["a", "c"]);
        expect(getNames(Ren.VisualisationContainers.getChildren(container, "next")))
            .toEqual(["b"]);
        expect(getElementNames(startElement)).toEqual(["a", "c"]);
        expect(getElementNames(nextElement)).toEqual(["b"]);
    });

    test("isAwaitingContainer_ChildNotInPage_True", () => {

        const child = createChild("detached", "somewhere", 1);
        const attached = createChild("attached", "somewhere", 2);

        document.body.appendChild(attached.element);

        expect(Ren.VisualisationContainers.isAwaitingContainer(child)).toBe(true);
        expect(Ren.VisualisationContainers.isAwaitingContainer(attached)).toBe(false);
        expect(Ren.VisualisationContainers.isAwaitingContainer(createChild("top", undefined, 1)))
            .toBe(false);

        attached.element.remove();
    });

    test("forgetContainer_ReplacedByAnotherWithSameId_ReplacementKept", () => {

        const createContainer = () => ({
            visualisationId: "replaced",
            element: document.createElement("div")
        });
        const oldContainer = createContainer();
        const newContainer = createContainer();
        const oldChildrenElement = document.createElement("div");
        const newChildrenElement = document.createElement("div");

        oldContainer.element.appendChild(oldChildrenElement);
        newContainer.element.appendChild(newChildrenElement);

        Ren.VisualisationContainers.registerChildrenElement(oldContainer, oldChildrenElement);
        Ren.VisualisationContainers.registerChildrenElement(newContainer, newChildrenElement);
        Ren.VisualisationContainers.forgetContainer(oldContainer);

        expect(Ren.VisualisationContainers.getChildrenElement(newContainer))
            .toBe(newChildrenElement);

        Ren.VisualisationContainers.forgetContainer(newContainer);

        expect(Ren.VisualisationContainers.getChildrenElement(newContainer)).toBeUndefined();
    });
});
