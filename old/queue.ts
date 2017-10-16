import Queue from 'better_queue';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import deploy from './deploy';


//var db = new sqlite3.Database("");
//db.run("CREATE TABLE lorem (info TEXT)");

var queue = null;

function queue_deploy(deploy_path, treeish) {
    // generate id
    var task_id = crypto.randomBytes(20).toString('hex');

    queue.push({ id: task_id, deploy_path: deploy_path, treeish: treeish});

    // return id so we can poll.
    return task_id;
}

function queue_setup(db) {
    queue = new Queue(function (task) {
        var inprogress = deploy.deploy(task.deploy_path, task.treeish);

        // TODO: update sqlite here, we could signal the queue manager instead
        // I guess...
        inprogress.on('start', _ =>
            db.run("INSERT INTO deploy_progress (task_id, status) VALUES ($task_id, "started")"
                {$task_id: task.id}));
        inprogress.on('end', _ =>
            db.run("INSERT INTO deploy_progress (task_id, status) VALUES ($task_id, "ended")"
                {$task_id: task.id}));
        inprogress.on('error', err =>
            db.run("INSERT INTO deploy_progress (task_id, status, info) VALUES ($task_id, "error", $error)"
                {$task_id: task.id, $error: err}));
        inprogress.on('progress', prog =>
            db.run("INSERT INTO deploy_progress (task_id, status, info) VALUES ($task_id, "progress", $progress)"
                {$task_id: task.id, $progress: prog}));
    }, {id: 'id'});

    // Might need these in the future.
    queue.on('task_finish', function (taskId, result, stats) {
    });

    queue.on('task_failed', function (taskId, err, stats) {
    });
}

module.exports = {
    deploy: queue_deploy,
    queue_setup: queue_setup
};
