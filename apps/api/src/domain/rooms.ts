import type { RoomStatus } from "@hotel-os/shared";

export function validateRoomConfigStatus(status?: RoomStatus, openStayCount = 0) {
  if (status === "OCCUPIED" && openStayCount === 0) {
    return "Use check-in to mark a room as occupied";
  }
  if (status && status !== "OCCUPIED" && openStayCount > 0) {
    return "Room has an open stay and cannot be marked as available, cleaning, or maintenance";
  }
  return null;
}

export function validateRoomStatusTransition(targetStatus: RoomStatus, openStayCount: number) {
  if (targetStatus === "OCCUPIED" && openStayCount === 0) {
    return "Use check-in to mark a room as occupied";
  }
  if (targetStatus !== "OCCUPIED" && openStayCount > 0) {
    return "Room has an open stay and cannot be marked as available, cleaning, or maintenance";
  }
  return null;
}

