let onlineUsers = [];

module.exports = function (socket, io) {
  socket.on("join", (user) => {
    socket.join(user);
    if (onlineUsers.filter(u => u.email === user.email && u.name === user.name).length === 0) {
      onlineUsers.push({...user, socketId: socket.id});
    }

    io.emit("get-online-users", onlineUsers);

    io.to(socket.id).emit("set socket", socket.id);

  });

  socket.on("callUser", (data) => {
    let userId = data.userToCall;
    let userSocketInfo = onlineUsers.find(user => user.socketId === userId);
    io.to(userSocketInfo.socketId).emit("callUser", {
      signal: data.signal,
      from: socket.id,
      name: data.name,
      picture: data.picture,
    });

  });

  socket.on("callDeclined", (id) => {
    socket.to(id).emit("callDeclined");
  });

  socket.on("callEnded", (id) => {
    socket.to(id).emit("callEnded");
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("get-online-users", onlineUsers);
  })
};


