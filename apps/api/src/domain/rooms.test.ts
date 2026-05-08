import assert from "node:assert/strict";
import test from "node:test";
import { validateRoomConfigStatus, validateRoomStatusTransition } from "./rooms.js";

test("occupied is only entered through check-in", () => {
  assert.equal(validateRoomConfigStatus("OCCUPIED", 0), "Use check-in to mark a room as occupied");
  assert.equal(validateRoomStatusTransition("OCCUPIED", 0), "Use check-in to mark a room as occupied");
});

test("open stays block manual non-occupied transitions", () => {
  assert.equal(
    validateRoomStatusTransition("AVAILABLE", 1),
    "Room has an open stay and cannot be marked as available, cleaning, or maintenance"
  );
  assert.equal(validateRoomStatusTransition("OCCUPIED", 1), null);
});

