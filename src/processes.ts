/**
  * @file Functions for creating processes for a commit id.
  */
import * as q from 'q';
import * as express from 'express';
import * as httpProxy from 'http-proxy';
import * as http from 'http';
import * as nunjucks from 'nunjucks';
import * as utils from './utils';
import {deploy_commit} from './deploy';
import * as admin from './admin';
import * as ppm2 from './ppm2';
import * as path from 'path';
import * as jsonfile from 'jsonfile';

var uuid = require('uuid');

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

async function multi_proxying(req, base_hostname, server_port,
                              proxy_treeish, process_list, test_id) {
    // deploy and test all commits - can be run in parrllel
    await Promise.all(proxy_treeish.map(async function (treeish) {
        let commit = await utils.exec("git rev-parse " + treeish);
        let found = process_list.filter((item) => item.name.indexOf(commit) != -1);
        if (found.length === 0) {
            await utils.deploy_commit(commit, server_port);
        }

        let result = await new Promise(function (resolve, reject) {
            http.request({
                hostname: req.hostname,
                port: req.port,
                path: req.path,
                method: req.method,
                headers: req.headers},
                function (res) {

                });
        });

        // write result to db
    }));
}

function default_proxying(req, res, next, base_hostname, production_commit, server_port, proxy, config) {
    var commit_id = get_commit_id(req, base_hostname);

    // TODO: I'm expecting that the startup script will call the proxy
    // server to start the production server... not sure if this is really the
    // best approach.
    if (commit_id === null) {
        commit_id = production_commit;
    }

    // check if commit is already running.
    ppm2.connect()
        .then(_ => ppm2.list())
        .then(function (list) {
            // only mutliproxy if we are receiving a productikon request.
            let multiproxying = commit_id === production_commit && config['plugins']
                && config['plugins']['multiproxy'];
            // generate a test id if we're multiproxying
            if (multiproxying) {
                var test_id = uuid.v4();
                // generate snapshot.
                // record results from production
                proxy.on('proxyRes', function (proxyRes, req, res){

                });
            }

            let found = list.filter((item) => item.name.indexOf(commit_id) != -1);
            if (found.length == 1 && found[0].pm2_env.status === 'online') {
                proxy.web(req, res, {target: `http://${base_hostname}:${found[0].pm2_env.LAZY_CLOUD_PORT}`});
            } else {
                // if isn't running then return splash page to start deploy.
                res.render('deploy_progress', {commit_id: commit_id,
                           url: `${base_hostname}:${server_port}`});
            }
            if (multiproxying) {
                multi_proxying(req, base_hostname, server_port,
                               config['plugins']['multiproxy'], list, test_id);
            }
        })
        .then(_ => ppm2.disconnect())
        .catch(err => next(err));
}

export default function start_lazycloud_server(deploy_path, server_port,
                                               base_hostname, production_commit) {
    var config = jsonfile.readFileSync(path.join(deploy_path, "lazycloud.json"));
    var app = express();

    // Template config.
    nunjucks.configure(path.resolve(__dirname, '..', 'views'), {
        autoescape: true,
        express: app,
        noCache: true
    });
    // set .njk as the default extension
    app.set('view engine', 'njk');

    // Setup express js web socket integration.
    var expressWs = require('express-ws')(app);

    // admin
    var admin_router = admin.create_admin(deploy_path, base_hostname);
    app.use('/lazy_cloud_admin', admin_router);

    var proxy = httpProxy.createProxyServer();

    app.all('/*', function (req, res, next) {
        default_proxying(req, res, next, base_hostname, production_commit,
                     server_port, proxy, config);
    });

    return new Promise(function (resolve, reject) {
        var server = app.listen(server_port);
        server.on('error', err => reject(err));
        server.on('listening', _ => resolve(server));
    });
}
