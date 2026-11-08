/**
 * Functions for managing the DB connections used to generate reports.  See DbConnectionManager.cs.
 */
Ren.DbConnectionManagement = (() => {

    const heartbeatIntervalSeconds = 60;

    /**
     * Generates a unique ID for the DB connection held by an open browser tab.
     */
    const generateConnectionGuid = () => crypto.randomUUID();

    let heartbeatIntervalId;

    /**
     * Every x minutes, update the connection heartbeat so that the DB connection manager doesn't
     * dispose the connection held by an open browser tab.
     */
    const setUpConnectionHeartbeat = (connectionGuid) => {

        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);

        if (!Ren.Endpoints.has("updateConnectionHeartbeat")) return;

        heartbeatIntervalId = setInterval(() => {

            const data = { connectionGuid };

            Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("updateConnectionHeartbeat"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

        }, heartbeatIntervalSeconds * 1000);
    };

    /**
     * Makes a POST request to the server to dispose of the specified database connection.
     */
    const disposeConnection = (connectionGuid) => {

        const url = Ren.Endpoints.getUrl("disposeConnection");

        if (!url) return;

        Ren.FetchUtils.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ connectionGuid })
        });
    };

    return {
        generateConnectionGuid,
        setUpConnectionHeartbeat,
        disposeConnection
    };
})();
