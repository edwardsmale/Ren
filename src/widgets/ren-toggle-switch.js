/**
 * Creates a toggle switch widget.
 */
Ren.ToggleSwitch = (() => {

    const create = (initialValue) => {

        let value = initialValue ?? false;
        let clickHandler = null;

        const widgetGuid = Ren.RandomUtils.generateRandomClassName("ren-toggle-switch");

        const stylesheet = Ren.DynamicStylesheets
            .setupDynamicStylesheet(widgetGuid, "toggle-switch")
            .getStylesheet();

        const label = Ren.HtmlUtils.create("label")
            ._addClass(
                "ren-toggle-switch__label"
            );

        const toggleSwitch = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-toggle-switch",
                widgetGuid
            )
            ._append(label);

        toggleSwitch.onclick = () => {

            clickHandler && clickHandler();
        };

        const onClick = (handler) => {

            clickHandler = handler;
        };

        const toggleEnabledBackgroundColour = () =>
            Ren.Theme.cssValue("toggle-switch-on-background", "#4d85ff");
        const toggleDisabledBackgroundColour = () =>
            Ren.Theme.cssValue("toggle-switch-off-background", "#C6C6C6");

        const toggleBackgroundColour = () =>
            Ren.Theme.cssValue("toggle-switch-knob-background", "white");

        const updateStylesheet = (value) => {

            const scope = `.${widgetGuid}`;

            const styles = [];

            if (value) {

                styles.push(scope + ` .ren-toggle-switch__label { background-color: ${toggleEnabledBackgroundColour()}; }`);
                styles.push(scope + ` .ren-toggle-switch__label:after { transform: translateX(24px); background-color: ${toggleBackgroundColour()} }`);

            }
            else {

                styles.push(scope + ` .ren-toggle-switch__label { background-color: ${toggleDisabledBackgroundColour()}; }`);
                styles.push(scope + ` .ren-toggle-switch__label:after { transform: translateX(0); background-color: ${toggleBackgroundColour()} }`);
            }

            stylesheet.textContent = styles.join("\n");
        };

        const setValue = (newValue) => {

            value = newValue;

            updateStylesheet(value);
        };

        updateStylesheet(value);

        return {
            element: toggleSwitch,
            onClick,
            setValue
        };
    };

    return {
        create
    };
})();
