var q = require("q"),
    child_process = require("child_process");

function exec(command){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    proc.stdout.on('data', (data) => {
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        deferred.notify([data, null]);
    });

    proc.on('error', function(err) {
        deferred.reject(err);
    });

    proc.on('close', (code) => {
        if (code !== 0) {
            deferred.reject(new Error("Process closed unexpectedly with code: " + code));
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
}

module.exports = {
    exec: exec
}
