import {mat3, mat4} from './utils/index.js'

const incr = 0.006;
const rMax = 0.99;
const gMax = 0.99;
const bMax = 0.99;
let rCur = Math.random();
let gCur = Math.random();
let bCur = Math.random();

"use strict";

/**
 * A very basic stack class,
 * for keeping a hierarchy of transformations.
 * @class
 */
class Stack {
  /**
   * Constructor.
   * @constructs Stack
   */
  constructor() {
    /** Array for holding the stack elements. */
    this.elements = [];
    /** Top of the stack. */
    this.t = 0;
  }

  /**
   * Pushes a given matrix onto this stack.
   * @param {Matrix4} m transformation matrix.
   */
  push(m) {
    this.elements[this.t++] = m;
  }

  /**
   * Return the matrix at the top of this stack.
   * @return {Matrix4} m transformation matrix.
   */
  top() {
    if (this.t <= 0) {
      console.log("top = ", this.t);
      console.log("Warning: stack underflow");
    } else {
      return this.elements[this.t - 1];
    }
  }

  /**
   * Pops the matrix at the top of this stack.
   * @return {Matrix4} m transformation matrix.
   */
  pop() {
    if (this.t <= 0) {
      console.log("Warning: stack underflow");
    } else {
      this.t--;
      var temp = this.elements[this.t];
      this.elements[this.t] = undefined;
      return temp;
    }
  }

  /**
   * Returns whether this stack is empty.
   * @returns {Boolean} true if the stack is empty.
   */
  isEmpty() {
    return this.t <= 0;
  }
}

/**
 * A simpleRotator object to enable rotation by mouse dragging.
 * Provides the view transform that is applied to both skybox and teapot.
 * @type {SimpleRotator}
 */
var rotator;

/**
 * The transposed inverse of the model view matrix.
 * @type {mat3}
 */
var normalMatrix = mat3.create();

/**
 * <p>Creates data for vertices, colors, and normal vectors for
 * a unit cube. </p>
 *
 * Return value is an object with three attributes:
 * vertices, colors, and normals, each referring to a Float32Array.<br>
 * (Note this is a "self-invoking" anonymous function.)
 * @return {Object<{numVertices: Number, vertices: Float32Array, colors: Float32Array, normals: Float32Array}>}
 * vertex array with associated color and normal arrays.
 * @function
 * @global
 */
var cube = (function makeCube() {
  // vertices of cube
  // prettier-ignore
  var rawVertices = new Float32Array([
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5
    ]);

  // prettier-ignore
  var rawColors = new Float32Array([
      1.0, 0.0, 0.0, 1.0,  // red
      0.0, 1.0, 0.0, 1.0,  // green
      0.0, 0.0, 1.0, 1.0,  // blue
      1.0, 1.0, 0.0, 1.0,  // yellow
      1.0, 0.0, 1.0, 1.0,  // magenta
      0.0, 1.0, 1.0, 1.0,  // cyan
    ]);

  // prettier-ignore
  var rawNormals = new Float32Array([
      0, 0, 1,
      1, 0, 0,
      0, 0, -1,
      -1, 0, 0,
      0, 1, 0,
      0, -1, 0
    ]);

  // prettier-ignore
  var indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,  // z face
      1, 5, 6, 1, 6, 2,  // +x face
      5, 4, 7, 5, 7, 6,  // -z face
      4, 0, 3, 4, 3, 7,  // -x face
      3, 2, 6, 3, 6, 7,  // + y face
      4, 5, 1, 4, 1, 0   // -y face
    ]);

  var verticesArray = [];
  var colorsArray = [];
  var normalsArray = [];
  for (var i = 0; i < 36; ++i) {
    // for each of the 36 vertices...
    var face = Math.floor(i / 6);
    var index = indices[i];

    // (x, y, z): three numbers for each point
    for (var j = 0; j < 3; ++j) {
      verticesArray.push(rawVertices[3 * index + j]);
    }

    // (r, g, b, a): four numbers for each point
    for (var j = 0; j < 4; ++j) {
      colorsArray.push(rawColors[1 * face + j]);
    }

    // three numbers for each point
    for (var j = 0; j < 3; ++j) {
      normalsArray.push(rawNormals[3 * face + j]);
    }
  }

  return {
    numVertices: 36,
    vertices: new Float32Array(verticesArray),
    colors: new Float32Array(colorsArray),
    normals: new Float32Array(normalsArray),
  };
})();

