/**
 * Provides logging functionalities for the Ren web application.
 *
 * Nothing is logged unless loggingEnabled is set in ren.config.  Each entry is then turned into
 * the body POSTed to renLogInsert by the function the host registers with
 * Ren.Extensions.registerLogEntryMapper, so that the host decides how its log is laid out.
 */
Ren.Log = (() => {

    let pageSeq = 0;

    let pageEventTypeSeqMap = new Map();

    let mapLogEntry = null;
    let isHandlingMappers = false;
    let hasReportedMissingMapper = false;

    const logQueue = [];
    const LOG_INTERVAL_MS = 1000;

    const isLoggingEnabled = () => Ren.Config.getConfig().loggingEnabled === true;

    /**
     * Reports, once, that logging is enabled but the host hasn't registered a log entry mapper.
     */
    const reportMissingMapper = () => {

        if (hasReportedMissingMapper) return;

        hasReportedMissingMapper = true;

        console.error(
            "loggingEnabled is set in ren.config, but no log entry mapper is registered.  "
            + "Register one with Ren.Extensions.registerLogEntryMapper."
        );
    };

    /**
     * Takes the host's log entry mapper.  This file loads before Ren.Extensions, so it's taken
     * when the queue is first processed, by which time the host's scripts have run.
     */
    const handleMappers = () => {

        if (isHandlingMappers) return;

        isHandlingMappers = true;

        Ren.Extensions.handle("logEntryMapper", (mapper) => {
            mapLogEntry = mapper;
        });
    };

    function processLogQueue() {

        handleMappers();

        if (!isLoggingEnabled()) return;

        if (!mapLogEntry) {
            logQueue.length = 0;
            reportMissingMapper();
            return;
        }

        if (logQueue.length === 0) return;

        const url = Ren.Endpoints.getUrl("renLogInsert");

        if (!url) {
            logQueue.length = 0;
            return;
        }

        while (logQueue.length > 0) {

            const body = mapLogEntry(logQueue.shift());

            Ren.FetchUtils.fetch(url, {
                suppressErrorLogging: true,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }).catch(() => { });
        }
    }

    setInterval(processLogQueue, LOG_INTERVAL_MS);

    /**
     * Queues a log entry with a specified log level, for the host's mapper to turn into the body
     * POSTed to renLogInsert.
     *
     * @param {number} logLevel - The level of the log.
     * @param {string} eventType - The event type.
     * @param {string} [logGroup] - A string to group related log messages together.
     * @param {string} [topic] - Indicates the entity which the log message is about.
     * @param {string} [itemGuid] - The guid of the item the log message is about.
     * @param {object} [data] - Additional data to log.
     */
    const log = (logLevel, eventType, logGroup, topic, itemGuid, data) => {

        if (!isLoggingEnabled()) return;

        // Downloaded reports can't make requests to the server.
        if (Ren.UrlContext.isDownloadedReport()) return;

        // A data source the page polls in the background would swamp the log.
        if (Ren.NamedDataSources.getOptionsForTopic(topic).quiet) return;

        // Increment overall sequence for the page.
        pageSeq++;

        // Increment per-event type sequence for the page.
        const pageEventTypeSeq = (pageEventTypeSeqMap.get(eventType) || 0) + 1;

        pageEventTypeSeqMap.set(eventType, pageEventTypeSeq);

        logQueue.push({
            createdOn: new Date(),
            logLevel,
            eventType,
            logGroup,
            topic,
            itemGuid,
            pageGuid: Ren.UserContext.getPageGuid(),
            userGuid: Ren.UserContext.getUserGuid(),
            sessionGuid: Ren.UserContext.getSessionGuid(),
            pageUrl: Ren.UrlContext.browserRelativeUrl(),
            pageSeq,
            pageEventTypeSeq,
            data: data || null
        });
    };

    const error = (eventType, logGroup, topic, itemGuid, data) => log(Ren.LogLevelEnum.Error, eventType, logGroup, topic, itemGuid, data);
    const warning = (eventType, logGroup, topic, itemGuid, data) => log(Ren.LogLevelEnum.Warn, eventType, logGroup, topic, itemGuid, data);
    const info = (eventType, logGroup, topic, itemGuid, data) => log(Ren.LogLevelEnum.Info, eventType, logGroup, topic, itemGuid, data);
    const debug = (eventType, logGroup, topic, itemGuid, data) => log(Ren.LogLevelEnum.Debug, eventType, logGroup, topic, itemGuid, data);

    return {
        error,
        warning,
        info,
        debug,
        processLogQueue
    };
})();
