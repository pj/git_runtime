// Run by lazycloudd.js to start proxy process. Note: shouldn't be started
// directly.
var processes = require('./processes');

if (process.argv.length !== 5) {
    console.log("Lazy cloud server must be started by script.")
    process.exit(1);
}

processes.start_lazycloud_server(
        process.argv[2], // path to deployment
        parseInt(process.argv[3]), // proxy port
        parseInt(process.argv[4]), // production port
        process.argv[5]); // base hostname