/**
 * Return a matrix to transform normals, so they stay
 * perpendicular to surfaces after a linear transformation.
 * @param {Matrix4} model model matrix.
 * @param {Matrix4} view view matrix.
 * @returns {Float32Array} modelview transposed inverse.
 */
function makeNormalMatrixElements(model, view) {
  var n = new Matrix4(view).multiply(model);
  n.transpose();
  n.invert();
  n = n.elements;
  // prettier-ignore
  return new Float32Array([
      n[0], n[1], n[2],
      n[4], n[5], n[6],
      n[8], n[9], n[10]
    ]);
}

// A few global variables...

/**
 * The OpenGL context.
 * @type {WebGL2RenderingContext}
 */
var gl;

/**
 * Handle to a buffer on the GPU.
 * @type {WebGLBuffer}
 */
var vertexBuffer;

/**
 * Handle to a buffer on the GPU.
 * @type {WebGLBuffer}
 */
var vertexNormalBuffer;

/**
 * Handle to the compiled shader program on the GPU.
 * @type {WebGLProgram}
 */
var lightingShader;

/**
 * Transformation matrix that is the root of 5 objects in the scene.
 * @type {Matrix4}
 */
var torsoMatrix = new Matrix4().setTranslate(0, 0, 0);

/**  @type {Matrix4} */
var leftShoulderMatrix = new Matrix4().setTranslate(6.5, 2, 0);
/**  @type {Matrix4} */
var leftArmMatrix = new Matrix4().setTranslate(0, -5, 0);
/**  @type {Matrix4} */
var leftHandMatrix = new Matrix4().setTranslate(0, -4, 0);

/**  @type {Matrix4} */

var rightShoulderMatrix = new Matrix4().setTranslate(-6.5, 2, 0);
/**  @type {Matrix4} */                             
var rightArmMatrix = new Matrix4().setTranslate(0, -5, 0);
/**  @type {Matrix4} */
var rightHandMatrix = new Matrix4().setTranslate(0, -4, 0);

/**  @type {Matrix4} */
var headMatrix = new Matrix4().setTranslate(0, 7, 0);

/**  @type {Matrix4} */
var legMatrix = new Matrix4().setTranslate(0, -8, 0);

var torsoAngle = 0.0;

var leftShoulderAngle = 0.0;
var leftArmAngle = 0.0;
var leftHandAngle = 0.0;

var rightShoulderAngle = 0.0;
var rightArmAngle = 0.0;
var rightHandAngle = 0.0;

var headAngle = 0.0;

var legAngle = 0.0;


var torsoMatrixLocal = new Matrix4().setScale(10, 10, 15);

var leftShoulderMatrixLocal = new Matrix4().setScale(3, 5, 2);
var leftArmMatrixLocal = new Matrix4().setScale(3, 5, 2);
var leftHandMatrixLocal = new Matrix4().setScale(1, 3, 3);

var rightShoulderMatrixLocal = new Matrix4().setScale(3, 5, 2);
var rightArmMatrixLocal = new Matrix4().setScale(3, 5, 2);
var rightHandMatrixLocal = new Matrix4().setScale(1, 3, 3);

var headMatrixLocal = new Matrix4().setScale(12, 3, 12);

var legMatrixLocal = new Matrix4().setScale(4, 24, 2);

var contRotationLeg = 0


/**
 * View matrix.
 * @type {Matrix4}
 */
// prettier-ignore
var view;

/**
 * <p>Projection matrix.</p>
 * Here use aspect ratio 3/2 corresponding to canvas size 600 x 400.
 * @type {Matrix4}
 */
var projection = new Matrix4().setPerspective(50, 1.4, 0.1, 1000);

/**
 * Translate keypress events to strings.
 * @param {KeyboardEvent} event key pressed.
 * @return {String | null}
 * @see http://javascript.info/tutorial/keyboard-events
 */
function getChar(event) {
  if (event.which == null) {
    return String.fromCharCode(event.keyCode); // IE
  } else if (event.which != 0 && event.charCode != 0) {
    return String.fromCharCode(event.which); // the rest
  } else {
    return null; // special key
  }
}

/**
 * <p>Handler for key press events.</p>
 * Adjusts object rotations.
 * @param {KeyboardEvent} event key pressed.
 */
