import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { World } from '@/components/classes/world';
import { Tool } from '@/components/classes/tool';

import { blocks } from '@/lib/blocks';

const CENTER_SCREEN = new THREE.Vector2();

export class Player {
  radius = 0.5;
  height = 1.75;
  jumpSpeed = 10;
  onGround = false;

  maxSpeed = 10;
  input = new THREE.Vector3();
  velocity = new THREE.Vector3();
  #worldVelocity = new THREE.Vector3();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  controls = new PointerLockControls(this.camera, document.body);
  cameraHelper = new THREE.CameraHelper(this.camera);

  boundsHelper: THREE.Mesh;
  selectionHelper: THREE.Mesh;

  raycaster = new THREE.Raycaster(undefined, undefined, 0, 3);
  selectedCoords: THREE.Vector3 | null = null;
  activeBlockId = blocks.empty.id;

  tool = new Tool();

  constructor(scene: THREE.Scene) {
    this.camera.position.set(16, 16, 16);
    this.camera.layers.enable(1);
    scene.add(this.camera);
    // scene.add(this.cameraHelper);

    this.camera.add(this.tool);

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // Wireframe mesh visualizing the player's bounding cylinder
    this.boundsHelper = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16),
      new THREE.MeshBasicMaterial({ wireframe: true })
    );
    // scene.add(this.boundsHelper);

    const selectionMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      color: 0xffff00,
    });
    const selectionGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.selectionHelper = new THREE.Mesh(selectionGeometry, selectionMaterial);
    scene.add(this.selectionHelper);

    this.raycaster.layers.set(0);
  }

  get worldVelocity() {
    this.#worldVelocity.copy(this.velocity);
    this.#worldVelocity.applyEuler(new THREE.Euler(0, this.camera.rotation.y, 0));
    return this.#worldVelocity;
  }

  update(world: World) {
    this.updateRaycaster(world);
    this.tool.update();
  }

  updateRaycaster(world: World) {
    this.raycaster.setFromCamera(CENTER_SCREEN, this.camera);
    const intersections = this.raycaster.intersectObject(world, true);

    if (intersections.length > 0) {
      const intersection = intersections[0];

      // Get the position of the chunk that the block is contained in
      const chunk = intersection.object.parent!;

      // Get transformation matrix of the intersected block
      const blockMatrix = new THREE.Matrix4();
      (intersection.object as THREE.InstancedMesh).getMatrixAt(intersection.instanceId!, blockMatrix);

      // Extract the position from the block's transformation matrix
      // and store it in selectedCoords
      this.selectedCoords = chunk.position.clone();
      this.selectedCoords.applyMatrix4(blockMatrix);

      // If we are adding a block to the world, move the selection indicator
      // to the nearest adjacent block
      if (this.activeBlockId !== blocks.empty.id) {
        this.selectedCoords.add(intersection.normal!);
      }

      this.selectionHelper.position.copy(this.selectedCoords);
      this.selectionHelper.visible = true;

      // console.log(this.selectedCoords);
    } else {
      this.selectedCoords = null;
      this.selectionHelper.visible = false;
    }
  }

  // Applies a change in velocity 'dv' that is specified in the world frame
  applyWorldDeltaVelocity(dv: THREE.Vector3) {
    dv.applyEuler(new THREE.Euler(0, -this.camera.rotation.y, 0));
    this.velocity.add(dv);
  }

  applyInputs(dt: number) {
    if (this.controls.isLocked) {
      this.velocity.x = this.input.x;
      this.velocity.z = this.input.z;
      this.controls.moveRight(this.velocity.x * dt);
      this.controls.moveForward(this.velocity.z * dt);
      this.position.y += this.velocity.y * dt;

      const playerPositionContainer = document.getElementById('player-position');
      if (playerPositionContainer) {
        playerPositionContainer.innerHTML = this.toString();
      }
    }
  }

  // Updates the position of the player's bounding cylinder helper
  updateBoundsHelper() {
    this.boundsHelper.position.copy(this.position);
    this.boundsHelper.position.y -= this.height / 2;
  }

  // Returns current world position of the player
  get position() {
    return this.camera.position;
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.controls.isLocked) {
      this.controls.lock();
    }

    switch (event.code) {
      case 'Digit0':
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6':
      case 'Digit7':
      case 'Digit8':
        document.getElementById(`toolbar-${this.activeBlockId}`)?.classList.remove('selected');
        this.activeBlockId = Number(event.key);
        document.getElementById(`toolbar-${this.activeBlockId}`)?.classList.add('selected');

        // Only show the tool when it is currently active
        this.tool.visible = this.activeBlockId === 0;
        break;
      case 'KeyW':
        this.input.z = this.maxSpeed;
        break;
      case 'KeyA':
        this.input.x = -this.maxSpeed;
        break;
      case 'KeyS':
        this.input.z = -this.maxSpeed;
        break;
      case 'KeyD':
        this.input.x = this.maxSpeed;
        break;
      case 'KeyR':
        this.position.set(32, 16, 32);
        this.velocity.set(0, 0, 0);
        break;
      case 'Space':
        if (this.onGround) {
          this.velocity.y += this.jumpSpeed;
        }
        break;
    }
  }

  onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
        this.input.z = 0;
        break;
      case 'KeyA':
        this.input.x = 0;
        break;
      case 'KeyS':
        this.input.z = 0;
        break;
      case 'KeyD':
        this.input.x = 0;
        break;
    }
  }

  toString() {
    let str = '';
    str += `X: ${this.position.x.toFixed(3)} `;
    str += `Y: ${this.position.y.toFixed(3)} `;
    str += `Z: ${this.position.z.toFixed(3)} `;
    return str;
  }
}
