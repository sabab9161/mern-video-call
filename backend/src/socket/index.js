import Notification from "../models/Notification.js";
import Room from "../models/Room.js";

export const configureSocket = (io) => {
  const usersByRoom = new Map();

  const getMembers = (roomId) => usersByRoom.get(roomId) || [];

  const setMembers = (roomId, members) => {
    if (members.length) usersByRoom.set(roomId, members);
    else usersByRoom.delete(roomId);
  };

  const isSocketHost = (socket) => Boolean(socket.data.isHost);

  const findTargetSocket = (roomId, targetPeerId) => {
    const member = getMembers(roomId).find((item) => item.peerId === targetPeerId);
    return member ? io.sockets.sockets.get(member.socketId) : null;
  };

  const leaveRoom = (socket) => {
    const { roomId, peerId } = socket.data;
    if (!roomId) return;

    const members = getMembers(roomId).filter((member) => member.socketId !== socket.id);
    setMembers(roomId, members);
    socket.to(roomId).emit("user-left", { socketId: socket.id, peerId });
    socket.to(roomId).emit("notification", {
      type: "user_left",
      title: "User left",
      message: `${socket.data.user?.name || "Someone"} left the meeting`
    });

    socket.data.roomId = null;
    socket.data.peerId = null;
    socket.data.user = null;
    socket.data.isHost = false;
  };

  io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, peerId, user }) => {
      try {
        const room = await Room.findOne({ roomId }).select("createdBy status");
        if (!room || room.status === "ended") {
          socket.emit("meeting-ended", { message: "This meeting is not available" });
          return;
        }

        const normalizedPeerId = peerId || null;
        const previousMember = getMembers(roomId).find((member) => member.socketId === socket.id);
        const members = getMembers(roomId).filter((member) => member.socketId !== socket.id);
        const isHost = room.createdBy.toString() === user?.id;
        const member = { socketId: socket.id, peerId: normalizedPeerId, user, isHost };

        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.peerId = normalizedPeerId;
        socket.data.user = user;
        socket.data.isHost = isHost;

        socket.emit("room-users", members.filter((item) => item.peerId));
        setMembers(roomId, [...members, member]);

        if (normalizedPeerId && previousMember?.peerId !== normalizedPeerId) {
          socket.to(roomId).emit("user-joined", member);
          socket.to(roomId).emit("notification", {
            type: "user_joined",
            title: "User joined",
            message: `${user?.name || "Someone"} joined the meeting`
          });
        }
      } catch (error) {
        console.error("join-room failed", error);
        socket.emit("admin-error", { message: "Unable to join room" });
      }
    });

    socket.on("send-message", ({ roomId, message }) => {
      const targetRoomId = roomId || socket.data.roomId;
      if (!targetRoomId || !message?.trim()) return;

      io.to(targetRoomId).emit("receive-message", {
        id: `${Date.now()}-${socket.id}`,
        message: message.trim(),
        user: socket.data.user,
        createdAt: new Date().toISOString()
      });
    });

    socket.on("send-reaction", ({ roomId, emoji, sender }) => {
      const targetRoomId = roomId || socket.data.roomId;
      if (!targetRoomId || !["\u2764\uFE0F", "\u270B"].includes(emoji)) return;

      io.to(targetRoomId).emit("receive-reaction", {
        id: `${Date.now()}-${socket.id}`,
        emoji,
        sender: sender || socket.data.user?.name || "Guest",
        createdAt: new Date().toISOString()
      });
    });

    socket.on("active-speaker", ({ roomId, peerId, speaking }) => {
      const targetRoomId = roomId || socket.data.roomId;
      if (!targetRoomId || !peerId) return;
      socket.to(targetRoomId).emit("active-speaker", { peerId, speaking });
    });

    socket.on("mute-participant", ({ roomId, targetPeerId }) => {
      if (!isSocketHost(socket)) {
        socket.emit("admin-error", { message: "Only the host can mute participants" });
        return;
      }

      const target = findTargetSocket(roomId || socket.data.roomId, targetPeerId);
      if (!target) return;
      target.emit("force-muted", { by: socket.data.user });
      io.to(roomId || socket.data.roomId).emit("participant-muted", { peerId: targetPeerId, by: socket.data.user });
    });

    socket.on("remove-participant", ({ roomId, targetPeerId }) => {
      if (!isSocketHost(socket)) {
        socket.emit("admin-error", { message: "Only the host can remove participants" });
        return;
      }

      const targetRoomId = roomId || socket.data.roomId;
      const target = findTargetSocket(targetRoomId, targetPeerId);
      if (!target) return;
      target.emit("force-removed", { message: "The host removed you from the meeting" });
      leaveRoom(target);
      target.leave(targetRoomId);
    });

    socket.on("end-meeting", async ({ roomId }) => {
      const targetRoomId = roomId || socket.data.roomId;
      if (!isSocketHost(socket)) {
        socket.emit("admin-error", { message: "Only the host can end the meeting" });
        return;
      }

      await Room.findOneAndUpdate({ roomId: targetRoomId }, { status: "ended" }).catch(() => {});
      io.to(targetRoomId).emit("meeting-ended", { message: "The host ended the meeting" });
      const room = await Room.findOne({ roomId: targetRoomId }).select("participants").catch(() => null);
      if (room?.participants?.length) {
        await Notification.insertMany(room.participants.map((userId) => ({
          user: userId,
          type: "meeting_ended",
          title: "Meeting ended",
          message: "The host ended the meeting",
          roomId: targetRoomId
        }))).catch(() => {});
      }
      getMembers(targetRoomId).forEach((member) => {
        const memberSocket = io.sockets.sockets.get(member.socketId);
        memberSocket?.leave(targetRoomId);
      });
      usersByRoom.delete(targetRoomId);
    });

    socket.on("leave-room", () => leaveRoom(socket));
    socket.on("disconnect", () => leaveRoom(socket));
  });
};
