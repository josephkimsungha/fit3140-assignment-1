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
    roomsReference[socket.id] = roomNumber;
    console.log(`${socket.id} joined room #${roomNumber}`);

    if (!gameBoards[roomNumber]) {
      gameBoards[roomNumber] = new Array(9);
      console.log(`Gameboard was made for room #${roomNumber}`);
    }

    if (io.sockets.adapter.rooms[roomsReference[socket.id]].length > 1) {
      io.to(roomsReference[socket.id]).emit("start");
    }

    socket.on("move", moveId => {
      // check validity of move

      io.to(roomsReference[socket.id]).emit("move", moveId, socket.id);
      
      // check if the move was a winning move
    });
  });
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
