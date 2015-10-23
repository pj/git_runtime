var http = require('http');
var httpProxy = require('http-proxy');
var pm2 = require('pm2');
var extend = require('util')._extend;
var git = require("nodegit");
var path = require("path");

function commit_process_exists(commit_id, process_def, cb) {
    pm2.list(function (err, list) {
        if (err) cb(err);
        var found = list.find((proc) => proc.name.indexOf(commit_id) != -1);
        if (found === -1) {
            var script = process_def.apps[0].script;
            var repo_path = path.dirname(script);
            git.Repository.open(repo_path)
                .then((repo) => git.Revparse.single(repo, commit_id))
                .then((object) => start_process(commit_id, process_def, cb))
                .catch((err) => cb(err));
        } else {
            cb(null, null);
        }
    });
}
function start_process(commit_id, process_def_array, cb) {
    var process_def = process_def_array.apps[0];
    var new_process_def = extend({}, process_def);
    if (new_process_def.env) {
        new_process_def.env = extend({}, new_process_def.env);
    } else {
        new_process_def.env = {};
    }

    new_process_def.env.GIT_RUNTIME = commit_id;
    new_process_def.name = new_process_def.name + " - " + commit_id;

    new_process_def_array = {apps: [new_process_def]};
    pm2.start(
        new_process_def_array,
        function(err, apps) {
            if (err) cb(err);
            cb(null, apps);
        }
    );
}

function find_create_commit_process(commit_id, process_def, cb) {
    pm2.connect(function(err) {
        if (err) cb(err);

        commit_process_exists(commit_id, process_def, cb);
    });
}

function start_proxy(target, port, process_def){
    var proxy = httpProxy.createProxyServer({});

    var server = http.createServer(function(req, res) {
        var commit_id = req.headers['X-Git-Commit-ID'];
        if (commit_id) {
            create_commit_process(commit_id, process_def)
        } else {
            proxy.web(req, res, { target: target});
        }
    });

    console.log("listening on port", port);
    server.listen(port);
}

module.exports = {
    start_proxy: start_proxy,
    commit_process_exists: commit_process_exists,
    find_create_commit_process: find_create_commit_process
};
