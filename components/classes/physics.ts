import * as THREE from 'three';

import { Player } from '@/components/classes/player';
import { World } from '@/components/classes/world';

import { blocks } from '@/lib/blocks';

const collisionMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.2,
});
const collisionGeometry = new THREE.BoxGeometry(1.001, 1.001, 1.001);

const contactMaterial = new THREE.MeshBasicMaterial({
  wireframe: true,
  color: 0x00ff00,
});
const contactGeometry = new THREE.SphereGeometry(0.05, 6, 6);

export class Physics {
  simulationRate = 200;
  timestep = 1 / this.simulationRate;
  accumulator = 0;

  gravity = 32;

  helpers: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.helpers = new THREE.Group();
    scene.add(this.helpers);
  }

  // Moves the physics simukation forward in time 'dt'
  update(dt: number, player: Player, world: World) {
    this.accumulator += dt;

    while (this.accumulator >= this.timestep) {
      this.helpers.clear();
      player.velocity.y -= this.gravity * this.timestep;
      player.applyInputs(this.timestep);
      player.updateBoundsHelper();
      this.detectCollisions(player, world);
      this.accumulator -= this.timestep;
    }
  }

  detectCollisions(player: Player, world: World) {
    player.onGround = false;

    const candidates = this.broadPhase(player, world);
    const collisions = this.narrowPhase(candidates, player);

    // console.log('Broadphase:', candidates.length);
    // console.log('Narrowphase:', collisions.length);

    if (collisions.length > 0) {
      this.resolveCollisions(collisions, player);
    }
  }

  // Performs a rough search against the world to return all
  // possible blocks the player may be colliding with
  broadPhase(player: Player, world: World) {
    const candidates = [];

    // Get the extents of the player
    const extents = {
      x: {
        min: Math.floor(player.position.x - player.radius),
        max: Math.ceil(player.position.x + player.radius),
      },
      y: {
        min: Math.floor(player.position.y - player.height),
        max: Math.ceil(player.position.y),
      },
      z: {
        min: Math.floor(player.position.z - player.radius),
        max: Math.ceil(player.position.z + player.radius),
      },
    };

    // Loop through all blocks within the player's extents
    // If they aren't empty, then they are a possible collision candidate
    for (let x = extents.x.min; x <= extents.x.max; x++) {
      for (let y = extents.y.min; y <= extents.y.max; y++) {
        for (let z = extents.z.min; z <= extents.z.max; z++) {
          const block = world.getBlock(x, y, z);
          if (block && block.id !== blocks.empty.id) {
            const blockPos = { x, y, z };
            candidates.push(blockPos);
            this.addCollisionHelper(blockPos);
          }
        }
      }
    }

    return candidates;
  }

  // Narrows down the blocks found in the broad-phase to the set
  // of blocks the player is actually colliding with
  narrowPhase(candidates: { x: number; y: number; z: number }[], player: Player) {
    const collisions = [];

    for (const block of candidates) {
      // Get the point on the block that is closest to the center of the player's bounding cylinder
      const p = player.position;
      const closestPoint = {
        x: Math.max(block.x - 0.5, Math.min(p.x, block.x + 0.5)),
        y: Math.max(block.y - 0.5, Math.min(p.y - player.height / 2, block.y + 0.5)),
        z: Math.max(block.z - 0.5, Math.min(p.z, block.z + 0.5)),
      };

      // Determine if point is inside player's bounding cylinder
      // Get distance along each axis between closest point and the center of the player's bounding cylinder
      const dx = closestPoint.x - player.position.x;
      const dy = closestPoint.y - (player.position.y - player.height / 2);
      const dz = closestPoint.z - player.position.z;

      if (this.pointInPlayerBoundingCylinder(closestPoint, player)) {
        // Compute the overlap between the point and the player's bounding
        // cylinder along the y-axis and in the xz-plane
        const overlapY = player.height / 2 - Math.abs(dy);
        const overlapXZ = player.radius - Math.sqrt(dx * dx + dz * dz);

        // Compute the normal of the collision (pointing away from the contact point)
        // and the overlap bewteen the point and the player's bounding cylinder
        let normal, overlap;
        if (overlapY < overlapXZ) {
          normal = new THREE.Vector3(0, -Math.sign(dy), 0);
          overlap = overlapY;
          player.onGround = true;
        } else {
          normal = new THREE.Vector3(-dx, 0, -dz).normalize();
          overlap = overlapXZ;
        }

        collisions.push({
          block,
          contactPoint: closestPoint,
          normal,
          overlap,
        });

        this.addContactPointHelper(closestPoint);
      }
    }

    return collisions;
  }

  // Resolves each of the collisions found in the narrow-phase
  resolveCollisions(
    collisions: {
      block: { x: number; y: number; z: number };
      contactPoint: { x: number; y: number; z: number };
      normal: THREE.Vector3;
      overlap: number;
    }[],
    player: Player
  ) {
    // Resolve the collisions in order of the smallest overlap to the largest
    collisions.sort((a, b) => {
      return a.overlap - b.overlap;
    });

    for (const collision of collisions) {
      // We need to re-check if the contact point is inside the player bounding cylinder
      // for each collision since the player position is updated after each collision is resolved
      if (!this.pointInPlayerBoundingCylinder(collision.contactPoint, player)) continue;

      // 1) Adjust position of player so the block and player are no longer overlapping
      let deltaPosiiton = collision.normal.clone();
      deltaPosiiton.multiplyScalar(collision.overlap);
      player.position.add(deltaPosiiton);

      // 2) Negate player's velocity along the collision normal
      // Get the magnitude of the player's velocity along the collision normal
      let magnitude = player.worldVelocity.dot(collision.normal);
      // Remove the part of the velocity from the player's velocity
      let velocityAdjustment = collision.normal.clone().multiplyScalar(magnitude);

      // Apply the velocity to the player
      player.applyWorldDeltaVelocity(velocityAdjustment.negate());
    }
  }

  // Visualizes the block the player is colliding with
  addCollisionHelper(block: { x: number; y: number; z: number }) {
    const blockMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    blockMesh.position.copy(block);
    this.helpers.add(blockMesh);
  }

  // Visualizes the contact at the point 'p'
  addContactPointHelper(p: { x: number; y: number; z: number }) {
    const contactMesh = new THREE.Mesh(contactGeometry, contactMaterial);
    contactMesh.position.copy(p);
    this.helpers.add(contactMesh);
  }

  // Returns true if the point 'p' is inside the player's bounding cylinder
  pointInPlayerBoundingCylinder(p: { x: number; y: number; z: number }, player: Player) {
    const dx = p.x - player.position.x;
    const dy = p.y - (player.position.y - player.height / 2);
    const dz = p.z - player.position.z;
    const r_sq = dx * dx + dz * dz;

    // Check if contact point is inside the player's bounding cylinder
    return Math.abs(dy) < player.height / 2 && r_sq < player.radius * player.radius;
  }
}
