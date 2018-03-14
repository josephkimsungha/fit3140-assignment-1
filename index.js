const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.get("/", function(req, res){
  res.sendFile(__dirname + "/index.html");
});

let roomNumber = 0;
const roomsReference = {};
const gameBoards = {};

io.on("connection", socket => {
  if (io.sockets.adapter.rooms[roomNumber] && io.sockets.adapter.rooms[roomNumber].length > 1) roomNumber++;
  socket.join(roomNumber, () => {
    const playerNumber = io.sockets.adapter.rooms[roomNumber].length;
    roomsReference[socket.id] = { roomNumber, playerNumber };
    console.log(`${socket.id} joined room #${roomNumber} as player ${playerNumber}`); // When player 1 leaves, player 2 needs to be set to player 1 somehow

    if (!gameBoards[roomNumber]) {
      gameBoards[roomNumber] = new Array(9);
      console.log(`Gameboard was made for room #${roomNumber}`);
    }

    if (io.sockets.adapter.rooms[roomsReference[socket.id].roomNumber].length > 1) {
      io.to(roomsReference[socket.id].roomNumber).emit("start");
    }

    socket.on("move", moveId => {
      // check validity of move

      io.to(roomsReference[socket.id].roomNumber).emit("move", moveId, roomsReference[socket.id].playerNumber);

      // check if the move was a winning move
    });
  });
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
