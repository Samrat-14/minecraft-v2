import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { World } from '@/components/classes/world';
import { Player } from '@/components/classes/player';

import { resources } from '@/lib/blocks';

export const setupGUI = (scene: THREE.Scene, world: World, player: Player) => {
  // Initialize GUI
  const gui = new GUI();

  // Scene config
  const sceneFolder = gui.addFolder('Scene');
  sceneFolder.add(scene.fog as THREE.Fog, 'near', 1, 200, 1).name('Fog Near');
  sceneFolder.add(scene.fog as THREE.Fog, 'far', 1, 200, 1).name('Fog Far');

  // Player config
  const playerFolder = gui.addFolder('Player');
  playerFolder.add(player, 'maxSpeed', 1, 20, 1).name('Max Speed');
  playerFolder.add(player.cameraHelper, 'visible').name('Show Camera Helper');

  // Terrain config
  const terrainFolder = gui.addFolder('Terrain');
  terrainFolder.add(world, 'asyncLoading').name('Async Chunk Loading');
  terrainFolder.add(world, 'drawDistance', 0, 5, 1).name('Draw Distance');
  terrainFolder.add(world.params, 'seed', 0, 10000).name('Seed');
  terrainFolder.add(world.params.terrain, 'scale', 10, 100).name('Scale');
  terrainFolder.add(world.params.terrain, 'magnitude', 0, 1).name('Magnitude');
  terrainFolder.add(world.params.terrain, 'offset', 0, 1).name('Offset');

  // Resource config
  const resourcesFolder = gui.addFolder('Resources').close();
  resources.forEach((resource) => {
    resourcesFolder.add(resource, 'scarcity', 0, 1).name(resource.name);

    const scaleFolder = resourcesFolder.addFolder('Scale');
    scaleFolder.add(resource.scale, 'x', 10, 100).name('X Scale');
    scaleFolder.add(resource.scale, 'y', 10, 100).name('Y Scale');
    scaleFolder.add(resource.scale, 'z', 10, 100).name('Z Scale');
  });

  // Handle value change in GUI
  gui.onChange(() => {
    world.generate();
  });

  // Return GUI object to destroy in the cleanup function of useEffect
  return gui;
};
