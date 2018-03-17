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

let roomQueue = [1, 1, 2, 2, 3, 3]; // TODO make the rooms be a queue of [0, 0, 1, 1, 2, 2] etc. pop out a number when putting a player in. Push it back in when they disconnect. Add more numbers if you run out
const roomsReference = {};
const gameBoards = {};

io.on("connection", socket => {
  roomQueue.sort().reverse();
  const roomNumber = roomQueue.pop();
  if (roomQueue.length < 5) {
    const highestRoom = Math.max(...roomQueue, ...Object.keys(io.sockets.adapter.rooms).filter(room => Number(room)));
    for (let i = 1; i < 4; i++) {
      roomQueue.push(highestRoom + i);
      roomQueue.push(highestRoom + i);
    }
  }
  console.log(roomQueue);
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
      gameBoards[roomNumber].resetStatus = "pending";

      socket.to(roomNumber).emit("resetRequest");
    });

    socket.on("resetResponse", accepted => {
      const { roomNumber, playerNumber } = roomsReference[socket.id];
      if (gameBoards[roomNumber].resetStatus == "pending") {
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
      }
      gameBoards[roomNumber].resetStatus = null;
    });

    socket.on("disconnect", () => {
      console.log(`${socket.id} disconnected.`);
      const { roomNumber, playerNumber } = roomsReference[socket.id];

      gameBoards[roomNumber] = { board: new Array(9), playerTurn: 1, status: "waiting" };
      socket.to(roomNumber).emit("reset");
      socket.to(roomNumber).emit("lostConnection"); // TODO

      // if the other player was player 2, they are now player 1
      if (playerNumber == 1 && io.sockets.adapter.rooms[roomNumber]) {
        const otherPlayerId = Object.keys(io.sockets.adapter.rooms[roomNumber].sockets)[0];
        roomsReference[otherPlayerId].playerNumber = 1;
        console.log(`${otherPlayerId} has been promoted to player 1 of room #${roomNumber}.`);
      }

      // push the roomNumber back into the queue
      roomQueue.push(roomNumber);
    });
  });
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
