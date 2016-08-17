// Run by lazycloudd.js to start proxy process. Note: shouldn't be started
// directly.
var processes = require('./processes');

if (process.argv.length !== 5) {
    console.log("Lazy cloud server must be started by script.")
    process.exit(1);
}

processes.start_lazycloud_server(
        parseInt(process.argv[2]),
        parseInt(process.argv[3]),
        process.argv[4]);
