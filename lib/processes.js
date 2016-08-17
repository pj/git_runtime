/**
  * @file Functions for creating processes for a commit id.
  */
//var http = require('http');
//var httpProxy = require('http-proxy');
//var pm2 = require('pm2');
//var ppm2 = require('../lib/ppm2.js');
//var extend = require('util')._extend;
//var git = require("nodegit");
//var path = require("path");
//var wait_for_response = require("../site_wait.js");
//var structure = require("../structure.js");

//function create_process(commit_id, process_def) {
    //return ppm2.connect()
        //.then((_) => ppm2.list())
        //.then((list) => {
            //var found, i;

            //for (i in list) {
               //if (list[i].name.indexOf(commit_id) != -1) {
                    //found = i;
                    //break;
               //}
            //}

            //if (found === undefined) {
                //return commit_exists(process_def, commit_id)
                    //.then((object) => {
                        //var new_process_def = create_new_process_def(
                                //commit_id, process_def, list);
                        //return ppm2.start(new_process_def)
                            //.then((_) => new_process_def.apps[0].env.PORT);
                    //});
            //} else {
                //var existing_proc = list[found];
                //return existing_proc.pm2_env.PORT;
            //}
        //});
//}

//function create_process_server(base_hostname) {
    //return http.createServer(function(req, res) {
        //// If this is an admin request route to the admin process.
        //if (req.url.indexOf('/lazy_cloud_admin') === 0) {
            //res.
        //}

        //var hostname = req.headers.hostname.split(':')[0];
        //if (hostname !== base_hostname) {

        //}

        //var commit_id = req.headers['x-git-commit-id'];
        //if (commit_id) {
            //create_process(commit_id, process_def)
                //.then(function (port) {
                    //return wait_for_response("localhost:" + port)
                        //.then((_) => proxy.web(req, res,
                                    //{ target: "localhost:" + port}))
                //})
            //.fail((err) => {
                //console.log(err);
                //res.statusCode = 500;
                //res.end(err.toString());
                //return err;
            //});
        //} else {
            //proxy.web(req, res, { target: target + ":" + target_port});
        //}
    //});
//}

//function start_process_server(port, base_hostname) {
    //var server = create_process_server(base_hostname);
    //server.listen(port);
//}

//module.exports = {
    //start_process_server: start_process_server
//};

var express = require('express'),
    httpProxy = require('http-proxy'),
    portfinder = require('portfinder'),
    cons = require('consolidate'),
    q = require("q"),
    structure = require("./structure"),
    admin = require('./admin');

var getPort = q.denodeify(portfinder.getPort);

/**
  * If a process is started return it's port, otherwise start a new process and
  * return it's port.
  */
function get_process_port(commit_id) {
    return ppm2.connect()
        .then(commit_is_running(commit_id))
        .then((port) => {
            if (port !== null) {
                return port;
            } else {
                return structure.add_commit(commit_id)
                    .then(getPort())
                    .then((port) => {
                        var process_def = create_process_def(commit_id, port);
                        return ppm2.start(process_def);
                    });
            }});
}

function create_process_def(commit_id, port) {
    return {
        "apps" : [{
            "name"        : "lazycloud - " + commit_id,
            "script"      : "npm start",
            "node_args"   : "--harmony",
            "env"         : {
                LAZY_CLOUD_COMMIT_ID: commit_id,
                LAZY_CLOUD_PORT: port
            }
        }]
    };
}

function get_commit_id(req, base_hostname) {
    var hostname = req.headers.host.split(':')[0];
    if (hostname !== base_hostname) {
        var host_split = hostname.split('.');
        var base_split = base_hostname.split('.');
        if (host_split.length - base_split.length === 1) {
            return host_split[0];
        } else {
            throw new Error("Badly formatted hostname " + hostname);
        }
    } else {
        var commit_id = req.headers['x-git-commit-id'];

        if (commit_id) {
            return commit_id;
        } else {
            // Proxy to production
            return null;
        }
    }
}

function commit_is_running() {
    return ppm2.list()
        .then((list) => {
            var found = list.filter(
                    (item) => item.name.indexOf(commit_id) != -1);

            if (found.length === 0) {
                return null;
            } else if (found.length > 1){
                throw new Error("More than one process running for a commit");
            } else {
                return found[0].pm2_env.LAZY_CLOUD_PORT;
            }
        });
}

function start_lazycloud_server(server_port, production_port, base_hostname) {
    var app = express();

    // assign the handlebars engine to .html files
    admin.engine('html', cons.handlebars);

    // set .html as the default extension
    admin.set('view engine', 'html');
    admin.set('views', __dirname + '/views');

    var proxy = httpProxy.createProxyServer();

    app.use('/lazy_cloud_admin', admin);

    app.all('/*', function (req, res, next) {
        var commit_id = get_commit_id(req, base_hostname);
        if (commit_id !== null){
            get_process_port(commit_id)
                .then((port) =>{
                    proxy.web(req, res, {target: 'localhost:' + port});
                })
        } else {
            proxy.web(req, res, {target: 'localhost:' + production_port});
        }
    });

    app.listen(server_port, function () {
      console.log('Lazycloud server started on port ' + server_port + ' for hostname ' + base_hostname);
    });
}

module.exports = {
    start_lazycloud_server: start_lazycloud_server
};
