/**
 * The function editor's inputs for the template parameters declared in its code's header comment
 * (see Ren.FunctionTemplateParameters).  Changing an input writes its value into the header, and
 * editing the header updates the inputs.
 */
Ren.FunctionEditorTemplateParameterInputs = (() => {

    // Gets the step of a slider for a range where the declaration names none.
    const getDefaultSliderStep = (min, max) => {

        const range = max - min;

        if (range <= 1) return 0.01;
        if (range <= 10) return 0.1;

        return 1;
    };

    const createRowElement = (parameter) => {

        const hasRange = parameter.min !== null && parameter.max !== null;

        const rowElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "FunctionEditorTemplateParameter",
            {
                type: parameter.type,
                typeClass: parameter.type.replace(/\W/g, ""),
                min: parameter.min ?? "",
                max: parameter.max ?? "",
                step: parameter.step ?? "any",
                sliderStep: hasRange && parameter.type === "number"
                    ? parameter.step ?? getDefaultSliderStep(parameter.min, parameter.max)
                    : null
            }
        );

        const nameElement = rowElement.querySelector(".js-ren-template-parameter-name");
        const descriptionElement = rowElement.querySelector(".js-ren-template-parameter-description");

        nameElement.textContent = parameter.name;
        nameElement.title = parameter.description;
        descriptionElement.textContent = parameter.description;
        descriptionElement.title = parameter.description;

        return rowElement;
    };

    /**
     * Attaches the inputs to a container.
     * @param {Function} getCode - Gets the editor's code.
     * @param {Function} updateCode - Sets the editor's code, keeping the caret where it was.
     * @param {Function} [onValueChanged] - Called with the new code after an input changes it.
     * @returns {{ sync: Function, closeColourPickers: Function }} sync updates the inputs to match
     * the code, and closeColourPickers closes the colour picker windows the inputs opened.
     */
    const attach = (container, getCode, updateCode, onValueChanged) => {

        let signature = null;
        let controlsByName = {};
        let pickedColourAppliersByName = {};

        // Each colour parameter's picker window is linked to its input by the group
        // colourPickerGroupPrefix + the parameter's name.
        const colourPickerGroupPrefix =
            Ren.RandomUtils.generateRandomClassName("template-parameter-colour") + "|";

        // The names of the colour parameters with a picker window open.
        const openPickerNames = new Set();

        const getColourPickerGroup = (name) => colourPickerGroupPrefix + name;

        const getColourPickerName = (colourPickerGroup) =>
            colourPickerGroup.indexOf(colourPickerGroupPrefix) === 0
                ? colourPickerGroup.substring(colourPickerGroupPrefix.length)
                : null;

        const setParameterValue = (name, value) => {

            updateCode(Ren.FunctionTemplateParameters.setValue(getCode(), name, value));

            if (onValueChanged) onValueChanged(getCode());
        };

        const setupTextControl = (parameter, rowElement) => {

            const input = rowElement.querySelector(".js-ren-template-parameter-value");

            input.addEventListener("input", () => setParameterValue(parameter.name, input.value));

            return (value) => { input.value = value; };
        };

        const setupNumberControl = (parameter, rowElement) => {

            const input = rowElement.querySelector(".js-ren-template-parameter-value");
            const slider = rowElement.querySelector(".js-ren-template-parameter-slider");

            if (slider) {

                slider.addEventListener("input", () => {

                    input.value = slider.value;
                    setParameterValue(parameter.name, slider.value);
                });
            }

            // A half-typed number, such as "-", is left out of the code until it is a number.
            input.addEventListener("input", () => {

                if (input.value === "" || isNaN(parseFloat(input.value))) return;

                if (slider) slider.value = input.value;

                setParameterValue(parameter.name, input.value);
            });

            return (value) => {

                input.value = value;

                if (slider && value !== "") slider.value = value;
            };
        };

        const setupBooleanControl = (parameter, rowElement) => {

            const checkbox = rowElement.querySelector(".js-ren-template-parameter-value");

            checkbox.addEventListener("change", () => {

                setParameterValue(parameter.name, checkbox.checked ? "true" : "false");
            });

            return (value) => { checkbox.checked = Ren.TextUtils.isTrue(value); };
        };

        const showPickerColour = (name, colour) => {

            if (!openPickerNames.has(name)) return;

            Ren.Messages.Requests.showColourPickerColour.notify(getColourPickerGroup(name), colour);
        };

        // Gets a value indicating whether the inputs are closed along with their editor, and have
        // no picker window open that could still pick a colour for them.
        const isFinished = () => !container.isConnected && openPickerNames.size === 0;

        let isListeningToPickers = false;

        // Owned by no window, since a picker keeps applying its colours after the editor it was
        // opened from has closed.  Each listener removes itself once the inputs are finished.
        const listenToPickers = () => {

            if (isListeningToPickers) return;

            isListeningToPickers = true;

            Ren.Messages.withOwner(null, () => {

                Ren.Messages.Events.colourPicked.handle((colourPickerGroup, colour) => {

                    if (isFinished()) return false;

                    const name = getColourPickerName(colourPickerGroup);

                    if (name !== null && pickedColourAppliersByName[name]) {
                        pickedColourAppliersByName[name](colour);
                    }
                });

                Ren.Messages.Events.colourPickerWindowClosed.handle((colourPickerGroup) => {

                    const name = getColourPickerName(colourPickerGroup);

                    if (name !== null) openPickerNames.delete(name);

                    if (isFinished()) return false;
                });
            });
        };

        const closePicker = (name) => {

            openPickerNames.delete(name);
            Ren.Messages.Requests.closeColourPickerWindow.notify(getColourPickerGroup(name));
        };

        const closeColourPickers = () => {

            const names = Array.from(openPickerNames);

            for (let index = 0; index < names.length; index++) closePicker(names[index]);
        };

        const setupColourControl = (parameter, rowElement) => {

            const swatch = rowElement.querySelector(".js-ren-template-parameter-swatch");
            const input = rowElement.querySelector(".js-ren-template-parameter-value");

            const showColour = (colour) => {

                swatch.style.background = Ren.Colours.toRgb(colour) ? colour : "";
            };

            input.addEventListener("input", () => {

                showColour(input.value);
                showPickerColour(parameter.name, input.value);
                setParameterValue(parameter.name, input.value);
            });

            swatch.addEventListener("click", () => {

                if (openPickerNames.has(parameter.name)) {

                    closePicker(parameter.name);
                    return;
                }

                openPickerNames.add(parameter.name);
                listenToPickers();

                Ren.Messages.Requests.colourPickerWindow.notify(
                    getColourPickerGroup(parameter.name),
                    parameter.name,
                    input.value,
                    swatch
                );
            });

            pickedColourAppliersByName[parameter.name] = (colour) => {

                input.value = colour;
                showColour(colour);
                setParameterValue(parameter.name, colour);
            };

            return (value) => {

                // Read back from hex, a colour just picked could move the hue slider a little.
                if (value === input.value && swatch.style.background) return;

                input.value = value;
                showColour(value);
                showPickerColour(parameter.name, value);
            };
        };

        const CONTROL_SETUPS = {
            number: setupNumberControl,
            boolean: setupBooleanControl,
            colour: setupColourControl
        };

        const build = (parameters) => {

            const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
                "FunctionEditorTemplateParameters",
                {}
            );

            const rowsElement = element.querySelector(".js-ren-template-parameters-rows");
            const colourParameterNames = new Set();

            controlsByName = {};
            pickedColourAppliersByName = {};

            for (let index = 0; index < parameters.length; index++) {

                const parameter = parameters[index];

                if (parameter.type === "colour") colourParameterNames.add(parameter.name);
            }

            // A picker stays open, and linked to the new input, while its parameter is a colour.
            const pickerNames = Array.from(openPickerNames);

            for (let index = 0; index < pickerNames.length; index++) {

                if (!colourParameterNames.has(pickerNames[index])) closePicker(pickerNames[index]);
            }

            for (let index = 0; index < parameters.length; index++) {

                const parameter = parameters[index];
                const rowElement = createRowElement(parameter);
                const setupControl = CONTROL_SETUPS[parameter.type] || setupTextControl;
                const setValue = setupControl(parameter, rowElement);

                setValue(parameter.value ?? "");

                controlsByName[parameter.name] = {
                    setValue,
                    element: rowElement.querySelector(".js-ren-template-parameter-controls")
                };

                rowsElement.appendChild(rowElement);
            }

            container.innerHTML = "";
            container.appendChild(element);
        };

        const getSignature = (parameters) => {

            const parts = [];

            for (let index = 0; index < parameters.length; index++) {

                const parameter = parameters[index];

                parts.push([
                    parameter.name, parameter.type, parameter.min, parameter.max, parameter.step,
                    parameter.description
                ]);
            }

            return JSON.stringify(parts);
        };

        const sync = () => {

            const parameters = Ren.FunctionTemplateParameters.parse(getCode());

            container.hidden = parameters.length === 0;

            const newSignature = getSignature(parameters);

            if (newSignature !== signature) {

                signature = newSignature;
                build(parameters);
                return;
            }

            // The input being typed in already shows what it wrote to the code.
            for (let index = 0; index < parameters.length; index++) {

                const control = controlsByName[parameters[index].name];

                if (!control || control.element.contains(document.activeElement)) continue;

                control.setValue(parameters[index].value ?? "");
            }
        };

        sync();

        return {
            sync,
            closeColourPickers
        };
    };

    return {
        attach
    };
})();
