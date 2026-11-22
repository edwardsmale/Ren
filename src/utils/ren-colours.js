/**
 * Functions for working with colours.
 */
Ren.Colours = (() => {

    const tooltipBackground = "#FBF6C9";

    /**
     * Gets the accent colour of theme in ren.config, which highlights what a chart draws
     * attention to.
     */
    const getAccentColour = () => Ren.Config.getConfig().theme.accent;

    /**
     * Gets a colour component as two hex digits, rounded and held within 0 to 255.
     */
    const toHexComponent = (component) =>
        Math.round(Ren.NumberUtils.clamp(component, 0, 255)).toString(16).padStart(2, "0");

    /**
     * Gets the #rrggbb colour for red, green and blue components, each 0 to 255.
     */
    const rgbToHex = (red, green, blue) =>
        "#" + toHexComponent(red) + toHexComponent(green) + toHexComponent(blue);

    /**
     * Inverts a hex colour for better visibility in dark mode.
     */
    const invertHexColour = (hex) => {

        hex = hex.replace("#", "");

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return rgbToHex(255 - r, 255 - g, 255 - b);
    };

    // How much of the original colour a pastel shade keeps by default, 0 to 1.
    const DEFAULT_PASTEL_STRENGTH = 0.55;

    // The brightest a pastel shade may get, out of 255, so light colours don't wash out.
    const MAX_PASTEL_BRIGHTNESS = 210;

    /**
     * Gets the perceived brightness of an r/g/b triple, 0 to 255.
     */
    const brightnessOf = (red, green, blue) => 0.299 * red + 0.587 * green + 0.114 * blue;

    // Settings and palettes use hex; a browser reports a computed colour as rgb()/rgba(), or a
    // color-mix() in srgb as color(srgb ...) with components from 0 to 1.
    const SHORT_HEX_PATTERN = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
    const LONG_HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
    const RGB_PATTERN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;
    const SRGB_PATTERN = /^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/i;

    /**
     * Gets a colour's { red, green, blue } components from #rgb, #rrggbb, rgb(...), rgba(...) or
     * color(srgb ...), or null for anything else (a gradient, say).
     */
    const toRgb = (colour) => {

        if (!colour) return null;

        const trimmed = colour.trim();
        const longHex = LONG_HEX_PATTERN.exec(trimmed);

        if (longHex) {

            return {
                red: parseInt(longHex[1], 16),
                green: parseInt(longHex[2], 16),
                blue: parseInt(longHex[3], 16)
            };
        }

        const shortHex = SHORT_HEX_PATTERN.exec(trimmed);

        if (shortHex) {

            return {
                red: parseInt(shortHex[1] + shortHex[1], 16),
                green: parseInt(shortHex[2] + shortHex[2], 16),
                blue: parseInt(shortHex[3] + shortHex[3], 16)
            };
        }

        const rgb = RGB_PATTERN.exec(trimmed);

        if (rgb) {

            return {
                red: Math.round(parseFloat(rgb[1])),
                green: Math.round(parseFloat(rgb[2])),
                blue: Math.round(parseFloat(rgb[3]))
            };
        }

        const srgb = SRGB_PATTERN.exec(trimmed);

        if (srgb) {

            return {
                red: Math.round(Ren.NumberUtils.clamp(parseFloat(srgb[1]), 0, 1) * 255),
                green: Math.round(Ren.NumberUtils.clamp(parseFloat(srgb[2]), 0, 1) * 255),
                blue: Math.round(Ren.NumberUtils.clamp(parseFloat(srgb[3]), 0, 1) * 255)
            };
        }

        return null;
    };

    /**
     * Gets the perceived brightness of a colour, 0 to 255, or null where toRgb can't read it.
     */
    const brightnessOfColour = (colour) => {

        const rgb = toRgb(colour);
        return rgb === null ? null : brightnessOf(rgb.red, rgb.green, rgb.blue);
    };

    /**
     * Gets a pastel shade of a hex colour by mixing it with white, held back where it would be too
     * pale to make out.
     *
     * @param {number} [strength] - How much of the original colour is kept, 0 to 1.
     */
    const toPastel = (hex, strength) => {

        const { red, green, blue } = toRgb(hex);

        let keep = strength === undefined ? DEFAULT_PASTEL_STRENGTH : strength;

        // Brightness is linear in the amount kept, so the least within the cap is solved for.
        const brightness = brightnessOf(red, green, blue);

        if (brightness < MAX_PASTEL_BRIGHTNESS) {

            const leastKeep = (255 - MAX_PASTEL_BRIGHTNESS) / (255 - brightness);

            if (keep < leastKeep) {
                keep = leastKeep;
            }
        }
        else {

            keep = 1;
        }

        const mix = (component) => component * keep + 255 * (1 - keep);

        return rgbToHex(mix(red), mix(green), mix(blue));
    };

    /**
     * Gets a colour with its components multiplied by a factor - below 1 for a darker shade, above
     * 1 for a lighter one - or null where toRgb can't read it.
     */
    const scaleBrightness = (colour, factor) => {

        const rgb = toRgb(colour);

        if (rgb === null) return null;

        return rgbToHex(rgb.red * factor, rgb.green * factor, rgb.blue * factor);
    };

    /**
     * Gets a colour's HSL lightness, 0 to 1, or null where toRgb can't read it.
     */
    const lightnessOfColour = (colour) => {

        const rgb = toRgb(colour);

        if (rgb === null) return null;

        const max = Math.max(rgb.red, rgb.green, rgb.blue);
        const min = Math.min(rgb.red, rgb.green, rgb.blue);

        return (max + min) / 2 / 255;
    };

    // CIELAB with a D50 white point.
    const LAB_WHITE_X = 0.96422;
    const LAB_WHITE_Z = 0.82521;
    const LAB_T0 = 4 / 29;
    const LAB_T1 = 6 / 29;
    const LAB_T2 = 3 * LAB_T1 * LAB_T1;
    const LAB_T3 = LAB_T1 * LAB_T1 * LAB_T1;

    const toLinear = (component) => {

        const value = component / 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const fromLinear = (value) => 255 * (value <= 0.0031308
        ? 12.92 * value
        : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);

    const xyzToLab = (value) => value > LAB_T3 ? Math.cbrt(value) : value / LAB_T2 + LAB_T0;

    const labToXyz = (value) => value > LAB_T1 ? value * value * value : LAB_T2 * (value - LAB_T0);

    const rgbToLab = (rgb) => {

        const red = toLinear(rgb.red);
        const green = toLinear(rgb.green);
        const blue = toLinear(rgb.blue);

        const y = xyzToLab(0.2225045 * red + 0.7168786 * green + 0.0606169 * blue);

        const isGrey = red === green && green === blue;

        const x = isGrey
            ? y
            : xyzToLab((0.4360747 * red + 0.3850649 * green + 0.1430804 * blue) / LAB_WHITE_X);

        const z = isGrey
            ? y
            : xyzToLab((0.0139322 * red + 0.0971045 * green + 0.7141733 * blue) / LAB_WHITE_Z);

        return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
    };

    const labToRgbString = (l, a, b) => {

        const fy = (l + 16) / 116;
        const x = LAB_WHITE_X * labToXyz(fy + a / 500);
        const y = labToXyz(fy);
        const z = LAB_WHITE_Z * labToXyz(fy - b / 200);

        const component = (value) =>
            Math.round(Ren.NumberUtils.clamp(fromLinear(value), 0, 255)) || 0;

        return "rgb(" +
            component(3.1338561 * x - 1.6168667 * y - 0.4906146 * z) + ", " +
            component(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z) + ", " +
            component(0.0719453 * x - 0.2289914 * y + 1.4052427 * z) + ")";
    };

    /**
     * Creates a function giving the colour a fraction of the way between two colours, blended in
     * CIELAB so that the steps look even, as rgb(...).  Fractions outside 0 to 1 carry on past
     * either end.  Between greys, it gives the same as blending in HCL.
     */
    const interpolateLab = (fromColour, toColour) => {

        const from = rgbToLab(toRgb(fromColour));
        const to = rgbToLab(toRgb(toColour));

        return (fraction) => labToRgbString(
            from.l + (to.l - from.l) * fraction,
            from.a + (to.a - from.a) * fraction,
            from.b + (to.b - from.b) * fraction
        );
    };

    /**
     * Gets a colour made lighter or darker by an amount of CIELAB lightness (out of 100), keeping
     * its hue and saturation, as rgb(...), or null where toRgb can't read it.
     */
    const shiftLightness = (colour, amount) => {

        const rgb = toRgb(colour);

        if (rgb === null) return null;

        const lab = rgbToLab(rgb);

        return labToRgbString(Ren.NumberUtils.clamp(lab.l + amount, 0, 100), lab.a, lab.b);
    };

    const FILTER_FUNCTION_PATTERN = /([a-z-]+)\(\s*([\d.]+)(%?)\s*\)/gi;

    /** Gets a { red, green, blue } colour put through a saturate() filter's matrix. */
    const saturateRgb = (rgb, amount) => ({
        red: (0.213 + 0.787 * amount) * rgb.red
            + (0.715 - 0.715 * amount) * rgb.green
            + (0.072 - 0.072 * amount) * rgb.blue,
        green: (0.213 - 0.213 * amount) * rgb.red
            + (0.715 + 0.285 * amount) * rgb.green
            + (0.072 - 0.072 * amount) * rgb.blue,
        blue: (0.213 - 0.213 * amount) * rgb.red
            + (0.715 - 0.715 * amount) * rgb.green
            + (0.072 + 0.928 * amount) * rgb.blue
    });

    /**
     * Gets the colour a CSS filter turns a colour into, as hex, so text over a filtered mark can be
     * coloured for what is actually drawn.  Only brightness, contrast, saturate and grayscale are
     * followed; the colour is given back unchanged where there is no filter or it can't be read.
     */
    const applyFilter = (colour, filter) => {

        if (!filter || filter === "none") return colour;

        let rgb = toRgb(colour);

        if (rgb === null) return colour;

        const clampRgb = (value) => ({
            red: Ren.NumberUtils.clamp(value.red, 0, 255),
            green: Ren.NumberUtils.clamp(value.green, 0, 255),
            blue: Ren.NumberUtils.clamp(value.blue, 0, 255)
        });

        const mapChannels = (mapChannel) => ({
            red: mapChannel(rgb.red),
            green: mapChannel(rgb.green),
            blue: mapChannel(rgb.blue)
        });

        FILTER_FUNCTION_PATTERN.lastIndex = 0;
        let match = FILTER_FUNCTION_PATTERN.exec(filter);

        while (match) {

            const name = match[1].toLowerCase();
            const amount = parseFloat(match[2]) / (match[3] ? 100 : 1);

            if (name === "brightness") {
                rgb = mapChannels(channel => channel * amount);
            }
            else if (name === "contrast") {

                rgb = mapChannels(channel => (channel - 127.5) * amount + 127.5);
            }
            else if (name === "saturate") {

                rgb = saturateRgb(rgb, amount);
            }
            else if (name === "grayscale") {

                rgb = saturateRgb(rgb, 1 - Math.min(amount, 1));
            }

            rgb = clampRgb(rgb);
            match = FILTER_FUNCTION_PATTERN.exec(filter);
        }

        return rgbToHex(rgb.red, rgb.green, rgb.blue);
    };

    // Set high, as a mid blue or green still reads better under white text.
    const DARK_TEXT_BRIGHTNESS = 180;

    /**
     * Gets "black" or "white", whichever reads best over a background colour.
     */
    const contrastingTextColour = (hex) =>
        brightnessOfColour(hex) >= DARK_TEXT_BRIGHTNESS ? "black" : "white";

    return {
        getAccentColour,
        tooltipBackground,
        toHexComponent,
        rgbToHex,
        invertHexColour,
        toRgb,
        brightnessOfColour,
        toPastel,
        scaleBrightness,
        lightnessOfColour,
        interpolateLab,
        shiftLightness,
        applyFilter,
        contrastingTextColour
    };
})();
