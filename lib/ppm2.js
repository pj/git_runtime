var pm2 = require("pm2");
var q = require("q");

module.exports = {
    connect: q.denodify(pm2.connect),
    disconnect: q.denodify(pm2.disconnect),
    list: q.denodify(pm2.list),
    start: q.denodify(pm2.start),
    killDaemon: q.denodify(pm2.killDaemon)
}
