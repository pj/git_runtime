// Run by lazycloudd.js to start proxy process. Note: shouldn't be started
// directly.
import start_lazycloud_server from './processes'

if (process.argv.length < 6) {
    console.error("Lazy cloud server must be started by script.");
    process.exit(1);
}

start_lazycloud_server(
        process.argv[2], // path to deployment
        parseInt(process.argv[3]), // proxy port
        parseInt(process.argv[4]), // production port
        process.argv[5] // base hostname
);
