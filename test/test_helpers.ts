import * as q from "q";
import * as pm2 from "pm2";
import * as path from 'path';

var fs = require("q-io/fs");

import * as ppm2 from "../src/ppm2";
import * as fse from '../src/fs-extra';

import * as utils from '../src/utils';
import * as init from '../src/init';

async function write_commit(tmp_repo_path, commit) {
    process.chdir(tmp_repo_path);
    let [message, files] = commit;
    console.log(Object.keys(files).map(path => files[path]));
    await Promise.all(Object.keys(files)
                        .map(path => fs.write(path, files[path])));
    // commit with message
    await utils.exec(`git add --all`);
    await utils.exec(`git commit -m "${message}"`);
    let commit_id = await utils.exec(`git rev-parse HEAD`);
    return commit_id[0].trim();
}

export class commiterator {
    repo_path: string;
    current: number;
    commits: any;
    constructor(repo_path, ...commits) {
        this.repo_path = repo_path;
        this.commits = commits;
        this.current = -1;
    }

    async next() {
        this.current++;
        if (this.current >= this.commits.length) {
            throw new Error("No more commits");
        }
        let commit_id = await write_commit(this.repo_path, this.commits[this.current])
        return commit_id;
    }
}

export async function createTempRepo() {
    var x = await utils.tmp.dirAsync({unsafeCleanup: true});
    this.repo_path = x[0]
    this.repo_cleanup = x[1];
    await utils.exec("git init", {cwd: this.repo_path});
}

export async function createTempDeployment() {
    var x = await utils.tmp.dirAsync({unsafeCleanup: true});
    this.deployment_path = x[0]
    this.deployment_cleanup = x[1];
    process.chdir(this.deployment_path);

    this.deploy_repo_path = path.resolve(this.deployment_path, 'repo');
    await init.init_deployment(this.repo_path);
    await ppm2.connect();
    await ppm2.killDaemon();
}