function handleKeyPress(event) {
  var ch = getChar(event);
  let opt = document.getElementById("options");
  switch (ch) {
    case "t":
      torsoAngle += 15;
      torsoMatrix.setTranslate(0, 0, 0).rotate(torsoAngle, 0, 1, 0);
      break;
    case "T":
      torsoAngle -= 15;
      torsoMatrix.setTranslate(0, 0, 0).rotate(torsoAngle, 0, 1, 0);
      break;
    case "s":
      leftShoulderAngle += 15;
      // rotate shoulder clockwise about a point 2 units above its center
      var currentShoulderRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-leftShoulderAngle, 1, 0, 0)
        .translate(0, -2, 0);
      leftShoulderMatrix.setTranslate(6.5, 2, 0).multiply(currentShoulderRot);
      break;
    case "S":
      leftShoulderAngle -= 15;
      var currentShoulderRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-leftShoulderAngle, 1, 0, 0)
        .translate(0, -2, 0);
      leftShoulderMatrix.setTranslate(6.5, 2, 0).multiply(currentShoulderRot);
      break;
    case "a":
      leftArmAngle += 15;
      // rotate arm clockwise about its top front corner
      var currentArm = new Matrix4()
        .setTranslate(0, 2.5, 1.0)
        .rotate(-leftArmAngle, 1, 0, 0)
        .translate(0, -2.5, -1.0);
      leftArmMatrix.setTranslate(0, -5, 0).multiply(currentArm);
      break;
    case "A":
      leftArmAngle -= 15;
      var currentArm = new Matrix4()
        .setTranslate(0, 2.5, 1.0)
        .rotate(-leftArmAngle, 1, 0, 0)
        .translate(0, -2.5, -1.0);
      leftArmMatrix.setTranslate(0, -5, 0).multiply(currentArm);
      break;
    case "h":
      leftHandAngle += 15;
      leftHandMatrix.setTranslate(0, -4, 0).rotate(leftHandAngle, 0, 1, 0);
      break;
    case "H":
      leftHandAngle -= 15;
      leftHandMatrix.setTranslate(0, -4, 0).rotate(leftHandAngle, 0, 1, 0);
      break;
    case "q":
      rightShoulderAngle += 15;
      // rotate shoulder clockwise about a point 2 units above its center
      var currentShoulderRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-rightShoulderAngle, 1, 0, 0)
        .translate(0, -2, 0);
      rightShoulderMatrix.setTranslate(-6.5, 2, 0).multiply(currentShoulderRot);
      break;
    case "Q":
      rightShoulderAngle -= 15;
      var currentShoulderRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-rightShoulderAngle, 1, 0, 0)
        .translate(0, -2, 0);
      rightShoulderMatrix.setTranslate(-6.5, 2, 0).multiply(currentShoulderRot);
      break;
    case "w":
      rightArmAngle += 15;
      // rotate arm clockwise about its top front corner
      var currentArm = new Matrix4()
        .setTranslate(0, 2.5, 1.0)
        .rotate(-rightArmAngle, 1, 0, 0)
        .translate(0, -2.5, -1.0);
      rightArmMatrix.setTranslate(0, -5, 0).multiply(currentArm);
      break;
    case "W":
      rightArmAngle -= 15;
      var currentArm = new Matrix4()
        .setTranslate(0, 2.5, 1.0)
        .rotate(-rightArmAngle, 1, 0, 0)
        .translate(0, -2.5, -1.0);
      rightArmMatrix.setTranslate(0, -5, 0).multiply(currentArm);
      break;
    case "e":
      rightHandAngle += 15;
      rightHandMatrix.setTranslate(0, -4, 0).rotate(rightHandAngle, 0, 1, 0);
      break;
    case "E":
      rightHandAngle -= 15;
      rightHandMatrix.setTranslate(0, -4, 0).rotate(rightHandAngle, 0, 1, 0);
      break;
    case "l":
      headAngle += 15;
      headMatrix.setTranslate(0, 7, 0).rotate(headAngle, 0, 1, 0);
      break;
    case "L":
      headAngle -= 15;
      headMatrix.setTranslate(0, 7, 0).rotate(headAngle, 0, 1, 0);
      break;
    case "f":

      if(contRotationLeg == 2){
        break;
      }

      contRotationLeg++
      legAngle += 15;
      // rotate shoulder clockwise about a point 2 units above its center

      var currentLegRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-legAngle, 1, 0, 0)
        .translate(0, -2, 0);
      legMatrix.setTranslate(0, -8, 0).multiply(currentLegRot);
      break;
    case "F":
      if(contRotationLeg == -2){
        break;
      }

      contRotationLeg--
      legAngle -= 15;
      // rotate shoulder clockwise about a point 2 units above its center
      var currentLegRot = new Matrix4()
        .setTranslate(0, 2, 0)
        .rotate(-legAngle, 1, 0, 0)
        .translate(0, -2, 0);
      legMatrix.setTranslate(0, -8, 0).multiply(currentLegRot);
      break;
    default:
      return;
  }

  rCur += incr;
  gCur += incr;
  bCur += incr;
  if (rCur > rMax) {
	rCur = 0.2
  }
  if (gCur > gMax) {
	gCur = 0.2
  }
  if (bCur > bMax) {
	bCur = 0.2
  }
  gl.clearColor(rCur, gCur, bCur, 1.0);
  draw()
}

