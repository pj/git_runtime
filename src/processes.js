/**
  * @file Functions for creating processes for a commit id.
  */
var express = require('express'),
    httpProxy = require('http-proxy'),
    nunjucks = require('nunjucks'),
    q = require("q"),
    structure = require("./structure"),
    utils = require("./utils"),
    deploy = require("./deploy"),
    admin = require('./admin');

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

function start_lazycloud_server(deploy_path, server_port, production_port, base_hostname) {
    var app = express();

    // Template config.
    nunjucks.configure('views', {
        autoescape: true,
        express: app
    });
    // set .html as the default extension
    app.set('view engine', 'njk');
    app.set('views', __dirname + '/views');

    // Setup express js web socket integration.
    var expressWs = require('express-ws')(app);

    // admin
    var admin_router = admin.create_admin(deploy_path);
    app.use('/lazy_cloud_admin', admin_router);

    var proxy = httpProxy.createProxyServer();

    app.all('/*', function (req, res, next) {
        var commit_id = get_commit_id(req, base_hostname);
        if (commit_id !== null){
            // quick check here to see if we are already deployed and running
            // and code is up to date.
            deploy.deploy(deploy_path, commit_id)
                .then((port) =>{
                    proxy.web(req, res, {target: 'localhost:' + port});
                });
        } else {
            proxy.web(req, res, {target: 'localhost:' + production_port});
        }
    });

    return new Promise(function (resolve, reject) {
        var server = app.listen(server_port);
        server.on('error', err => reject(err));
        server.on('listening', _ => resolve(server));
    });
}

module.exports = {
    start_lazycloud_server: start_lazycloud_server
};
