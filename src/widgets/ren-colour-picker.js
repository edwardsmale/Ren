/**
 * Creates a colour picker: a saturation/value square over a hue slider, and swatches of common
 * colours beneath.  It reports the colour picked as #rrggbb.
 */
Ren.ColourPicker = (() => {

    const COMMON_COLOURS = [
        "#000000", "#595959", "#a6a6a6", "#d9d9d9", "#ffffff",
        "#2166ac", "#67a9cf", "#d1e5f0", "#f7f7f7", "#fddbc7", "#ef8a62", "#b2182b",
        "#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027",
        "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#e41a1c", "#eb4297"
    ];

    // Hue in degrees, saturation and value 0 to 1.
    const hsvToHex = (hue, saturation, value) => {

        const chroma = value * saturation;
        const sector = (hue % 360) / 60;
        const second = chroma * (1 - Math.abs(sector % 2 - 1));
        const components = [
            [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
            [0, second, chroma], [second, 0, chroma], [chroma, 0, second]
        ][Math.floor(sector) % 6];
        const lightness = value - chroma;

        return Ren.Colours.rgbToHex(
            (components[0] + lightness) * 255,
            (components[1] + lightness) * 255,
            (components[2] + lightness) * 255
        );
    };

    const rgbToHsv = (rgb) => {

        const red = rgb.red / 255;
        const green = rgb.green / 255;
        const blue = rgb.blue / 255;
        const max = Math.max(red, green, blue);
        const chroma = max - Math.min(red, green, blue);
        let hue = 0;

        if (chroma !== 0) {

            if (max === red) {

                hue = 60 * (((green - blue) / chroma + 6) % 6);
            }
            else if (max === green) {

                hue = 60 * ((blue - red) / chroma + 2);
            }
            else {

                hue = 60 * ((red - green) / chroma + 4);
            }
        }

        return { hue, saturation: max === 0 ? 0 : chroma / max, value: max };
    };

    /**
     * Creates a picker showing a colour, calling onChange with each colour picked.  Returns
     * { element, setColour }, where setColour shows a colour without reporting it.
     */
    const create = (initialColour, onChange) => {

        let hue = 0;
        let saturation = 0;
        let value = 0;

        const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("ColourPicker", {
            colours: COMMON_COLOURS
        });

        const square = element.querySelector(".js-ren-colour-picker-square");
        const marker = element.querySelector(".js-ren-colour-picker-marker");
        const hueSlider = element.querySelector(".js-ren-colour-picker-hue");
        const swatches = element.querySelectorAll(".js-ren-colour-picker-swatch");

        const render = () => {

            square.style.backgroundColor = hsvToHex(hue, 1, 1);
            marker.style.left = (saturation * 100) + "%";
            marker.style.top = ((1 - value) * 100) + "%";
            marker.style.backgroundColor = hsvToHex(hue, saturation, value);
            hueSlider.value = String(Math.round(hue));
        };

        const report = () => {

            render();
            onChange(hsvToHex(hue, saturation, value));
        };

        const setColour = (colour) => {

            const rgb = Ren.Colours.toRgb(colour);

            if (!rgb) return;

            const hsv = rgbToHsv(rgb);

            // A grey has no hue of its own, so the slider stays where it was.
            if (hsv.saturation !== 0) hue = hsv.hue;

            saturation = hsv.saturation;
            value = hsv.value;
            render();
        };

        const pickFromSquare = (e) => {

            const bounds = square.getBoundingClientRect();

            saturation = Ren.NumberUtils.clamp((e.clientX - bounds.left) / bounds.width, 0, 1);
            value = 1 - Ren.NumberUtils.clamp((e.clientY - bounds.top) / bounds.height, 0, 1);
            report();
        };

        square.addEventListener("pointerdown", (e) => {

            square.setPointerCapture(e.pointerId);
            pickFromSquare(e);
            e.preventDefault();
        });

        square.addEventListener("pointermove", (e) => {

            if (square.hasPointerCapture(e.pointerId)) pickFromSquare(e);
        });

        hueSlider.addEventListener("input", () => {

            hue = parseFloat(hueSlider.value);
            report();
        });

        for (let index = 0; index < swatches.length; index++) {

            const colour = swatches[index].dataset.colour;

            swatches[index].addEventListener("click", () => {

                setColour(colour);
                onChange(colour);
            });
        }

        setColour(initialColour);

        return {
            element,
            setColour
        };
    };

    return {
        create
    };
})();
