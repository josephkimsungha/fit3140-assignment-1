const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

function checkBoard(board, playerNumber) {
  // check rows
  for (let i = 0; i < 9; i += 3) {
    const row = board.slice(i, i + 3);
    if (!row.includes(undefined) && row.every(number => number == playerNumber)) {
      return "win";
    }
  }

  // check columns
  for (let i = 0; i < 3; i++) {
    const column = board.filter((number, index) => index % 3 == i);
    if (column.length == 3 && column.every(number => number == playerNumber)) {
      return "win";
    }
  }

  // check diagonals
  const mainDiagonal = board.filter((number, index) => [0, 4, 8].indexOf(index) > -1);
  if (mainDiagonal.length == 3 && mainDiagonal.every(number => number == playerNumber)) {
    return "win";
  }

  const secondaryDiagonal = board.filter((number, index) => [2, 4, 6].indexOf(index) > -1);
  if (secondaryDiagonal.length == 3 && secondaryDiagonal.every(number => number == playerNumber)) {
    return "win";
  }

  if (!board.includes(undefined)) {
    return "draw";
  }

  return;
}

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
      gameBoards[roomNumber] = { board: new Array(9), playerTurn: 1, status: "waiting" };
      console.log(`Gameboard was made for room #${roomNumber}`);
    }

    if (io.sockets.adapter.rooms[roomsReference[socket.id].roomNumber].length > 1) {
      io.to(roomsReference[socket.id].roomNumber).emit("start");
      socket.to(roomsReference[socket.id].roomNumber).emit("newTurn");
      gameBoards[roomsReference[socket.id].roomNumber].status = "playing";
    }

    socket.on("move", moveId => {
      const { roomNumber, playerNumber } = roomsReference[socket.id];
      const { board, playerTurn, status } = gameBoards[roomNumber];

      if (status != "playing") {
        io.to(socket.id).emit("notPlaying");
      } else {
        // check player turn
        if (playerNumber != playerTurn) {
          io.to(socket.id).emit("wrongTurn");
        } else {
          // check validity of move
          if (board[moveId]) {
            io.to(socket.id).emit("alreadyPlayed");
          } else {
            // update board
            board[moveId] = playerNumber;

            // send move out to players
            io.to(roomsReference[socket.id].roomNumber).emit("move", moveId, roomsReference[socket.id].playerNumber);

            // check if the move was a winning move or game has ended in a tie
            switch (checkBoard(board, playerNumber)) {
              case "win":
                gameBoards[roomNumber].status = "finished";
                io.to(socket.id).emit("win");
                socket.to(roomNumber).emit("lose");
                break;
              case "draw":
                gameBoards[roomNumber].status = "finished";
                io.to(roomNumber).emit("draw");
                break;
              default:
                // change turn
                gameBoards[roomNumber].playerTurn = 1 + playerTurn % 2;
                socket.to(roomNumber).emit("newTurn");
            }
          }
        }
      }
    });

    socket.on("resetRequest", () => {
      const { roomNumber, playerNumber } = roomsReference[socket.id];
      roomsReference[socket.id].resetStatus = "pending";

      socket.to(roomNumber).emit("resetRequest");
    });

    socket.on("resetResponse", accepted => {
      const { roomNumber, playerNumber } = roomsReference[socket.id];
      if (accepted) {
        gameBoards[roomNumber] = { board: new Array(9), playerTurn: 1, status: "playing" };
        io.to(roomNumber).emit("reset");
        // player one must start
        if (playerNumber == 1) {
          io.to(socket.id).emit("newTurn");
        } else {
          socket.to(roomNumber).emit("newTurn");
        }
      } else {
        socket.to(roomNumber).emit("resetRejected");
      }
    });
  });
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
