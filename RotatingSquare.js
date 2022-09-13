/**
 * @file
 *
 * Summary.
 *
 * 
 * 
 *
 * @author Igor Vilhalba
 * 
 */

"use strict";

let w;
let h;
let currentColor = 'r'
const deg = -1
const dist = 40

let square = {
    r: new DOMPoint(-dist, -dist),
    g: new DOMPoint(dist, -dist),
    b: new DOMPoint(dist, dist),
    w: new DOMPoint(-dist, dist)
}

function oppositeColor(c) {
    let color
    switch (c) {
        case 'r':
            color = 'b'
            break
        case 'b':
            color = 'r'
            break
        case 'g':
            color = 'w'
            break
        case 'w':
            color = 'g'
    }
    return color
}

function colorFromLetter(c) {
    let color
    switch(c) {
        case 'r':
            color = 'rgba(255,0,0,255)'
            break
        case 'g':
            color = 'rgba(0,255,0,255)'
            break
        case 'b':
            color = 'rgba(0,0,255,255)'
            break
        case 'w':
            color = 'rgba(255,255,255,255)'
            break
    }
    return color
}

function squareToArray(sq) {
    return [sq.r, sq.g, sq.b, sq.w]
}

function squareFromArray(arr) {
    return {r: arr[0], g: arr[1], b: arr[2], w: arr[3]}
}

function squareToString(sq) {
    return '{r: ' + pointToString(sq.r) 
    + ', g: ' + pointToString(sq.g) 
    + ', b: ' + pointToString(sq.b) 
    + ', w: ' + pointToString(sq.w) + '}'
}
function pointToString(p) {
    return '{x: ' + p.x + ', y: ' + p.y + '}'
}

/**
 * Maps a point in world coordinates to viewport coordinates.<br>
 * Note that the Y axix points downwards.
 * @returns {Array<Number>} transformed point.
 */
function mapToViewport(x, y, n = 5) {
    return [((x + n / 2) * w) / n, ((-y + n / 2) * h) / n];
}

function* range(start, end) {
    let step = (start > end) ? -1 : 1;
    let current = start
    while (true) {
      yield current;
      if (current === end) break;
      current += step;
    }
}  

function rotateAround(sq, c) {
    let [dx, dy] = [sq[c].x, sq[c].y]
    let trans = new DOMMatrix()
        .translate(-dx, -dy)
        .rotate(deg)
        .translate(dx, dy)
    //console.log(pointToString(sq[c]) + " => " + pointToString(sq[c].matrixTransform(trans)))
    //let res = squareFromArray(squareToArray(sq).map((p) => (p == sq[c]) ? p : p.matrixTransform(trans)))
    let res = squareFromArray(squareToArray(sq).map((p) => p.matrixTransform(trans)))
    
    //console.log("Original: " + squareToString(sq))
    //console.log("Rotacionado:", squareToString(res))
    return res
}

function rotateAround(sq, c) {
    let [dx, dy] = [sq[c].x, sq[c].y]

    let ops = [
        new DOMMatrix().translate(-dx, -dy),
        new DOMMatrix().rotate(deg),
        new DOMMatrix().translate(dx, dy)
    ]

    let res = squareFromArray(squareToArray(sq).map(
        (p) => p.matrixTransform(ops[0])
            .matrixTransform(ops[1])
            .matrixTransform(ops[2])))
    //console.log(squareToString(res))
    return res
}

function draw(ctx, sq) {
    ctx.fillStyle = "rgba(0, 204, 204, 1)";
    ctx.rect(0, 0, w, h);
    ctx.fill();

    let rotatedSquare = rotateAround(sq, currentColor)
    square = rotatedSquare
    let trans = new DOMMatrix().translate(w/2, h/2)
    let points = squareToArray(sq).map((p) => p.matrixTransform(trans))

    drawSquare(ctx, points)

    /* marca o centro */
    ctx.fillStyle = "rgba(0,0,0,255)"
    ctx.beginPath()
    ctx.arc(w/2, h/2, 5, 0, 2*Math.PI)
    ctx.closePath()
    ctx.fill()

    drawDots(ctx, squareFromArray(points))

    return rotatedSquare
}

function drawSquare(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath();

    // constroi gradiente
    let sq = squareFromArray(points)
    let opCol = oppositeColor(currentColor)
    let [start, end] = [sq[currentColor], sq[opCol]]
    let gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y)
    gradient.addColorStop(0, colorFromLetter(currentColor))
    gradient.addColorStop(1, colorFromLetter(opCol))
    // the fill color
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = "rgba(130,130,1300,255)"
    ctx.lineWidth = 10
    ctx.stroke()
}

function drawDots(ctx, sq) {
    ['r', 'g', 'b', 'w'].forEach((c) =>{
        let color = colorFromLetter(c)
        let p = sq[c]
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5, 0, 2*Math.PI)
        ctx.closePath()
        ctx.fill()
    })
}

function mainEntrance() {
    // retrieve <canvas> element
    var canvasElement = document.querySelector("#theCanvas");
    var ctx = canvasElement.getContext("2d");

    w = canvasElement.width;
    h = canvasElement.height;

    var runanimation = (() => {

        return () => {
            document.addEventListener('keypress', (event) =>{
                const keyName = event.key;
                //console.log(keyName)
                if (isValidKey(keyName)) {
                    currentColor = keyName.toLowerCase()
                }
            })

            draw(ctx, square);

            // request that the browser calls runanimation() again "as soon as it can"
            requestAnimationFrame(runanimation);
        };
    })();

    // draw!
    runanimation();
}

function isValidKey(key) {
    return ['r', 'g', 'b', 'w'].includes(key.toLowerCase())
}