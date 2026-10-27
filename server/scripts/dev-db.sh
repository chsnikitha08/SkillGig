#!/bin/sh
# Starts a single-node MongoDB replica set for local development.
# Transactions (used for every money movement) require a replica set,
# and a plain `mongod` is standalone. Data lives in server/.mongo-data (gitignored).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)/.mongo-data"
PORT="${MONGO_PORT:-27018}"
mkdir -p "$DIR"
mongod --replSet rs0 --port "$PORT" --dbpath "$DIR" --bind_ip 127.0.0.1 --fork --logpath "$DIR/mongod.log"
sleep 1
mongosh --quiet --port "$PORT" --eval '
try { rs.status() } catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:'"$PORT"'" }] }) }
'
echo "Replica set running: MONGODB_URI=mongodb://127.0.0.1:$PORT/skillgig?replicaSet=rs0"
