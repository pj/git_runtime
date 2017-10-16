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
import * as ppm2 from './promisify/ppm2';
import * as path from 'path';
import * as jsonfile from 'jsonfile';

var uuid = require('uuid');
var levelup = require('levelup');
var Connection = require('versionbase').Connection;

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

async function default_proxying(req, res, next, base_hostname, production_commit,
                          server_port, proxy, config, multiproxy_db,
                          vb_connection) {
    try {
        let commit_id = get_commit_id(req, base_hostname);

        // TODO: I'm expecting that the startup script will call the proxy
        // server to start the production server... not sure if this is really the
        // best approach.
        if (commit_id === null) {
            commit_id = production_commit;
        }

        let multiproxying = commit_id === production_commit
                                && config['plugins']
                                && config['plugins']['multiproxy'];

        let list = await ppm2.list();
        let snapshot_id = null, multiproxy_test_id = null, headers = {};
        if (multiproxying) {
            multiproxy_test_id = uuid.v4();
            req.mutliproxy_test_id = multiproxy_test_id;
            // generate snapshot.
            snapshot_id = await vb_connection.create_snapshot();
            req.snapshot_id = snapshot_id;
            headers["X-Lazy-Cloud-Snapshot-ID"] = snapshot_id;
            headers["X-Lazy-Cloud-Multiproxy-Test"] = multiproxy_test_id;
        }

        let found = list.filter((item) => item.name.indexOf(commit_id) != -1);
        if (found.length == 1 && found[0].pm2_env.status === 'online') {
            proxy.web(req, res, {
                target: `http://${base_hostname}:${found[0].pm2_env.LAZY_CLOUD_PORT}`,
                headers: headers
            });
        } else {
            // if isn't running then return splash page to start deploy.
            res.render('deploy_progress', {
                            commit_id: commit_id,
                            url: `${base_hostname}:${server_port}`
                        });
        }
    } catch (e) {
        next(e);
    }
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

    // Record results from production.
    let multiproxying = config['plugins'] && config['plugins']['multiproxy'];

    let multiproxy_db;
    let vb_connection;
    if (multiproxying) {
        vb_connection = Connection.connect();
        multiproxy_db = levelup('multiproxy.db');
        proxy.on('proxyRes', function (proxyRes, req, res) {
            let snapshot_id = req.snapshot_id;
            let multiproxy_test_id = req.multiproxy_test_id;
            if (snapshot_id && multiproxy_test_id) {
                let body_buffer = Buffer.from("");
                proxyRes.on('data', function (chunk) {
                    if (Buffer.isBuffer(chunk)) {
                        chunk.copy(body_buffer);
                    } else {
                        body_buffer.write(chunk);
                    }
                });

                proxyRes.on('end', function () {
                    let test_doc = {
                        doctype: "multiproxy",
                        snapshot_id: snapshot_id,
                        test_id: multiproxy_test_id,
                        status_code: proxyRes.statusCode,
                        body: body_buffer.toString()
                    };

                    multiproxy_db.put(multiproxy_test_id, test_doc, function (err, value) {
                        if (err) {
                            // not much we can do...
                            console.error(err);
                        }
                    });
                });

                proxyRes.on('error', function (error) {
                    console.error(error);
                });
            }
        });
    }

    app.all('/*', function (req, res, next) {
        default_proxying(req, res, next, base_hostname, production_commit,
                     server_port, proxy, config, multiproxy_db, vb_connection);
    });

    return ppm2.connect()
        .then(function () {
            return new Promise(function (resolve, reject) {
                var server = app.listen(server_port);
                server.on('error', err => reject(err));
                server.on('listening', _ => resolve(server));
            });
        });
}
