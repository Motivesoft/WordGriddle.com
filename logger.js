(function () {
    // Original console methods
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    // Function to send logs to the server
    function sendLogToServer(type, message) {
        const logData = {
            type: type,
            message: message,
            timestamp: new Date().toISOString()
        };

        fetch('/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        }).catch(error => {
            originalConsole.error(console, `Failed to send log to server: ${message}: `, error);
        });
    }

    // Override console methods
    console.log = function (...args) {
        originalConsole.log.apply(console, args);
        sendLogToServer('LOG  ', args.join(' '));
    };

    console.error = function (...args) {
        originalConsole.error.apply(console, args);
        sendLogToServer('ERROR', args.join(' '));
    };

    console.warn = function (...args) {
        originalConsole.warn.apply(console, args);
        sendLogToServer('WARN ', args.join(' '));
    };

    console.info = function (...args) {
        originalConsole.info.apply(console, args);
        sendLogToServer('INFO ', args.join(' '));
    };

    console.debug = function (...args) {
        originalConsole.debug.apply(console, args);
        sendLogToServer('DEBUG', args.join(' '));
    };

    // TODO confirm this works as expected
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("Uncaught error:", message);
        console.error("Source:", source);
        console.error("Line:", lineno, "Column:", colno);
        console.error("Error object:", error);
    }
})();