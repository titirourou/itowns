import * as THREE from 'three';
import OrientedImageCamera from '../Renderer/OrientedImageCamera';

/**
 * The CameraCalibrationParser module provide a [parse]{@link module:CameraCalibrationParser.parse}
 * method that takes a JSON array of camera calibrations in and yields an array of THREE.Camera
 *
 * @module CameraCalibrationParser
 */

THREE.Matrix4.prototype.setMatrix3 = function setMatrix3(m) {
    this.elements[0] = m.elements[0];
    this.elements[1] = m.elements[1];
    this.elements[2] = m.elements[2];
    this.elements[4] = m.elements[3];
    this.elements[5] = m.elements[4];
    this.elements[6] = m.elements[5];
    this.elements[8] = m.elements[6];
    this.elements[9] = m.elements[7];
    this.elements[10] = m.elements[8];
    return this;
};

const matrix3 = new THREE.Matrix3();
// the json format encodes the following transformation:
// extrinsics: p_local = rotation * (p_world - position)
// intrinsics: p_pixel = projection * p_local
// distortion: p_raw = distortion(p_pixel)
function parseCalibration(calibration, options) {
    // parse intrinsics
    const proj = calibration.projection;
    const size = new THREE.Vector2().fromArray(calibration.size);
    const focal = new THREE.Vector2(proj[0], proj[4]);
    const center = new THREE.Vector2(proj[2], proj[5]);
    const skew = proj[1];
    const camera = new OrientedImageCamera(size, focal, center, options.near, options.far, skew);

    // parse extrinsics: Object3d.matrix is from local to world
    // p_world = position + transpose(rotation) * p_local
    camera.position.fromArray(calibration.position);
    // calibration.rotation is row-major but fromArray expects a column-major array, yielding the transposed matrix
    const rotationInverse = matrix3.fromArray(calibration.rotation);
    camera.matrix.setMatrix3(rotationInverse);
    // local axes for cameras is (X right, Y up, Z back) rather than (X right, Y down, Z front)
    camera.scale.set(1, -1, -1);
    camera.quaternion.setFromRotationMatrix(camera.matrix);
    camera.matrix.compose(camera.position, camera.quaternion, camera.scale);

    // parse distortion
    if (calibration.distortion) {
        camera.distortion = {
            pps: new THREE.Vector2().fromArray(calibration.distortion.pps),
            polynom: new THREE.Vector4().fromArray(calibration.distortion.poly357),
            l1l2: new THREE.Vector3().set(0, 0, 0),
        };
        camera.distortion.polynom.w = calibration.distortion.limit * calibration.distortion.limit;
        if (calibration.distortion.l1l2) {
            camera.distortion.l1l2.fromArray(calibration.distortion.l1l2);
            camera.distortion.l1l2.z = calibration.distortion.etats;
        }
    }

    camera.name = calibration.id;
    return camera;
}

export default {
    /**
     * @function parse
     * @param {string|JSON} json - the json content of the calibration file.
     * @param {Object} options - Options controlling the parsing.
     * @param {string} options.near - Near of the created cameras.
     * @param {string} options.near - Far of the created cameras.
     * @return {Promise} - a promise that resolves with an array of cameras.
     */
    parse(json, options = {}) {
        if (typeof (json) === 'string') {
            json = JSON.parse(json);
        }
        return Promise.resolve(json.map(calibration => parseCalibration(calibration, options)));
    },
};