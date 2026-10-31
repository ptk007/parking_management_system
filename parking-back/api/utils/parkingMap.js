function validateParkingMap(map) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v);
  const finite = (n, min, max) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const box = (v) =>
    object(v) &&
    finite(v.x, 0, 1000) &&
    finite(v.y, 0, 40000) &&
    finite(v.width, 0, 1000) &&
    finite(v.height, 0, 40000);
  if (
    !object(map) ||
    !Array.isArray(map.slots) ||
    map.slots.length > 5000 ||
    !object(map.layout) ||
    !Array.isArray(map.layout.shapes) ||
    map.layout.shapes.length > 300 ||
    !object(map.layout.positions)
  )
    throw new Error("Invalid parking map");
  const keys = new Set(),
    names = new Set();
  for (const slot of map.slots) {
    if (
      !object(slot) ||
      !Number.isSafeInteger(slot.number) ||
      slot.number < 1 ||
      typeof slot.zone !== "string" ||
      !slot.zone.trim() ||
      slot.zone.length > 64 ||
      !["available", "disabled", "occupied", "incoming"].includes(
        slot.status,
      ) ||
      (slot.name !== undefined &&
        (typeof slot.name !== "string" ||
          !slot.name.trim() ||
          slot.name.length > 100))
    )
      throw new Error("Invalid parking slot");
    const key = JSON.stringify([slot.zone, slot.number]);
    const name =
      slot.name ||
      (slot.zone === "default"
        ? String(slot.number)
        : `${slot.zone}-${slot.number}`);
    if (keys.has(key) || names.has(name))
      throw new Error("Duplicate parking slot");
    keys.add(key);
    names.add(name);
  }
  for (const [key, value] of Object.entries(map.layout.positions))
    if (!keys.has(key) || !box(value)) throw new Error("Invalid slot position");
  const ids = new Set();
  for (const shape of map.layout.shapes) {
    if (
      !box(shape) ||
      typeof shape.id !== "string" ||
      ids.has(shape.id) ||
      !["rectangle", "ellipse", "line", "text"].includes(shape.type) ||
      !/^#[a-f0-9]{6}$/i.test(shape.color) ||
      !finite(shape.opacity, 0.05, 1) ||
      typeof shape.text !== "string" ||
      shape.text.length > 100
    )
      throw new Error("Invalid map element");
    ids.add(shape.id);
  }
  const bg = map.layout.background;
  if (
    bg != null &&
    (!object(bg) ||
      typeof bg.name !== "string" ||
      bg.name.length > 255 ||
      typeof bg.dataUrl !== "string" ||
      bg.dataUrl.length > 2800000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(bg.dataUrl))
  )
    throw new Error("Invalid map background");
  return {
    version: 2,
    sourceName: String(map.sourceName || "Parking map").slice(0, 1000),
    slots: map.slots,
    layout: map.layout,
  };
}
module.exports = { validateParkingMap };
