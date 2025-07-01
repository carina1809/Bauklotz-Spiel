// ===============================
// 1. A-Frame Komponente: block-builder
// ===============================

// Komponente für das Bauen und Löschen von Blöcken erstellen
AFRAME.registerComponent('block-builder', {
  schema: {
    color: {type: 'string', default: '#FF0000'}, // Standardfarbe: Rot
    size: {type: 'number', default: 1}           // Standardgröße: 1
  },

  // Wird beim Start einmal ausgeführt
  init: function () {
    this.blocks = []; // Hier speichern wir alle gebauten Blöcke

    // Linksklick: Block bauen, Rechtsklick: Block löschen
    window.addEventListener('mousedown', this.onMouseDown.bind(this));

    // Rechtsklick-Menü im Browser deaktivieren (damit wir Blöcke löschen können)
    window.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  },

  // Wird bei jedem Mausklick ausgeführt
  onMouseDown: function (event) {
    if (event.button === 0) { // Linke Maustaste
      this.addBlockAtCursor();
    } else if (event.button === 2) { // Rechte Maustaste
      this.removeBlockAtCursor();
    }
  },

  // Block an der aktuellen Blickrichtung platzieren
  addBlockAtCursor: function () {
    const camera = this.el.sceneEl.camera;
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), direction);

    // Prüfe, ob wir auf ein Objekt schauen (z.B. Boden oder Block)
    const intersects = raycaster.intersectObjects(
      this.el.sceneEl.object3D.children, true
    );

    let position;
    if (intersects.length > 0) {
      // Höhe des getroffenen Objekts bestimmen
      let hitObj = intersects[0].object;
      let hitHeight = this.data.size;
      // Falls das getroffene Objekt ein Block ist, nimm dessen Höhe
      if (hitObj.el && hitObj.el.tagName === 'A-BOX') {
        const scale = hitObj.el.getAttribute('scale');
        hitHeight = scale ? scale.y : this.data.size;
      }
      // Block exakt auf das getroffene Objekt setzen
      position = intersects[0].point.clone().add(new THREE.Vector3(0, hitHeight / 2, 0));
    } else {
      // Sonst Block 3 Einheiten vor die Kamera setzen
      position = camera.getWorldPosition(new THREE.Vector3()).add(direction.multiplyScalar(3));
    }

    // Position auf das Raster runden (damit die Blöcke schön nebeneinander sitzen)
    position.x = Math.round(position.x / this.data.size) * this.data.size;
    position.y = Math.round(position.y / this.data.size) * this.data.size;
    position.z = Math.round(position.z / this.data.size) * this.data.size;

    // Block nie unter den Boden setzen
    if (position.y < this.data.size / 2) {
      position.y = this.data.size / 2;
    }

    // Prüfen, ob an dieser Stelle schon ein Block ist
    const exists = this.blocks.some(block => {
      const pos = block.getAttribute('position');
      return (
        Math.abs(pos.x - position.x) < 0.01 &&
        Math.abs(pos.y - position.y) < 0.01 &&
        Math.abs(pos.z - position.z) < 0.01
      );
    });
    if (exists) return; // Kein Block bauen, wenn schon einer da ist

    // Neuen Block erstellen und zur Szene hinzufügen
    const block = document.createElement('a-box');
    block.setAttribute('color', this.data.color);
    block.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
    block.setAttribute('scale', {x: this.data.size, y: this.data.size, z: this.data.size});
    this.el.sceneEl.appendChild(block);
    this.blocks.push(block); // Block merken
  },

  // Block unter dem Cursor löschen
  removeBlockAtCursor: function () {
    const camera = this.el.sceneEl.camera;
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), direction);

    const intersects = raycaster.intersectObjects(
      this.el.sceneEl.object3D.children, true
    );

    // Suche nach dem ersten Block (a-box), der getroffen wurde
    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      // Finde das zugehörige a-box Element
      let el = obj.el;
      if (el && el.tagName === 'A-BOX') {
        this.el.sceneEl.removeChild(el); // Block aus Szene entfernen
        this.blocks = this.blocks.filter(b => b !== el); // Block aus Liste entfernen
        break;
      }
    }
  }
});

// ===============================
// 2. UI- und Steuerungs-Logik
// ===============================

document.addEventListener('DOMContentLoaded', function() {
  // --- Spielanleitung ein-/ausklappen ---
  // Elemente holen
  const btn = document.getElementById('toggle-instruction');
  const content = document.getElementById('instruction-content');
  const instruction = document.getElementById('instruction');

  // Beim Klick auf den Button Anleitung ein- oder ausklappen
  btn.addEventListener('mousedown', function(e) {
    e.stopPropagation(); // Verhindert, dass das Event weitergegeben wird!
  });

  btn.addEventListener('click', function() {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      instruction.classList.add('open');
    } else {
      content.style.display = 'none';
      instruction.classList.remove('open');
    }
  });

  // --- Farbauswahl NUR über Tastatur (1-5) ---
  // Alle Farbauswahl-Buttons holen
  const colorBtns = document.querySelectorAll('.color-btn');
  // Das Entity mit der block-builder-Komponente holen
  const blockBuilder = document.querySelector('[block-builder]');
  // Standardfarbe (rot, Taste 5) markieren
  colorBtns[4].classList.add('selected');

  // Wenn eine Zahlentaste (1-5) gedrückt wird, Farbe wechseln
  document.addEventListener('keydown', function(e) {
    if (e.key >= '1' && e.key <= '5') {
      const idx = parseInt(e.key, 10) - 1;
      colorBtns.forEach(b => b.classList.remove('selected'));
      colorBtns[idx].classList.add('selected');
      // Die Farbe in der block-builder-Komponente setzen
      if (blockBuilder && blockBuilder.components['block-builder']) {
        blockBuilder.components['block-builder'].data.color = colorBtns[idx].dataset.color;
      }
    }
  });

  // --- Kamera-Höhe mit + und - steuern ---
  // Kamera-Entity holen
  const camera = document.querySelector('a-camera');
  // Bei + oder - die Kamera nach oben oder unten bewegen
  document.addEventListener('keydown', function(e) {
    const pos = camera.getAttribute('position');
    if (e.key === '+' || e.key === '=') {
      camera.setAttribute('position', {x: pos.x, y: pos.y + 0.2, z: pos.z});
    }
    if (e.key === '-' || e.key === '_') {
      camera.setAttribute('position', {x: pos.x, y: Math.max(0.2, pos.y - 0.2), z: pos.z});
    }
  });

  // --- Tageszeit (Sky) wechseln ---
  // Sky- und Sonne/Mond-Element holen
  const sky = document.getElementById('sky');
  const sphere = document.getElementById('toggle-sky');
  let isDay = true; // Start: Tag

  // Beim Klick auf die Sonne/Mond das Hintergrundbild und die Farbe wechseln
  sphere.addEventListener('click', function() {
    if (isDay) {
      sky.setAttribute('src', 'Bilder/night.png');
      sphere.setAttribute('color', '#FFFFFF');
    } else {
      sky.setAttribute('src', 'Bilder/day.jpeg');
      sphere.setAttribute('color', '#FFD700');
    }
    isDay = !isDay; // Zustand umschalten
  });
});