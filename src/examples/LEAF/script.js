/* eslint no-undef: "off", no-unused-vars: "off" */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/OrbitControls.js'
import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { Rhino3dmLoader } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/loaders/3DMLoader.js'

const loader = new Rhino3dmLoader()
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/')

const definition = 'LEAF.gh'

// setup input change events
const XCoordinate = document.getElementById('RH_IN:X coordinate')
XCoordinate.addEventListener('mouseup', onSliderChange, false)
XCoordinate.addEventListener('touchend', onSliderChange, false)

const YCoordinate = document.getElementById('RH_IN:Y coordinate')
YCoordinate.addEventListener('mouseup', onSliderChange, false)
YCoordinate.addEventListener('touchend', onSliderChange, false)

const PlanVariation = document.getElementById('RH_IN:Rotation Variation')
PlanVariation.addEventListener('mouseup', onSliderChange, false)
PlanVariation.addEventListener('touchend', onSliderChange, false)

const InnerShell = document.getElementById('RH_IN:Generate Inflated Inner Shell')
InnerShell.addEventListener('mouseup', onSliderChange, false)
InnerShell.addEventListener('touchend', onSliderChange, false)

const OuterShell = document.getElementById('RH_IN:Generate Outer Shell')
OuterShell.addEventListener('mouseup', onSliderChange, false)
OuterShell.addEventListener('touchend', onSliderChange, false)

const OuterShellOpening = document.getElementById('RH_IN:Outer Shell Roof Opening Size')
OuterShellOpening.addEventListener('mouseup', onSliderChange, false)
OuterShellOpening.addEventListener('touchend', onSliderChange, false)

let rhino, doc

rhino3dm().then(async m => {
    console.log('Loaded rhino3dm.')
    rhino = m // global

    init()
    compute()

})

const downloadButton = document.getElementById("downloadButton")
downloadButton.onclick = download

function download() {
    // write rhino doc to "blob"
    const bytes = doc.toByteArray()
    const blob = new Blob([bytes], { type: "application/octect-stream" })

    // use "hidden link" trick to get the browser to download the blob
    const filename = data.definition.replace(/\.gh$/, '') + '.3dm'
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
}

/**
 * Call appserver
 */
async function compute() {
    showSpinner(true)
        // initialise 'data' object that will be used by compute()
    const data = {
        definition: definition,
        inputs: {
            'RH_IN:X coordinate': XCoordinate.valueAsNumber,
            'RH_IN:Y coordinate': YCoordinate.valueAsNumber,
            'RH_IN:Rotation Variation': PlanVariation.valueAsNumber,
            'RH_IN:Generate Inflated Inner Shell': InnerShell.valueAsNumber,
            'RH_IN:Generate Outer Shell': OuterShell.valueAsNumber,
            'RH_IN:Outer Shell Roof Opening Size': OuterShellOpening.valueAsNumber
        }


    }

    console.log(data.inputs)

    const request = {
        'method': 'POST',
        'body': JSON.stringify(data),
        'headers': { 'Content-Type': 'application/json' }
    }

    try {
        const response = await fetch('/solve', request)

        if (!response.ok)
            throw new Error(response.statusText)

        const responseJson = await response.json()
        collectResults(responseJson)

    } catch (error) {
        console.error(error)
    }
}

/**
 * Parse response
 */
function collectResults(responseJson) {

    const values = responseJson.values

    console.log(values)

    // clear doc
    try {
        if (doc !== undefined)
            doc.delete()
    } catch {}

    //console.log(values)
    doc = new rhino.File3dm()

    // for each output (RH_OUT:*)...
    for (let i = 0; i < values.length; i++) {
        // ...iterate through data tree structure...
        for (const path in values[i].InnerTree) {
            const branch = values[i].InnerTree[path]
                // ...and for each branch...
            for (let j = 0; j < branch.length; j++) {
                // ...load rhino geometry into doc
                const rhinoObject = decodeItem(branch[j])
                if (rhinoObject !== null) {
                    // console.log(rhinoObject)
                    doc.objects().add(rhinoObject, null)
                }
            }
        }
    }
}

function showSpinner(enable) {
    if (enable)
        document.getElementById('loader').style.display = 'block'
    else
        document.getElementById('loader').style.display = 'none'
}

function decodeItem(item) {
    const data = JSON.parse(item.data)
    if (item.type === 'System.String') {
        // hack for draco meshes
        try {
            return rhino.DracoCompression.decompressBase64String(data)
        } catch {} // ignore errors (maybe the string was just a string...)
    } else if (typeof data === 'object') {
        return rhino.CommonObject.decode(data)
    }
    return null
}

function onSliderChange() {

    showSpinner(true)
    compute()
    zoomCameraToSelection(camera, controls, scene.children)
}

// BOILERPLATE //
var scene, camera, renderer, controls

function init() {
    // Rhino models are z-up, so set this as the default
    THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

    scene = new THREE.Scene()
    scene.background = new THREE.Color(1, 1, 1)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .8, 1000)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)

    camera.position.z = 5
    camera.position.x = -100
    camera.position.y = -100


    // add a directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff)
    directionalLight.intensity = 1.25
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight()
    scene.add(ambientLight)


    window.addEventListener('resize', onWindowResize, false)

    animate()
}

var animate = function() {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    animate()
}

function zoomCameraToSelection(camera, controls, selection, fitOffset = 1.2) {

    const box = new THREE.Box3();

    for (const object of selection) {
        if (object.isLight) continue
        box.expandByObject(object);
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

    const direction = controls.target.clone()
        .sub(camera.position)
        .normalize()
        .multiplyScalar(distance);
    controls.maxDistance = distance * 10;
    controls.target.copy(center);

    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    camera.position.copy(controls.target).sub(direction);

    controls.update();

}