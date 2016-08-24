var q = require("q");
var request = require("request");

function wait_for_response(host){
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

module.exports = wait_for_response;
