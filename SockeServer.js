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
    let userInfo = onlineUsers.find(u => u.socketId === data.from);
    io.to(userInfo.socketId).emit("callUser", {
      signal: data.signal,
      from: data.from,
      name: data.name,
      picture: data.picture,
      email: data.email,
      to: socket.id
    });

  });

  socket.on("callDeclined", (id) => {
    socket.to(id).emit("callDeclined");
  });

  socket.on("callAccepted", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("get-online-users", onlineUsers);
  })

  //         socket.on('offer', (data) => {
  //           io.to(data.receiver).emit('offer', data);
  //         });

  //         socket.on('answer', (data) => {
  //           io.to(data.receiver).emit('answer', data);
  //         });

  //         socket.on('ice-candidate', (data) => {
  //           io.to(data.receiver).emit('ice-candidate', data);
  //         });

  //         socket.on("sendMessage", async (data) => {
  //           const { sender, receiver, message } = data;
  //           const newMessage = { sender, receiver, message, timestamp: new Date() };
  //           await messageCollection.insertOne(newMessage);
  //           io.to(message.receiver).emit("newMessage", newMessage);
  //         });

  //         socket.on('disconnect', () => {
  //           console.log('user disconnected');
  //         });
};
