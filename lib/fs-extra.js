var fse = require('fs-extra');
var q = require('q');

module.exports = {
    emptyDir: q.denodeify(fse.emptyDir)
}