/**
 * <p>Helper function.</p>
 * Renders the cube based on the model transformation
 * on top of the stack and the given local transformation.
 * @param {Matrix4} matrixStack matrix on top of the stack;
 * @param {Matrix4} matrixLocal local transformation.
 */
function renderCube(matrixStack, matrixLocal) {
  // bind the shader
  gl.useProgram(lightingShader);

  // get the index for the a_Position attribute defined in the vertex shader
  var positionIndex = gl.getAttribLocation(lightingShader, "a_Position");
  if (positionIndex < 0) {
    console.log("Failed to get the storage location of a_Position");
    return;
  }

  var normalIndex = gl.getAttribLocation(lightingShader, "a_Normal");
  if (normalIndex < 0) {
    console.log("Failed to get the storage location of a_Normal");
    return;
  }

  // "enable" the a_position attribute
  gl.enableVertexAttribArray(positionIndex);
  gl.enableVertexAttribArray(normalIndex);

  // bind data for points and normals
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(positionIndex, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
  gl.vertexAttribPointer(normalIndex, 3, gl.FLOAT, false, 0, 0);

  var loc = gl.getUniformLocation(lightingShader, "view");
  gl.uniformMatrix4fv(loc, false, view);
  loc = gl.getUniformLocation(lightingShader, "projection");
  gl.uniformMatrix4fv(loc, false, projection.elements);
  loc = gl.getUniformLocation(lightingShader, "u_Color");
  //gl.uniform4f(loc, 0.0, 1.0, 0.0, 1.0);
  gl.uniform4f(loc, 1-rCur, 1-gCur, 1-bCur, 1.0);
  var loc = gl.getUniformLocation(lightingShader, "lightPosition");
  gl.uniform4f(loc, -5.0, 10.0, 5.0, 0.9);

  var modelMatrixloc = gl.getUniformLocation(lightingShader, "model");
  var normalMatrixLoc = gl.getUniformLocation(lightingShader, "normalMatrix");

  // transform using current model matrix on top of stack
  var current = new Matrix4(matrixStack.top()).multiply(matrixLocal);
  gl.uniformMatrix4fv(modelMatrixloc, false, current.elements);
  gl.uniformMatrix3fv(
    normalMatrixLoc,
    false,
    makeNormalMatrixElements(current, view)
  );

  gl.drawArrays(gl.TRIANGLES, 0, 36);

  // on safari 10, buffer cannot be disposed before drawing...
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
}

/** Code to actually render our geometry. */
function draw() {
  view = rotator.getViewMatrix();

  // clear the framebuffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BIT);

  // set up the matrix stack
  var s = new Stack();
  s.push(torsoMatrix);
  renderCube(s, torsoMatrixLocal);

  // shoulder relative to torso
  s.push(new Matrix4(s.top()).multiply(leftShoulderMatrix));
  renderCube(s, leftShoulderMatrixLocal);

  // arm relative to shoulder
  s.push(new Matrix4(s.top()).multiply(leftArmMatrix));
  renderCube(s, leftArmMatrixLocal);

  // hand relative to arm
  s.push(new Matrix4(s.top()).multiply(leftHandMatrix));
  renderCube(s, leftHandMatrixLocal);
  s.pop();
  s.pop();
  s.pop();

  s.push(new Matrix4(s.top()).multiply(rightShoulderMatrix));
  renderCube(s, rightShoulderMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(rightArmMatrix));
  renderCube(s, rightArmMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(rightHandMatrix));
  renderCube(s, rightHandMatrixLocal);
  s.pop();
  s.pop();
  s.pop();

  // head relative to torso
  s.push(new Matrix4(s.top()).multiply(headMatrix));
  renderCube(s, headMatrixLocal);
  s.pop();

  s.push(new Matrix4(s.top()).multiply(legMatrix));
  renderCube(s, legMatrixLocal);
  s.pop();

  s.pop();

  animate()

}

/**
 * <p>Entry point when page is loaded.</p>
 *
 * Basically this function does setup that "should" only have to be done once,<br>
 * while draw() does things that have to be repeated each time the canvas is
 * redrawn.
 * @function
 * @memberof Window
 * @name anonymous_load
 * @global
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event
 */
window.addEventListener("load", (event) => {
  // retrieve <canvas> element
  var canvas = document.getElementById("theCanvas");

  rotator = new SimpleRotator(canvas, draw);
  rotator.setView([0, 0, 1], [0, 1, 0], 45);

  // key handler
  window.onkeypress = handleKeyPress;

  gl = canvas.getContext("webgl2");
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }

  // load and compile the shader pair, using utility from the teal book
  var vshaderSource = document.getElementById(
    "vertexLightingShader"
  ).textContent;
  var fshaderSource = document.getElementById(
    "fragmentLightingShader"
  ).textContent;
  if (!initShaders(gl, vshaderSource, fshaderSource)) {
    console.log("Failed to intialize shaders.");
    return;
  }
  lightingShader = gl.program;
  gl.useProgram(null);

  // buffer for vertex positions for triangles
  vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log("Failed to create the buffer object");
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube.vertices, gl.STATIC_DRAW);

  // buffer for vertex normals
  vertexNormalBuffer = gl.createBuffer();
  if (!vertexNormalBuffer) {
    console.log("Failed to create the buffer object");
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube.normals, gl.STATIC_DRAW);

  // buffer is not needed anymore (not necessary, really)
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // specify a fill color for clearing the framebuffer

  gl.clearColor(rCur, gCur, bCur, 1.0);
  gl.enable(gl.DEPTH_TEST);


  // define an animation loop
  var animate = function () {
    draw();
    requestAnimationFrame(animate);
  };

  // start drawing!
  animate();
});
 function SimpleRotator(
    canvas,
    callback,
    viewDirectionVector,
    viewUpVector,
    viewDistance
) {
    var unitx = new Array(3);
    var unity = new Array(3);
    var unitz = new Array(3);
    var viewZ;
    /**
     * Set up the view, where the parameters are optional,
     * and are used in the same way, <br>
     * as the corresponding parameters in the constructor.
     * @param {Array<Number>} viewDirectionVector
     * @param {Array<Number>} viewUpVector
     * @param {Number} viewDistance
     */
    this.setView = function (viewDirectionVector, viewUpVector, viewDistance) {
        var viewpoint = viewDirectionVector || [0, 0, 10];
        var viewup = viewUpVector || [0, 1, 0];
        if (viewDistance && typeof viewDistance == "number")
            viewZ = viewDistance;
        else viewZ = length(viewpoint);
        copy(unitz, viewpoint);
        normalize(unitz, unitz);
        copy(unity, unitz);
        scale(unity, unity, dot(unitz, viewup));
        subtract(unity, viewup, unity);
        normalize(unity, unity);
        cross(unitx, unity, unitz);
    };
    /**
     * Returns an array representing the viewing transformation matrix for the current view, <br>
     * suitable for use with
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniformMatrix gl.uniformMatrix4fv}
     * or, for further transformation, with the glmatrix library {@link https://glmatrix.net/docs/module-mat4.html mat4} class.
     * @return {Float32Array} view matrix.
     */
    this.getViewMatrix = function () {
        return new Float32Array(this.getViewMatrixArray());
    };
    /**
     * Sets the view matrix.
     * @param {Float32Array} matrix view matrix.
     */
    this.setViewMatrix = function (matrix) {
        unitx[0] = matrix[0];
        unity[0] = matrix[1];
        unitz[0] = matrix[2];
        unitx[1] = matrix[4];
        unity[1] = matrix[5];
        unitz[1] = matrix[6];
        unitx[2] = matrix[8];
        unity[2] = matrix[9];
        unitz[2] = matrix[10];
    };
    /**
     * Returns the view transformation matrix as a regular JavaScript array, <br>
     * but still represents as a 1D array of 16 elements, in column-major order.
     * @returns {Array<Number>} view matrix.
     */
    this.getViewMatrixArray = function () {
        return [
            unitx[0],
            unity[0],
            unitz[0],
            0,
            unitx[1],
            unity[1],
            unitz[1],
            0,
            unitx[2],
            unity[2],
            unitz[2],
            0,
            0,
            0,
            -viewZ,
            1,
        ];
    };
    /**
     * Returns the viewDistance.
     * @return {Number} view distance.
     */
    this.getViewDistance = function () {
        return viewZ;
    };
    /**
     * Sets the distance of the viewer from the origin without
     * changing the direction of view. <br>
     * If not present, the length of viewDirectionVector is used.
     * @param {Number} viewDistance view distance.
     */
    this.setViewDistance = function (viewDistance) {
        viewZ = viewDistance;
    };
    function applyTransvection(e1, e2) {
        // rotate vector e1 onto e2
        function reflectInAxis(axis, source, destination) {
            var s =
                2 *
                (axis[0] * source[0] +
                    axis[1] * source[1] +
                    axis[2] * source[2]);
            destination[0] = s * axis[0] - source[0];
            destination[1] = s * axis[1] - source[1];
            destination[2] = s * axis[2] - source[2];
        }
        normalize(e1, e1);
        normalize(e2, e2);
        var e = [0, 0, 0];
        add(e, e1, e2);
        normalize(e, e);
        var temp = [0, 0, 0];
        reflectInAxis(e, unitz, temp);
        reflectInAxis(e1, temp, unitz);
        reflectInAxis(e, unitx, temp);
        reflectInAxis(e1, temp, unitx);
        reflectInAxis(e, unity, temp);
        reflectInAxis(e1, temp, unity);
    }
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    var radius = Math.min(centerX, centerY);
    var radius2 = radius * radius;
    var prevx, prevy;
    var prevRay = [0, 0, 0];
    var dragging = false;
    function doMouseDown(evt) {
        if (dragging) return;
        dragging = true;
        document.addEventListener("mousemove", doMouseDrag, false);
        document.addEventListener("mouseup", doMouseUp, false);
        var box = canvas.getBoundingClientRect();
        prevx = window.pageXOffset + evt.clientX - box.left;
        prevy = window.pageYOffset + evt.clientY - box.top;
    }
    function doMouseDrag(evt) {
        if (!dragging) return;
        var box = canvas.getBoundingClientRect();
        var x = (window.pageXOffset + evt.clientX - box.left);
        var y = (window.pageYOffset + evt.clientY - box.top);
        var ray1 = toRay(prevx, prevy);
        var ray2 = toRay(x, y);
        applyTransvection(ray1, ray2);
        prevx = x;
        prevy = y;
        if (callback) {
            callback();
        }
    }
    function doMouseUp(evt) {
        if (dragging) {
            document.removeEventListener("mousemove", doMouseDrag, false);
            document.removeEventListener("mouseup", doMouseUp, false);
            dragging = false;
        }
    }
    function toRay(x, y) {
        var dx = x - centerX;
        var dy = centerY - y;
        var vx = dx * unitx[0] + dy * unity[0]; // The mouse point as a vector in the image plane.
        var vy = dx * unitx[1] + dy * unity[1];
        var vz = dx * unitx[2] + dy * unity[2];
        var dist2 = vx * vx + vy * vy + vz * vz;
        if (dist2 > radius2) {
            return [vx, vy, vz];
        } else {
            var z = Math.sqrt(radius2 - dist2);
            return [vx + z * unitz[0], vy + z * unitz[1], vz + z * unitz[2]];
        }
    }
    function dot(v, w) {
        return v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
    }
    function length(v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }
    function normalize(v, w) {
        var d = length(w);
        v[0] = w[0] / d;
        v[1] = w[1] / d;
        v[2] = w[2] / d;
    }
    function copy(v, w) {
        v[0] = w[0];
        v[1] = w[1];
        v[2] = w[2];
    }
    function add(sum, v, w) {
        sum[0] = v[0] + w[0];
        sum[1] = v[1] + w[1];
        sum[2] = v[2] + w[2];
    }
    function subtract(dif, v, w) {
        dif[0] = v[0] - w[0];
        dif[1] = v[1] - w[1];
        dif[2] = v[2] - w[2];
    }
    function scale(ans, v, num) {
        ans[0] = v[0] * num;
        ans[1] = v[1] * num;
        ans[2] = v[2] * num;
    }
    function cross(c, v, w) {
        var x = v[1] * w[2] - v[2] * w[1];
        var y = v[2] * w[0] - v[0] * w[2];
        var z = v[0] * w[1] - v[1] * w[0];
        c[0] = x;
        c[1] = y;
        c[2] = z;
    }
    this.setView(viewDirectionVector, viewUpVector, viewDistance);
    canvas.addEventListener("mousedown", doMouseDown, false);
}
