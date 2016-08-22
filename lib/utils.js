var q = require("q"),
    child_process = require("child_process");

function exec(command){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    var stdout_data = [];
    var stderr_data = [];

    proc.stdout.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stdout_data.push(data);
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stderr_data.push(data);
        deferred.notify([null, data]);
    });

    proc.on('error', function(err) {
        deferred.reject(err);
    });

    proc.on('close', (code) => {
        if (code !== 0) {
            deferred.reject(new Error("Process closed unexpectedly with code: " + code));
        } else {
            deferred.resolve([stdout_data.join(""), stderr_data.join("")]);
        }
    });

    return deferred.promise;
}

function execPred(command){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    proc.stdout.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        deferred.notify([null, data]);
    });

    proc.on('error', function(err) {
        deferred.reject(err);
    });

    proc.on('close', (code) => {
        defered.resolve(code)
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
var portfinder = denodeifyAll(require("portfinder"));

module.exports = {
    exec: exec,
    execPred: execPred,
    denodeifyAll: denodeifyAll,
    tmp: tmp,
    portfinder: portfinder
}
