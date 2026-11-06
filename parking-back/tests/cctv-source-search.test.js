const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const ParkingSourceFile = require("../api/models/parkingSourceFileModel");
const controller = require("../api/controllers/cctvSourceController");

const sourceFileId = new mongoose.Types.ObjectId();
const fileRoot = path.resolve(__dirname, "../../json_file/parking_slots");

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function createSourceFile(t, data) {
  const directory = await fs.mkdtemp(path.join(fileRoot, "cctv-search-test-"));
  const filename = path.join(directory, "source.json");
  await fs.writeFile(filename, JSON.stringify(data));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  t.mock.method(ParkingSourceFile, "findOne", async () => ({
    path: path.relative(path.resolve(__dirname, "../.."), filename),
    fileType: "cctv",
  }));
}

test("exact search matches camera number, IP, name, or RTSP link without opening a stream", async (t) => {
  const record = {
    NO: "CCTV-21",
    "IP ADDRESS": "192.0.2.21",
    "CAMERA NAME_NEW": "North Entrance",
    "ANPR&PTZ RTSP": "rtsp://camera.example/stream",
  };
  await createSourceFile(t, [record]);
  const probe = t.mock.method(controller, "probeCameraConnection", async () => ({
    online: true,
  }));

  const res = response();
  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: " NORTH ENTRANCE " } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    matches: [
      {
        recordIndex: 0,
        cameraNo: "CCTV-21",
        ipAddress: "192.0.2.21",
        sourceCameraName: "North Entrance",
        rtspLink: "rtsp://camera.example/stream",
      },
    ],
    camera: {
      recordIndex: 0,
      cameraNo: "CCTV-21",
      ipAddress: "192.0.2.21",
      sourceCameraName: "North Entrance",
      rtspLink: "rtsp://camera.example/stream",
    },
    status: "Unknown",
    message: "Camera matched. Open the live preview to check its connection.",
  });
  assert.equal(probe.mock.callCount(), 0);
});

test("the matcher checks each of the four source fields using exact values", () => {
  const record = {
    NO: "CCTV-21",
    "IP ADDRESS": "192.0.2.21",
    "CAMERA NAME_NEW": "North Entrance",
    "ANPR&PTZ RTSP": "rtsp://camera.example/stream",
  };
  for (const value of Object.values(record)) {
    assert.equal(controller.findCameraMatches([record], value).length, 1);
  }
  assert.equal(controller.findCameraMatches([record], "192.0.2").length, 0);
});

test("returns all exact duplicate matches without probing an arbitrary camera", async (t) => {
  await createSourceFile(t, [
    { NO: "A-1", "ANPR&PTZ RTSP": "rtsp://camera.example/a" },
    { NO: "A-1", "ANPR&PTZ RTSP": "rtsp://camera.example/b" },
  ]);
  const probe = t.mock.method(controller, "probeCameraConnection", async () => true);
  const res = response();

  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: "A-1" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.matches.length, 2);
  assert.equal(res.body.status, "Unknown");
  assert.equal(probe.mock.callCount(), 0);
});

test("returns Unknown with the matched details when RTSP is absent", async (t) => {
  await createSourceFile(t, [{ NO: "NO-STREAM", "CAMERA NAME_NEW": "No stream" }]);
  const probe = t.mock.method(controller, "probeCameraConnection", async () => true);
  const res = response();

  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: "NO-STREAM" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.camera.cameraNo, "NO-STREAM");
  assert.equal(res.body.status, "Unknown");
  assert.match(res.body.message, /RTSP link is missing/);
  assert.equal(probe.mock.callCount(), 0);
});

test("unmatched camera data returns Unknown without a connection probe", async (t) => {
  await createSourceFile(t, [{ NO: "CAM-1" }]);
  const probe = t.mock.method(controller, "probeCameraConnection", async () => true);
  const res = response();

  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: "CAM-2" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.matches, []);
  assert.equal(res.body.status, "Unknown");
  assert.equal(probe.mock.callCount(), 0);
});

test("a source record with a missing disk file returns a re-importable 404, not 500", async (t) => {
  t.mock.method(ParkingSourceFile, "findOne", async () => ({
    path: "json_file/parking_slots/source-file-that-does-not-exist.json",
    fileType: "cctv",
  }));
  const res = response();

  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: "CAM-1" } },
    res,
  );

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /missing from the server.*Re-import/);
});

test("the selected source record alone is used for a connection recheck", async (t) => {
  await createSourceFile(t, [
    { NO: "CAM-1", "ANPR&PTZ RTSP": "rtsp://camera.example/a" },
    { NO: "CAM-2", "ANPR&PTZ RTSP": "rtsp://camera.example/b" },
  ]);
  const probe = t.mock.method(controller, "probeCameraConnection", async (url) => {
    assert.equal(url, "rtsp://camera.example/b");
    return { online: false };
  });
  const res = response();

  await controller.probeCameraSource(
    { params: { fileId: String(sourceFileId), recordIndex: "1" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.camera.cameraNo, "CAM-2");
  assert.equal(res.body.status, "Offline");
  assert.equal(probe.mock.callCount(), 1);
});

test("live preview rejects a source record without a valid RTSP URL", async (t) => {
  await createSourceFile(t, [{ NO: "CAM-1", "ANPR&PTZ RTSP": "http://camera.example/stream" }]);
  const res = response();

  await controller.streamCameraPreview(
    {
      params: { fileId: String(sourceFileId), recordIndex: "0" },
      body: {},
      on() {},
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /no valid RTSP link/);
});

test("rejects malformed or oversized search requests", async () => {
  const res = response();
  await controller.searchCameraSource(
    { params: { fileId: String(sourceFileId) }, body: { query: " ".repeat(201) } },
    res,
  );
  assert.equal(res.statusCode, 400);
});
