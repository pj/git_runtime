/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="./manual.d.ts" />
import * as q from 'q';
import * as request from 'request';

export function wait_for_response(host){
    var deferred = q.defer();
    var times = 0;
    var intervalId;
    intervalId = setInterval(function () {
        request(host, function (err, response, body){
            if (err) {
                if (times < 5) {
                    times += 1;
                    return;
                } else {
                    deferred.reject(new Error("Host not responding"));
                    clearInterval(intervalId);
                    return;
                }
            } else {
                deferred.resolve();
                clearInterval(intervalId);
            }
        });
    }, 200);

    return deferred.promise;
}
