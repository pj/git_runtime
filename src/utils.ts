import * as q from 'q';
import * as child_process from 'child_process';

export function exec(command: string, options=null){
    var deferred = q.defer();
    if (options) {
        var proc = child_process.exec(command, options);
    } else {
        var proc = child_process.exec(command);
    }

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
        let stdout = stdout_data.join("");
        let stderr = stderr_data.join("");
        //console.log("=======");
        //console.log(command);
        //console.log(stdout);
        //console.log("-------");
        //console.log(stderr);

        if (code !== 0) {
            deferred.reject(new Error("Process closed unexpectedly with code: " + code));
        } else {
            deferred.resolve([stdout, stderr]);
        }
    });

    return deferred.promise;
}

export function execPred(command: string){
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
        //let stdout = stdout_data.join("");
        //let stderr = stderr_data.join("");
        //console.log("=======");
        //console.log(command);
        //console.log(stdout);
        //console.log("-------");
        //console.log(stderr);
        deferred.resolve(code)
    });

    return deferred.promise;
}
/**
  * apply denodeify to a module, producing a new module containing methods
  * with 'Async' appended.
  */
export function denodeifyAll(o) {
    var new_module = {}
    Object.keys(o)
        .filter(m => typeof o[m] === 'function')
        .forEach(m => new_module[m + 'Async'] = q.denodeify(o[m]));

    return new_module;
}

// Various promiseified modules
export const tmp:any = denodeifyAll(require("tmp"));
export var getPortAsync = q.denodeify(require("portfinder").getPort);
