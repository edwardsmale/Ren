/**
 * Mixes CSS colours equally, as for a chart point or group row standing for many rows.  A mix is
 * a running total, so mixes of parts can be added together into the mix of the whole.
 *
 * Colours are weighted by their alpha, so a translucent colour counts for less, and a null colour
 * counts as transparent.  A mix of one colour throughout comes out as that colour as given.
 */
Ren.ColourMixer = (() => {

    // Bounds the caches, as a function could give a different colour for every row.
    const MAX_CACHED_COLOURS = 1000;

    const RGBA_PATTERN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i;

    const checkedColours = new Map();

    const componentsByColour = new Map();

    let colourCanvasContext = null;

    /**
     * Gets a value indicating whether text is a colour CSS understands.
     */
    const isColour = (text) => {

        let result = checkedColours.get(text);

        if (result !== undefined) return result;

        if (checkedColours.size >= MAX_CACHED_COLOURS) checkedColours.clear();

        result = CSS.supports("color", text);
        checkedColours.set(text, result);

        return result;
    };

    /**
     * Gets a colour's { red, green, blue, alpha }, named colours included, or null where the
     * browser gives it in a form that can't be mixed.
     */
    const getColourComponents = (colour) => {

        let components = componentsByColour.get(colour);

        if (components !== undefined) return components;

        if (componentsByColour.size >= MAX_CACHED_COLOURS) componentsByColour.clear();

        if (!colourCanvasContext) {
            colourCanvasContext = document.createElement("canvas").getContext("2d");
        }

        // A canvas gives back any colour it is set to as #rrggbb, or rgba(...) where translucent.
        colourCanvasContext.fillStyle = "#000000";
        colourCanvasContext.fillStyle = colour;

        const normalised = colourCanvasContext.fillStyle;
        const rgb = Ren.Colours.toRgb(normalised);
        const rgba = RGBA_PATTERN.exec(normalised);

        components = rgb
            ? {
                red: rgb.red,
                green: rgb.green,
                blue: rgb.blue,
                alpha: rgba && rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
            }
            : null;

        componentsByColour.set(colour, components);

        return components;
    };

    const createMix = () => ({
        red: 0,
        green: 0,
        blue: 0,
        opacity: 0,
        count: 0,
        colour: null,
        isOneColour: true
    });

    /**
     * Adds a colour to a mix, or null for no colour.  A colour that can't be read counts as none.
     */
    const addColour = (mix, colour) => {

        if (mix.count === 0) {
            mix.colour = colour;
        }
        else if (colour !== mix.colour) {

            mix.isOneColour = false;
        }

        mix.count++;

        if (!colour) return;

        const components = getColourComponents(colour);

        if (!components) return;

        mix.red += components.red * components.alpha;
        mix.green += components.green * components.alpha;
        mix.blue += components.blue * components.alpha;
        mix.opacity += components.alpha;
    };

    /**
     * Adds the colours of one mix to another.
     */
    const addMix = (mix, otherMix) => {

        if (otherMix.count === 0) return;

        if (mix.count === 0) {

            mix.colour = otherMix.colour;
            mix.isOneColour = otherMix.isOneColour;
        }
        else if (!otherMix.isOneColour || otherMix.colour !== mix.colour) {

            mix.isOneColour = false;
        }

        mix.red += otherMix.red;
        mix.green += otherMix.green;
        mix.blue += otherMix.blue;
        mix.opacity += otherMix.opacity;
        mix.count += otherMix.count;
    };

    /**
     * Gets a mix's colour, or null where it has none.
     */
    const getMixedColour = (mix) => {

        if (mix.count === 0) return null;

        if (mix.isOneColour) return mix.colour;

        if (mix.opacity === 0) return null;

        const alpha = Math.round(mix.opacity / mix.count * 1000) / 1000;

        return `rgba(${Math.round(mix.red / mix.opacity)}, ${Math.round(mix.green / mix.opacity)}, `
            + `${Math.round(mix.blue / mix.opacity)}, ${alpha})`;
    };

    return {
        isColour,
        getColourComponents,
        createMix,
        addColour,
        addMix,
        getMixedColour
    };
})();
