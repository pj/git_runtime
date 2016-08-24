// Functions for starting a process for a commit id
var http = require('http');
var httpProxy = require('http-proxy');
var pm2 = require('pm2');
var ppm2 = require('../lib/ppm2.js');
var extend = require('util')._extend;
var git = require("nodegit");
var path = require("path");
var wait_for_response = require("../site_wait.js");
var structure = require("../structure.js");

function commit_exists(process_def, commit_id) {
    var script = process_def.apps[0].script;
    var repo_path = path.dirname(script);
    return structure.add_commit(repo_path, commit_id);
        //git.Repository.open(repo_path)
        //.then((repo) => git.Revparse.single(repo, commit_id));
}

function create_new_process_def(commit_id, process_def_array, list){
    var process_def = process_def_array.apps[0];
    var new_process_def = extend({}, process_def);
    if (new_process_def.env) {
        new_process_def.env = extend({}, new_process_def.env);
    } else {
        new_process_def.env = {};
    }
    var max_port = list.reduce(function(prev, cur){
        if (prev !== null && (parseInt(prev.pm2_env.PORT) >
                    parseInt(cur.pm2_env.PORT))) {
            return prev;
        } else {
            return cur;
        }
    }, null);

    if (max_port) {
        new_process_def.env.PORT = parseInt(max_port.pm2_env.PORT) + 1;
    }

    new_process_def.env.GIT_RUNTIME = commit_id;
    new_process_def.name = new_process_def.name + " - " + commit_id;

    new_process_def_array = {apps: [new_process_def]};

    return new_process_def_array;
}

function create_process(commit_id, process_def) {
    return ppm2.connect()
        .then((_) => ppm2.list())
        .then((list) => {
            var found, i;

            for (i in list) {
               if (list[i].name.indexOf(commit_id) != -1) {
                    found = i;
                    break;
               }
            }

            if (found === undefined) {
                return commit_exists(process_def, commit_id)
                    .then((object) => {
                        var new_process_def = create_new_process_def(
                                commit_id, process_def, list);
                        return ppm2.start(new_process_def)
                            .then((_) => new_process_def.apps[0].env.PORT);
                    });
            } else {
                var existing_proc = list[found];
                return existing_proc.pm2_env.PORT;
            }
        });
}

function create_process_server() {
    return http.createServer(function(req, res) {
        var commit_id = req.headers['x-git-commit-id'];
        if (commit_id) {
            create_process(commit_id, process_def)
                .then(function (port) {
                    return wait_for_response(target + ":" + port)
                        .then((_) => proxy.web(req, res,
                                    { target: target + ":" + port}))
                })
            .fail((err) => {
                console.log(err);
                res.statusCode = 500;
                res.end(err.toString());
                return err;
            });
        } else {
            proxy.web(req, res, { target: target + ":" + target_port});
        }
    });
}

module.exports = {
    create_process_server: create_process_server
};
