import * as fse from 'fs-extra';
import * as q from 'q';

export const emptyDir = q.denodeify(fse.emptyDir);
export const writeJSON = q.denodeify(fse.writeJSON);
