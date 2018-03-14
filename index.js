const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.get("/", function(req, res){
  res.sendFile(__dirname + "/index.html");
});

const startGame = function(player1, player2) {
  const gameBoard = new Array(9);
  let gameStatus = "playing";

  const playMove = function(player, moveId) {
    gameBoard[moveId] = player === "p1" ? "X" : "O";
    player1.emit("move", gameBoard);
    player2.emit("move", gameBoard);
  }

  player1.on("move", moveId => playMove("p1", moveId));
  player2.on("move", moveId => playMove("p2", moveId));
}

const queue = [];

io.on("connection", socket => {
  if (queue.length == 0) {
    queue.push(socket);
    console.log(socket.id, "joined the queue. Current queue:", queue.map(s => s.id));
  } else {
    const player1 = socket;
    const player2 = queue[0];
    queue.splice(0, 1);
    console.log(player1.id, "and", player2.id, "have joined a room. New queue:", queue.map(s => s.id));
    startGame(player1, player2);
  }

  socket.on("disconnect", () => {
    const index = queue.map(s => s.id).indexOf(socket.id);
    if (index > -1) {
      queue.splice(index, 1);
    }
    console.log(socket.id, "disconnected. New queue:", queue.map(s => s.id));
  })
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
