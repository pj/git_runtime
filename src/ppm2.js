var pm2 = require("pm2");
var q = require("q");

module.exports = {
    connect: q.denodeify(pm2.connect),
    disconnect: q.denodeify(pm2.disconnect),
    list: q.denodeify(pm2.list),
    start: q.denodeify(pm2.start),
    stop: q.denodeify(pm2.stop),
    delete: q.denodeify(pm2.delete),
    killDaemon: q.denodeify(pm2.killDaemon)
};
