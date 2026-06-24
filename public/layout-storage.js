// ============================================
// STRUCTURA — Layout Storage (Firestore)
// ============================================

const LayoutStorage = (function () {
  'use strict';

  const MAX_LAYOUTS = 20; // Free tier limit per user

  // --- Save layout ---
  async function saveLayout(name, layerData) {
    const user = StructuraAuth.getUser();
    if (!user) throw new Error('Must be signed in to save.');

    // Serialize layer data (strip runtime-only fields)
    const gridData = {};
    for (const [layerName, layer] of Object.entries(layerData)) {
      gridData[layerName] = {
        buildings: layer.buildings.map(b => ({
          buildingId: b.buildingId,
          x: b.x, y: b.y,
          w: b.w, h: b.h
        }))
      };
    }

    const doc = {
      ownerId: user.uid,
      name: name,
      gridData: gridData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      sharedWith: []
    };

    // Check if updating existing or creating new
    const existing = await getLayoutByName(name);
    if (existing) {
      await db.collection('layouts').doc(existing.id).update({
        gridData: doc.gridData,
        updatedAt: doc.updatedAt
      });
      return existing.id;
    } else {
      // Check count limit
      const count = await getLayoutCount();
      if (count >= MAX_LAYOUTS) {
        throw new Error(`Layout limit reached (${MAX_LAYOUTS}). Delete a layout first.`);
      }
      doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('layouts').add(doc);
      return ref.id;
    }
  }

  // --- Load layout ---
  async function loadLayout(layoutId) {
    const snap = await db.collection('layouts').doc(layoutId).get();
    if (!snap.exists) throw new Error('Layout not found.');
    return { id: snap.id, ...snap.data() };
  }

  // --- List user's layouts ---
  async function listLayouts() {
    const user = StructuraAuth.getUser();
    if (!user) return [];

    const snap = await db.collection('layouts')
      .where('ownerId', '==', user.uid)
      .orderBy('updatedAt', 'desc')
      .get();

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // --- Delete layout ---
  async function deleteLayout(layoutId) {
    await db.collection('layouts').doc(layoutId).delete();
  }

  // --- Rename layout ---
  async function renameLayout(layoutId, newName) {
    await db.collection('layouts').doc(layoutId).update({ name: newName });
  }

  // --- Helpers ---
  async function getLayoutByName(name) {
    const user = StructuraAuth.getUser();
    if (!user) return null;
    const snap = await db.collection('layouts')
      .where('ownerId', '==', user.uid)
      .where('name', '==', name)
      .limit(1)
      .get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async function getLayoutCount() {
    const user = StructuraAuth.getUser();
    if (!user) return 0;
    const snap = await db.collection('layouts')
      .where('ownerId', '==', user.uid)
      .get();
    return snap.size;
  }

  return { saveLayout, loadLayout, listLayouts, deleteLayout, renameLayout };
})();
