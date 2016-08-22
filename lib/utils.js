var q = require("q"),
    child_process = require("child_process");

function exec(command){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    proc.stdout.on('data', (data) => {
        console.log("-------");
        console.log(command);
        console.log(data);
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        console.log("-------");
        console.log(command);
        console.log(data);
        deferred.notify([null, data]);
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

/**
  * apply denodeify to a module, producing a new module containing methods
  * with 'Async' appended.
  */
function denodeifyAll(o) {
    var new_module = {}
    Object.keys(o)
        .filter(m => typeof o[m] === 'function')
        .forEach(m => new_module[m + 'Async'] = q.denodeify(o[m]));

    return new_module;
}

// Various promiseified modules
var tmp = denodeifyAll(require("tmp"));

module.exports = {
    exec: exec,
    denodeifyAll: denodeifyAll,
    tmp: tmp
}
