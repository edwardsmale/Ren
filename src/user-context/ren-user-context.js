Ren.UserContext = (() => {

    const USER_GUID_KEY = "ren-user-guid";
    const SESSION_GUID_KEY = "ren-session-guid";

    // The page's own guid, made the first time it's asked for.
    let pageGuid = null;

    /**
     * Gets the specified storage's guid under the specified key: the one already there, else one
     * under the older key, which is then removed, else a new one with the specified prefix.  The
     * guids are only for Ren's log, so a page that doesn't send one gets nothing put in storage.
     */
    const getOrCreateGuid = (storage, key, olderKey, prefix) => {

        if (!Ren.Endpoints.has("renLogInsert")) return null;

        const guid = storage.getItem(key);

        if (guid) return guid;

        const newGuid = storage.getItem(olderKey) || Ren.RandomUtils.generateRandomClassName(prefix);

        storage.setItem(key, newGuid);
        storage.removeItem(olderKey);

        return newGuid;
    };

    /**
     * Gets the user guid, which persists across browser sessions, or null where renLogInsert
     * isn't configured.
     */
    const getUserGuid = () => getOrCreateGuid(localStorage, USER_GUID_KEY, "userGuid", "u");

    /**
     * Gets the session guid, which persists across page reloads, or null where renLogInsert isn't
     * configured.
     */
    const getSessionGuid = () => getOrCreateGuid(
        sessionStorage,
        SESSION_GUID_KEY,
        "sessionGuid",
        "s"
    );

    /**
     * Gets the page's guid.
     */
    const getPageGuid = () => {

        pageGuid ??= Ren.RandomUtils.generateRandomClassName("p");

        return pageGuid;
    };

    return {
        getUserGuid,
        getSessionGuid,
        getPageGuid
    };
})();
