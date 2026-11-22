/**
 * Finds out what menu items do without showing what they would show, so that a settings window can
 * offer a menu's items as controls (see Ren.MenuSettingsModel).
 *
 * Two things are found out.  What an item depends on: a host notes a dependency where its items
 * read something, such as the series a chart's items act on, and track() collects the ones noted
 * while it runs.  And what an item opens: an editor or window about to open calls intercept(),
 * which, while an action is being probed, records what it was asked to show and stops the action
 * before anything is shown.
 */
Ren.MenuItemProbe = (() => {

    // The dependencies noted while tracking, or null when nothing is being tracked.
    let trackedDependencies = null;

    // What was intercepted while probing an action, or null when nothing is being probed.
    let interception = null;

    // Thrown to stop a probed action once it has asked for something to be shown.
    const STOP_ACTION = { isMenuItemProbeStop: true };

    /**
     * Notes that what is running depends on the named thing.  Costs nothing when not tracking.
     */
    const noteDependency = (name) => {

        if (trackedDependencies) trackedDependencies.add(name);
    };

    /**
     * Runs a function, returning what it returned and the names of the dependencies it noted.  A
     * function that throws is taken to have returned undefined.
     */
    const track = (fn) => {

        const outerDependencies = trackedDependencies;
        const dependencies = new Set();

        trackedDependencies = dependencies;

        let value;

        try {
            value = fn();
        }
        catch (e) {
            value = undefined;
        }
        finally {
            trackedDependencies = outerDependencies;
        }

        if (outerDependencies) dependencies.forEach(name => outerDependencies.add(name));

        return { value, dependencies };
    };

    /**
     * Gets a value indicating whether an action is being probed.
     */
    const isProbing = () => interception !== null;

    /**
     * Called by an editor or window about to be shown.  While an action is being probed, records
     * what kind of thing it is and the details it was given, then stops the action.
     */
    const intercept = (kind, details) => {

        if (interception === null) return;

        interception.kind = kind;
        interception.details = details || {};

        throw STOP_ACTION;
    };

    /**
     * Runs an action to find out what it would show, returning { kind, details }: "number" or
     * "text" for the editors with those names, "window" for any other window, "message" for a
     * request for something to be shown elsewhere, or "none" where the action ran to the end
     * without asking for anything to be shown - in which case it has done whatever it does.
     */
    const probeAction = (action, actionParameters) => {

        const outerInterception = interception;
        const result = { kind: "none", details: {} };

        interception = result;

        try {
            action.apply(null, actionParameters ?? []);
        }
        catch (e) {
            if (e !== STOP_ACTION) result.kind = "error";
        }
        finally {
            interception = outerInterception;
        }

        return result;
    };

    return {
        noteDependency,
        track,
        isProbing,
        intercept,
        probeAction
    };
})();
